// Check the numbers of "Jacobians, Singular Values and Dynamics" (jacobian/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each widget the way a reader would (following the
// "先玩 / Try first" prompt literally, including dragging the hand along the table and a dot of the SVD widget with the
// mouse) and compares the readouts with the numbers quoted in the "你会看到 / What you will see" lines. Numbers a
// readout does not show (which term is largest at a given instant, when a joint first hits its cap, the figures'
// numbers) are recomputed with the page's own engine, window.TB, inside the page.
// Part B recomputes, with the same engine, the numbers quoted in the formula cards, the paragraphs and the quiz.
//   usage: node check.js /absolute/path/to/jacobian/index.html      (takes about 4 minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/jacobian/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(600);
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined && !cond ? '   [' + got + ']' : '')); };
  const norm = s => s.replace(/[\u2060\u200b]/g, '').replace(/\s+/g, ' ').replace(/\u2212/g, '-').trim();
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(600); },
    // click a control by its label; nth picks the n-th control with exactly that label
    click: async (label, wait, nth) => { const r = await p.evaluate(([i, l, nth]) => { const nm = s => s.replace(/\s+/g, ' ').trim();
        const els = [...document.getElementById(i).querySelectorAll('button,[role=button],label')].filter(e => e.getClientRects().length > 0);
        let e; if (nth !== null) e = els.filter(x => nm(x.innerText) === l)[nth];
        else e = els.find(x => nm(x.innerText) === l) || els.find(x => nm(x.innerText).startsWith(l)) || els.find(x => nm(x.innerText).includes(l));
        if (!e) return 'no control "' + l + '"'; e.click(); return 'ok' }, [id, label, nth === undefined ? null : nth]);
      if (r !== 'ok') { bad++; log.push('FAIL ' + id + ': ' + r); } await p.waitForTimeout(wait || 250); },
    set: async (inp, v, wait) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(wait || 250); },
    val: (inp) => p.evaluate(i => { const e = document.getElementById(i); return e.value + ' [' + e.min + '…' + e.max + ']'; }, inp),
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .met')].map(m => m.innerText).join(' ## '), id).then(norm),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    text: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll(s ? '#' + i + ' ' + s : '#' + i)].filter(e => e.getClientRects().length > 0).map(m => m.innerText).join(' ## '), [id, sel || '']).then(norm),
    // wait until the status line and the readouts have stopped changing (an animation has finished)
    settle: async function () { let last = '', same = 0; for (let k = 0; k < 100; k++) { await p.waitForTimeout(300); const s = await this.status() + (await this.met()); if (s === last) { if (++same >= 5) break; } else { same = 0; last = s; } } },
    // click a canvas at (fx(width), y) in CSS pixels of the canvas
    cvclick: async (sel, fx, y) => { let r; for (let k = 0; k < 6; k++) { r = await p.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, sel); await p.waitForTimeout(250); }
      await p.mouse.click(r.x + fx(r.w), r.y + y); await p.waitForTimeout(300); },
  });
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const sec = t => log.push('-- ' + t);
  // put the hand at world x on a side-view canvas: the widgets map pixel -> x with TB.tview(6, 6, w - 12, h - 12, ...VB)
  const handX = async (cvId, VB, x) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const pt = await p.evaluate(([i, VB, x]) => { const cv = document.getElementById(i), r = cv.getBoundingClientRect(), V = TB.tview(6, 6, cv.clientWidth - 12, cv.clientHeight - 12, ...VB); return [r.left + V.X(x), r.top + V.Y(0)]; }, [cvId, VB, x]);
    await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0], pt[1]); await p.mouse.up(); await p.waitForTimeout(200); };
  // drag inside a canvas from one canvas pixel to another
  const dragPx = async (cvId, a, c) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const r = await p.evaluate(i => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left, q.top]; }, cvId);
    await p.mouse.move(r[0] + a[0], r[1] + a[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(r[0] + a[0] + (c[0] - a[0]) * k / 6, r[1] + a[1] + (c[1] - a[1]) * k / 6); await p.mouse.up(); await p.waitForTimeout(250); };
  // run a snippet inside the page, where the engine TB lives; the snippet is the body of a function
  const EV = (fn, arg) => p.evaluate(fn, arg);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-')) : NaN; };
  // the visible text of a section, folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);

  // ======================= Part A: the widgets, operated as each "Try first" prompt says =======================
  // ---- step 0 · the task
  { sec('step 0 · task'); const w = W('task'); await w.show(); let s = '';
    for (let k = 0; k < 6; k++) { await w.click('下一帧', 350); s = await w.status(); if (s.startsWith('① 起点')) break; }
    ok('task, frame ①: hand at 0.36 m, shoulder supplies 6.7 N·m = 10.2 to hold the arm minus 3.6 from the press', has(s, '① 起点：手在 x = 0.36 m', '肩还是要出 6.7 N·m', '要 10.2 N·m', '其中 3.6 N·m'), s);
    await w.click('下一帧', 350); s = await w.status();
    ok('task, frame ②: hand at 0.58 m moving right at 0.43 m/s; rates shoulder -0.47, elbow 1.11, wrist 0.43 rad/s; the shoulder turns back', has(s, '② 往右最快：手走到 x = 0.58 m，速度 0.43 m/s', '肩 -0.47、肘 1.11、腕 0.43 rad/s', '手往右，肩反而往回转'), s);
    await w.click('下一帧', 350); s = await w.status();
    ok('task, frame ③: hand at 0.80 m, shoulder supplies 8.2 N·m (15.4 to hold the arm, 8.0 taken away by the press)', has(s, '③ 最远处：手在 x = 0.80 m', '肩要出 8.2 N·m', '要 15.4 N·m', '变成了 8.0 N·m'), s);
    await w.click('下一帧', 350); s = await w.status();
    ok('task, frame ④: hand again at 0.58 m, rates reversed', has(s, '④ 往回走：手又到了 x = 0.58 m'), s);
    const r = await EV(() => { const K = TB, T = K.WIPE.T, fr = [0, .25, .5, .75].map(f => { const p = K.plan(f * T), Fe = [-K.CONTACT.mu * K.WIPE.F * Math.tanh(p.v / K.CONTACT.vs), K.WIPE.F]; return K.rnea(p.q, p.qd, p.qdd, Fe, true); });
      let q1max = -9, q1min = 9; for (let k = 1; k < 1600; k++) { const p = K.plan(k * .001); if (p.v > .01) { q1max = Math.max(q1max, p.qd[0]); q1min = Math.min(q1min, p.qd[0]); } } return { fr, q1max, q1min }; });
    ok('task (engine): all the way to the right the shoulder rate is negative (between ' + r.q1min.toFixed(2) + ' and ' + r.q1max.toFixed(3) + ' rad/s)', r.q1max < 0 && r.q1min > -0.7, JSON.stringify(r));
    ok('task (engine): shoulder torque in the four frames 6.7, 7.4, 8.2, 5.9 N·m; elbow and wrist always below 1.4 N·m', r.fr.map(t => t[0].toFixed(1)).join(' ') === '6.7 7.4 8.2 5.9' && r.fr.every(t => Math.abs(t[1]) < 1.4 && Math.abs(t[2]) < 1.4), JSON.stringify(r.fr));
    ok('lead: 1 rad = 57.3°', (180 / Math.PI).toFixed(1) === '57.3'); }

  // ---- figure of step 0: the arm at x = 0.55 m
  { sec('figure of step 0 · the arm and its coordinates'); const r = await EV(() => { const K = TB, q = K.qAt(.55), F = K.fk(q); return { q: q.map(v => v * 180 / Math.PI), P: F.P, L: K.L, B: K.B, wipe: [K.WIPE.x0, K.WIPE.x1], reach: Math.sqrt(K.REACH * K.REACH - K.B[1] * K.B[1]), MS: K.MS }; });
    ok('figure: joint angles 30.3°, -91.4°, -15.2° with the hand at 0.55 m', r.q.map(v => v.toFixed(1)).join(' ') === '30.3 -91.4 -15.2', r.q.join(' '));
    ok('figure: elbow at (0.345, 0.452), wrist at (0.514, 0.146), hand at (0.550, 0.000)', near(r.P[1][0], .345, 6e-4) && near(r.P[1][1], .452, 6e-4) && near(r.P[2][0], .514, 6e-4) && near(r.P[2][1], .146, 6e-4) && near(r.P[3][0], .55, 1e-6) && Math.abs(r.P[3][1]) < 1e-6, JSON.stringify(r.P));
    ok('figure: links 40, 35, 15 cm (2.0, 1.5, 0.5 kg), post 25 cm, wiping range 36 to 80 cm, farthest reach 86.5 cm', r.L.join(' ') === '0.4 0.35 0.15' && r.MS.join(' ') === '2 1.5 0.5' && r.B[1] === .25 && r.wipe.join(' ') === '0.36 0.8' && (r.reach * 100).toFixed(1) === '86.5', JSON.stringify(r)); }

  // ---- step 1 · the Jacobian
  { sec('step 1 · jac'); const w = W('jac'); await w.show(); const VB = [-.10, .98, -.08, .66]; let m;
    await handX('jac-cv', VB, .36); m = await w.met(); ok('jac, hand at 36 cm: shoulder column 43.8 cm long', has(m, '手在 x = 0.360 m', '肩到手的距离 43.8 cm'), m);
    await w.click('肘', 200); m = await w.met(); ok('jac, 36 cm: elbow column 49.1 cm', has(m, '肘到手的距离 49.1 cm'), m);
    await w.click('腕', 200); m = await w.met(); ok('jac, 36 cm: wrist column 15.0 cm', has(m, '腕到手的距离 15.0 cm'), m);
    await handX('jac-cv', VB, .80); m = await w.met(); ok('jac, hand at 80 cm: wrist column still 15.0 cm', has(m, '手在 x = 0.800 m', '腕到手的距离 15.0 cm'), m);
    await w.click('肘', 200); m = await w.met(); ok('jac, 80 cm: elbow column 50.0 cm', has(m, '肘到手的距离 50.0 cm'), m);
    await w.click('肩', 200); m = await w.met(); ok('jac, 80 cm: shoulder column 83.8 cm', has(m, '肩到手的距离 83.8 cm'), m);
    const r = await EV(() => { const K = TB; let lo = 9, hi = 0; for (let x = .36; x <= .8001; x += .002) { const F = K.fk(K.qAt(x)), d = Math.hypot(F.h[0] - F.P[1][0], F.h[1] - F.P[1][1]); lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; });
    ok('jac (engine): between 36 and 80 cm the elbow column stays between 49.1 and 50.0 cm', (r[0] * 100).toFixed(1) === '49.1' && (r[1] * 100).toFixed(1) === '50.0', r.join(' '));
    await w.set('jac-a', 1, 200); let s = await w.status(); m = await w.met();
    ok('jac, shoulder turned 1° at 80 cm: J predicts 14.6 mm, off by 0.13 mm', has(m, 'J 预测手走 14.6 mm', '两者差 0.13 mm') && has(s, '只转肩 1°', '只差 0.13 mm'), m + ' | ' + s);
    await w.set('jac-a', 3, 200); s = await w.status(); ok('jac, 3°: the status still calls J a very accurate straight-line approximation', has(s, '很准的直线近似'), s);
    await w.set('jac-a', 4, 200); s = await w.status(); ok('jac, 4°: the status changes: prediction off by 2.0 mm, 3% of the distance', has(s, '只转肩 4°', '预测差了 2.0 mm，是走的距离的 3%'), s);
    await w.set('jac-a', 10, 200); s = await w.status(); ok('jac, 10°: off by 12.8 mm (9%)', has(s, '预测差了 12.8 mm，是走的距离的 9%'), s);
    await w.set('jac-a', 30, 200); s = await w.status(); ok('jac, 30°: off by 114.0 mm (26%)', has(s, '预测差了 114.0 mm，是走的距离的 26%'), s);
    await w.set('jac-a', 0, 200); }

  // ---- step 2 · the SVD
  { sec('step 2 · svd'); const w = W('svd'); await w.show(); let m;
    const src = await EV(() => [...document.querySelectorAll('script')].map(s => s.textContent).find(t => t.includes('svd-cv')) || '');
    ok('svd (widget source): the animation runs 0..1 rotate by Vᵀ, 1..2 stretch along the axes, 2..3 rotate into U, and labels the steps so', has(src, '0..1 rotate by V^T, 1..2 stretch, 2..3 rotate', '第 1 步：转（Vᵀ）', '第 2 步：沿两根轴拉伸（Σ）', '第 3 步：再转（U）') && has(src, 'const Sg=[[1+(D.s[0]-1)*f2,0],[0,1+(D.s[1]-1)*f2]]'), src.slice(0, 200));
    await w.click('一步一步看分解', 200); await p.waitForTimeout(5200);
    await w.click('剪切', 400); m = await w.met(); ok('svd, shear: σ₁ 1.55, σ₂ 0.65, determinant 1.00', has(m, 'σ₁ 1.55 σ₂ 0.65 行列式 1.00'), m);
    ok('svd: 1.55 × 0.65 is 1 to two decimals, as the determinant says', near(1.55 * 0.65, 1, 0.01));
    await w.click('一步一步看分解', 200); await p.waitForTimeout(5200);
    const pix = (wx, wy) => p.evaluate(([wx, wy]) => { const cv = document.getElementById('svd-cv'), W = cv.clientWidth, H = cv.clientHeight, pw = (W - 18) / 2, hs = Math.min(pw, H - 26) / 2, cx = 12 + pw * 1.5, cy = 22 + (H - 24) / 2, R = hs / 2; return [cx + wx * R, cy - wy * R]; }, [wx, wy]);
    await dragPx('svd-cv', await pix(.9, 1), await pix(.9, .3)); m = (await w.text('#svd-mx')) + ' | ' + (await w.met());
    ok('svd, dot Ae₂ dragged straight down to 0.30: σ₂ 0.22, σ₁/σ₂ 6.2', has(m, 'A = 1.00 0.90 0.00 0.30', 'σ₂ 0.22', '条件数 σ₁/σ₂ 6.2'), m);
    await dragPx('svd-cv', await pix(.9, .3), await pix(.9, .1)); m = (await w.text('#svd-mx')) + ' | ' + (await w.met());
    ok('svd, down to 0.10: σ₂ 0.07, σ₁/σ₂ 18.1', has(m, 'A = 1.00 0.90 0.00 0.10', 'σ₂ 0.07', '条件数 σ₁/σ₂ 18.1'), m);
    await dragPx('svd-cv', await pix(.9, .1), await pix(.9, 0)); m = (await w.text('#svd-mx')) + ' | ' + (await w.met()); const s = await w.status();
    ok('svd, down to 0: the columns lie on one line, σ₂ 0.00, rank 1, the circle becomes a segment', has(m, 'A = 1.00 0.90 0.00 0.00', 'σ₂ 0.00', '秩 1') && has(s, '整个圆被压成了一条线段'), m + ' | ' + s);
    await w.click('一般的', 300); }

  // ---- figure of step 2: the SVD of J at 0.55 m
  { sec('figure of step 2 · three numbers in, two out'); const r = await EV(() => { const S = TB.svd(TB.jac(TB.qAt(.55))); return { s: S.s, a: Math.atan2(S.u[0][1], S.u[0][0]) * 180 / Math.PI, Jv3: TB.mv(TB.jac(TB.qAt(.55)), S.v[2]) }; });
    ok('figure: σ₁ = 0.744 at 48.5°, σ₂ = 0.283; J v₃ = 0', r.s[0].toFixed(3) === '0.744' && r.s[1].toFixed(3) === '0.283' && r.a.toFixed(1) === '48.5' && Math.hypot(...r.Jv3) < 1e-12, JSON.stringify(r)); }

  // ---- step 3 · the velocity ellipse
  { sec('step 3 · vel'); const w = W('vel'); await w.show(); const VB = [-.10, .98, -.30, .66]; let m, s;
    await handX('vel-cv', VB, .20); m = await w.met(); ok('vel, far left (0.20 m): long axis at 174°, that is 6° from horizontal; σ₁/σ₂ 2.2', has(m, '手在 x = 0.200 m', 'σ₁/σ₂ 2.2', '长轴的方向 174°'), m);
    await handX('vel-cv', VB, .36); m = await w.met(); ok('vel, 0.36 m: long axis at 24°, σ₁σ₂ 0.178', has(m, '可操作度 σ₁σ₂ 0.178', '长轴的方向 24°'), m);
    await handX('vel-cv', VB, .55); m = await w.met(); ok('vel, 0.55 m: long axis at 48°, σ₁/σ₂ 2.6', has(m, 'σ₁/σ₂ 2.6', '长轴的方向 48°'), m);
    await handX('vel-cv', VB, .59); m = await w.met(); ok('vel, 0.59 m: σ₁σ₂ 0.212', has(m, '可操作度 σ₁σ₂ 0.212'), m);
    await handX('vel-cv', VB, .80); m = await w.met(); ok('vel, 0.80 m: long axis at 67°, σ₁/σ₂ 6.7, σ₁σ₂ 0.142', has(m, '可操作度 σ₁σ₂ 0.142', 'σ₁/σ₂ 6.7', '长轴的方向 67°'), m);
    await handX('vel-cv', VB, .85); m = await w.met(); ok('vel, 0.85 m: σ₁/σ₂ 15.2', has(m, 'σ₁/σ₂ 15.2'), m);
    await handX('vel-cv', VB, .90); m = await w.met(); s = await w.status();
    ok('vel, dragged to the end: 2.6 mm short of the farthest point, σ₂ 0.026, σ₁/σ₂ 40.2, long axis at 73°; the hand can move only across the arm', has(m, 'σ₂ 0.026', 'σ₁/σ₂ 40.2', '长轴的方向 73°') && has(s, '只差 2.6 mm', '手只能沿着垂直于手臂的方向动'), m + ' | ' + s);
    const r = await EV(() => { const K = TB; let best = [0, 0], kl = [9, 0], mono = true, prev = null; for (let x = .20; x <= K.TAB.hi + 1e-9; x += .001) { const S = K.svd(K.jac(K.qAt(x))), wv = S.s[0] * S.s[1]; if (wv > best[1]) best = [x, wv];
          if (x <= .45) { kl[0] = Math.min(kl[0], S.s[0] / S.s[1]); kl[1] = Math.max(kl[1], S.s[0] / S.s[1]); } let a = Math.atan2(S.u[0][1], S.u[0][0]) * 180 / Math.PI; a = ((a + 360) % 180); if (a > 90 + 45) a -= 180; if (prev !== null && a < prev - 1e-9) mono = false; prev = a; }
        const xe = K.TAB.hi; return { best, kl, mono, arm: Math.atan2(-K.B[1], xe) * 180 / Math.PI, xr: Math.sqrt(K.REACH * K.REACH - K.B[1] * K.B[1]), xe }; });
    ok('vel (engine): σ₁σ₂ is largest at ' + r.best[0].toFixed(3) + ' m (0.212), inside the wiping range 0.36 to 0.80 m', near(r.best[0], .59, .006) && r.best[1].toFixed(3) === '0.212', JSON.stringify(r.best));
    ok('vel (engine): on the left (0.20 to 0.45 m) σ₁/σ₂ stays between 2.0 and 2.2', r.kl[0] >= 1.95 && r.kl[1] <= 2.25, r.kl.join(' '));
    ok('vel (engine): the long axis turns anticlockwise all the way as the hand moves right', r.mono);
    ok('vel (engine): at the end the arm points at ' + r.arm.toFixed(1) + '°, so 73° is perpendicular to it (within 1°); farthest point 0.8646 m, end of the drag 0.862 m', near(r.arm + 90, 73, 1) && near(r.xr, .8646, 1e-4) && near(r.xe, .862, 1e-9) && ((r.xr - r.xe) * 1000).toFixed(1) === '2.6', JSON.stringify(r)); }

  // ---- step 4 · pseudoinverse and damped least squares
  { sec('step 4 · inv'); const w = W('inv'); await w.show(); let s, m;
    const fin = async () => { for (let k = 0; k < 60; k++) { await p.waitForTimeout(200); s = await w.status(); if (!s.startsWith('t = ') && !s.startsWith('目标从')) break; } m = await w.met(); };
    await w.click('伪逆', 50); await fin();
    ok('inv, pseudoinverse: follows within 0.1 mm early on; ends stuck 85.0 mm from the target, the joints at the cap 100% of the time', has(s, '伪逆：', '误差不到 0.1 mm', '冲到了上限（3.0 rad/s）', '100% 的时间顶着上限') && has(m, '手离目标 85.0 mm'), s + ' | ' + m);
    const r = await EV(() => { const K = TB, V = .15, X0 = .60, X1 = .95, TT = (X1 - X0) / V, TEND = TT + 1.2, KP = 10, QMAX = 3, DT = .002, xd = t => t < TT ? X0 + V * t : X1, vd = t => t < TT ? V : 0;
        const sim = G => { let q = K.qAt(X0), t = 0; const rec = []; while (t <= TEND + 1e-9) { const J = K.jac(q), h = K.fk(q).h, e = [xd(t) - h[0], 0 - h[1]], wv = [vd(t) + KP * e[0], KP * e[1]]; let qd = K.mv(G(J), wv); const mx = Math.max(...qd.map(Math.abs)); if (mx > QMAX) qd = qd.map(v => v * QMAX / mx);
            rec.push({ t, xd: xd(t), hx: h[0], hy: h[1], e: Math.hypot(e[0], e[1]), nq: Math.max(...qd.map(Math.abs)), s2: K.svd(J).s[1], sat: mx > QMAX }); q = q.map((v, i) => v + DT * qd[i]); t += DT; } return rec; };
        const P = sim(K.pinv), f1 = P.find(r => r.nq >= 1), fs = P.find(r => r.sat), aft = P.filter(r => r.t > TT), o = {};
        o.one = [f1.xd, f1.s2]; o.sat = [fs.xd, fs.s2]; o.early = Math.max(...P.filter(r => r.t < 1.2).map(r => r.e)) * 1000; o.hx = [Math.min(...aft.map(r => r.hx)), Math.max(...aft.map(r => r.hx))]; o.reach = Math.sqrt(K.REACH * K.REACH - K.B[1] * K.B[1]);
        o.dls = [.005, .01, .015, .03, .12].map(l => { const R = sim(J => K.dls(J, l)), a = R.filter(r => r.t > TT), e = R[R.length - 1], mid = R.find(r => r.t >= 1.0); return { l, peak: Math.max(...R.map(r => r.nq)), sat: a.filter(r => r.sat).length / a.length, hx: e.hx, hy: e.hy, e: e.e * 1000, mid: mid.e * 1000, midxd: mid.xd }; });
        const d = Math.hypot(.95, K.B[1]); o.closest = [.95 / d * K.REACH, K.B[1] - K.B[1] / d * K.REACH, (d - K.REACH) * 1000]; return o; });
    ok('inv (engine, same loop as the widget): the fastest joint passes 1 rad/s with the target at 0.82 m and σ₂ = 0.12', r.one[0].toFixed(2) === '0.82' && r.one[1].toFixed(2) === '0.12', r.one.join(' '));
    ok('inv (engine): it hits the 3 rad/s cap with the target at 0.859 m and σ₂ about 0.04, 6 mm before the farthest point', r.sat[0].toFixed(3) === '0.859' && r.sat[1].toFixed(2) === '0.04' && Math.round((r.reach - r.sat[0]) * 1000) === 6, r.sat.join(' '));
    ok('inv (engine): before that the hand is within 0.1 mm of the target; after the target stops the hand stays at 0.865 m', r.early < 0.1 && r.hx.every(v => v.toFixed(3) === '0.865'), r.early + ' ' + r.hx.join(' '));
    await w.click('阻尼最小二乘', 50); await fin();
    ok('inv, damped least squares (λ = 3.0 cm): fastest joint peaks at 2.71 rad/s and stops; hand 82.3 mm from the target, 21 mm above the table', has(s, '阻尼最小二乘（λ = 3.0 cm）', '最高 2.71 rad/s，最后停下来', '离目标 82.3 mm，比桌面高 21 mm') && has(m, '最快的关节 0.00 rad/s', '手的高度 21.0 mm'), s + ' | ' + m);
    const d3 = r.dls.find(x => x.l === .03), d12 = r.dls.find(x => x.l === .12);
    ok('inv (engine): with λ = 3 cm the hand stops at (0.870, 0.021); the reachable point closest to the target is the same point, on the line from the shoulder, 82.3 mm away', d3.hx.toFixed(3) === '0.870' && d3.hy.toFixed(3) === '0.021' && r.closest[0].toFixed(3) === '0.870' && r.closest[1].toFixed(3) === '0.021' && r.closest[2].toFixed(1) === '82.3', JSON.stringify(d3) + ' ' + r.closest.join(' '));
    await w.set('inv-l', 10, 50); await fin(); ok('inv, λ = 1.0 cm: too small, the joints jitter at the cap again', has(s, '阻尼最小二乘（λ = 1.0 cm）：λ 太小了', '顶着上限来回抖（100% 的时间）'), s);
    await w.set('inv-l', 5, 50); await fin(); ok('inv, λ = 0.5 cm: the same', has(s, '阻尼最小二乘（λ = 0.5 cm）：λ 太小了', '顶着上限来回抖'), s);
    ok('inv (engine): with λ = 1.5 cm, the next slider position, the joints no longer sit at the cap after the target stops', r.dls.find(x => x.l === .015).sat === 0 && r.dls.find(x => x.l === .01).sat === 1);
    await w.set('inv-l', 120, 50); await fin(); ok('inv, λ = 12 cm: the fastest joint never exceeds 1.07 rad/s', has(s, '阻尼最小二乘（λ = 12.0 cm）', '最高 1.07 rad/s'), s);
    ok('inv (engine): after 1 s (target at 0.75 m) the hand is 4.5 mm behind with λ = 12 cm and 0.3 mm with λ = 3 cm', d12.mid.toFixed(1) === '4.5' && d3.mid.toFixed(1) === '0.3' && d12.midxd.toFixed(2) === '0.75', d12.mid + ' ' + d3.mid);
    await w.set('inv-l', 30, 50); await fin(); }

  // ---- step 5 · the null space
  { sec('step 5 · null'); const w = W('null'); await w.show(); let m = await w.met(), s = await w.status();
    const bad = () => p.evaluate(() => document.getElementById('null-st').className.includes('bad'));
    ok('null, start: hand at (0.400, 0), the elbow 3.6 cm inside the shelf, v₃ = (0.11, -0.34, 0.93)', has(m, '肘离搁板 -3.6 cm', '零空间方向 v₃ (0.11, -0.34, 0.93)') && /手在 \(0\.400, -?0\.000\) m/.test(m) && has(s, '手臂撞上了搁板') && await bad(), m + ' | ' + s);
    let v = 457, lab = ''; const hands = [];
    for (; v >= 0; v -= 1) { await w.set('null-a', v, 12); hands.push(await w.met()); if (!(await bad())) break; } lab = await w.text('#null-ao');
    ok('null, slider dragged left: the elbow is first clear of the shelf at ' + lab + ' (about -130°)', near(parseFloat(lab), -130, 1.5), lab + ' slider ' + v);
    await w.set('null-a', 200, 150); m = await w.met(); lab = await w.text('#null-ao'); hands.push(m);
    ok('null, at -139°: the elbow is 3.5 cm below the shelf', lab === '-139°' && has(m, '肘离搁板 3.5 cm'), lab + ' ' + m);
    for (v = 457; v <= 1000; v += 1) { await w.set('null-a', v, 12); hands.push(await w.met()); if (!(await bad())) break; } lab = await w.text('#null-ao');
    ok('null, slider dragged right: the elbow is first clear at ' + lab + ' (-39°)', lab === '-39°', lab + ' slider ' + v);
    ok('null: through all ' + hands.length + ' slider positions tried, the readout stays "Hand at (0.400, 0.000) m"', hands.every(h => /手在 \(0\.400, -?0\.000\) m/.test(h)));
    await w.set('null-a', 457, 150);
    const fin = async () => { for (let k = 0; k < 70; k++) { await p.waitForTimeout(250); s = await w.status(); if (!s.startsWith('擦着')) break; } };
    await w.click('边擦边走：只用伪逆', 100); await fin(); ok('null, wiping with the pseudoinverse only: the elbow is inside the shelf 89% of the time', has(s, '只用伪逆：', '89% 的时间撞着'), s);
    await w.click('边擦边走：加上零空间那一项', 100); await fin(); ok('null, with the null-space term: out after 0.4 s; on the second pass never closer than 4.5 cm', has(s, '0.4 秒后就退了出来', '离搁板最近也有 4.5 cm'), s);
    const r = await EV(() => { const K = TB, SH = K.SHELF, TAU = 2 * Math.PI, WX0 = .24, WX1 = .60, WT = 4, xw = t => (WX0 + WX1) / 2 - (WX1 - WX0) / 2 * Math.cos(TAU * t / WT), vw = t => (WX1 - WX0) / 2 * TAU / WT * Math.sin(TAU * t / WT);
        const sim = avoid => { let q = K.qAt(WX0), t = 0, ex = 0, ey = 0; const dt = .004; while (t <= 2 * WT + 1e-9) { const J = K.jac(q), P = K.pinv(J), F = K.fk(q), h = F.h, e = [xw(t) - h[0], -h[1]], wv = [vw(t) + 10 * e[0], 10 * e[1]]; let qd = K.mv(P, wv); ex = Math.max(ex, Math.abs(e[0])); ey = Math.max(ey, Math.abs(e[1]));
            if (avoid) { const ye = F.P[1][1], yw = F.P[2][1], wgt = K.clamp((ye - (SH.y0 - .10)) / .05, 0, 1), ww = K.clamp((.10 - yw) / .05, 0, 1), c1 = Math.cos(F.A[0]), c12 = Math.cos(F.A[1]), z = [-20 * wgt * K.L[0] * c1 + 20 * ww * (K.L[0] * c1 + K.L[1] * c12), 20 * ww * K.L[1] * c12, 0], N = K.eye(3).map((rw, i) => rw.map((u, j) => u - (P[i][0] * J[0][j] + P[i][1] * J[1][j]))), zn = K.mv(N, z); qd = qd.map((u, i) => u + zn[i]); }
            q = q.map((u, i) => u + dt * qd[i]); t += dt; } return [ex * 1000, ey * 1000]; }; return { pinv: sim(false), avoid: sim(true), shelf: [SH.x0, SH.x1, SH.y0, SH.y1] }; });
    ok('null (engine, same loop as the widget): in both wiping modes the hand stays within 0.1 mm of the plan, along the table and in height', r.pinv.concat(r.avoid).every(e => e < 0.1), JSON.stringify(r));
    ok('null (engine): the shelf runs from 18 to 62 cm, 45 to 50 cm above the table; the widget wipes from 24 to 60 cm, all of it under the shelf', r.shelf.join(' ') === '0.18 0.62 0.45 0.5');
    await w.click('手停着，自己拖', 200); }

  // ---- step 6 · force
  { sec('step 6 · force'); const w = W('force'); await w.show(); const VB = [-.10, .98, -.30, .66]; let s = await w.status();
    ok('force, pressing down 10 N at 0.55 m: τ = (-5.50, -2.05, -0.36) N·m; the shoulder’s share is x × F = 5.50; with gravity (6.8, 0.1, -0.3) N·m', has(s, '往下压 10 N', '(-5.50, -2.05, -0.36) N·m', '-x × F = -5.50 N·m', '一共 (6.8, 0.1, -0.3) N·m'), s);
    ok('force: 0.55 × 10 = 5.5', near(0.55 * 10, 5.5, 1e-12));
    await w.set('force-f', 50, 250); s = await w.status(); ok('force, 50 N at 0.55 m: no joint over its limit', has(s, '往下压 50 N') && !s.includes('超了上限'), s);
    let first = null; for (let x = .555; x <= .862; x += .005) { const xx = Math.round(x * 1000) / 1000; await handX('force-cv', VB, xx); s = await w.status(); if (s.includes('超了上限')) { first = [xx, s]; break; } }
    ok('force, dragging right at 50 N: the first limit reported is the wrist’s, at about 0.81 m (first seen at ' + (first ? first[0] : '?') + ' m in 5 mm steps)', !!first && first[0] >= .81 && first[0] <= .82 && /超了上限：腕。$/.test(first[1]), first ? first[1] : '');
    const r = await EV(() => { const K = TB, fmax = xx => { const q = K.qAt(xx), J = K.jac(q), g = K.grav(q); let lo = 0, hi = 500; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if ([0, 1, 2].every(i => Math.abs(g[i] - J[1][i] * m) <= K.TAUMAX[i])) lo = m; else hi = m; } return [lo, [0, 1, 2].findIndex(i => Math.abs(g[i] - J[1][i] * (lo + .01)) > K.TAUMAX[i])]; };
        let sw = null, x50 = null; for (let x = .40; x <= .862; x += .001) { if (sw === null && fmax(x)[1] === 2) sw = x; if (x50 === null && x > .55 && fmax(x)[0] < 50) x50 = x; } return { f55: fmax(.55), f80: fmax(.80), sw, x50, lim: K.TAUMAX }; });
    ok('force (engine, same search as the widget’s curve): at 0.55 m the shoulder limits the press, at 95 N; the wrist takes over at 0.67 m; at 0.80 m 51.5 N is left', Math.round(r.f55[0]) === 95 && r.f55[1] === 0 && r.sw.toFixed(2) === '0.67' && r.f80[0].toFixed(1) === '51.5' && r.f80[1] === 2, JSON.stringify(r));
    ok('force (engine): a 50 N press first exceeds a limit at ' + r.x50.toFixed(3) + ' m; motor limits 40, 25 and 6 N·m', near(r.x50, .81, .005) && r.lim.join(' ') === '40 25 6');
    await w.click('沿手臂往外推', 250); s = await w.status(); ok('force, pushing out along the arm: the shoulder needs 0.00 N·m, the line of action passes through it', has(s, '肩一点力矩也不用出（0.00 N·m）', '作用线正好穿过肩关节'), s);
    await w.click('叠上速度椭圆', 250); s = await w.status(); ok('force, velocity ellipse overlaid: same axes, lengths swapped', has(s, '两个椭圆的轴在同一条线上，长短却正好反过来'), s);
    await w.click('叠上速度椭圆', 200); await w.click('往下压', 200); await w.set('force-f', 10, 200); await handX('force-cv', VB, .55); }

  // ---- figure of step 6: lever arms
  { sec('figure of step 6 · torque = force × lever arm'); const r = await EV(() => { const K = TB, q = K.qAt(.55), F = K.fk(q), J = K.jac(q); return { arms: [0, 1, 2].map(i => F.h[0] - F.P[i][0]), tau: [0, 1, 2].map(i => J[0][i] * 0 + J[1][i] * -10) }; });
    ok('figure: lever arms 0.550, 0.205, 0.036 m; torques 5.50, 2.05, 0.36 N·m, all clockwise', r.arms.map(v => v.toFixed(3)).join(' ') === '0.550 0.205 0.036' && r.tau.map(v => v.toFixed(2)).join(' ') === '-5.50 -2.05 -0.36' && r.arms.every((a, i) => near(a * 10, -r.tau[i], 1e-9)), JSON.stringify(r)); }

  // ---- step 7 · mass at the hand
  { sec('step 7 · mass'); const w = W('mass'); await w.show(); const VB = [-.10, .98, -.30, .66]; let m = await w.met();
    ok('mass, 0.55 m, push right: 0.16 kg, 31.1 cm/s, 12° off; lightest/heaviest 0.16/2.32 kg', has(m, '有效质量 0.16 kg', '速度 31.1 cm/s', '偏了 12°', '0.16 / 2.32 kg'), m);
    await w.click('推一下', 500); await w.click('往上', 250); m = await w.met();
    ok('mass, 0.55 m, push up: 1.41 kg, 7.2 cm/s, 61° off', has(m, '有效质量 1.41 kg', '速度 7.2 cm/s', '偏了 61°'), m);
    await w.click('推一下', 500);
    const r = await EV(() => { const K = TB, f = x => { const q = K.qAt(x), J = K.jac(q), Li = K.mul(K.mul(J, K.inv3(K.mass(q))), K.tr(J)); return Li; }; return { a: f(.55), b: f(.80), total: K.MS.reduce((s, v) => s + v, 0) }; });
    ok('mass (engine): pushed up at 0.55 m the hand moves mostly to the right (Δv along (' + r.a[0][1].toFixed(2) + ', ' + r.a[1][1].toFixed(2) + ')); up is 8 to 9 times heavier than right; the arm weighs 4 kg', r.a[0][1] > r.a[1][1] && r.a[0][0] / r.a[1][1] > 8 && r.a[0][0] / r.a[1][1] < 9 && r.total === 4, JSON.stringify(r.a));
    await handX('mass-cv', VB, .80); m = await w.met(); ok('mass, 0.80 m, push up: 0.23 kg, 26.4 cm/s; lightest/heaviest 0.16/3.78 kg', has(m, '有效质量 0.23 kg', '速度 26.4 cm/s', '0.16 / 3.78 kg'), m);
    await w.click('推一下', 500); await w.click('往右', 250); m = await w.met(); ok('mass, 0.80 m, push right: 0.44 kg, 18.3 cm/s', has(m, '有效质量 0.44 kg', '速度 18.3 cm/s'), m);
    await w.click('推一下', 500); await handX('mass-cv', VB, .55); }

  // ---- step 8 · the equation of motion
  { sec('step 8 · eom'); const w = W('eom'); await w.show(); let s, m;
    await w.click('平举', 300); await w.click('放手', 50); const smp = []; for (let k = 0; k < 42; k++) { await p.waitForTimeout(100); smp.push(await w.met()); } await w.click('暂停', 250); m = await w.met(); s = await w.status();
    const TV = smp.map(x => [num(x, /动能 T ([-\d.]+) J/), num(x, /势能 V ([-\d.]+) J/)]), Tmax = Math.max(...TV.map(x => x[0]));
    ok('eom, released from flat: T rises to about 16 J (largest sampled ' + Tmax.toFixed(2) + ' J) while V falls by the same amount; T + V stays 0', Tmax > 14 && Tmax <= 16.3 && TV.every(x => Math.abs(x[0] + x[1]) < 0.011), JSON.stringify(TV.slice(0, 6)));
    const drift = num(m, /T \+ V 漂了 ([\d.]+) mJ/); ok('eom: after about 4 s, T + V has drifted by only ' + drift + ' mJ (a few thousandths of a millijoule)', drift < 0.02 && has(s, '数值积分的误差'), m);
    const ne = num(m, /τ 差 ([\de.+-]+) N·m/); ok('eom: Newton–Euler and Lagrange give torques within ' + ne + ' N·m of each other', ne < 1e-5, m);
    const r = await EV(() => { const K = TB, terms = (st, tau) => { const qdd = K.fdyn(st.q, st.qd, tau, null, true); return { Mq: K.mv(K.mass(st.q), qdd), Cq: K.mv(K.cmat(st.q, st.qd).C, st.qd), g: K.grav(st.q) }; };
        const run = (q0, tauf, T) => { let st = { t: 0, q: q0.slice(), qd: [0, 0, 0] }; const E0 = K.pot(st.q), rec = [], n = Math.round(T / .001); for (let k = 0; k <= n; k++) { rec.push({ t: st.t, T: K.kin(st.q, st.qd), V: K.pot(st.q) - E0, st: { t: st.t, q: st.q.slice(), qd: st.qd.slice() } }); st = K.step(st, .001, t => tauf(t), {}); } return rec; };
        const flat = run([0, 0, 0], t => [0, 0, 0], 4); let best = flat[0]; for (const x of flat) if (x.T > best.T) best = x;
        const spin = run([-Math.PI / 2, 0, 0], t => [t < .6 ? 4 : 0, 0, 0], 3), at = t => spin[Math.round(t / .001)];
        return { t0: terms(flat[0].st, [0, 0, 0]), tb: best.t, Tb: best.T, Vb: best.V, bt: terms(best.st, [0, 0, 0]), drift: Math.max(...flat.map(x => Math.abs(x.T + x.V))) * 1000, E06: at(.6).T + at(.6).V, E3: at(3).T + at(3).V, ang: at(.6).st.q[0] + Math.PI / 2 }; });
    ok('eom (engine, 1 ms steps like the widget): at release C q̇ = 0 and at the shoulder g = 16.4 N·m, M q̈ = -16.4 N·m', r.t0.Cq.every(v => v === 0) && r.t0.g[0].toFixed(1) === '16.4' && r.t0.Mq[0].toFixed(1) === '-16.4', JSON.stringify(r.t0));
    ok('eom (engine): T peaks at ' + r.tb.toFixed(2) + ' s at 16.3 J, with V = -16.3 J', r.tb.toFixed(2) === '0.43' && r.Tb.toFixed(1) === '16.3' && r.Vb.toFixed(1) === '-16.3', r.tb + ' ' + r.Tb);
    ok('eom (engine): at that moment, at the shoulder, g = 1.4, C q̇ = 12.4 and M q̈ = -13.8 N·m; these two are the largest terms of all nine', r.bt.g[0].toFixed(1) === '1.4' && r.bt.Cq[0].toFixed(1) === '12.4' && r.bt.Mq[0].toFixed(1) === '-13.8' && [...r.bt.g, ...r.bt.Cq.slice(1), ...r.bt.Mq.slice(1)].every(v => Math.abs(v) < 12.3), JSON.stringify(r.bt));
    ok('eom (engine): in 4 s with exact 1 ms steps the drift is ' + r.drift.toFixed(4) + ' mJ', r.drift < 0.02);
    await w.click('垂着，转肩膀', 300); await w.click('放手', 50); await p.waitForTimeout(1500); await w.click('暂停', 250); s = await w.status(); m = await w.met();
    ok('eom, hanging, turn the shoulder: the motor did 1.72 J of work in the first 0.6 s and T + V rose by that much', has(s, '前 0.6 秒里肩的电机做了 1.72 J 的功'), s);
    ok('eom (engine): in those 0.6 s the shoulder turned 24.6° = 0.43 rad; 4 N·m × that angle = 1.72 J; T + V is 1.72 J at 0.6 s and still 1.72 J at 3 s', (r.ang * 180 / Math.PI).toFixed(1) === '24.6' && r.ang.toFixed(2) === '0.43' && (4 * r.ang).toFixed(2) === '1.72' && r.E06.toFixed(2) === '1.72' && r.E3.toFixed(2) === '1.72', JSON.stringify([r.ang, r.E06, r.E3]));
    await w.click('擦桌子的姿势', 300); }

  // ---- figure of step 9: the two passes of Newton–Euler at the fastest moment
  { sec('figure of step 9 · the two passes'); const r = await EV(() => { const K = TB, p = K.plan(K.WIPE.T / 4), Fe = [-K.CONTACT.mu * K.WIPE.F * Math.tanh(p.v / K.CONTACT.vs), K.WIPE.F], tr = K.rnea(p.q, p.qd, p.qdd, Fe, true, true), F = K.fk(p.q); return { x: p.x, v: p.v, P: F.P, w: tr.w, f: tr.f, tau: tr.tau, Fe, wt: K.MS.map(m => m * K.G), qd: p.qd }; });
    ok('figure: hand at 0.58 m, 0.43 m/s; angular velocities -0.47, 0.64, 1.06 rad/s, each the previous one plus the joint rate', r.x.toFixed(2) === '0.58' && r.v.toFixed(2) === '0.43' && r.w.map(v => v.toFixed(2)).join(' ') === '-0.47 0.64 1.06' && near(r.w[1], r.w[0] + r.qd[1], 1e-12) && near(r.w[2], r.w[1] + r.qd[2], 1e-12), JSON.stringify(r.w));
    ok('figure: the hand pushes the table with (3, -10) N; joint forces (3.00, -5.14), (3.06, 9.21), (3.13, 28.53) N', near(-r.Fe[0], 3, 1e-3) && r.Fe[1] === 10 && r.f[2].map(v => v.toFixed(2)).join(' ') === '3.00 -5.14' && r.f[1].map(v => v.toFixed(2)).join(' ') === '3.06 9.21' && r.f[0].map(v => v.toFixed(2)).join(' ') === '3.13 28.53', JSON.stringify(r.f));
    ok('figure: the last link weighs 4.9 N; joint torques (7.37, 1.36, 0.08) N·m; pose as drawn', r.wt[2].toFixed(1) === '4.9' && r.tau.map(v => v.toFixed(2)).join(' ') === '7.37 1.36 0.08' && near(r.P[1][0], .3513, 1e-4) && near(r.P[1][1], .4413, 1e-4) && near(r.P[2][0], .5339, 1e-4) && near(r.P[2][1], .1427, 1e-4), JSON.stringify(r.P)); }

  // ---- step 10 · control (the simulation runs in real time: each setting needs a full round trip before its statistics appear)
  { sec('step 10 · ctrl'); const w = W('ctrl'); await w.show(); let m, s;
    const stats = async () => { let last = '', same = 0; for (let k = 0; k < 60; k++) { await p.waitForTimeout(400); m = await w.met(); if (m.includes('这里给出')) continue; if (m === last) { if (++same >= 3) break; } else { same = 0; last = m; } } s = await w.status(); };
    await w.click('在空中', 50); await w.click('关节 PD', 50); await stats();
    ok('ctrl, in the air, joint PD: height error 17.1 mm (RMS); the hand brushes the table now and then', has(m, '高度误差（均方根） 17.1 mm') && has(s, '蹭到桌面'), m + ' | ' + s);
    await w.click('PD + 重力补偿', 50); await stats(); ok('ctrl, air, PD + gravity compensation: 0.48 mm', has(m, '高度误差（均方根） 0.48 mm'), m);
    await w.click('计算力矩', 50); await stats(); ok('ctrl, air, computed torque: 0.00 mm', has(m, '高度误差（均方根） 0.00 mm'), m);
    await w.click('操作空间 + 力控制', 50); await stats(); ok('ctrl, air, operational space: 0.00 mm', has(m, '高度误差（均方根） 0.00 mm'), m);
    await w.click('PD + 重力补偿', 50); await w.click('擦快一倍', 50); await stats(); ok('ctrl, air, PD + gravity compensation at twice the speed: 1.7 mm, about 3.5 times 0.48 mm', has(m, '高度误差（均方根） 1.7 mm', '擦一个来回 1.6 s') && near(1.7 / 0.48, 3.5, 0.06), m);
    await w.click('擦快一倍', 50); await w.click('计算力矩', 50); await w.click('湿海绵', 50); await stats(); ok('ctrl, air, computed torque with the wet sponge (normal speed): 6.1 mm', has(m, '高度误差（均方根） 6.1 mm', '擦一个来回 3.2 s'), m);
    await w.click('湿海绵', 50); await w.click('在桌上', 50); await w.click('关节 PD', 50); await stats();
    ok('ctrl, on the table, joint PD: 22.6 N on average, between 12 and 44 N', has(m, '压力 22.6 ± 9.0 N', '压力范围 12.2 – 44.1 N') && has(s, '在 12 到 44 N 之间乱跳'), m + ' | ' + s);
    await w.click('PD + 重力补偿', 50); await stats(); ok('ctrl, table, PD + gravity compensation: 4.4 N on average', has(m, '压力 4.4 ± 3.1 N'), m);
    await w.click('计算力矩', 50); await stats(); ok('ctrl, table, computed torque: 20.5 mm off along the table, force between 0.7 and 38 N', has(m, '沿桌面误差（均方根） 20.5 mm', '压力范围 0.7 – 38.3 N'), m);
    await w.click('操作空间 + 力控制', 50); await stats(); ok('ctrl, table, operational space + force: 0.30 mm off along the table, 10.00 ± 0.25 N', has(m, '沿桌面误差（均方根） 0.30 mm') && has(s, '压力 10.00 ± 0.25 N'), m + ' | ' + s);
    await w.click('暂停', 200); }

  // ---- figure of step 10: stiffness of the hand under computed torque
  { sec('figure of step 10 · how far 3 N moves the hand'); const r = await EV(() => { const K = TB, q = K.qAt(.55), J = K.jac(q), Li = K.mul(K.mul(J, K.inv3(K.mass(q))), K.tr(J)), E = K.eig2(Li[0][0], Li[0][1], Li[1][1]), w = K.CTL.WN; return { kL: w * w / E.l[0], kH: w * w / E.l[1], dir: Math.atan2(E.u[0][1], E.u[0][0]) * 180 / Math.PI, w }; });
    ok('figure: ω = 30 rad/s; softest direction 141 N/m at 12.5° from the table, stiffest 2090 N/m (to three figures); 3 N moves the hand 21 mm and 1.4 mm', r.w === 30 && Math.round(r.kL) === 141 && Math.round(r.kH / 10) * 10 === 2090 && r.dir.toFixed(1) === '12.5' && Math.round(3 / r.kL * 1000) === 21 && (3 / r.kH * 1000).toFixed(1) === '1.4', JSON.stringify(r)); }

  // ---- step 11 · the map
  { sec('step 11 · map'); const w = W('sp'); await w.show();
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp .spgr')].map(g => ({ h: g.querySelector('.spgh').innerText.replace(/\s+/g, ' ').trim(), k: [...g.querySelectorAll('.spk')].map(k => k.firstChild.textContent.replace(/\s+/g, ' ').trim()) })));
    await w.click('用到的矩阵', 300); let G = await groups(); const all = new Set(G.flatMap(g => g.k)), jt = G.find(g => g.h.startsWith('转置 Jᵀ'));
    ok('map: 66 tiles; grouped by matrix: 10 groups; the group "转置 Jᵀ" has 10 tiles, among them τ = Jᵀ F, active stiffness, hybrid position/force, impedance and operational-space control', all.size === 66 && G.length === 10 && !!jt && jt.k.length === 10 && ['τ = Jᵀ F（虚功原理）', '主动刚度控制', '力/位混合控制', '阻抗控制', '操作空间控制'].every(n => jt.k.includes(n)), G.length + ' ' + (jt ? jt.k.join(';') : ''));
    await w.click('年代', 300); G = await groups(); const g80 = G.find(g => g.h.startsWith('1980–1989'));
    ok('map, by era: 5 groups holding 61 dated tiles; 1980–1989 has 28 and is headed "机器人学的黄金十年"', G.length === 5 && G.reduce((s, g) => s + g.k.length, 0) === 61 && !!g80 && g80.k.length === 28 && g80.h.includes('机器人学的黄金十年') && ['可操作度', '阻尼最小二乘', '任务优先级', '操作空间控制', '阻抗控制', '自适应控制'].every(n => g80.k.includes(n)), G.map(g => g.k.length).join(' '));
    const tile = async name => { await p.evaluate(nm => { const k = [...document.querySelectorAll('#sp .spk')].find(k => k.firstChild.textContent.replace(/\s+/g, ' ').trim() === nm); k.click(); }, name); await p.waitForTimeout(120); };
    const rel = () => p.evaluate(() => [...document.querySelectorAll('#sp .sprel button')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    const head = () => p.evaluate(() => { const d = document.querySelector('#sp .spd'); return d ? d.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : ''; });
    await tile('伪逆'); let R = await rel(); ok('map, "伪逆" (1920, 1955): 4 relatives', R.length === 4 && (await head()).startsWith('伪逆 1920、1955'), R.join(';'));
    let okc = true; const chain = ['梯度投影（零空间）', '任务优先级', '多层任务的递推', '人形机器人的全身控制', '操作空间控制'];
    for (const nx of chain) { R = await rel(); if (!R.includes(nx)) { okc = false; break; } await p.evaluate(nm => { [...document.querySelectorAll('#sp .sprel button')].find(b => b.innerText.replace(/\s+/g, ' ').trim() === nm).click(); }, nx); await p.waitForTimeout(150); }
    ok('map: five clicks on relatives lead from the pseudoinverse to operational-space control, by way of whole-body control of humanoids (2005)', okc && (await head()).startsWith('操作空间控制'), await head());
    await w.click('管什么', 300); const seen = new Set(['伪逆']), queue = ['伪逆']; while (queue.length) { const a = queue.shift(); await tile(a); for (const b of await rel()) if (!seen.has(b)) { seen.add(b); queue.push(b); } }
    const out = [...all].filter(n => !seen.has(n));
    ok('map: following relatives from the pseudoinverse reaches 39 of the 66 tiles; Lagrange’s equations, recursive Newton–Euler, computed torque and principal component analysis are among those not reached', seen.size === 39 && ['拉格朗日方程', '递推牛顿–欧拉', '计算力矩', '主成分分析'].every(n => out.includes(n)), seen.size + ' | ' + out.join(';')); }

  // ======================= Part B: the numbers in the cards, the paragraphs and the quiz, recomputed with the page's engine =======================
  { const R = await EV(() => { const K = TB, DEG = 180 / Math.PI, o = {};
      const q = K.qAt(.55), F = K.fk(q), J = K.jac(q), S = K.svd(J), pf = K.plan(K.WIPE.T / 4), Jf = K.jac(pf.q), Fe = [-K.CONTACT.mu * K.WIPE.F * Math.tanh(pf.v / K.CONTACT.vs), K.WIPE.F];
      o.q = q.map(v => v * DEG); o.P = F.P; o.J = J; o.Jf = Jf; o.pf = { x: pf.x, v: pf.v, qd: pf.qd, qdd: pf.qdd }; o.vf = K.mv(Jf, pf.qd);
      o.vmax = Math.max(...Array.from({ length: 3200 }, (_, k) => K.plan(k * .001).v)); o.consts = { T: K.WIPE.T, F: K.WIPE.F, reach: K.REACH };
      o.relerr = [1, 5, 10, 30].map(d => { const a = d / DEG; return Math.hypot(Math.cos(a) - 1, Math.sin(a) - a) / (2 * Math.sin(a / 2)) * 100; });
      { const a = 10 / DEG, Rr = Math.hypot(.55, .25); o.sh10 = [Rr * a * 1000, 2 * Rr * Math.sin(a / 2) * 1000, a / 2 * DEG, Rr * Math.hypot(Math.cos(a) - 1, Math.sin(a) - a) * 1000]; }
      o.deg1ms = pf.qd.map(v => Math.abs(v) * .001 * DEG);
      const sv = A => { const s = K.svd(A); return { s: s.s, u1: Math.atan2(s.u[0][1], s.u[0][0]) * DEG, v1: Math.atan2(s.v[0][1], s.v[0][0]) * DEG }; };
      o.gen = sv([[1.3, .5], [.4, .9]]); o.shear = sv([[1, .9], [0, 1]]); o.mir = sv([[.4, 1.3], [1.1, .2]]); o.S = { s: S.s, u: S.u, v: S.v };
      { const B = K.mul(J, K.tr(J)), E = K.eig2(B[0][0], B[0][1], B[1][1]); o.eigJJt = E.l; }
      { const t0 = performance.now(); let acc = 0; for (let k = 0; k < 100000; k++) acc += K.svd(J).s[0]; o.svdMicro = (performance.now() - t0) / 100000 * 1000; }
      const vx = Jx => 1 / Math.sqrt(K.inv2(K.mul(Jx, K.tr(Jx)))[0][0]); o.vx = [vx(J), vx(Jf)]; o.nqd = Math.hypot(...pf.qd);
      o.wk = [.36, .55, .80, .85, .86].map(x => { const s = K.svd(K.jac(K.qAt(x))).s; return [s[0] * s[1], s[0] / s[1], 1 / s[1]]; });
      o.sing = [K.L[0] + K.L[1] - K.L[2], K.L[0] - K.L[1] + K.L[2], Math.abs(K.L[0] - K.L[1] - K.L[2])];
      { const v = [.1, 0], qd = K.mv(K.pinv(J), v), q2 = K.mv(K.inv2([[J[0][0], J[0][1]], [J[1][0], J[1][1]]]), v); o.pinv = { uv: [S.u[0][0] * .1, S.u[1][0] * .1], qd, n: Math.hypot(...qd), q2, n2: Math.hypot(...q2), Jqd: K.mv(J, qd) }; }
      { const g = (s, l) => s / (s * s + l * l); o.dls = [1 / (2 * .03), g(S.s[1], .03), 1 / S.s[1], g(.05, .03), g(.01, .03)]; }
      { const V = .15, X0 = .60, X1 = .95, TT = (X1 - X0) / V, TEND = TT + 1.2, KP = 10, QMAX = 3, DT = .002, xd = t => t < TT ? X0 + V * t : X1, vd = t => t < TT ? V : 0; let qq = K.qAt(X0), t = 0, peak = 0, last = null; while (t <= TEND + 1e-9) { const Jq = K.jac(qq), h = K.fk(qq).h, e = [xd(t) - h[0], 0 - h[1]], wv = [vd(t) + KP * e[0], KP * e[1]]; let qd = K.mv(K.tsvd(Jq, .03), wv); const mx = Math.max(...qd.map(Math.abs)); if (mx > QMAX) qd = qd.map(v => v * QMAX / mx); peak = Math.max(peak, Math.max(...qd.map(Math.abs))); last = [Math.hypot(e[0], e[1]) * 1000, h[1] * 1000, Math.max(...qd.map(Math.abs))]; qq = qq.map((v, i) => v + DT * qd[i]); t += DT; } o.tsvd = { peak, last }; }
      { const el = x => K.fk(K.qAt(x)).P[1][1]; let lo = null, hi = null; for (let x = .36; x <= .8001; x += .001) if (el(x) > .45) { if (lo === null) lo = x; hi = x; } o.elbow = [lo, hi, el(.36), K.fk(K.ikPhi([.55, 0], -90 / DEG).q).P[1][1], K.fk(K.ikPhi([.55, 0], -120 / DEG).q).P[1][1]]; const v3 = S.v[2]; o.N = { diag: v3.map(x => x * x), Nz: v3.map(x => -x * v3[2]), JNz: K.mv(J, v3.map(x => -x * v3[2])) }; }
      { const lap = (cx, cy, Rr, laps) => { let qq = K.ikDefault([cx + Rr, cy]); const N = 2000, phi0 = qq[0] + qq[1] + qq[2], out = []; for (let L = 0; L < laps; L++) { for (let k = 0; k < N; k++) { const a1 = 2 * Math.PI * (k + 1) / N, tgt = [cx + Rr * Math.cos(a1), cy + Rr * Math.sin(a1)]; for (let it = 0; it < 2; it++) { const h = K.fk(qq).h, P = K.pinv(K.jac(qq)), e = [tgt[0] - h[0], tgt[1] - h[1]]; qq = qq.map((v, i) => v + P[i][0] * e[0] + P[i][1] * e[1]); } } if (L === 0 || L === 99) out.push((qq[0] + qq[1] + qq[2] - phi0) * DEG); } const h = K.fk(qq).h; out.push(Math.hypot(h[0] - cx - Rr, h[1] - cy) * 1000); return out; }; o.circle = lap(.55, .10, .08, 100); }
      o.tauR = [0, 1, 2].map(i => J[0][i] * 10); o.g = K.grav(q); o.tot = o.g.map((g, i) => g - J[1][i] * 10); o.s80 = K.svd(K.jac(K.qAt(.8))).s;
      { const Fv = [0, -10], h = 1e-6, JtF = qq => { const Jq = K.jac(qq); return [0, 1, 2].map(i => Jq[0][i] * Fv[0] + Jq[1][i] * Fv[1]); }, a = q.slice(), b = q.slice(); a[2] += h; b[2] -= h; const Kq = K.mul(K.mul(K.tr(J), [[1000, 0], [0, 3000]]), J); o.Kq = Kq; o.geo = Math.abs((JtF(a)[2] - JtF(b)[2]) / (2 * h)) / Kq[2][2] * 100; }
      { const fmax = xx => { const qq = K.qAt(xx), Jq = K.jac(qq), g = K.grav(qq); let lo = 0, hi = 500; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if ([0, 1, 2].every(i => Math.abs(g[i] - Jq[1][i] * m) <= K.TAUMAX[i])) lo = m; else hi = m; } return lo; }; let best = [0, 0]; for (let x = .22; x <= .862; x += .001) { const f = fmax(x); if (f > best[1]) best = [x, f]; } o.fmax = { best, f85: fmax(.85) }; }
      { const M = K.mass(q), Mi = K.inv3(M), Li = K.mul(K.mul(J, Mi), K.tr(J)), E = K.eig2(Li[0][0], Li[0][1], Li[1][1]); o.M = M; o.Li = Li; o.E = { l: E.l, dl: Math.atan2(E.u[0][1], E.u[0][0]) * DEG }; o.dyn = K.svd(K.mul(J, Mi)).s;
        o.KE = K.kin(pf.q, pf.qd); const Lf = K.inv2(K.mul(K.mul(Jf, K.inv3(K.mass(pf.q))), K.tr(Jf))); o.KEmin = .5 * pf.v * pf.v * Lf[0][0];
        const q8 = K.qAt(.8), J8 = K.jac(q8), L8 = K.mul(K.mul(J8, K.inv3(K.mass(q8))), K.tr(J8)), E8 = K.eig2(L8[0][0], L8[0][1], L8[1][1]), d = [.8, -.25], dn = Math.hypot(...d), u = d.map(x => x / dn); o.m80 = { heavy: 1 / E8.l[1], dirHeavy: Math.atan2(E8.u[1][1], E8.u[1][0]) * DEG, phi: (q8[0] + q8[1] + q8[2]) * DEG, along: 1 / (u[0] * (L8[0][0] * u[0] + L8[0][1] * u[1]) + u[1] * (L8[1][0] * u[0] + L8[1][1] * u[1])) }; }
      { const M = K.mass(pf.q); o.eom = { Mq: K.mv(M, pf.qdd), Cq: K.mv(K.cmat(pf.q, pf.qd).C, pf.qd), g: K.grav(pf.q), JtF: [0, 1, 2].map(i => -(Jf[0][i] * Fe[0] + Jf[1][i] * Fe[1])), tau: K.rnea(pf.q, pf.qd, pf.qdd, Fe, true) }; const pt = K.plan(K.WIPE.T / 2); o.turn = [K.mv(K.mass(pt.q), pt.qdd)[0], K.grav(pt.q)[0]];
        let mn = 1e9, mxM = 0; for (let k = 0; k < 3200; k++) { const p = K.plan(k * .001), m1 = Math.abs(K.mv(K.mass(p.q), p.qdd)[0]); mxM = Math.max(mxM, m1); if (m1 > 1e-6) mn = Math.min(mn, K.grav(p.q)[0] / m1); } o.ratio = [mn, mxM];
        const sk = (() => { const C = K.cmat(pf.q, pf.qd), Md = [0, 1, 2].map(r => [0, 1, 2].map(c => [0, 1, 2].reduce((s, i) => s + C.dM[i][r][c] * pf.qd[i], 0))), x = [.3, -1.1, .7]; let v = 0; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) v += x[r] * (Md[r][c] - 2 * C.C[r][c]) * x[c]; return v; })(); o.skew = sk; }
      { const tr = K.rnea(pf.q, pf.qd, pf.qdd, Fe, true, true); o.ne = { w: tr.w, al: tr.al, ao: tr.ao, f: tr.f, tau: tr.tau, W: K.MS.reduce((s, m) => s + m, 0) * K.G, w3: K.MS[2] * K.G }; }
      { const dq = o.g.map((v, i) => v / K.CTL.KP[i]); o.sag = { deg: dq.map(v => v * DEG), dh: K.mv(J, dq).map(v => v * 1000) }; o.ctl = { kp: K.CTL.KP, kd: K.CTL.KD, wn: K.CTL.WN, wx: K.CTL.WX, ki: K.CTL.KI, dt: K.CTL.DT, depth: K.CTL.DEPTH, air: K.CTL.AIR, k: K.CONTACT.k, mu: K.CONTACT.mu }; }
      return o; });
    const f = (v, d) => v.toFixed(d), fs = (a, d) => a.map(v => v.toFixed(d).replace(/^-0\.(0+)$/, '0.$1')).join(' ');
    let T;
    sec('text of step 0'); T = await secText('k-task');
    ok('step 0: one round trip 3.2 s, pressing 10 N, fastest 0.43 m/s; straight reach 90 cm, 86.5 cm on the table', has(T, '一个来回 3.2 秒', '一直往下压 10 N', '0.43 m/s', '够到 90 cm', '最远只到 86.5 cm') && R.consts.T === 3.2 && R.consts.F === 10 && f(R.vmax, 2) === '0.43' && near(R.consts.reach, .9, 1e-12));
    sec('text of step 1'); T = await secText('k-jac');
    ok('step 1, forward kinematics at 0.55 m: q = (30.3°, -91.4°, -15.2°), φ = -76.3°; elbow (0.345, 0.452), forearm at -61.1°, wrist (0.514, 0.146)', has(T, 'q = (30.3°, -91.4°, -15.2°)，φ = -76.3°', '(0.345, 0.452)', '30.3° - 91.4° = -61.1°', '(0.514, 0.146)') && fs(R.q, 1) === '30.3 -91.4 -15.2' && f(R.q[0] + R.q[1] + R.q[2], 1) === '-76.3' && f(R.q[0] + R.q[1], 1) === '-61.1');
    ok('step 1, columns of J at 0.55 m: (0.250, 0.550) 0.604 m long; (0.452, 0.205) 0.496 m; (0.146, 0.036) 0.150 m', has(T, 'J₁ = (0.250, 0.550)，长 0.604 m', 'J₂ = (0.452, 0.205)，长 0.496 m', 'J₃ = (0.146, 0.036)，长 0.150 m') && fs([R.J[0][0], R.J[1][0], R.J[0][1], R.J[1][1], R.J[0][2], R.J[1][2]], 3) === '0.250 0.550 0.452 0.205 0.146 0.036' && fs([0, 1, 2].map(i => Math.hypot(R.J[0][i], R.J[1][i])), 3) === '0.604 0.496 0.150');
    ok('step 1, fastest moment (hand at 0.58 m): rates (-0.47, 1.11, 0.43) rad/s; columns (0.250, 0.580), (0.441, 0.229), (0.143, 0.046); hand velocity (0.43, 0.00) m/s', has(T, '(-0.47, 1.11, 0.43) rad/s', '-0.47 × (0.250, 0.580) + 1.11 × (0.441, 0.229) + 0.43 × (0.143, 0.046) ≈ (0.43, 0.00) m/s') && fs(R.pf.qd, 2) === '-0.47 1.11 0.43' && fs([R.Jf[0][0], R.Jf[1][0], R.Jf[0][1], R.Jf[1][1], R.Jf[0][2], R.Jf[1][2]], 3) === '0.250 0.580 0.441 0.229 0.143 0.046' && f(R.vf[0], 2) === '0.43' && Math.abs(R.vf[1]) < 1e-6);
    ok('step 1, straight-line error: 0.9% after 1°, 4.4% after 5°, 8.7% after 10°, 26% after 30°', has(T, '转 1° 差 0.9%，转 5° 差 4.4%，转 10° 差 8.7%，转 30° 差 26%') && fs(R.relerr.slice(0, 3), 1) === '0.9 4.4 8.7' && Math.round(R.relerr[3]) === 26);
    ok('step 1, shoulder turned 10°: predicted 105.4 mm, real 105.3 mm, direction 5° off, end points 9.2 mm apart', has(T, 'J 预测手走 105.4 mm，真走 105.3 mm', '偏了 5°', '相距 9.2 mm') && fs(R.sh10, 1) === '105.4 105.3 5.0 9.2');
    ok('step 1: in one millisecond the joints turn only a few hundredths of a degree (' + fs(R.deg1ms, 3) + '° at the fastest moment)', has(T, '关节只转零点零几度') && R.deg1ms.every(v => v > .01 && v < .1));
    ok('step 1, second row of J: (0.550, 0.205, 0.036); 0.01 rad (0.6°) at the shoulder lifts the hand 5.5 mm, at the wrist 0.36 mm', has(T, '(0.550, 0.205, 0.036)', '0.01 rad（约 0.6°）手升 5.5 mm', '只升 0.36 mm') && f(R.J[1][0] * 10, 1) === '5.5' && f(R.J[1][2] * 10, 2) === '0.36' && f(.01 * 180 / Math.PI, 1) === '0.6');
    sec('text of step 2'); T = await secText('k-svd');
    ok('step 2, the "general" matrix: σ = 1.59, 0.61; long axis at 31.7°, v₁ at 34.3°; area factor 0.97 = determinant 1.3 × 0.9 - 0.5 × 0.4', has(T, 'σ₁ = 1.59、σ₂ = 0.61', '长轴朝 31.7°', 'v₁ 朝 34.3°', '1.3 × 0.9 - 0.5 × 0.4 = 0.97') && fs(R.gen.s, 2) === '1.59 0.61' && f(R.gen.u1, 1) === '31.7' && f(R.gen.v1, 1) === '34.3' && f(1.3 * .9 - .5 * .4, 2) === '0.97' && f(R.gen.s[0] * R.gen.s[1], 2) === '0.97');
    ok('step 2, shear: turn 57° clockwise, stretch by 1.55 and 0.65, turn 33° anticlockwise; mirror: determinant -1.35, singular values 1.52 and 0.89', has(T, '先顺时针转 57°，沿两根轴拉伸成 1.55 倍和 0.65 倍，再逆时针转 33°', '-1.35', '1.52 和 0.89') && Math.round(R.shear.v1) === 57 && Math.round(R.shear.u1) === 33 && fs(R.shear.s, 2) === '1.55 0.65' && fs(R.mir.s, 2) === '1.52 0.89' && f(.4 * .2 - 1.3 * 1.1, 2) === '-1.35');
    ok('step 2, SVD of J at 0.55 m: σ₁ = 0.744, u₁ = (0.663, 0.749) at 48.5°, v₁ = (0.776, 0.609, 0.166); σ₂ = 0.283, u₂ = (-0.749, 0.663), v₂ = (0.627, -0.718, -0.303); v₃ = (-0.065, 0.339, -0.939)', has(T, 'σ₁ = 0.744，u₁ = (0.663, 0.749)，朝右上 48.5°', 'v₁ = (0.776, 0.609, 0.166)', 'σ₂ = 0.283，u₂ = (-0.749, 0.663)', 'v₂ = (0.627, -0.718, -0.303)', 'v₃ = (-0.065, 0.339, -0.939)') && fs(R.S.s, 3) === '0.744 0.283' && fs(R.S.u[0], 3) === '0.663 0.749' && fs(R.S.u[1], 3) === '-0.749 0.663' && fs(R.S.v[0], 3) === '0.776 0.609 0.166' && fs(R.S.v[1], 3) === '0.627 -0.718 -0.303' && fs(R.S.v[2], 3) === '-0.065 0.339 -0.939');
    ok('step 2: the eigenvalues of J Jᵀ are σ₁² and σ₂²', near(R.eigJJt[0], R.S.s[0] ** 2, 1e-12) && near(R.eigJJt[1], R.S.s[1] ** 2, 1e-12));
    ok('step 2: one SVD of the 2 × 3 J takes a few microseconds (' + f(R.svdMicro, 1) + ' µs here, in the browser, on this machine)', has(T, '算一次 SVD 只要几微秒') && R.svdMicro < 20);
    sec('text of step 3'); T = await secText('k-vel');
    ok('step 3: with |q̇| = 1 rad/s the hand can do 0.358 m/s along x at 0.55 m and 0.338 at 0.58 m; 0.432 / 0.338 = 1.28 rad/s, the norm of (-0.47, 1.11, 0.43)', has(T, '0.358 m/s', '这个数是 0.338', '0.432 / 0.338 = 1.28 rad/s', '合起来正是 1.28') && fs(R.vx, 3) === '0.358 0.338' && f(.432 / .338, 2) === '1.28' && f(R.nqd, 2) === '1.28');
    ok('step 3, along the table: 0.36 m w = 0.178, κ = 2.1; 0.55 m 0.210, 2.6; 0.80 m 0.142, 6.7; 0.85 m 0.069, 15; 0.86 m κ = 29', has(T, 'w = 0.178、κ = 2.1', 'w = 0.210、κ = 2.6', '（0.212）', 'w = 0.142、κ = 6.7', 'w = 0.069、κ = 15', 'κ = 29') && fs(R.wk.map(x => x[0]).slice(0, 4), 3) === '0.178 0.210 0.142 0.069' && fs(R.wk.map(x => x[1]).slice(0, 3), 1) === '2.1 2.6 6.7' && Math.round(R.wk[3][1]) === 15 && Math.round(R.wk[4][1]) === 29);
    ok('step 3: 1/σ₂ is 6.9 at 0.80 m, 14.8 at 0.85 m and 28 at 0.86 m', has(T, '0.80 m 处 1/σ₂ = 6.9，0.85 m 处是 14.8，0.86 m 处是 28') && f(R.wk[2][2], 1) === '6.9' && f(R.wk[3][2], 1) === '14.8' && Math.round(R.wk[4][2]) === 28);
    ok('step 3: folded-back singular postures with the hand 0.6, 0.2 and 0.1 m from the shoulder', has(T, '手离肩 0.6 m、0.2 m、0.1 m') && fs(R.sing, 2) === '0.60 0.20 0.10');
    sec('text of step 4'); T = await secText('k-inv');
    ok('step 4, pseudoinverse example at 0.55 m for v = (0.1, 0): components 0.066 and -0.075; 1/σ = 1.34, 3.54; q̇ = (-0.097, 0.244, 0.095), norm 0.280; wrist locked: (-0.104, 0.279, 0), norm 0.297', has(T, 'u₁ᵀv = 0.066，u₂ᵀv = -0.075', '1/σ₁ = 1.34，1/σ₂ = 3.54', '(-0.097, 0.244, 0.095) rad/s，合起来 0.280 rad/s', '(-0.104, 0.279, 0)，合起来 0.297') && fs(R.pinv.uv, 3) === '0.066 -0.075' && fs([1 / R.S.s[0], 1 / R.S.s[1]], 2) === '1.34 3.54' && fs(R.pinv.qd, 3) === '-0.097 0.244 0.095' && f(R.pinv.n, 3) === '0.280' && fs(R.pinv.q2, 3) === '-0.104 0.279' && f(R.pinv.n2, 3) === '0.297' && near(R.pinv.Jqd[0], .1, 1e-12) && Math.abs(R.pinv.Jqd[1]) < 1e-12);
    ok('step 4, damped gains for λ = 3 cm: at most 1/(2 × 0.03) ≈ 17; 3.50 against 3.54 at σ₂ = 0.283 (1% less); 14.7 against 20 at σ = 0.05; 10 against 100 at σ = 0.01', has(T, '1/(2 × 0.03) ≈ 17', '倍数是 3.50，伪逆是 3.54，只差 1%', 'σ = 0.05 时是 14.7，伪逆是 20', 'σ = 0.01 时是 10，伪逆是 100') && Math.round(R.dls[0]) === 17 && f(R.dls[1], 2) === '3.50' && f(R.dls[2], 2) === '3.54' && Math.round((1 - R.dls[1] / R.dls[2]) * 100) === 1 && f(R.dls[3], 1) === '14.7' && f(R.dls[4], 1) === '10.0');
    ok('step 4, truncated SVD with ε = 3 cm: gain 1/ε = 33 just before the threshold; the fastest joint still reaches the 3 rad/s cap; it ends stopped, ' + f(R.tsvd.last[0], 1) + ' mm from the target', has(T, 'ε = 3 cm 时是 33', '照样顶到了 3 rad/s') && Math.round(1 / .03) === 33 && near(R.tsvd.peak, 3, 1e-9) && R.tsvd.last[2] < 1e-6);
    sec('text of step 5'); T = await secText('k-null');
    ok('step 5: on the default postures the elbow is above 45 cm for the hand between 36 and 56 cm (48.9 cm at 36 cm); at 0.55 m, tilting the last link from -90° to -120° lowers the elbow from 43.9 to 37.9 cm', has(T, '手在 36 cm 到 56 cm 之间时，肘都高过了 45 cm', '肘高 48.9 cm', '肘从 43.9 cm 降到 37.9 cm') && f(R.elbow[0], 2) === '0.36' && f(R.elbow[1], 2) === '0.56' && f(R.elbow[2] * 100, 1) === '48.9' && f(R.elbow[3] * 100, 1) === '43.9' && f(R.elbow[4] * 100, 1) === '37.9');
    ok('step 5, null-space projector at 0.55 m: diagonal 0.004, 0.115, 0.881; N (0, 0, -1) = (-0.061, 0.318, -0.881), which moves the hand by exactly 0', has(T, '0.004、0.115、0.881', 'N z = (-0.061, 0.318, -0.881) rad/s') && fs(R.N.diag, 3) === '0.004 0.115 0.881' && fs(R.N.Nz, 3) === '-0.061 0.318 -0.881' && Math.hypot(...R.N.JNz) < 1e-12);
    ok('step 5, the pseudoinverse is not repeatable: a circle of radius 8 cm, anticlockwise about (0.55, 0.10) m, started with the last link pointing down: ' + f(R.circle[0], 2) + '° of drift after one lap, ' + f(R.circle[1], 1) + '° after a hundred (hand back on its start point to ' + R.circle[2].toExponential(0) + ' mm)', has(T, '绕 (0.55, 0.10) m 这一点逆时针画半径 8 cm 的圆，最后一节每圈偏约 0.3°，一百圈就偏了 33°') && f(R.circle[0], 1) === '0.3' && Math.round(R.circle[1]) === 33 && R.circle[2] < 1e-6);
    sec('text of step 6'); T = await secText('k-force');
    ok('step 6: pushing right with 10 N needs (2.50, 4.52, 1.46) N·m (heights 0.25, 0.452, 0.146 m); gravity g = (12.32, 2.16, 0.09); pressing 10 N the total is (6.82, 0.11, -0.27) N·m', has(T, 'τ = (2.50, 4.52, 1.46) N·m', 'g = (12.32, 2.16, 0.09) N·m', '(6.82, 0.11, -0.27) N·m') && fs(R.tauR, 2) === '2.50 4.52 1.46' && fs(R.g, 2) === '12.32 2.16 0.09' && fs(R.tot, 2) === '6.82 0.11 -0.27');
    ok('step 6, force ellipse: 1.34 N and 3.54 N per N·m at 0.55 m; at 0.80 m σ₂ = 0.1452 and 1/0.1452 = 6.89 N', has(T, '只能推 1.34 N，沿 u₂ 能推 3.54 N', 'σ₂ = 0.1452', '1/0.1452 = 6.89 N') && f(R.s80[1], 4) === '0.1452' && f(1 / .1452, 2) === '6.89');
    ok('step 6, the curve of the largest press: highest near 0.34 m at about 148 N; 45 N at 0.85 m', has(T, '0.34 m 附近，约 148 N', '0.85 m 处 45 N') && f(R.fmax.best[0], 2) === '0.34' && Math.abs(R.fmax.best[1] - 148) < 1 && Math.round(R.fmax.f85) === 45);
    ok('step 6, joint stiffness for 1000 N/m across and 3000 N/m up at the hand: [970, 451, 95; 451, 330, 88; 95, 88, 25] N·m/rad; the term with the 10 N press changes the wrist entry by about 6%', has(T, '970', '对腕大约差 6%') && R.Kq.map(r => r.map(Math.round).join(' ')).join(' ; ') === '970 451 95 ; 451 330 88 ; 95 88 25' && Math.round(R.geo) === 6);
    sec('text of step 7'); T = await secText('k-mass');
    ok('step 7, M at 0.55 m: [0.561, 0.143, 0.012; 0.143, 0.152, 0.016; 0.012, 0.016, 0.004]; the last rod about its end m l²/3 = 0.00375', has(T, 'M = [0.561, 0.143, 0.012; 0.143, 0.152, 0.016; 0.012, 0.016, 0.004] kg·m²', 'm l² / 3 = 0.0038') && R.M.map(r => fs(r, 3)).join(' ; ') === '0.561 0.143 0.012 ; 0.143 0.152 0.016 ; 0.012 0.016 0.004' && near(.5 * .15 * .15 / 3, .00375, 1e-12));
    ok('step 7, Λ⁻¹ at 0.55 m: [6.10, 1.26; 1.26, 0.71]; lightest direction at 12.5°, 0.157 kg; heaviest at 102.5°, 2.32 kg; a 0.5 kg rod about one end feels like 0.5/3 ≈ 0.17 kg', has(T, 'Λ⁻¹ = [6.10, 1.26; 1.26, 0.71]', '最轻的方向朝 12.5°', '0.157 kg', '最重的方向朝 102.5°', '2.32 kg', '0.5 / 3 ≈ 0.17 kg') && fs([R.Li[0][0], R.Li[0][1], R.Li[1][1]], 2) === '6.10 1.26 0.71' && f(R.E.dl, 1) === '12.5' && f(1 / R.E.l[0], 3) === '0.157' && f(1 / R.E.l[1], 2) === '2.32' && f(.5 / 3, 2) === '0.17');
    ok('step 7, at 0.80 m: heaviest direction 3.8 kg, pointing 35° below the horizontal, along the last link (at ' + f(R.m80.phi, 1) + '°); 1.24 kg along the line from the shoulder', has(T, '最重的方向（3.8 kg）', '朝右下 35°', '0.80 m 处是 1.24 kg') && f(R.m80.heavy, 1) === '3.8' && Math.round(180 - R.m80.dirHeavy) === 35 && Math.abs(-R.m80.phi - (180 - R.m80.dirHeavy)) < 1 && f(R.m80.along, 2) === '1.24');
    ok('step 7, folded parts: the semi-axes of the mobility ellipse are 6.38 and 0.43 m/s per N·s; the dynamic manipulability ellipse 49.8 and 0.9 m/s²; kinetic energy at the fastest moment 0.082 J, of which the hand motion needs at least 0.032 J', has(T, '6.38 和 0.43 m/s', '49.8 和 0.9 m/s²', '0.082 焦耳', '0.032 焦耳') && fs(R.E.l, 2) === '6.38 0.43' && fs(R.dyn, 1) === '49.8 0.9' && f(R.KE, 3) === '0.082' && f(R.KEmin, 3) === '0.032');
    sec('text of step 8'); T = await secText('k-eom');
    ok('step 8, last link alone: 0.5 × 9.81 × 0.075 = 0.368; 0.368 × cos(-76.3°) = 0.087 N·m, the third component of g(q)', has(T, '0.0038 q̈₃ + 0.368 cos φ = τ₃', '0.368 × cos(-76.3°) = 0.087 N·m') && f(.5 * 9.81 * .075, 3) === '0.368' && f(.368 * Math.cos(-76.3 * Math.PI / 180), 3) === '0.087' && f(R.g[2], 3) === '0.087');
    ok('step 8, fastest moment: M q̈ = (-0.31, 0.01, 0.00), C q̇ = (0.05, -0.04, -0.00), g = (12.69, 2.35, 0.11), Jᵀ F = (-5.05, -0.96, -0.03); sum τ = (7.37, 1.36, 0.08) N·m', has(T, 'M q̈ = (-0.31, 0.01, 0.00)，C q̇ = (0.05, -0.04, -0.00)，g = (12.69, 2.35, 0.11)', 'Jᵀ F = (-5.05, -0.96, -0.03)', 'τ = (7.37, 1.36, 0.08) N·m') && fs(R.eom.Mq, 2) === '-0.31 0.01 0.00' && fs(R.eom.Cq, 2) === '0.05 -0.04 0.00' && fs(R.eom.g, 2) === '12.69 2.35 0.11' && fs(R.eom.JtF, 2) === '-5.05 -0.96 -0.03' && fs(R.eom.tau, 2) === '7.37 1.36 0.08' && [0, 1, 2].every(i => near(R.eom.Mq[i] + R.eom.Cq[i] + R.eom.g[i] + R.eom.JtF[i], R.eom.tau[i], 1e-6)));
    ok('step 8: at the turn at 0.80 m the inertia term at the shoulder is 0.78 N·m against 15.43 of gravity; over the whole round trip gravity is never less than 19.8 times the inertia term there; 16 times 0.78 is 12.5, comparable to gravity', has(T, '也只有 0.78 N·m，重力那项却是 15.43', '最接近的时候是 19.8 倍') && f(R.turn[0], 2) === '0.78' && f(R.turn[1], 2) === '15.43' && f(R.ratio[0], 1) === '19.8' && f(R.ratio[1], 2) === '0.78' && 16 * .78 > 12 && 16 * .78 < 15.43);
    ok('step 8: Ṁ - 2C is skew-symmetric with the Christoffel form of C (xᵀ(Ṁ - 2C)x = ' + R.skew.toExponential(1) + ' for a test x)', Math.abs(R.skew) < 1e-6);
    sec('text of step 9'); T = await secText('k-ne');
    ok('step 9, outward pass: angular velocities -0.47, 0.64, 1.06 rad/s; angular accelerations -0.75, 0.06, 0.30 rad/s²; elbow acceleration (0.07, 9.50), wrist (0.01, 9.63) m/s²', has(T, '-0.47、0.64、1.06 rad/s', '-0.75、0.06、0.30 rad/s²', '(0.07, 9.50) m/s²，腕是 (0.01, 9.63)') && fs(R.ne.w, 2) === '-0.47 0.64 1.06' && fs(R.ne.al, 2) === '-0.75 0.06 0.30' && fs(R.ne.ao[1], 2) === '0.07 9.50' && fs(R.ne.ao[2], 2) === '0.01 9.63');
    ok('step 9, inward pass: wrist (3.00, -5.14) N, elbow (3.06, 9.21) N, shoulder (3.13, 28.53) N; the arm weighs 39.2 N, the last link 4.9 N; torques (7.37, 1.36, 0.08) N·m, the same as Lagrange', has(T, '(3.00, -5.14) N', '(3.06, 9.21) N', '(3.13, 28.53) N', '39.2 N', '4.9 N', '(7.37, 1.36, 0.08) N·m') && fs(R.ne.f[2], 2) === '3.00 -5.14' && fs(R.ne.f[1], 2) === '3.06 9.21' && fs(R.ne.f[0], 2) === '3.13 28.53' && f(R.ne.W, 1) === '39.2' && f(R.ne.w3, 1) === '4.9' && [0, 1, 2].every(i => near(R.ne.tau[i], R.eom.tau[i], 1e-9)));
    sec('text of step 10'); T = await secText('k-ctrl');
    ok('step 10, joint PD holds the arm up by being off target: 12.32 / 400 = 0.031 rad (1.8°) at the shoulder, 0.6° at the elbow, 0.25° at the wrist; the hand sags 19 mm and pulls back 13 mm', has(T, '12.32 / 400 = 0.031 rad（1.8°）', '肘差 0.6°，腕差 0.25°', '下沉 19 mm、往回缩 13 mm') && f(12.32 / 400, 3) === '0.031' && f(R.sag.deg[0], 1) === '1.8' && f(R.sag.deg[1], 1) === '0.6' && f(R.sag.deg[2], 2) === '0.25' && Math.round(R.sag.dh[1]) === 19 && Math.round(R.sag.dh[0]) === 13);
    ok('step 10, constants: Kp 400, 200, 20; Kd 40, 16, 1; ω = 30 rad/s; 25 rad/s at the hand; force integral gain 8 /s; 0.5 ms steps; planned 4 mm into the table, 2 cm up in the air; table 20 000 N/m (0.5 mm for 10 N), friction 0.3', has(T, '肩 400、40，肘 200、16，腕 20、1', '这里取 30 rad/s', '2 × 25 × 速度差 + 25² × 位置差', '这里取 8 /s', '比桌面低 4 mm', '刚度 20 000 N/m，压进去 0.5 mm 就是 10 N') && R.ctl.kp.join(' ') === '400 200 20' && R.ctl.kd.join(' ') === '40 16 1' && R.ctl.wn === 30 && R.ctl.wx === 25 && R.ctl.ki === 8 && R.ctl.dt === .0005 && R.ctl.depth === .004 && R.ctl.air === .02 && R.ctl.k === 20000 && R.ctl.mu === .3 && near(20000 * .0005, 10, 1e-9));
    ok('step 10, computed torque: the error decays to a tenth in about 4/ω = 0.13 s ((1 + 4) e⁻⁴ = 0.092)', has(T, '大约 4/ω 秒（这里是 0.13 秒）就衰减到十分之一') && f(4 / 30, 2) === '0.13' && near(5 * Math.exp(-4), .1, .01));
    ok('step 10, stiffness under computed torque: 30² × 0.157 ≈ 141 N/m and 30² × 2.32 ≈ 2090 N/m; 3 N moves the hand 2 cm', has(T, '30² × 0.157 ≈ 141 N/m', '30² × 2.32 ≈ 2090 N/m', '3 N 就是 2 cm') && Math.round(900 * .157) === 141 && Math.round(900 * 2.32 / 10) * 10 === 2090 && Math.round(3 / 141 * 100) === 2);
    ok('step 10, impedance example: a 1000 N/m hand in series with the 20 000 N/m table is about 952 N/m; 1 cm of command gives about 9.5 N; a table 1 mm higher adds about 1 N', has(T, '合起来约 952 N/m', '压力大约 9.5 N', '力只多 1 N 左右') && Math.round(1000 * 20000 / 21000) === 952 && f(952.4 * .01, 1) === '9.5' && Math.round(952.4 * .001) === 1);
    // the table of results: every cell recomputed with the same simulation and the same statistics as the widget (2 round trips in the air, 3 on the table; the latest one counts)
    const C = await EV(() => { const K = TB, run = (kind, scene, T, wet, per) => { const S = K.wipeSim(kind, scene, T, wet), DT = K.CTL.DT, hist = [], n = Math.round((per || 2) * T / DT); for (let k = 1; k <= n; k++) { S.adv(); if (Math.round(S.st.t / DT) % 4 === 0) { const h = K.fk(S.st.q).h, Fv = K.tableForce(S.st.q, S.st.qd); hist.push([S.st.t, (h[0] - K.wipeX(S.st.t, T)) * 1000, (h[1] - (scene === 'table' ? 0 : K.CTL.AIR)) * 1000, Fv[1]]); } }
          const t0 = S.st.t - T, Rr = hist.filter(h => h[0] > t0), rms = k => Math.sqrt(Rr.reduce((s, h) => s + h[k] * h[k], 0) / Rr.length), b = Rr.map(h => h[3]), m = b.reduce((s, v) => s + v, 0) / b.length; return { rx: rms(1), ry: rms(2), m, sd: Math.sqrt(b.reduce((s, v) => s + (v - m) * (v - m), 0) / b.length), lo: Math.min(...b), hi: Math.max(...b) }; };
        const o = {}; for (const k of ['pd', 'pdg', 'ct', 'osc']) o[k] = { air: run(k, 'air', 3.2, false), fast: run(k, 'air', 1.6, false), wet: run(k, 'air', 3.2, true), tab: run(k, 'table', 3.2, false, 3) }; o.ctTabWet = run('ct', 'table', 3.2, true, 3); o.oscTabWet = run('osc', 'table', 3.2, true, 3); o.oscTabFast = run('osc', 'table', 1.6, false, 3); return o; });
    const mm = v => v < .995 ? v.toFixed(2) : v.toFixed(1), row = k => [mm(C[k].air.ry), mm(C[k].fast.ry), mm(C[k].wet.ry), mm(C[k].tab.rx), C[k].tab.m.toFixed(1), C[k].tab.sd.toFixed(1), C[k].tab.lo.toFixed(1), C[k].tab.hi.toFixed(1)].join(' ');
    ok('step 10, table, joint PD: 17.1, 16.9, 17.8 mm in the air; on the table 14.6 mm and 22.6 ± 9.0 N (12–44)', has(T, '关节 PD 17.1 mm 16.9 mm 17.8 mm 14.6 mm 22.6 ± 9.0 N（12–44）') && row('pd') === '17.1 16.9 17.8 14.6 22.6 9.0 12.2 44.1', row('pd'));
    ok('step 10, table, PD + gravity compensation: 0.48, 1.72, 5.19 mm; 4.1 mm and 4.4 ± 3.1 N (1.3–10.4)', has(T, 'PD + 重力补偿 0.48 mm 1.72 mm 5.19 mm 4.1 mm 4.4 ± 3.1 N（1.3–10.4）') && [C.pdg.air.ry.toFixed(2), C.pdg.fast.ry.toFixed(2), C.pdg.wet.ry.toFixed(2), C.pdg.tab.rx.toFixed(1), C.pdg.tab.m.toFixed(1), C.pdg.tab.sd.toFixed(1), C.pdg.tab.lo.toFixed(1), C.pdg.tab.hi.toFixed(1)].join(' ') === '0.48 1.72 5.19 4.1 4.4 3.1 1.3 10.4', row('pdg'));
    ok('step 10, table, computed torque: 0.00, 0.00, 6.11 mm; 20.5 mm and 8.4 ± 9.3 N (0.7–38); with the wet sponge on the table about 90 mm', has(T, '计算力矩 0.00 mm 0.00 mm 6.11 mm 20.5 mm 8.4 ± 9.3 N（0.7–38）', '沿桌面差到 90 mm') && [C.ct.air.ry.toFixed(2), C.ct.fast.ry.toFixed(2), C.ct.wet.ry.toFixed(2), C.ct.tab.rx.toFixed(1), C.ct.tab.m.toFixed(1), C.ct.tab.sd.toFixed(1), C.ct.tab.lo.toFixed(1), Math.round(C.ct.tab.hi)].join(' ') === '0.00 0.00 6.11 20.5 8.4 9.3 0.7 38' && Math.round(C.ctTabWet.rx) === 90 && C.ct.air.ry < .01 && C.ct.fast.ry < .01, row('ct'));
    ok('step 10, table, operational space + force: 0.00, 0.00, 9.36 mm; 0.30 mm and 10.00 ± 0.25 N (9.6–10.5); wet: 0.72 mm, still 10.00 ± 0.25 N; twice as fast: 1.7 mm, 7.3 to 13.1 N', has(T, '操作空间 + 力控制 0.00 mm 0.00 mm 9.36 mm 0.30 mm 10.00 ± 0.25 N（9.6–10.5）', '沿桌面差到 0.72 mm', '沿桌面差 1.7 mm，压力在 7.3 到 13.1 N 之间', '高度差 9.4 mm') && [C.osc.air.ry.toFixed(2), C.osc.fast.ry.toFixed(2), C.osc.wet.ry.toFixed(2), C.osc.tab.rx.toFixed(2), C.osc.tab.m.toFixed(2), C.osc.tab.sd.toFixed(2), C.osc.tab.lo.toFixed(1), C.osc.tab.hi.toFixed(1)].join(' ') === '0.00 0.00 9.36 0.30 10.00 0.25 9.6 10.5' && C.oscTabWet.rx.toFixed(2) === '0.72' && C.oscTabWet.m.toFixed(2) === '10.00' && C.oscTabWet.sd.toFixed(2) === '0.25' && C.oscTabFast.rx.toFixed(1) === '1.7' && C.oscTabFast.lo.toFixed(1) === '7.3' && C.oscTabFast.hi.toFixed(1) === '13.1', row('osc') + ' ' + JSON.stringify(C.oscTabFast));
    sec('text of step 11 and the summary'); T = await secText('k-map');
    ok('step 11: the rank-1 approximation of J at 0.55 m is 0.744 u₁ v₁ᵀ and misses J by σ₂ = 0.283', has(T, '0.744 u₁ v₁ᵀ', '0.283 m/s'));
    T = await secText('k-sum');
    ok('summary table: semi-axes 0.744 and 0.283 m/s; 1.34 and 3.54 N; lightest 0.157 kg, heaviest 2.32 kg', has(T, '0.744 和 0.283 m/s', '1.34 和 3.54 N', '最轻 0.157 kg，最重 2.32 kg'));
    ok('quiz: 0.1 / 0.283 = 0.35 rad/s and 0.1 / 0.744 = 0.13 rad/s; 0.55 × 10 = 5.5 N·m; 12.3 - 5.5 = 6.8 N·m; stiffness 141 N/m; force between 0.7 and 38 N', has(T, '0.1 / 0.283 = 0.35 rad/s', '0.1 / 0.744 = 0.13 rad/s', '0.55 × 10 = 5.5 N·m', '12.3 N·m', '只要 6.8 N·m', '硬度才 141 N/m', '在 0.7 到 38 N 之间跳') && f(.1 / .283, 2) === '0.35' && f(.1 / .744, 2) === '0.13' && f(R.g[0], 1) === '12.3' && f(R.tot[0], 1) === '6.8'); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
