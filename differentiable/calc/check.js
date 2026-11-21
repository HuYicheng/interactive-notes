// Check the numbers of "Differentiability and Gradients" (differentiable/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt literally: pressing buttons, moving sliders, dragging the arm's target with the mouse and
// letting the learning and fitting interactives run to the end) and compares the readouts with the numbers quoted in
// the "你会看到 / What you will see" lines. Numbers a readout does not show (values at a given number of throws, what
// is drawn only on a canvas, what the figures state) are recomputed with the page's own engine, window.TB, inside the
// page, with the same loops and the same random seeds as the interactives; the comments say "same loop as the
// interactive" where that is done.
// Part B recomputes, with the same engine, the numbers quoted in the formula cards, the paragraphs and the figures.
//   usage: node check.js /absolute/path/to/differentiable/index.html      (takes several minutes)
// The random numbers are seeded, so every number is the same on every run in a Chromium browser.
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/differentiable/index.html'); process.exit(2); }
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
  // wait until a readout matches (training widgets): polls every 100 ms, at most `max` seconds
  const until = async (w, re, max) => { for (let k = 0; k < (max || 120) * 10; k++) { const m = await w.met(); if (re.test(m)) return m; await p.waitForTimeout(100); } return await w.met(); };
  // drag inside a canvas from one canvas pixel to another
  const dragPx = async (cvId, a, c) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const r = await p.evaluate(i => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left, q.top]; }, cvId);
    await p.mouse.move(r[0] + a[0], r[1] + a[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(r[0] + a[0] + (c[0] - a[0]) * k / 6, r[1] + a[1] + (c[1] - a[1]) * k / 6); await p.mouse.up(); await p.waitForTimeout(250); };
  // run a snippet inside the page, where the engine TB lives; the snippet is the body of a function
  const EV = (fn, arg) => p.evaluate(fn, arg);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-')) : NaN; };
  // the visible text of a section, folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);

  // ======================= Part A: the interactives, operated as each "Play first" prompt says =======================
  const row = w => w.text('.row');
  const KEEP = {};   // readouts kept for Part B
  // ---- step 0 · the task
  { sec('step 0 · task'); const w = W('task'); await w.show();
    const st = {}; for (const t of [0.2, 0.5, 0.78, 0.83]) { await w.set('task-k', t, 200); st[t] = await w.status(); }
    ok('task, 0.2 s after release: "horizontally 29 cm every 0.1 s"', has(st[0.2], '水平方向每 0.1 秒走 29 cm'), st[0.2]);
    ok('task, 0.5 s: past the top (1.43 m above the ground); at 0.7 s right above the bin but still 0.63 m high', has(st[0.5], '最高点（离地 1.43 m）', '0.7 秒时它正好在筐的上方，可还有 0.63 m 高'), st[0.5]);
    ok('task, back at rim height: 2.25 m from the release point, 25 cm beyond the centre of the bin', has(st[0.78], '离出手点 2.25 m', '远了 25 cm'), st[0.78]);
    ok('task, landing: on the ground at 2.40 m, e = +25 cm', has(st[0.83], '落在 2.40 m', '+25 cm'), st[0.83]);
    const r = await EV(() => { const K = TB, A = 45 * K.DEG, v = 4.1, y = t => K.H0 + v * Math.sin(A) * t - .5 * K.G * t * t, x = t => v * Math.cos(A) * t;
      const tp = v * Math.sin(A) / K.G, tg = (v * Math.sin(A) + Math.sqrt(Math.pow(v * Math.sin(A), 2) + 2 * K.G * (K.H0 - K.R))) / K.G, L = K.land(v, A);
      return { dx: x(.1) * 100, rise: [1, 2, 3].map(k => (y(k / 10) - y((k - 1) / 10)) * 100), fall: [4, 5, 6, 7].map(k => (y((k - 1) / 10) - y(k / 10)) * 100), tp, hp: y(tp), x7: x(.7), y7: y(.7), xr: L.x, xg: x(tg), bin: [K.D0 - K.HW, K.D0 + K.HW], HR: K.HR }; });
    ok('engine: 29 cm forward in every 0.1 s; rises of 24, 14 and under 5 cm in the first three frames; each later frame falls further than the one before',
      near(r.dx, 29.0, .05) && near(r.rise[0], 24.1, .05) && near(r.rise[1], 14.3, .05) && r.rise[2] > 4 && r.rise[2] < 5 && r.fall.every((f, i) => f > 0 && (i === 0 || f > r.fall[i - 1])), JSON.stringify(r));
    ok('engine: the top is reached about 0.3 s after release, 1.43 m above the ground', near(r.tp, 0.296, .001) && near(r.hp, 1.429, .001), r.tp + ' ' + r.hp);
    ok('engine: at 0.7 s the ball is above the bin (1.85 … 2.15 m) with its centre 0.63 m above the ground, the rim being 0.3 m high', r.x7 > r.bin[0] && r.x7 < r.bin[1] && near(r.y7, 0.628, .001) && r.HR === 0.3, r.x7 + ' ' + r.y7);
    ok('engine: back at rim height at 2.25 m (25 cm beyond the centre), on the ground at 2.40 m', near(r.xr, 2.249, .001) && near(r.xg, 2.404, .001), r.xr + ' ' + r.xg); }

  // ---- step 1 · one knob
  { sec('step 1 · knob'); const w = W('knob'); await w.show(); let m = await w.met();
    ok('knob, start (4.100 m/s, 45°): landing point 2.249 m, miss +24.9 cm, derivative 0.887', has(m, '落点 x 2.249 m', '+24.9 cm', '0.887'), m);
    await w.click('按导数改一步', 300); await w.settle(); let ro = await row(w); m = await w.met();
    ok('knob, one press of "Use the derivative": speed 3.819 m/s, miss +0.7 cm, in', has(ro, '3.819') && has(m, '+0.7 cm') && near(num(m, /落点 x ([\d.]+) m/), 2.007, .0006), ro + ' || ' + m);
    await w.click('按导数改一步', 300); await w.settle(); ro = await row(w); m = await w.met();
    ok('knob, second press: 3.810 m/s, miss 0.0 cm', has(ro, '3.810') && /差 e = x - D [+-]0\.0 cm/.test(m), ro + ' || ' + m);
    await w.click('仰角 α', 400); ro = await row(w); m = await w.met();
    ok('knob, switching to the angle starts again from 45.0° (speed fixed at 4.1 m/s), miss +24.9 cm', has(ro, '45.0°') && has(m, '+24.9 cm'), ro + ' || ' + m);
    await w.click('按导数改一步', 300); await w.settle(); ro = await row(w); m = await w.met();
    ok('knob, angle, first press: jumps to 61.5°, now 25.1 cm short', has(ro, '61.5°') && has(m, '-25.1 cm'), ro + ' || ' + m);
    await w.click('按导数改一步', 300); await w.settle(); ro = await row(w); m = await w.met(); let s = await w.status();
    ok('knob, angle, second press: 55.9°, miss -2.6 cm (within 10 cm, so in): 2 presses', has(ro, '55.9°') && has(m, '-2.6 cm', '已经扔了几次 2'), ro + ' || ' + m);
    await w.set('knob-v', 37, 400); m = await w.met(); s = await w.status();
    ok('knob, angle dragged to 37.0°: derivative -0.0007 m per degree; the tangent would meet the bin-centre line only at 469.8°', has(m, '-0.0007') && has(s, '37.0°', '469.8°'), m + ' || ' + s);
    await w.click('按导数改一步', 300); await w.settle(); ro = await row(w); m = await w.met(); s = await w.status();
    ok('knob, pressing there: the slider stops at its end, 80.0°, and the ball lands 130.9 cm short', has(ro, '80.0°') && has(m, '-130.9 cm') && has(s, '80.0°'), ro + ' || ' + m + ' || ' + s);
    await w.set('knob-z', 2, 400); ro = await row(w);
    ok('knob, "Zoom" at its maximum reads 100×', has(ro, '100×'), ro);
    // same window as the interactive at 100×: ±0.375° around the dot, ±0.00925 m around its landing point
    const z = await EV(() => { const K = TB, D2R = K.DEG, v = 4.1, X = a => K.land(v, a * D2R).x, u = 80, x0 = X(u), d = (X(u + 1e-4) - X(u - 1e-4)) / 2e-4, uw = 75 / 2 / 100, xw = (2.45 - .6) / 2 / 100; let mx = 0;
      for (let k = -100; k <= 100; k++) { const a = u + uw * k / 100, lin = x0 + d * (a - u); if (Math.abs(lin - x0) <= xw) mx = Math.max(mx, Math.abs(X(a) - lin)); } return { d, mx, xw, frac: mx / (2 * xw) }; });
    ok('engine: inside that window the curve and its tangent differ by less than 1/1000 of the window height (far less than a pixel): one line', z.frac < .001 && near(z.d, -0.0669, .0001), JSON.stringify(z)); }

  // ---- step 2 · two knobs: the loss landscape
  { sec('step 2 · land'); const w = W('land'); await w.show(); let m = await w.met();
    ok('land, start: 4.100 m/s, 45.0°, miss +24.9 cm, ∂L/∂v 0.2209, ∂L/∂α -0.2150 per radian; step size 0.50', has(m, '4.100 m/s', '45.0°', '+24.9 cm', '0.2209', '-0.2150') && has(await row(w), '0.50'), m);
    await w.click('走一步', 300); m = await w.met(); let s = await w.status();
    ok('land, one step: speed 3.989 m/s (0.111 slower), angle 51.2° (6.2° higher), miss +2.7 cm, "already in"', has(m, '3.989 m/s', '51.2°', '+2.7 cm') && has(s, '现在已经能进筐了') && near(4.100 - 3.989, 0.111, 1e-9) && near(51.2 - 45.0, 6.2, 1e-9), m + ' || ' + s);
    const hint = await w.text('.hint');
    ok('land: the map has the same scale across and up (so the arrow is drawn at right angles to the contours)', has(hint, '图上横竖的比例一样'), hint);
    const g = await EV(() => { const K = TB, D = K.D0, out = []; for (const [v, a] of [[4.1, 45], [3.6, 30], [4.3, 60], [3.9, 20], [4.4, 40]]) { const L = K.land(v, a * K.DEG), e = L.x - D, gv = e * L.dxdv, ga = e * L.dxda; out.push((gv * (-L.dxda) + ga * L.dxdv) / (Math.hypot(gv, ga) * Math.hypot(L.dxdv, L.dxda))); } return out; });
    ok('engine: at five starting points the gradient of the loss is perpendicular to the contour of the miss (cosine 0)', g.every(c => Math.abs(c) < 1e-12), g.join(' '));
    // the prompt (patched): back to 4.1 m/s, 45°, step size 1.5, one step at a time; three slider positions read "1.5"
    const runs = [];
    for (const sv of [0.17, 0.18, 0.19]) { await w.click('回到 4.1', 200); await w.set('land-e', sv, 150); const lab = await row(w), H = [];
      for (let k = 1; k <= 45; k++) { await w.click('走一步', 40); const q = (await w.met()).match(/出手速度 v ([\d.]+) m\/s 仰角 α ([\d.]+)° 差 e ([+-][\d.]+) cm/); H.push([+q[1], +q[2], +q[3]]); }
      let k0 = 1; for (let k = 44; k >= 0; k--) { if (Math.abs(H[k][2]) > 0.05) { k0 = k + 2; break; } } runs.push({ lab, H, k0, st: await w.status() }); }
    ok('land, step size "1.5" (3 slider positions read 1.5), step 1: lands at 3.76 … 3.77 m/s, 63° … 64°, with a miss of -55 … -59 cm, further off than the +24.9 cm at the start',
      runs.every(r => has(r.lab, '1.5') && r.H[0][0] >= 3.755 && r.H[0][0] < 3.775 && r.H[0][1] >= 63 && r.H[0][1] < 64.5 && r.H[0][2] <= -54.5 && r.H[0][2] >= -59.5), runs.map(r => r.H[0].join('/')).join(' | '));
    ok('land, step size 1.5, step 2: hits the bottom edge of the map (10.0°); the status says the steps are too large', runs.every(r => r.H[1][1] === 10 && has(r.st, '步子太大了')), runs.map(r => r.H[1].join('/')).join(' | '));
    ok('land, step size 1.5: settles on the valley floor (miss 0.0 cm) after between a dozen and thirty steps, near 3.74 m/s, with the angle between 31° and 39°',
      runs.every(r => r.k0 >= 12 && r.k0 <= 30 && near(r.H[44][0], 3.741, .0021) && r.H[44][1] >= 31 && r.H[44][1] < 39.5 && Math.abs(r.H[44][2]) < .05), runs.map(r => r.k0 + ': ' + r.H[44].join('/')).join(' | '));
    await w.click('回到 4.1', 200); await w.set('land-e', -0.3, 150); }

  // ---- step 2 · the computational graph
  { sec('step 2 · graph'); const w = W('graph'); await w.show();
    const waitSt = async (w, re, max) => { let t = ''; for (let k = 0; k < max * 10; k++) { t = await w.status(); if (re.test(t)) break; await p.waitForTimeout(100); } await p.waitForTimeout(200); return t; };
    await w.click('正向：算一遍', 300); let s = await waitSt(w, /最后得到损失/, 20); await p.waitForTimeout(4500); let m = await w.met();   // the pass is animated box by box
    ok('graph, one forward pass: L = 0.0310, a miss of 0.249 m', has(s, '0.0310') && has(s, '0.249') && has(m, '正向算了几遍 1'), s + ' || ' + m);
    await w.click('反向：往回传', 300); s = await waitSt(w, /反向走完/, 20); m = await w.met();
    ok('graph, one reverse pass: ∂L/∂v = 0.221 and ∂L/∂α = -0.215 (per radian) after 1 forward and 1 reverse pass', has(s, '∂L/∂v = 0.221', '∂L/∂α = -0.215') && has(m, '正向算了几遍 1', '反向算了几遍 1'), s + ' || ' + m);
    const c = await EV(() => { const K = TB, L = K.land(4.1, 45 * K.DEG), e = L.x - K.D0, vy = L.vy, dtdvy = (1 + vy / Math.sqrt(vy * vy + 2 * K.G * (K.H0 - K.HR))) / K.G, avx = e * L.t, avy = e * L.vx * dtdvy, c = Math.cos(45 * K.DEG), s = Math.sin(45 * K.DEG);
      return { Lv: .5 * e * e, e, avx, avy, c, s, vs: 4.1 * s, v1: avx * c, v2: avy * s, a1: avx * (-4.1 * s), a2: avy * (4.1 * c), dtdvy, t: L.t, vx: L.vx, dv: e * L.dxdv, da: e * L.dxda }; });
    ok('engine (what the boxes show): ∂L/∂v_x = 0.193, ∂L/∂v_y = 0.119; the arrows from v carry × 0.707, those from α × -2.899 and × 2.899', near(c.avx, 0.193, .0005) && near(c.avy, 0.119, .0005) && near(c.c, 0.707, .0005) && near(c.vs, 2.899, .0005), JSON.stringify(c));
    ok('engine: the two paths into v bring back 0.193 × 0.707 and 0.119 × 0.707, which add up to 0.221; the two into α combine to -0.215', near(c.v1 + c.v2, c.dv, 1e-12) && near(c.dv, 0.2209, .0001) && near(0.193 * 0.707 + 0.119 * 0.707, 0.221, .0006) && near(c.a1 + c.a2, c.da, 1e-12) && near(c.da, -0.2150, .0001), c.v1 + ' ' + c.v2 + ' ' + c.a1 + ' ' + c.a2);
    await w.click('清空', 300); await w.click('正向模式：只对 v', 300); s = await waitSt(w, /正向模式走完/, 20); m = await w.met();
    ok('graph, forward mode for v alone: 0.221 after 1 pass', has(s, '∂L/∂v = 0.221') && has(m, '正向算了几遍 1'), s + ' || ' + m);
    await w.click('正向模式：只对 α', 300); await p.waitForTimeout(600); s = await waitSt(w, /正向模式走完：这一遍只得到了 ∂L\/∂α/, 20); m = await w.met();
    ok('graph, forward mode for α alone: -0.215; 2 passes in all; trying knob by knob takes 3', has(s, '∂L/∂α = -0.215') && has(m, '正向算了几遍 2', '挨个试要几遍 3 遍正向'), s + ' || ' + m); }

  // ---- step 3 · three ways of learning the rule
  { sec('step 3 · learn'); const w = W('learn'); await w.show(); let m = await w.met(), s = await w.status();
    ok('learn, start: all three at 20.4 cm · 27%; 321 weights, batches of 8 throws', (m.match(/20\.4 cm · 27%/g) || []).length === 3 && has(s, '321 个权重', '扔 8 次'), m + ' || ' + s);
    await w.click('开始学', 300); for (let k = 0; k < 600; k++) { s = await w.status(); if (/扔够了 20480 次/.test(s)) break; await p.waitForTimeout(250); } m = await w.met();
    ok('learn, after all 20480 throws: gradient 0.4 cm · 100%; trial and error 4.6 cm · 93% and 4.1 cm · 80%', has(m, '穿过物理求导 0.4 cm · 100%', '试错：知道差多少 4.6 cm · 93%', '试错：只知道进没进 4.1 cm · 80%', '每种扔了 20480'), m);
    // same loop and seeds as the interactive (learn): network 1-16-16-1 tanh from K.rng(seed), Adam 0.01, batches of 8, noise 0.15 m/s
    const R = await EV(() => { const K = TB, A = 45 * K.DEG, DL = 1.4, DH = 2.6, TOL = .10, B = 8, SIG = .15, MAXT = 20480, LR = .01;
      const TEST = [...Array(41).keys()].map(i => DL + (DH - DL) * i / 40), enc = D => (D - 2) / .6, dec = y => 3.9 + .6 * y, KS = ['grad', 'dist', 'hit'];
      const evalN = net => { const Xi = Float64Array.from(TEST.map(enc)), Y = K.fwd(net, Xi, TEST.length).Y; let s = 0, h = 0; TEST.forEach((D, i) => { const e = Math.abs(K.land(dec(Y[i]), A).x - D); s += e; if (e < TOL) h++; }); return { err: s / TEST.length, hit: h / TEST.length }; };
      const run = seed => { const net0 = K.mlp([1, 16, 16, 1], 'tanh', K.rng(seed)); const Sx = KS.map((k, i) => { const net = K.copyNet(net0); const s = { k, net, o: K.adam(net, LR), r: K.rng(seed * 7 + i + 1), thr: 0 }; s.ev = evalN(net); s.sm = s.ev.err; return s; });
        const out = { start: Sx.map(s => (s.sm * 100).toFixed(1) + ' cm · ' + Math.round(s.ev.hit * 100) + '%'), at: {}, nP: K.nParams(net0), lo: [1e9, 1e9, 1e9], hi: [0, 0, 0] };
        const upd = s => { const r = s.r, Ds = [...Array(B)].map(() => DL + (DH - DL) * r()), Xi = Float64Array.from(Ds.map(enc)), fw = K.fwd(s.net, Xi, B), dY = new Float64Array(B);
          if (s.k === 'grad') { for (let i = 0; i < B; i++) { const L = K.land(dec(fw.Y[i]), A), e = L.x - Ds[i]; dY[i] = e * L.dxdv * .6 / B; } }
          else { const Rw = [], E = []; for (let i = 0; i < B; i++) { const ep = K.gauss(r), e = K.land(dec(fw.Y[i]) + SIG * ep, A).x - Ds[i]; Rw.push(s.k === 'dist' ? -e * e : (Math.abs(e) < TOL ? 1 : 0)); E.push(ep); } const mb = Rw.reduce((p, q) => p + q, 0) / B; for (let i = 0; i < B; i++) dY[i] = -(Rw[i] - mb) * E[i] / SIG * .6 / B; }
          const G = K.zeros(s.net); K.bwd(s.net, fw, dY, B, G); K.astep(s.o, G); s.thr += B; };
        while (Sx[0].thr < MAXT) { Sx.forEach((s, i) => { upd(s); if (s.thr % 32 === 0 || s.thr < 256) { s.ev = evalN(s.net); s.sm = Math.exp(.75 * Math.log(s.sm) + .25 * Math.log(s.ev.err)); if (s.thr >= 5000) { out.lo[i] = Math.min(out.lo[i], s.sm * 100); out.hi[i] = Math.max(out.hi[i], s.sm * 100); } } });
          if ([96, 104, 9984, 10016, 20480].includes(Sx[0].thr)) out.at[Sx[0].thr] = Sx.map(s => +(s.sm * 100).toFixed(1)); }
        out.end = Sx.map(s => (s.sm * 100).toFixed(1) + ' cm · ' + Math.round(s.ev.hit * 100) + '%'); return out; };
      const res = {}; for (const seed of [1, 2, 3, 4, 5, 6]) res[seed] = run(seed); return res; });
    const r1 = R[1];
    ok('same loop as the interactive, seed 1: the network has 321 weights and the re-run ends exactly where the interactive ended', r1.nP === 321 && r1.end.join(' | ') === '0.4 cm · 100% | 4.6 cm · 93% | 4.1 cm · 80%' && r1.start[0] === '20.4 cm · 27%', r1.end.join(' | '));
    ok('re-run, around 100 throws (96 and 104): gradient four to five centimetres, miss-distance trial and error eight to nine, in-or-out trial and error 16 to 18 cm',
      [96, 104].every(t => r1.at[t][0] >= 4 && r1.at[t][0] < 5 && r1.at[t][1] >= 8 && r1.at[t][1] < 9.5 && r1.at[t][2] >= 15.5 && r1.at[t][2] <= 18.5), JSON.stringify(r1.at[96]) + JSON.stringify(r1.at[104]));
    ok('re-run, around 10 000 throws (9984 and 10016): gradient 0.5 cm; both kinds of trial and error between 2 and 4 cm', [9984, 10016].every(t => r1.at[t][0] === 0.5 && r1.at[t][1] >= 2 && r1.at[t][1] <= 4 && r1.at[t][2] >= 2 && r1.at[t][2] <= 4), JSON.stringify(r1.at[9984]) + JSON.stringify(r1.at[10016]));
    ok('re-run, after 5000 throws: the two trial-and-error lines stay between 2 and 11 cm (to the nearest cm), the gradient line below 1.5 cm', Math.min(r1.lo[1], r1.lo[2]) >= 1.95 && Math.max(r1.hi[1], r1.hi[2]) < 11.5 && r1.hi[0] < 1.5, r1.lo.join(' ') + ' / ' + r1.hi.join(' '));
    const ends = [2, 3, 4, 5, 6].map(sd => R[sd].at[20480]);
    ok('re-run, the next 5 starts (seeds 2 to 6): the gradient ends between 0.2 and 0.9 cm, trial and error between 2.6 and 7.1 cm', Math.min(...ends.map(e => e[0])) === 0.2 && Math.max(...ends.map(e => e[0])) === 0.9 && Math.min(...ends.map(e => Math.min(e[1], e[2]))) === 2.6 && Math.max(...ends.map(e => Math.max(e[1], e[2]))) === 7.1, JSON.stringify(ends));
    await w.click('换个开头重来', 500); m = await w.met();
    ok('learn, "Restart with new weights": the next start is the one of seed 2 in the re-run', (m.match(new RegExp(R[2].start[0].replace('.', '\\.'), 'g')) || []).length === 3, m + ' vs ' + R[2].start[0]); }

  // ---- step 4 · collisions
  { sec('step 4 · rim'); const w = W('rim'); await w.show(); await p.waitForTimeout(1500); let m = await w.met(), s = await w.status();
    KEEP.rim0 = num(m, /带噪声的进筐率 ([\d.]+)%/);
    ok('rim, start (3.550 m/s): out, rests 0.28 m short of the centre; local derivative -0.49; hit rate with noise 8.3%', has(m, '停在哪（离中心） -0.28 m', '局部导数 -0.49', '带噪声的进筐率 8.3%') && has(s, '没进'), m + ' || ' + s);
    await w.click('按局部梯度调 10 步', 400); await w.settle(); let ro = await row(w); m = await w.met(); s = await w.status();
    ok('rim, "10 steps by the local gradient": slower and slower, down to the bottom of the slider, 3.450 m/s; still out, resting 0.23 m from the centre', has(ro, '3.450') && has(m, '-0.23 m') && has(s, '还是没进', '越走越远') && /min="3.45"|3\.45/.test(await w.val('rim-v')), ro + ' || ' + m + ' || ' + s + ' || ' + (await w.val('rim-v')));
    await w.click('回到 3.55', 300); ro = await row(w);
    ok('rim, back at 3.55 with noise 0.080', has(ro, '3.550', '0.080'), ro);
    await w.click('按带噪声的进筐率调 10 步', 400); await w.settle(); ro = await row(w); m = await w.met(); s = await w.status();
    KEEP.rim10 = [num(ro, /出手速度 ([\d.]+)/), num(m, /带噪声的进筐率 ([\d.]+)%/)];
    ok('rim, "10 steps by the noisy hit rate" (noise 0.080): reaches 3.700 m/s, hit rate 67%', has(ro, '3.700') && has(m, '带噪声的进筐率 67%') && has(s, '现在进筐率 67%'), ro + ' || ' + m + ' || ' + s);
    await w.set('rim-s', 0.04, 300); await w.click('回到 3.55', 300); KEEP.rim04 = num(await w.met(), /带噪声的进筐率 ([\d.]+)%/); await w.click('按带噪声的进筐率调 10 步', 400); await w.settle(); ro = await row(w); s = await w.status();
    ok('rim, noise 0.040, back to 3.55, 10 steps: creeps only to 3.555; "of the 320 throws only 1 went in"', has(ro, '3.555', '0.040') && has(s, '320 次里一共只进了 1 次'), ro + ' || ' + s);
    await w.set('rim-v', 3.64, 300); m = await w.met(); s = await w.status(); const d1 = num(m, /局部导数 (-?[\d.]+)/);
    ok('rim, speed 3.640: local derivative 89.81; 0.001 m/s moves the resting point by 8.98 cm', d1 === 89.81 && has(s, '停的位置变 8.98 cm'), m + ' || ' + s);
    await w.set('rim-v', 4.02, 300); m = await w.met(); s = await w.status(); const d2 = num(m, /局部导数 (-?[\d.]+)/);
    ok('rim, speed 4.020: local derivative 99.47; 0.001 m/s moves the resting point by 9.95 cm (so 9 to 10 cm at both places)', d2 === 99.47 && has(s, '停的位置变 9.95 cm'), m + ' || ' + s);
    const near2 = []; for (const v of [3.63, 3.635, 3.645, 3.65, 4.01, 4.015, 4.025, 4.03]) { await w.set('rim-v', v, 120); near2.push(num(await w.met(), /局部导数 (-?[\d.]+)/)); }
    ok('rim, 0.005 and 0.010 m/s to either side of 3.64 and 4.02: local derivatives of several tens to more than a hundred (15 … 119)', near2.every(d => d > 15 && d < 120) && Math.max(...near2) > 100, near2.join(' '));
    await w.click('截断', 400); await w.settle(); ro = await row(w); m = await w.met(); s = await w.status();
    ok('rim, "Truncate": a few steps to 3.810 m/s, in', has(ro, '3.810') && has(s, '截断：不管碰筐沿以后的事') && has(m, '带噪声的进筐率 100%'), ro + ' || ' + m + ' || ' + s);
    // the five fates of figure F3 and the speed ranges of the list, with the same collision code as the interactive (K.fly)
    const F = await EV(() => { const K = TB, A = 45 * K.DEG, D = K.D0; const kind = v => { const f = K.fly(v, A, D), hs = f.hits.filter(h => h.k !== 'floor'); return { inside: f.inside, nRim: f.nRim, first: hs.length ? hs[0].k : 'none', side: hs.length ? (hs[0].x < D ? 'near' : 'far') : '', rest: f.xf - D, xf: f.xf }; };
      const key = q => (q.inside ? 'IN' : 'out') + ' ' + q.first + ' ' + q.side, runs = []; let cur = null;
      for (let i = 0; i <= 750; i++) { const v = 3.45 + i * .001, k = key(kind(v)); if (!cur || cur.k !== k) { cur = { k, from: +v.toFixed(3) }; runs.push(cur); } cur.to = +v.toFixed(3); }
      return { five: [3.50, 3.62, 3.81, 4.00, 4.10].map(kind), runs, air: [3.56, 3.64, 3.8, 4.02, 4.05].map(v => K.land(v, A).dxdv) }; });
    const f5 = F.five;
    ok('engine, figure F3: 3.50 m/s hits the outside face of the near wall and rests in front of the bin; 3.62 hits the near rim and bounces away; 3.81 lands inside; 4.00 hits the far rim and ends outside; 4.10 touches nothing and lands beyond the bin at 2.40 m',
      f5[0].first === 'face' && f5[0].side === 'near' && !f5[0].inside && f5[0].rest < -.15 && f5[1].first === 'rim' && f5[1].side === 'near' && !f5[1].inside && f5[2].inside && f5[2].nRim === 0 && f5[3].first === 'rim' && f5[3].side === 'far' && !f5[3].inside && f5[4].first === 'none' && !f5[4].inside && near(f5[4].xf, 2.404, .001), JSON.stringify(f5));
    const R0 = F.runs, find = k => R0.filter(r => r.k === k);
    ok('engine, the list of fates: below 3.56 m/s the outside of the near wall; near rim from 3.56 to 3.68 (mostly out, sometimes in); in without touching a rim from 3.68 to 3.95; far rim from 3.95 to 4.05 (first still in, then out); over the far rim above 4.05',
      R0[0].k === 'out face near' && R0[0].to === 3.562 && R0.filter(r => / rim near$/.test(r.k)).every(r => r.from >= 3.563 && r.to <= 3.678) && find('IN rim near').length >= 1 && R0.filter(r => /^IN (none |face far)$/.test(r.k)).length === 2 && find('IN none ')[0].from === 3.679 && find('IN face far')[0].to === 3.946 &&
      R0.filter(r => / rim far$/.test(r.k)).every(r => r.from >= 3.947 && r.to <= 4.053) && R0.filter(r => / rim far$/.test(r.k))[0].k === 'IN rim far' && R0[R0.length - 1].k === 'out none ' && R0[R0.length - 1].from === 4.054, R0.map(r => r.k + ' ' + r.from + '–' + r.to).join(' | '));
    ok('engine: in free flight the landing point moves only 0.8 to 0.9 m per m/s over these speeds (against local derivatives of about 100 near the rims)', F.air.every(d => d >= .78 && d < .9), F.air.join(' ')); }

  // ---- step 5 · a soft edge
  { sec('step 5 · edge'); const w = W('edge'); await w.show(); let m = await w.met(), ro = await row(w);
    ok('edge, start: guess at pixel 10.00, hard edge, derivative 0.000, 21.30 pixels from the truth', has(ro, '10.00', '硬') && has(m, '导数 dL/du 0.000', '离真位置 21.30 px'), ro + ' || ' + m);
    await w.click('按梯度走 30 步', 400); await w.settle(); ro = await row(w); m = await w.met(); let s = await w.status();
    ok('edge, hard, "30 gradient steps": the guess has not moved (10.00)', has(ro, '10.00') && has(m, '离真位置 21.30 px') && has(s, '一步也没动'), ro + ' || ' + m + ' || ' + s);
    await w.set('edge-s', 2, 300); m = await w.met(); const d2 = num(m, /导数 dL\/du (-?[\d.]+)/);
    await w.click('按梯度走 30 步', 400); await w.settle(); ro = await row(w); s = await w.status();
    ok('edge, softness 2 pixels: derivative still 0.000, 30 steps only creep to 10.01', d2 === 0 && has(ro, '10.01', '2.0'), ro + ' || ' + m + ' || ' + s);
    await w.set('edge-s', 6, 300); m = await w.met(); const d6 = num(m, /导数 dL\/du (-?[\d.]+)/);
    await w.click('按梯度走 30 步', 400); await w.settle(); ro = await row(w); const m6 = await w.met(); s = await w.status();
    ok('edge, softness 6 pixels: derivative -0.020; 30 steps arrive at 31.45, 0.15 pixels from the truth', d6 === -0.02 && has(ro, '31.45') && has(m6, '离真位置 0.15 px') && has(s, '找到了'), ro + ' || ' + m + ' || ' + m6);
    await w.click('回到第 10 个像素', 300); ro = await row(w);
    ok('edge, "Back to pixel 10" also returns the softness to hard', has(ro, '10.00', '硬'), ro);
    await w.click('由粗到细', 400); await w.settle(); ro = await row(w); m = await w.met();
    ok('edge, "Coarse to fine": ends at 31.34, 0.04 pixels off', has(ro, '31.34') && has(m, '离真位置 0.04 px'), ro + ' || ' + m); }

  // ---- step 5 · fitting Gaussians to a photo
  { sec('step 5 · splat'); const w = W('splat'); await w.show(); await p.waitForTimeout(1200); let m = await w.met();
    ok('splat, start: 120 Gaussians, 1080 knobs, PSNR 12.3 dB', has(m, '旋钮个数 1080', '走了几步 0', '12.3 dB'), m);
    const fit = async () => { await w.click('开始拟合', 30); let early = null; for (let k = 0; k < 1500; k++) { const q = await w.met(), st = num(q, /走了几步 (\d+)/); if (early === null && st >= 16 && st <= 40) early = [st, num(q, /PSNR） ([\d.]+) dB/)]; if (st >= 1500) return [q, early]; await p.waitForTimeout(early === null ? 15 : 150); } return [await w.met(), early]; };
    let [q, early] = await fit();
    ok('splat, 120 Gaussians: in the first twenty-odd steps the PSNR is only about 21 dB (20 … 24)', early !== null && early[1] >= 20 && early[1] <= 24, JSON.stringify(early));
    ok('splat, 120 Gaussians after all 1500 steps: 36.9 dB', has(q, '走了几步 1500', '36.9 dB'), q);
    await w.click('30', 600); [q] = await fit(); ok('splat, 30 Gaussians (270 knobs): 27.8 dB', has(q, '旋钮个数 270', '27.8 dB'), q);
    await w.click('400', 600); [q] = await fit(); ok('splat, 400 Gaussians (3600 knobs): 50.1 dB', has(q, '旋钮个数 3600', '50.1 dB'), q); }

  // ---- step 6 · a soft choice and a random draw
  { sec('step 6 · pick'); const w = W('pick'); await w.show(); let s = await w.status();
    ok('pick, start (scores 1.0 / 1.4 / 0.6, τ = 1.00): hard choice B; soft weight on C 0.21, derivative 0.17', has(s, '现在选 B', 'C 分到 0.21 的权重', '导数是 0.17'), s);
    const ST = {}; for (const tv of [-1.02, -1.01, -1, -0.99, -0.98]) { await w.set('pick-t', tv, 100); ST[tv] = { lab: await row(w), c: {} }; for (const cv of [0.6, 1.4, 2.0]) { await w.set('pick-c', cv, 100); const t = await w.status(); ST[tv].c[cv] = [num(t, /C 分到 ([\d.]+) 的权重/), num(t, /对 C 的分数的导数是 ([\d.]+)/)]; } }
    const all = Object.values(ST);
    ok('pick: five slider positions read τ = 0.10; at all of them C at 0.6 has weight 0.00 and derivative 0.00', all.every(q => has(q.lab, '0.10') && q.c[0.6][0] === 0 && q.c[0.6][1] === 0), JSON.stringify(ST));
    ok('pick, τ = 0.10, C at 1.4 (level with B): weight about 0.50 (0.49 … 0.50), derivative about 2.5 (2.50 at the middle position, 2.39 … 2.62 at the others)', all.every(q => q.c[1.4][0] >= 0.49 && q.c[1.4][0] <= 0.5 && q.c[1.4][1] >= 2.39 && q.c[1.4][1] <= 2.62) && ST[-1].c[1.4][1] === 2.5, JSON.stringify(all.map(q => q.c[1.4])));
    ok('pick, τ = 0.10, C at 2.0: weight 1.00, derivative back down to about 0.03 (0.02 … 0.03)', all.every(q => q.c[2.0][0] === 1 && q.c[2.0][1] >= 0.02 && q.c[2.0][1] <= 0.03), JSON.stringify(all.map(q => q.c[2.0])));
    await w.set('pick-t', -1, 100); await w.set('pick-c', 0.6, 100); await w.click('抽 1000 次', 300); for (let k = 0; k < 3; k++) await w.click('抽一次', 200);
    // the counts and the bars are drawn on the canvas only: same random numbers as the interactive (K.rng(9); 1000 draws first, then the single draws)
    const G = await EV(() => { const K = TB, r = K.rng(9), gum = () => -Math.log(-Math.log(Math.max(1e-12, r()))), s = [1, 1.4, .6], am = v => v.indexOf(Math.max(...v)), sm = (v, t) => { const m = Math.max(...v), e = v.map(x => Math.exp((x - m) / t)), z = e.reduce((a, b) => a + b, 0); return e.map(x => x / z); };
      const cnt = [0, 0, 0]; for (let i = 0; i < 1000; i++) cnt[am(s.map(v => v + gum()))]++; const one = [];
      for (let k = 0; k < 3; k++) { const g = [gum(), gum(), gum()], sg = s.map((v, i) => v + g[i]); one.push({ pick: 'ABC'[am(sg)], soft: [0.0955, 0.0977, 0.1, 0.1023, 0.1047].map(t => sm(sg, t)) }); }
      return { cnt, sm1: sm(s, 1), one }; });
    ok('same random numbers as the interactive: "Draw 1 000 times" picks A, B, C 344, 456 and 200 times, in line with the softmax weights 0.32, 0.47, 0.21', G.cnt.join(' ') === '344 456 200' && G.sm1.map(v => v.toFixed(2)).join(' ') === '0.32 0.47 0.21', G.cnt.join(' ') + ' | ' + G.sm1.join(' '));
    const o = G.one;
    ok('the next 3 single draws at τ = 0.10: B with a Gumbel-softmax bar of 1.00; C with about 0.94; then C again, split into about 0.25 (B) and 0.73 (C)',
      o[0].pick === 'B' && o[0].soft.every(q => q[1].toFixed(2) === '1.00') && o[1].pick === 'C' && o[1].soft.every(q => near(q[2], 0.94, .012)) && o[1].soft[2][2].toFixed(2) === '0.94' && o[2].pick === 'C' && o[2].soft.every(q => near(q[1], 0.25, .012) && near(q[2], 0.73, .022)) && o[2].soft[2][1].toFixed(2) === '0.25' && o[2].soft[2][2].toFixed(2) === '0.73', JSON.stringify(o.map(q => [q.pick, q.soft[0].map(v => +v.toFixed(3)), q.soft[2].map(v => +v.toFixed(3)), q.soft[4].map(v => +v.toFixed(3))]))); }

  // ---- step 6 · two ways to differentiate an average
  { sec('step 6 · noise'); const w = W('noise'); await w.show(); await p.waitForTimeout(1200); let s = await w.status(), ro = await row(w);
    KEEP.noise = [num(s, /求导的估计散开 ([\d.]+)/), num(s, /REINFORCE 散开 ([\d.]+)/), num(s, /是它的 (\d+) 倍/), num(s, /真正的梯度是 (-?[\d.]+)/)];
    ok('noise, start (μ = 3.950, σ = 0.060, 16 throws per batch): spreads 0.022 (reparameterisation), 0.111 (REINFORCE, 5 times as much), 0.080 (with a baseline); the true gradient of the hit rate is -6.24 while reparameterisation always says 0',
      has(ro, '3.950', '0.060') && has(s, '每批 16 次', '散开 0.022', 'REINFORCE 散开 0.111，是它的 5 倍', '加了基线是 0.080', '重参数化永远是 0', '真正的梯度是 -6.24'), ro + ' || ' + s);
    await w.click('64', 300); s = await w.status(); const a = [num(s, /求导的估计散开 ([\d.]+)/), num(s, /REINFORCE 散开 ([\d.]+)/), num(s, /加了基线是 ([\d.]+)/)];
    ok('noise, 64 throws per batch: 0.011, 0.061 and 0.043, each about half of what it was (ratios 0.50 … 0.55)', a.join(' ') === '0.011 0.061 0.043' && [a[0] / .022, a[1] / .111, a[2] / .080].every(q => q >= .49 && q <= .56), a.join(' '));
    const T = {}; for (const mu of [3.8, 3.805, 3.81]) { await w.set('noise-mu', mu, 250); T[mu] = num(await w.status(), /真正的梯度是 (-?[\d.]+)/); }
    ok('noise, μ near 3.8: the true gradient of the hit rate is close to 0 (0.53 at 3.800, 0.23 at 3.805, -0.08 at 3.810): the hit rate peaks there', T[3.8] === 0.53 && T[3.805] === 0.23 && T[3.81] === -0.08, JSON.stringify(T));
    // figure F4 and the card: the fast edge of the "in" window, the mean landing point at 3.95 m/s, and the eight schematic throws
    const f4 = await EV(() => { const K = TB, A = 45 * K.DEG, vhi = K.vFor(K.D0 + .10, A), vlo = K.vFor(K.D0 - .10, A), EPS = [-1.6, -1.0, -.55, -.2, .15, .5, .95, 1.5]; return { vhi, vlo, hits: EPS.filter(e => { const v = 3.95 + .06 * e; return v > vlo && v < vhi; }), slow: EPS.filter(e => e < 0).length, e395: K.land(3.95, A).x - K.D0 }; });
    ok('engine, figure F4: at 45° the ball goes in for speeds between 3.69 and 3.93 m/s; of the eight schematic throws around μ = 3.95 the 3 slowest go in', near(f4.vhi, 3.9287, .0005) && near(f4.vlo, 3.6915, .003) && f4.hits.join(' ') === '-1.6 -1 -0.55', JSON.stringify(f4));
    await w.set('noise-mu', 3.95, 200); await w.click('16', 200); }

  // ---- step 7 · stand-ins for the real world
  { sec('step 7 · proxy'); const w = W('proxy'); await w.show();
    const tbl = () => p.evaluate(() => [...document.querySelectorAll('#proxy tbody tr')].map(r => [...r.cells].map(c => c.innerText.trim()).join(' | ')).join(' ;; ')).then(norm);
    await w.click('让每个模型求导瞄准', 300); let t = await tbl();
    KEEP.book = t;
    ok('proxy, aiming at 2.60 m before any real throw: only textbook physics answers; 4.481 m/s, lands at 2.170 m, 43.0 cm short', t === '书本物理 | 4.481 | 2.170 m | -43.0 cm', t);
    await w.click('真扔一次', 300); await w.click('让每个模型求导瞄准', 300); t = await tbl(); let s = await w.status();
    KEEP.one = t;
    ok('proxy, after one real throw at 4.10 m/s: identified physics -8.3 cm (the only one in); textbook plus residual -18.7 cm; the black box asks for the upper limit, 5.800 m/s, and lands 54.4 cm too far',
      has(t, '黑箱：从零学 | 5.800 | 3.144 m | +54.4 cm', '书本 + 残差 | 4.823 | 2.413 m | -18.7 cm', '辨识出的物理 | 4.966 | 2.517 m | -8.3 cm') && has(s, '进了的：辨识出的物理。', '只有 1 次真扔的记录时，黑箱和残差只能照着这一点平移'), t + ' || ' + s);
    ok('proxy: 5.800 m/s is the upper end of what the aiming allows (slider maximum 5.2 plus 0.6)', /\[3\.2…5\.2\]/.test(await w.val('proxy-v')), await w.val('proxy-v'));
    await w.set('proxy-v', 3.8, 150); await w.click('真扔一次', 300); await w.set('proxy-v', 4.4, 150); await w.click('真扔一次', 300); s = await w.status();
    ok('proxy, after one more real throw each at 3.8 and 4.4 m/s (3 in all): identified slip factor 0.960 and drag coefficient 0.080, the true values', has(s, '真扔了 3 次', '打滑系数 0.960（真值 0.96）', '空气阻力系数 0.080（真值 0.08）'), s);
    await w.click('让每个模型求导瞄准', 300); t = await tbl(); s = await w.status();
    KEEP.three = t;
    ok('proxy, aiming at 2.60 m again: all three learned stand-ins go in, with misses of +1.7, -5.3 and -0.0 cm', has(t, '黑箱：从零学 | 5.103 | 2.617 m | +1.7 cm', '书本 + 残差 | 5.007 | 2.547 m | -5.3 cm', '辨识出的物理 | 5.080 | 2.600 m | -0.0 cm') && has(s, '进了的：黑箱：从零学、书本 + 残差、辨识出的物理。'), t + ' || ' + s);
    await w.set('proxy-d', 1.5, 150); await w.click('让每个模型求导瞄准', 300); t = await tbl();
    const miss = q => (q.match(/\| ([+-][\d.]+) cm/g) || []).map(x => parseFloat(x.slice(2)));
    ok('proxy, target 1.5 m: the three learned stand-ins are all within 2 cm (+0.4, -1.1, +0.0)', miss(t).slice(1).join(' ') === '0.4 -1.1 0' && miss(t).slice(1).every(e => Math.abs(e) < 2), t);
    await w.set('proxy-d', 3.0, 150); await w.click('让每个模型求导瞄准', 300); t = await tbl(); s = await w.status();
    ok('proxy, target 3.0 m: identified physics -0.0 cm, the black box +3.4 cm, textbook plus residual -12.0 cm, which is out', has(t, '黑箱：从零学 | 5.657 | 3.034 m | +3.4 cm', '书本 + 残差 | 5.455 | 2.880 m | -12.0 cm', '辨识出的物理 | 5.612 | 3.000 m | -0.0 cm') && has(s, '进了的：黑箱：从零学、辨识出的物理。'), t + ' || ' + s); }

  // ---- step 8 · inverse kinematics
  { sec('step 8 · ik'); const w = W('ik'); await w.show(); let m = await w.met();
    ok('ik, start: hand 27.7 cm from the target, joint angles 70° -60° -50°, σ_min 0.307', has(m, '手离目标 27.7 cm', '70° -60° -50°', '0.307'), m);
    const run = async () => { await w.click('一直走', 200); for (let k = 0; k < 120; k++) { if (!/在走/.test(await w.text('.btns'))) break; await p.waitForTimeout(120); } await p.waitForTimeout(200); };
    await run(); m = await w.met(); let s = await w.status();
    ok('ik, gradient descent, "Keep going": after the 60 steps the hand is still 1.3 cm from the target', has(m, '手离目标 1.3 cm', '走了几步 60') && has(s, '梯度下降走了 60 步，还差 1.3 cm'), m + ' || ' + s);
    await w.click('回到起始姿态', 250); await w.click('牛顿法（伪逆）', 250); const left = [];
    for (let k = 0; k < 4; k++) { await w.click('走一步', 250); left.push((await w.met()).match(/手离目标 ([\d.]+ (?:cm|mm))/)[1]); } s = await w.status();
    ok('ik, Newton from the start pose: 8.4 cm, 1.2 cm, 1.3 mm and 0.0 mm left after steps 1 to 4; "there after 4 steps"', left.join(', ') === '8.4 cm, 1.2 cm, 1.3 mm, 0.0 mm' && has(s, '到了', '用了 4 步'), left.join(', ') + ' || ' + s);
    // drag the target to 0.40 m right, 0.25 m up (same view mapping as the interactive), then gradient descent from the pose the arm is in
    const pt = await EV(([tx, ty]) => { const cv = document.getElementById('ik-cv'); cv.scrollIntoView({ block: 'center' }); const Wd = cv.clientWidth, H = cv.clientHeight, x0 = -1.0, x1 = 1.12, y0 = -.1, y1 = 1.06, sc = Math.min((Wd - 16) / (x1 - x0), (H - 14) / (y1 - y0)), ox = (Wd - sc * (x1 - x0)) / 2 - sc * x0, oy = H - 7 + sc * y0; return [ox + tx * sc, oy - ty * sc]; }, [0.40, 0.25]);
    await dragPx('ik-cv', [pt[0] + 1, pt[1]], pt); m = await w.met();
    ok('ik, target dragged to about half the distance (0.40 m right, 0.25 m up): the hand is now about 47 cm away', near(num(m, /手离目标 ([\d.]+) cm/), 47.2, .6), m);
    await w.click('梯度下降', 250); await run(); m = await w.met(); s = await w.status(); const nj = num(m, /走了几步 (\d+)/);
    ok('ik, gradient descent to the nearer target: there in ten steps or so (9 … 12)', has(s, '到了') && nj >= 9 && nj <= 12, m + ' || ' + s);
    await w.click('目标放到够不着的地方', 300); await w.click('牛顿法（伪逆）', 250); const st = [];
    for (let k = 0; k < 3; k++) { await w.click('走一步', 250); st.push(await w.met()); } s = await w.status();
    ok('ik, target out of reach, Newton step 1: largest joint turn 33.1°, σ_min 0.173', has(st[0], '这一步关节最多转了 33.1°', '0.173'), st[0]);
    ok('ik, Newton step 2: largest joint turn 31.0°, σ_min down to 0.026 (the arm is almost straight)', has(st[1], '这一步关节最多转了 31.0°', '0.026'), st[1]);
    ok('ik, Newton step 3: one joint turns 103.0° at once and the hand is flung to 64.1 cm from the target; "the pseudoinverse has flown off"', has(st[2], '这一步关节最多转了 103.0°', '手离目标 64.1 cm') && has(s, '伪逆迈飞了：第 3 步有个关节一下转了 103°', 'σ_min 只有 0.026'), st[2] + ' || ' + s);
    for (let k = 0; k < 3; k++) await w.click('走一步', 200); s = await w.status();
    ok('ik, Newton, three more steps: it keeps jumping about (the largest step so far 153°)', has(s, '之后它一直乱跳，最大的一步转了 153°'), s);
    await w.click('阻尼最小二乘', 250); await run(); m = await w.met(); s = await w.status();
    ok('ik, damped least squares on the same target: stops after 11 steps with the hand 6.9 cm from the target (6.6 cm is the best possible)', has(m, '手离目标 6.9 cm', '走了几步 11') && has(s, '目标够不着', '还差 6.9 cm（最近也要差 6.6 cm）'), m + ' || ' + s);
    // same step as the interactive (ik): step counts that no readout shows
    const I = await EV(() => { const LK = [.40, .32, .24], LAM = .08, DEG = Math.PI / 180, TH0 = [70 * DEG, -60 * DEG, -50 * DEG];
      const fk = t => { const P = [[0, 0]]; let f = 0, x = 0, y = 0; for (let k = 0; k < 3; k++) { f += t[k]; x += LK[k] * Math.cos(f); y += LK[k] * Math.sin(f); P.push([x, y]); } return P; };
      const info = (t, tg) => { const P = fk(t), h = P[3], e = [h[0] - tg[0], h[1] - tg[1]], Jc = [0, 1, 2].map(j => [-(h[1] - P[j][1]), h[0] - P[j][0]]); let a = 0, b = 0, d = 0; for (const c of Jc) { a += c[0] * c[0]; b += c[0] * c[1]; d += c[1] * c[1]; } const tr = a + d, det = a * d - b * b, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)); return { e, Jc, a, b, d, smin: Math.sqrt(Math.max(0, tr / 2 - disc)), err: Math.hypot(e[0], e[1]) }; };
      const step = (th, tg, meth) => { const I = info(th, tg); let w; if (meth === 'jt') { const g = I.Jc.map(c => c[0] * I.e[0] + c[1] * I.e[1]), Jg = [0, 0]; I.Jc.forEach((c, j) => { Jg[0] += c[0] * g[j]; Jg[1] += c[1] * g[j]; }); const nu = I.e[0] * Jg[0] + I.e[1] * Jg[1], den = Jg[0] * Jg[0] + Jg[1] * Jg[1], al = den > 1e-18 ? nu / den : 0; w = g.map(v => -al * v); } else { const l2 = meth === 'dls' ? LAM * LAM : 0, a = I.a + l2, d = I.d + l2, b = I.b, det = Math.max(a * d - b * b, 1e-12), y = [(d * I.e[0] - b * I.e[1]) / det, (-b * I.e[0] + a * I.e[1]) / det]; w = I.Jc.map(c => -(c[0] * y[0] + c[1] * y[1])); } return { th: th.map((v, k) => v + w[k]), turn: Math.max(...w.map(Math.abs)) / DEG }; };
      const run = (th0, tg, meth, max, tol) => { let th = th0.slice(), n = 0; const errs = [], turns = []; while (info(th, tg).err >= tol && n < max) { const q = step(th, tg, meth); th = q.th; n++; errs.push(info(th, tg).err); turns.push(q.turn); } return { n, th, errs, turns }; };
      const T0 = [.80, .50], jt = run(TH0, T0, 'jt', 2000, .0005), pinv = run(TH0, T0, 'pinv', 60, .0005), dls = run(TH0, T0, 'dls', 60, .0005);
      const half = [[.40, .25], [.45, .25], [.35, .30], [.40, .20], [.50, .30], [.30, .20], [.42, .27]].map(tg => ['jt', 'pinv', 'dls'].map(mm => run(pinv.th, tg, mm, 60, .0005).n).concat(['jt', 'pinv', 'dls'].map(mm => run(TH0, tg, mm, 60, .0005).n)));
      const TO = [.70, .75], dl = run(TH0, TO, 'dls', 11, 0);
      return { dist: Math.hypot(.8, .5), reach: LK[0] + LK[1] + LK[2], jtN: jt.n, jt60: jt.errs[59], pinvN: pinv.n, pinvErr: pinv.errs, dlsN: dls.n, half, distOut: Math.hypot(.7, .75), dlsTurns: dl.turns, dlsErr: dl.errs[10] }; });
    KEEP.ik = I;
    ok('same step as the interactive: gradient descent needs 280 steps to get within 0.5 mm (1.3 cm left after 60); Newton 4 steps (84.1, 12.5, 1.3, 0.02 mm left); damped least squares 7', I.jtN === 280 && near(I.jt60, .0134, .0002) && I.pinvN === 4 && near(I.pinvErr[0], .0841, .0001) && near(I.pinvErr[1], .0125, .0001) && near(I.pinvErr[2], .00127, .00002) && near(I.pinvErr[3], .000022, .000002) && I.dlsN === 7, JSON.stringify([I.jtN, I.jt60, I.pinvN, I.pinvErr, I.dlsN]));
    ok('same step, seven targets about half as far out: gradient descent takes ten steps or so (9 … 15 from the pose Newton ended in, 3 … 13 from the start pose), the other two only a few (2 … 8)', I.half.every(h => h[0] >= 9 && h[0] <= 15 && h[3] >= 3 && h[3] <= 13 && [h[1], h[2], h[4], h[5]].every(q => q >= 2 && q <= 8)), JSON.stringify(I.half));
    ok('same step, target out of reach: damped least squares never turns a joint by more than thirty-odd degrees in a step (largest 31.9°), and settles 6.9 cm from the target', Math.max(...I.dlsTurns) < 32 && near(Math.max(...I.dlsTurns), 31.9, .06) && near(I.dlsErr, .0692, .0002), I.dlsTurns.map(t => t.toFixed(1)).join(' ') + ' ' + I.dlsErr);
    ok('engine: the first target is 0.94 m from the base and the arm reaches 0.96 m; the out-of-reach target is 1.03 m away, so 6.6 cm is the closest the hand can get', near(I.dist, 0.943, .001) && near(I.reach, 0.96, 1e-9) && near(I.distOut, 1.026, .001) && near(I.distOut - I.reach, 0.066, .0005), I.dist + ' ' + I.distOut);
    await w.click('梯度下降', 200); }

  // ---- step 8 · the pose graph
  { sec('step 8 · slam'); const w = W('slam'); await w.show(); let m = await w.met(), s = await w.status();
    const sl = q => [num(q, /终点离起点 ([\d.]+) m/), num(q, /平均差 ([\d.]+) cm/), num(q, /误差平方和 ([\d.]+)/)]; KEEP.slam = { s0: sl(m) };
    ok('slam, start: 120 knobs; the end of the red line is 1.42 m from the start; mean error 96.1 cm; sum of squared errors 5753', has(m, '旋钮个数 120', '终点离起点 1.42 m', '和真实的路平均差 96.1 cm', '误差平方和 5753') && has(s, '终点离起点差了 1.42 m'), m + ' || ' + s);
    await w.click('高斯–牛顿走一步', 300); m = await w.met(); KEEP.slam.g1 = sl(m); ok('slam, one Gauss–Newton step: sum of squared errors 379', has(m, '误差平方和 379', '牛顿 1'), m);
    await w.click('高斯–牛顿走一步', 300); m = await w.met(); s = await w.status();
    KEEP.slam.g2 = sl(m);
    ok('slam, second Gauss–Newton step: 5.9, mean error 12.1 cm; "the error is spread over every step", all 40 poses moved', has(m, '误差平方和 5.9', '和真实的路平均差 12.1 cm', '终点离起点 0.04 m') && has(s, '40 个位姿、120 个旋钮一起挪', '误差被平摊到了每一步上'), m + ' || ' + s);
    await w.click('高斯–牛顿走一步', 300); m = await w.met(); ok('slam, a third step changes nothing more: still 5.9', has(m, '误差平方和 5.9', '牛顿 3'), m);
    await w.click('回到里程计', 300); m = await w.met(); ok('slam, "Back to odometry": 5753 again', has(m, '误差平方和 5753', '牛顿 0 · 梯度 0'), m);
    for (let k = 1; k <= 10; k++) { await w.click('梯度下降走 100 步', 200); for (let q = 0; q < 150; q++) { if (!/在走/.test(await w.text('.btns'))) break; await p.waitForTimeout(120); } } await p.waitForTimeout(200); m = await w.met();
    KEEP.slam.d1000 = sl(m);
    ok('slam, gradient descent run to 1000 steps: sum of squared errors 18.4 (3 times the 5.9 of two Gauss–Newton steps), mean error still 47.5 cm (4 times the 12.1 cm)', has(m, '误差平方和 18.4', '和真实的路平均差 47.5 cm', '梯度 1000') && Math.round(18.4 / 5.9) === 3 && Math.round(47.5 / 12.1) === 4, m);
    await w.click('关', 300); m = await w.met(); s = await w.status();
    ok('slam, loop closure off: the sum of squared errors is 0.0; "nothing to fix"', has(m, '误差平方和 0.0', '终点离起点 1.42 m') && has(s, '没有闭环', '误差平方和是 0，没什么可改的'), m + ' || ' + s);
    await w.click('高斯–牛顿走一步', 300); await w.click('梯度下降走 100 步', 200); for (let q = 0; q < 150; q++) { if (!/在走/.test(await w.text('.btns'))) break; await p.waitForTimeout(120); } m = await w.met();
    ok('slam, loop closure off: pressing either button moves nothing (still 1.42 m, 96.1 cm, 0.0)', has(m, '终点离起点 1.42 m', '和真实的路平均差 96.1 cm', '误差平方和 0.0'), m);
    await w.click('开', 300); }

  // ---- step 9 · the method map
  let METHODS = null;
  { sec('step 9 · sp'); const w = W('sp'); await w.show();
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp-g .spgr')].map(g => ({ name: g.querySelector('.spgh b').innerText.trim(), n: +g.querySelector('.spgh i').innerText, items: [...g.querySelectorAll('.spk')].map(b => b.innerText.replace(/\s+/g, ' ').trim()) })));
    await w.click('为什么要梯度', 400); let g = await groups(); const by = [...g].sort((a, b) => b.n - a.n), cnt = (gs, nm) => (gs.find(q => q.name === nm) || {}).n;
    ok('sp, "Why a gradient": 61 methods; the two largest groups are "Infer causes" (18) and "Control and planning" (17); "Learn from data" has 4', g.reduce((a, q) => a + q.n, 0) === 61 && by[0].name === '反推原因' && by[0].n === 18 && by[1].name === '控制和规划' && by[1].n === 17 && cnt(g, '从数据里学') === 4 && g.every(q => q.n === q.items.length), g.map(q => q.name + ' ' + q.n).join(' | '));
    await w.click('梯度从哪来', 400); g = await groups();
    ok('sp, "Where the gradient comes from": smooth already 25, make the hard parts soft 17, estimate by sampling 3, differentiate an equation 7, learn a stand-in 8, get the jumps right 1 (differentiable ray tracing by edge sampling)',
      g.map(q => q.n).join(' ') === '25 17 3 7 8 1' && g.map(q => q.name).join('|') === '本来就光滑：链式法则|把硬的变软|抽样估计|对方程求导|学一个可微的替身|把跳变处的导数算对' && /边缘采样的可微光线追踪/.test(g[5].items[0]), g.map(q => q.name + ' ' + q.n).join(' | '));
    METHODS = { src: g.map(q => q.n) };
    await w.click('哪里会断', 400); g = await groups(); const j = g.find(q => q.name === '跳变');
    ok('sp, "Where it breaks": the "Jumps" group has 8, among them the reparameterisation trick, differentiable rigid contact, Brax, MuJoCo MJX and 3D Gaussian splatting', j && j.n === 8 && ['重参数化技巧', '可微的刚体接触', 'Brax', 'MuJoCo MJX', '三维高斯泼溅'].every(nm => j.items.some(t => t.includes(nm))), j && j.items.join(' · '));
    ok('sp, "Where it breaks": the largest group is "Biased approximations" (20), then "Only sees nearby" (14) and "Memory and compute" (12)', cnt(g, '近似有偏') === 20 && cnt(g, '只看得到附近') === 14 && cnt(g, '内存和算力') === 12 && g.every(q => q.n <= 20), g.map(q => q.name + ' ' + q.n).join(' | '));
    METHODS.brk = g.map(q => q.n);
    await p.evaluate(() => document.querySelector('#sp-g .spk[data-id="lcp18"]').click()); await p.waitForTimeout(300); const d = await w.text('.spd');
    ok('sp, opening a method of the "Jumps" group: its description has a "Weaknesses" line saying where it breaks', has(d, '主要的坑 跳变', '短处') && has(d, '接触刚建立、刚断开的那一刻，梯度照样会跳'), d.slice(0, 400)); }

  // ======================= Part B: the numbers in the cards and the paragraphs, recomputed with the page's engine =======================
  { sec('text · numbers recomputed with the engine');
    const T = {}; for (const id of ['k-intro', 'k-one', 'k-many', 'k-net', 'k-rim', 'k-render', 'k-disc', 'k-proxy', 'k-robot', 'k-map']) T[id] = await secText(id);
    const HD = await p.evaluate(() => document.querySelector('header').innerText).then(norm);
    const R = await EV(() => { const K = TB, A = 45 * K.DEG, o = {};
      o.K = { G: K.G, H0: K.H0, HR: K.HR, R: K.R, HW: K.HW, D0: K.D0 };
      const L = K.land(4.1, A), e = L.x - K.D0; o.L = { x: L.x, t: L.t, vx: L.vx, vy: L.vy, dxdv: L.dxdv, dxda: L.dxda, e, root: Math.sqrt(L.vy * L.vy + 2 * K.G * (K.H0 - K.HR)), dtdvy: (1 + L.vy / Math.sqrt(L.vy * L.vy + 2 * K.G * (K.H0 - K.HR))) / K.G };
      // bisection between 3.6 (short) and 4.1 (long) until the landing point is within 1 cm of the centre
      { let lo = 3.6, hi = 4.1, n = 0; for (;;) { const m = (lo + hi) / 2, em = K.land(m, A).x - K.D0; n++; if (Math.abs(em) < .01) break; if (em > 0) hi = m; else lo = m; } o.bis = { n, e36: K.land(3.6, A).x - K.D0 }; }
      // Newton's method on the speed
      { const v1 = 4.1 - e / L.dxdv, L1 = K.land(v1, A), v2 = v1 - (L1.x - K.D0) / L1.dxdv; o.newton = { v1, x1: L1.x, v2, e2: K.land(v2, A).x - K.D0 }; }
      // the angle that throws furthest at 4.1 m/s
      { let best = [0, 0]; for (let a = 200; a <= 600; a++) { const x = K.land(4.1, a / 10 * K.DEG).x; if (x > best[1]) best = [a / 10, x]; } o.amax = best; }
      // the small network
      { const net = K.mlp([1, 16, 16, 1], 'tanh', K.rng(1)), sz = [1, 16, 16, 1]; let w = 0, b = 0; for (let i = 0; i < 3; i++) { w += sz[i] * sz[i + 1]; b += sz[i + 1]; } o.net = { n: K.nParams(net), w, b }; }
      // the hit rate with jitter: same smoothing as the interactive (rim): "in or out" on a grid of speeds 0.001 m/s apart, weighted by a Gaussian
      { const VA = 3.45, VB = 4.2, DV = .001, NS = Math.round((VB - VA) / DV) + 1, inn = new Float64Array(NS); for (let i = 0; i < NS; i++) inn[i] = K.fly(VA + i * DV, A, K.D0).inside ? 1 : 0;
        const Ps = (u, sig) => { const h = sig / DV, Rr = Math.ceil(4 * h), i = Math.round((u - VA) / DV); let s = 0, w = 0; for (let k = -Rr; k <= Rr; k++) { const j = i + k, wk = Math.exp(-.5 * (k / h) * (k / h)); w += wk; if (j >= 0 && j < NS) s += wk * inn[j]; } return s / w; };
        const xf = u => K.fly(u, A, K.D0).xf - K.D0, dxf = u => (xf(u + 1e-6) - xf(u - 1e-6)) / 2e-6;
        o.rim = { p08: Ps(3.55, .08), p04: Ps(3.55, .04), p37: Ps(3.7, .08), d1: dxf(3.635), d2: dxf(4.015), air: [3.56, 3.64, 3.8, 4.02, 4.05].map(v => K.land(v, A).dxdv) }; }
      // the S-shaped function of the soft edge
      { const S = z => 1 / (1 + Math.exp(-z)); o.S = [S(1), S(-1), S(.1 / 2), S(-.1 / 2), (S(1e-6) - S(-1e-6)) / 2e-6]; }
      // softmax of the three scores
      { const sm = (v, t) => { const m = Math.max(...v), ex = v.map(x => Math.exp((x - m) / t)), z = ex.reduce((a, b) => a + b, 0); return ex.map(x => x / z); }; o.sm = [sm([1, 1.4, .6], 1), sm([1, 1.4, .6], .1)]; }
      // the true gradient of the hit rate at μ = 3.95, σ = 0.06 (window |miss| < 10 cm), and the mean landing point there
      { const phi = z => Math.exp(-.5 * z * z) / Math.sqrt(2 * Math.PI), VLO = K.vFor(K.D0 - .10, A), VHI = K.vFor(K.D0 + .10, A), sg = .06, m = 3.95; o.dP = (phi((VLO - m) / sg) - phi((VHI - m) / sg)) / sg; o.e395 = K.land(3.95, A).x - K.D0; }
      // the "real world" of the stand-in interactive: same integrator (RK4, quadratic drag 0.08 /m, release at 96% of the commanded speed)
      { const sim = (v, kap, kd) => { let x = 0, y = K.H0, vx = v * kap * Math.cos(A), vy = v * kap * Math.sin(A); const dt = .004, f = (vx, vy) => { const s = Math.hypot(vx, vy); return [-kd * s * vx, -K.G - kd * s * vy]; };
          for (let i = 0; i < 2000; i++) { const a1 = f(vx, vy), k2 = [vx + .5 * dt * a1[0], vy + .5 * dt * a1[1]], a2 = f(k2[0], k2[1]), k3 = [vx + .5 * dt * a2[0], vy + .5 * dt * a2[1]], a3 = f(k3[0], k3[1]), k4 = [vx + dt * a3[0], vy + dt * a3[1]], a4 = f(k4[0], k4[1]);
            const nx = x + dt * (vx + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, ny = y + dt * (vy + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6, nvx = vx + dt * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]) / 6, nvy = vy + dt * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]) / 6;
            if (ny < K.HR && nvy < 0) { const fr = (y - K.HR) / (y - ny); return x + (nx - x) * fr; } x = nx; y = ny; vx = nvx; vy = nvy; } return x; };
        const vb = K.vFor(2.6, A); o.px = { vb, real: sim(vb, .96, .08), same: Math.abs(sim(4.1, 1, 0) - K.land(4.1, A).x) }; }
      // the loop of the pose-graph interactive: four sides of 8 steps of 0.5 m and two corner steps of 0.35 m
      o.loop = { n: 4 * (8 + 2), len: 4 * (8 * .5 + 2 * .35) };
      // what the scripts of the page say about the constants that are quoted in the text
      const src = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
      o.src = { slam: src.includes('ST=opt&&opt.st||.03,SR=(opt&&opt.sr||2)*Math.PI/180,LT=.02,LR=.5*Math.PI/180'), proxy: src.includes('const KAP=.96,KD=.08;'), ik: src.includes('const LK=[.40,.32,.24]') && src.includes('LAM=.08'), learn: src.includes('B=8,SIG=.15,MAXT=20480,LR=.01'), splat: src.includes('W=64,H=48') && src.includes('step>=1500') };
      return o; });
    const L = R.L, r3 = x => Math.round(x * 1000) / 1000;
    ok('text, step 0 (the task): the bin is 30 cm wide and 30 cm tall, the ball has a radius of 3.5 cm, the release point is 1.0 m above the ground and 0.7 m above the rim', has(T['k-intro'], '口宽 30 cm、高 30 cm；球的半径是 3.5 cm', '在离地 1.0 m 的地方松手', '1.0 - 0.3 = 0.7 m') && near(2 * R.K.HW, .30, 1e-9) && R.K.HR === .3 && R.K.R === .035 && R.K.H0 === 1 && R.K.D0 === 2, JSON.stringify(R.K));
    ok('text, landing-point card: both components 4.1 × 0.707 = 2.899 m/s; t = (2.899 + 4.704) ÷ 9.8 = 0.7758 s; x = 2.899 × 0.7758 = 2.249 m, 25 cm beyond the centre',
      has(T['k-intro'], '两个分量都是 4.1 × 0.707 = 2.899 m/s', '(2.899 + 4.704) ÷ 9.8 = 0.7758 s', 'x = 2.899 × 0.7758 = 2.249 m，比筐中心远 25 cm') && near(L.vx, 2.899, .0005) && near(L.vy, 2.899, .0005) && near(L.root, 4.704, .0005) && near(L.t, .7758, .00005) && near(L.x, 2.249, .0005) && near(L.e, .25, .005), JSON.stringify(L));
    ok('text, "differentiable" card: x′ ≈ 0.89 at 4.1 m/s, so 0.1 m/s faster lands about 8.9 cm further', has(T['k-intro'], 'x′ ≈ 0.89：速度每快 0.1 m/s，落点远约 8.9 cm') && near(L.dxdv, .89, .005) && near(L.dxdv * 10, 8.9, .05), L.dxdv);
    ok('text, step 1: knowing that 3.6 m/s is short and 4.1 m/s long, bisection needs 4 more throws to get within 1 cm', has(T['k-one'], '已知 3.6 m/s 太近、4.1 m/s 太远，从这个区间出发，要把落点压到离筐中心 1 cm 以内，还得再扔 4 次') && R.bis.n === 4 && R.bis.e36 < 0 && L.e > 0, JSON.stringify(R.bis));
    ok('text, step 1: 25 cm too far at 0.89 m per m/s means 0.25 ÷ 0.89 ≈ 0.28 m/s slower', has(T['k-one'], '速度每快 1 m/s 落点远 0.89 m，那就该慢 0.25 ÷ 0.89 ≈ 0.28 m/s') && near(.25 / .89, .28, .005), .25 / .89);
    ok('text, Newton card: v1 = 4.1 - 0.249 ÷ 0.887 = 3.819 m/s lands at 2.007 m (0.7 cm off); v2 = 3.810 m/s is almost dead centre',
      has(T['k-one'], 'e0 = +0.249 m，x′ = 0.887', 'v1 = 4.1 - 0.249 ÷ 0.887 = 3.819 m/s，落点 2.007 m，只差 0.7 cm', 'v2 = 3.810 m/s') && near(L.e, .249, .0005) && near(L.dxdv, .887, .0005) && near(R.newton.v1, 3.819, .0005) && near(R.newton.x1, 2.007, .0005) && near(R.newton.v2, 3.810, .0005) && Math.abs(R.newton.e2) < .0005, JSON.stringify(R.newton));
    ok('text, gradient-descent card: dL/dv = 0.249 × 0.887 = 0.221; with η = 1 ÷ 0.887² ≈ 1.27 the step is Newton’s: 4.1 - 1.27 × 0.221 = 3.819',
      has(T['k-one'], 'dL/dv = 0.249 × 0.887 = 0.221', '取 η = 1 ÷ 0.887² ≈ 1.27', '4.1 - 1.27 × 0.221 = 3.819') && near(L.e * L.dxdv, .221, .0005) && near(1 / (.887 * .887), 1.27, .005) && near(4.1 - 1.27 * .221, 3.819, .0006), L.e * L.dxdv);
    ok('text, step 1: at 4.1 m/s the angle curve is highest near 36.5°', has(T['k-one'], '仰角那条曲线在 36.5° 附近最高') && near(R.amax[0], 36.5, .15), JSON.stringify(R.amax));
    ok('text, gradient card: at 4.1 m/s, 45° the partial derivatives are 0.221 and -0.215 (per radian)', has(T['k-many'], '在 v = 4.1 m/s、α = 45°：∂L/∂v = 0.221，∂L/∂α = -0.215（角度按弧度算）') && near(L.e * L.dxdv, .221, .0005) && near(L.e * L.dxda, -.215, .0005), L.e * L.dxda);
    ok('text, chain-rule card: ∂x/∂v = 0.776 × 0.707 + 2.899 × 0.165 × 0.707 = 0.549 + 0.338 = 0.887',
      has(T['k-many'], '∂x/∂vx = t = 0.776', '∂t/∂vy = 0.165', '∂x/∂v = 0.776 × 0.707 + 2.899 × 0.165 × 0.707 = 0.549 + 0.338 = 0.887') && near(L.t, .776, .0005) && near(L.dtdvy, .165, .0005) && near(L.t * Math.SQRT1_2, .549, .0005) && near(L.vx * L.dtdvy * Math.SQRT1_2, .338, .0005) && near(L.t * Math.SQRT1_2 + L.vx * L.dtdvy * Math.SQRT1_2, L.dxdv, 1e-9), L.t + ' ' + L.dtdvy);
    ok('text, step 2: the small network of step ③ has 321 knobs, so trying them one by one takes 322 throws per update', has(T['k-many'], '第 ③ 步的小网络有 321 个旋钮，每改一次就要扔 322 次', '322 遍') && R.net.n === 321, JSON.stringify(R.net));
    ok('text, step 3: 321 adjustable numbers, 288 weights and 33 biases; batches of 8 throws, jitter 0.15 m/s, 20480 throws each', has(T['k-net'], '网络里一共有 321 个可调的数（288 个权重和 33 个偏置', '标准差 0.15 m/s', '每种学法扔到 20480 次为止') && R.net.w === 288 && R.net.b === 33 && R.net.w + R.net.b === R.net.n && R.src.learn, JSON.stringify(R.net));
    ok('text, network card: the signal passed back to the network is 0.249 × 0.887 = 0.221', has(T['k-net'], '损失对输出速度的导数是 0.249 × 0.887 = 0.221') && near(L.e * L.dxdv, .221, .0005), L.e * L.dxdv);
    ok('text, jitter card: at 3.55 m/s with σ = 0.08 about 1 throw in 12 goes in (the interactive reads 8.3%); ten steps reach 3.7 m/s with a hit rate of six or seven in ten (67%); with σ = 0.04 the hit rate at 3.55 is under 1% (0.7%)',
      has(T['k-rim'], '指令 3.55 m/s、σ = 0.08 m/s：大约每 12 次有 1 次进', '就到了 3.7 m/s，进筐率六七成', '把 σ 降到 0.04，3.55 m/s 时进筐率不到 1%') && near(R.rim.p08, 1 / 12, .004) && KEEP.rim0 === 8.3 && near(R.rim.p08 * 100, KEEP.rim0, .06) && KEEP.rim10[0] === 3.7 && KEEP.rim10[1] === 67 && near(R.rim.p37 * 100, 67, .6) && R.rim.p04 < .01 && KEEP.rim04 === 0.7 && near(R.rim.p04 * 100, 0.7, .06), JSON.stringify(R.rim) + ' ' + JSON.stringify([KEEP.rim0, KEEP.rim10, KEEP.rim04]));
    ok('text, step 4: near the rims the local derivative reaches about 100, against 0.8 to 0.9 in free flight', has(T['k-rim'], '局部导数到了 100 左右，而在空中飞时只有 0.8 到 0.9') && near(R.rim.d1, 100.35, .2) && near(R.rim.d2, 117.05, .2) && R.rim.air.every(d => d >= .78 && d < .9), R.rim.d1 + ' ' + R.rim.d2 + ' ' + R.rim.air.join(' '));
    ok('text, soft-edge card (β = 2 pixels): S(1) = 0.73, 0.27 two pixels outside; shifting by 0.1 pixel moves the edge pixels from 0.500 to about 0.513 and 0.488 (slope 0.25 at 0)',
      has(T['k-render'], 'S(1) = 0.73', '在筐外 2 个像素的是 0.27', '右边缘上的像素从 0.500 变成约 0.513，左边缘上的从 0.500 变成约 0.488', 'S 在 0 处的斜率是 0.25') && near(R.S[0], .73, .005) && near(R.S[1], .27, .005) && near(R.S[2], .5125, .0006) && near(R.S[3], .4875, .0006) && near(R.S[4], .25, 1e-6), R.S.join(' '));
    ok('text, step 5: the photo is 64 × 48 pixels and the fit runs for 1500 steps', has(T['k-render'], '64 × 48 像素', '一共 1500 步') && R.src.splat, String(R.src.splat));
    ok('text, softmax card: scores 1.0, 1.4, 0.6 give weights 0.32, 0.47, 0.21 at τ = 1 and 0.02, 0.98, 0.00 at τ = 0.1', has(T['k-disc'], '分数 1.0、1.4、0.6，τ = 1 时，权重是 0.32、0.47、0.21。τ = 0.1 时，变成 0.02、0.98、0.00') && R.sm[0].map(v => v.toFixed(2)).join(' ') === '0.32 0.47 0.21' && R.sm[1].map(v => v.toFixed(2)).join(' ') === '0.02 0.98 0.00', JSON.stringify(R.sm));
    ok('text, estimator card (μ = 3.95, σ = 0.06, 16 throws, 200 batches): spreads 0.022 and 0.111, 5 times as much; the true gradient of the hit rate is -6.24 per m/s; at 3.95 m/s the landing point is about 12 cm beyond the centre',
      has(T['k-disc'], '重参数化估出来的 200 个值散开（标准差）0.022，REINFORCE 散开 0.111，是它的 5 倍', '真正的梯度却是每 m/s -6.24（3.95 m/s 时平均落点比筐中心远约 12 cm') && KEEP.noise.join(' ') === '0.022 0.111 5 -6.24' && near(R.dP, -6.24, .005) && near(R.e395, .12, .005), JSON.stringify(KEEP.noise) + ' ' + R.dP + ' ' + R.e395);
    ok('text, stand-in card: the "real world" has κ = 0.96 and c = 0.08 /m; the textbook formula asks for 4.48 m/s to reach 2.6 m and the real throw lands at 2.17 m, 43 cm short; after one real throw identified physics is only 8 cm off; after three it is almost dead centre',
      has(T['k-proxy'], 'κ = 0.96，c = 0.08 /m', '瞄 2.6 m 时会算出 4.48 m/s，真扔只到 2.17 m，近了 43 cm', '辨识出的物理就只差 8 cm；真扔三次以后，它几乎正中') && R.src.proxy && near(R.px.vb, 4.481, .0005) && near(R.px.real, 2.170, .0005) && near(2.6 - R.px.real, .43, .0005) && R.px.same < 1e-4 && has(KEEP.book, '4.481 | 2.170 m | -43.0 cm') && has(KEEP.one, '辨识出的物理 | 4.966 | 2.517 m | -8.3 cm') && has(KEEP.three, '辨识出的物理 | 5.080 | 2.600 m | -0.0 cm'), JSON.stringify(R.px));
    const I = KEEP.ik;
    ok('text, inverse-kinematics card: links of 40, 32 and 24 cm (0.96 m in all), λ = 0.08; target 0.94 m from the base; 27.7 cm at the start; gradient descent 1.3 cm after 60 steps and 280 steps to get within 0.5 mm; Newton 4 steps (8.4 cm, 1.2 cm, 1.3 mm, 0.02 mm); damped least squares 7; out of reach at 1.03 m (6.6 cm at best), where Newton turns a joint by 103° in step 3',
      has(T['k-robot'], '三节长 40、32、24 cm', '离底座 0.94 m，快到够得着的边缘了（三节加起来 0.96 m）；手开始离它 27.7 cm', '梯度下降走 60 步还差 1.3 cm，要走 280 步才到 0.5 mm 以内', '牛顿法 4 步，每步之后分别差 8.4 cm、1.2 cm、1.3 mm、0.02 mm', '阻尼最小二乘 7 步', '离底座 1.03 m，最近也要差 6.6 cm', '牛顿法第 3 步就有个关节一下转了 103°') &&
      R.src.ik && near(I.dist, .94, .005) && near(I.reach, .96, 1e-9) && I.jtN === 280 && near(I.jt60 * 100, 1.3, .05) && I.pinvN === 4 && near(I.pinvErr[3] * 1000, .02, .005) && I.dlsN === 7 && near(I.distOut, 1.03, .005) && near((I.distOut - I.reach) * 100, 6.6, .05), JSON.stringify([I.dist, I.jtN, I.pinvErr, I.dlsN, I.distOut]));
    const sl = KEEP.slam;
    ok('text, pose-graph card: 40 steps, 18.8 m per lap; odometry noise 3 cm and 2°, loop closure 2 cm and 0.5°; end 1.42 m from the start, mean error 96 cm, sum of squared errors 5753; 379 after one Gauss–Newton step, 5.9 and 12 cm after two; gradient descent after 1000 steps: 18 and still 48 cm',
      has(T['k-robot'], '机器人沿一个圆角方形走 40 步，一圈 18.8 m', '这里里程计是 3 cm、2°，闭环是 2 cm、0.5°', '终点离起点差了 1.42 m，和真实的路平均差 96 cm，误差平方和是 5753', '高斯–牛顿第一步就把它降到 379，第二步降到 5.9，平均差 12 cm', '走 1000 步，误差平方和降到 18，和真实的路却平均还差 48 cm') &&
      R.loop.n === 40 && near(R.loop.len, 18.8, 1e-9) && R.src.slam && sl.s0.join(' ') === '1.42 96.1 5753' && sl.g1[2] === 379 && sl.g2[2] === 5.9 && Math.round(sl.g2[1]) === 12 && Math.round(sl.d1000[2]) === 18 && Math.round(sl.d1000[1]) === 48, JSON.stringify(sl));
    const sr = METHODS.src, bk = METHODS.brk, tot = sr.reduce((a, b) => a + b, 0);
    ok('text, step 9 and the header: 61 methods; smooth already about four in ten (25 of 61); nearly half "make" a gradient (17 + 3 + 8 = 28 of 61); a little over one in ten get it right (7 + 1 = 8 of 61)',
      has(T['k-map'], '这里把 61 种放在一起', '本来就光滑、直接用链式法则的约占四成；将近一半得想办法"造"一个梯度', '另有一成多在把梯度"算对"') && has(HD, '把 61 种"可微 X"放在一张地图上') && tot === 61 && near(sr[0] / tot, .41, .005) && near((sr[1] + sr[2] + sr[4]) / tot, .46, .005) && near((sr[3] + sr[5]) / tot, .13, .005), sr.join(' '));
    ok('text, step 9: the most common pitfall is "Biased approximations" (20), then "Only sees nearby" (14) and "Memory and compute" (12)', has(T['k-map'], '方法最多的是"近似有偏"，其次是"只看得到附近"和"内存和算力"') && bk.join(' ') === '8 5 2 20 14 12', bk.join(' '));
    ok('text, figure F3 and figure F4: the captions quote the five speeds 3.50, 3.62, 3.81, 4.00, 4.10 m/s and μ = 3.95 m/s, σ = 0.06 m/s (checked above)', has(T['k-rim'], '① 3.50 m/s 打在近处筐壁的外侧', '② 3.62 m/s 碰到近处的筐沿', '③ 3.81 m/s 落进筐里', '④ 4.00 m/s 碰到远处的筐沿', '⑤ 4.10 m/s 从远处的筐沿上方飞过') && has(T['k-disc'], '指令速度 μ = 3.95 m/s，手抖 σ = 0.06 m/s'), ''); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
