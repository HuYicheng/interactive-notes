// Check the numbers of "Rotation Representations: Matrices, Euler Angles, Axis-Angle, Quaternions" (rotation/index.html)
// against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt literally: pressing buttons, moving sliders, dragging the pictures with the mouse one
// pixel at a time, letting the animations finish) and compares the readouts with the numbers quoted in the
// "你会看到 / What you will see" lines; every check first requires the quoted string to be in that line. The two
// interactives that use chance draw from a seeded generator, so their readouts are the same on every run as long as
// the buttons are pressed in the order of the prompt. Statements that no readout shows (which matrix is the nearest
// rotation, the speeds of the three interpolations, what the axes of the gimbal do) are recomputed inside the page
// with the interactive's own code, cut out of the page source and run unchanged (see "harness"), or with the page's
// shared helpers (window.RX), and compared with formulas written out in this file.
// Part B recomputes the numbers quoted in the formula cards, the paragraphs and the figures, and tests every formula
// of the cards on random orientations against the page's own conversion routines; each check requires the quoted
// strings to be in the page.
//   usage: node check.js /absolute/path/to/rotation/index.html      (takes about a minute)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/rotation/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file + '#zh'); await p.waitForTimeout(700);
  await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });   // jumps, not glides: the mouse positions below are computed right after scrolling
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined && !cond ? '   [' + String(got).slice(0, 700) + ']' : '')); };
  // readouts and text are compared with the minus sign written as a hyphen and runs of white space collapsed
  const norm = s => s.replace(/[\u2060\u200b]/g, '').replace(/\s+/g, ' ').replace(/\u2212/g, '-').trim();
  const wait = ms => p.waitForTimeout(ms);
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(500); },
    // click a control by its label
    click: async (label, w) => { const r = await p.evaluate(([i, l]) => { const nm = s => s.replace(/\s+/g, ' ').trim();
        const els = [...document.getElementById(i).querySelectorAll('button')].filter(e => e.getClientRects().length > 0);
        const e = els.find(x => nm(x.innerText) === l) || els.find(x => nm(x.innerText).startsWith(l)) || els.find(x => nm(x.innerText).includes(l));
        if (!e) return 'no control "' + l + '"'; e.click(); return 'ok' }, [id, label]);
      if (r !== 'ok') { bad++; log.push('FAIL ' + id + ': ' + r); } await p.waitForTimeout(w || 250); },
    set: async (inp, v, w) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(w || 200); },
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    btns: () => p.evaluate(i => [...document.getElementById(i).querySelectorAll('button')].filter(e => e.getClientRects().length > 0).map(e => (e.classList.contains('on') ? '[x]' : '[ ]') + e.innerText.replace(/\s+/g, ' ').trim()).join(' '), id),
  });
  // the text of one element (its lines joined by " | "), and the entries of a 3 × 3 grid of numbers
  const T = id => p.evaluate(i => document.getElementById(i).innerText.replace(/\n/g, ' | '), id).then(norm);
  const cells = id => p.evaluate(i => [...document.getElementById(i).children].map(e => e.textContent.trim()).filter(t => /^-?\d/.test(t.replace('\u2212', '-'))).map(t => t.replace('\u2212', '-')), id);
  // the mouse on a picture: positions are given in the picture's own pixels (from its top-left corner)
  const rect = id => p.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, id);
  const view = async id => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(350); };
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const lack = (s, ...res) => res.filter(re => !(re instanceof RegExp ? re.test(s) : s.includes(re))).join(' ¦ ');
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const sec = t => log.push('-- ' + t);
  // the visible Chinese text of a section with its folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);
  // the "你会看到" line that follows each interactive, and the "先玩" prompt in front of it
  const WIDS = ['w0', 'wm', 'wa', 'wr', 'wb', 'w5', 'wd'];
  const SEE = {}, TRY = {};
  for (const id of WIDS) {
    SEE[id] = await p.evaluate(i => { let e = document.getElementById(i).nextElementSibling; while (e && (e.tagName === 'SCRIPT' || e.tagName === 'STYLE')) e = e.nextElementSibling; return e && e.classList.contains('see') ? e.innerText : ''; }, id).then(norm);
    TRY[id] = await p.evaluate(i => { const e = document.getElementById(i).previousElementSibling; return e && e.classList.contains('try') ? e.innerText : ''; }, id).then(norm);
  }
  ok('every interactive has a "先玩" prompt in front of it and a "你会看到" line after it', WIDS.every(id => SEE[id].startsWith('你会看到：') && /^先玩：/.test(TRY[id])), WIDS.filter(id => !(SEE[id].startsWith('你会看到：') && /^先玩：/.test(TRY[id]))).join(' '));
  const see = (id, ...strs) => strs.every(s => SEE[id].includes(s));
  const seeMiss = (id, ...strs) => strs.filter(s => !SEE[id].includes(s)).join(' ¦ ');
  // one check: the strings are in the see line AND the readout contains what it should
  const both = (name, id, strs, readout, ...res) => ok(name, see(id, ...strs) && has(readout, ...res), 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ readout lacks: ' + lack(readout, ...res) + ' ¦¦ readout: ' + readout.slice(0, 300));
  // one check: the strings are in the see line AND a condition computed elsewhere holds
  const seeAnd = (name, id, strs, cond, got) => ok(name, see(id, ...strs) && cond, 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ got: ' + String(got).slice(0, 400));
  // the scripts of the interactives (each one names its picture "<id>c"), for constants that no readout shows
  const SRC = await p.evaluate(ids => { const o = {}; for (const id of ids) { const t = [...document.scripts].map(s => s.textContent).find(t => t.includes("'" + id + "c'")); o[id] = t || ''; } return o; }, WIDS);
  ok('the script of every interactive was found in the page', WIDS.every(id => SRC[id].length > 500), WIDS.filter(id => !(SRC[id].length > 500)).join(' '));

  // ---------------------------------------------------------------------------------------------------------------
  // harness: pieces of the interactives' own code, cut out of the page source and run unchanged inside the page,
  // and small matrix routines written here (window.__L) that the page's own helpers (window.RX) are compared with
  // ---------------------------------------------------------------------------------------------------------------
  await p.evaluate(() => {
    const srcOf = key => { const t = [...document.scripts].map(s => s.textContent).find(t => t.includes(key)); if (!t) throw new Error('no script with ' + key); return t; };
    const between = (src, a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error('no "' + a + '"'); const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error('no "' + b + '"'); return src.slice(i, j); };
    const H = window.__H = {};
    // step 2: the interactive's own starting matrix, its random generator and its "project back" routine
    H.wm = () => { const s = srcOf("'wmc'"); const head = between(s, 'const X=RX', 'const box='); const pol = between(s, 'function polar(A)', 'function tween(to)');
      return new Function('RX', 'document', head + pol + ';return {M0,rnd,polar}')(RX, { getElementById: () => ({}) }); };
    // step 8: the interactive's own interpolation code and its two examples
    H.wd = () => { const s = srcOf("'wdc'"); const a = between(s, 'const q4=', 'let e0,e1'); const at = between(s, 'const at=(mi,u)', 'const BODY'); const ex = between(s, 'const EX=', ',rnd=');
      return new Function('X', 'const D=X.D;' + a + 'let e0,e1,q0,qs,ql;' + at + ex + ';return {q4,ang,slerp,EX,run:(A,B)=>{e0=A.map(v=>v*D);e1=B.map(v=>v*D);q0=X.e2q(e0[0],e0[1],e0[2]);const q1=X.e2q(e1[0],e1[1],e1[2]);qs=q4(q0,q1)>=0?q1:q1.map(v=>-v);ql=qs.map(v=>-v);const N=160,out=[];for(let mi=0;mi<3;mi++){const sp=[];let tot=0,pv=at(mi,0);for(let i=1;i<=N;i++){const c=at(mi,i/N),a=ang(pv,c);tot+=a;sp.push(a*N/D);pv=c}out.push({tot:tot/D,first:sp[0],last:sp[N-1],mx:Math.max(...sp),mn:Math.min(...sp)})}return {out,dot:q4(q0,q1),q0,q1}}}')(RX); };
    // routines written for this check, independent of the page's helpers
    const L = window.__L = {};
    L.mm = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
    L.mv = (A, v) => A.map(r => r.reduce((s, x, k) => s + x * v[k], 0));
    L.tr = A => A[0].map((_, j) => A.map(r => r[j]));
    L.I = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    L.add = (A, B, s) => A.map((r, i) => r.map((v, j) => v + (s === undefined ? 1 : s) * B[i][j]));
    L.scl = (A, s) => A.map(r => r.map(v => v * s));
    L.det = A => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    L.dist = (A, B) => Math.sqrt(A.reduce((s, r, i) => s + r.reduce((t, v, j) => t + (v - B[i][j]) ** 2, 0), 0));
    L.hat = k => [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]];
    L.rod = (k, th) => { const K = L.hat(k); return L.add(L.add(L.I(), K, Math.sin(th)), L.mm(K, K), 1 - Math.cos(th)); };   // Rodrigues' formula as written in the card
    L.rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    L.unit = r => { let v; do { v = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]; } while (Math.hypot(...v) < .2 || Math.hypot(...v) > 1); const n = Math.hypot(...v); return v.map(x => x / n); };
    // symmetric 3 × 3 eigen-decomposition by Jacobi rotations, used for the nearest rotation U Vᵀ = M (MᵀM)^(-1/2)
    L.eig = S => { let A = S.map(r => r.slice()), V = L.I(); for (let sweep = 0; sweep < 60; sweep++) { let off = 0; for (let pq of [[0, 1], [0, 2], [1, 2]]) { const [a, c] = pq; off += A[a][c] ** 2; if (Math.abs(A[a][c]) < 1e-15) continue;
          const th = .5 * Math.atan2(2 * A[a][c], A[c][c] - A[a][a]), cs = Math.cos(th), sn = Math.sin(th), G = L.I(); G[a][a] = cs; G[c][c] = cs; G[a][c] = sn; G[c][a] = -sn; A = L.mm(L.tr(G), L.mm(A, G)); V = L.mm(V, G); } if (off < 1e-26) break; } return { val: [A[0][0], A[1][1], A[2][2]], V }; };
    L.nearestRot = M => { const e = L.eig(L.mm(L.tr(M), M)), D = [[1 / Math.sqrt(e.val[0]), 0, 0], [0, 1 / Math.sqrt(e.val[1]), 0], [0, 0, 1 / Math.sqrt(e.val[2])]]; return L.mm(M, L.mm(e.V, L.mm(D, L.tr(e.V)))); };
  });

  // ===================================================== Part A =====================================================
  sec('Part A · the interactives, operated along their "先玩" prompts');

  // ---- step 1 · w0: a number on the tangent, wrapped onto the circle
  { const w = W('w0'); await w.show();
    let a = await T('w0a'), c = await T('w0b');
    both('w0 at the start: φ = 1.00 rad = 57.3°, the same angle on the circle', 'w0', ['开始时 φ = 1.00 rad（57.3°）', '沿圆缠了 57.3°'], a + ' ## ' + c, 'φ = 1.00 rad', '= 57.3°', '圆上角度 57.3°', '缠了 0 整圈');
    await w.click('2π', 1300); a = await T('w0a'); c = await T('w0b');
    both('w0 button 2π: 6.28 rad = 360.0°, back at 0.0° after one full turn, matrix 1, 0, 0, 1', 'w0', ['按 2π：φ = 6.28 rad = 360.0°', '"圆上角度"回到 0.0°', '1.00、0.00、0.00、1.00'], a + ' ## ' + c, 'φ = 6.28 rad', '= 360.0°', '[ 1.00 0.00 ] | [ 0.00 1.00 ]', '圆上角度 0.0°', '缠了 1 整圈');
    await w.click('2π + π/2', 1300); a = await T('w0a'); c = await T('w0b'); const m1 = c.split(' | ').slice(0, 2).join(' | ');
    both('w0 button 2π + π/2: 7.85 rad = 450.0°, 90.0° on the circle, matrix 0, −1, 1, 0', 'w0', ['按 2π + π/2：φ = 7.85 rad = 450.0°', '圆上角度是 90.0°', '0.00、-1.00、1.00、0.00'], a + ' ## ' + c, 'φ = 7.85 rad', '= 450.0°', '[ 0.00 -1.00 ] | [ 1.00 0.00 ]', '圆上角度 90.0°', '缠了 1 整圈');
    await w.click('π/2', 1300); c = await T('w0b'); const m2 = c.split(' | ').slice(0, 2).join(' | ');
    seeAnd('w0 button π/2 gives the very same matrix and the same angle on the circle as 2π + π/2', 'w0', ['和按 π/2 时分毫不差'], m1 === m2 && c.includes('圆上角度 90.0°') && c.includes('缠了 0 整圈'), m1 + ' / ' + c);
    const wr = await p.evaluate(() => { let worst = 0; for (let i = 0; i <= 160; i++) { const v = -8 + i * .05; for (const k of [-2, -1, 1, 2]) { const d = Math.abs(RX.wrap(v) - RX.wrap(v + k * 2 * Math.PI)); worst = Math.max(worst, Math.min(d, Math.abs(d - 2 * Math.PI))); } } return worst; });
    seeAnd('w0: numbers on the tangent that differ by a multiple of 2π land on the same point of the circle (161 values, with the page\'s own wrap)', 'w0', ['切线上相差 2π 的数，全都落在圆上同一点'], wr < 1e-9, wr);
    await w.set('w0s', -1); a = await T('w0a'); c = await T('w0b');
    seeAnd('w0 negative side: φ = −1.00 gives −57.3° and the arrow below the horizontal (drawn at cy − R sin φ), i.e. turned clockwise', 'w0', ['往负的一边拖，绳子朝反方向缠，红箭头顺时针转'],
      a.includes('φ = -1.00 rad') && c.includes('圆上角度 -57.3°') && c.includes('[ 0.54 0.84 ] | [ -0.84 0.54 ]') && SRC.w0.includes('[cx+Rr*Math.cos(phi),cy-Rr*Math.sin(phi)]') && SRC.w0.includes('const a=phi*i/n'), a + ' ## ' + c);
    await w.set('w0s', 1); }

  // ---- step 2 · wm: the three axes are the three columns
  { const w = W('wm'); await w.show();
    let c = await cells('wmm'), st = await w.status();
    both('wm at the start: column 1 is 0.77, 0.54, 0.34 (mostly along x, towards y, tipped up)', 'wm', ['开始时第 1 列是 0.77、0.54、0.34', '主要朝着世界的 x 方向，偏向 y，还微微上翘'], [c[0], c[3], c[6]].join(' '), '0.77 0.54 0.34');
    ok('wm: that column has its largest part along x and positive parts along y and z', +c[0] > +c[3] && +c[3] > +c[6] && +c[6] > 0, c.join(' '));
    // drag the picture about in several directions, one pixel at a time
    await view('wmc'); const r = await rect('wmc'); let worst = '';
    for (const [dx, dy, k] of [[1, 0, 70], [0, 1, 55], [-1, 1, 40], [1, -1, 90]]) { let x = r[0] + 170, y = r[1] + 130; await p.mouse.move(x, y); await p.mouse.down(); for (let i = 0; i < k; i++) { x += dx; y += dy; await p.mouse.move(x, y); } await p.mouse.up(); await wait(80);
      const s = await w.status(); if (!s.startsWith('三列长度 1.00 / 1.00 / 1.00；两两点积 0.00 / 0.00 / 0.00；det = 1.00。合格的旋转矩阵。')) worst = s; }
    const cd = await cells('wmm');
    seeAnd('wm: after four drags the matrix has changed and the status line still reads lengths 1.00, dot products 0.00, det = 1.00', 'wm', ['三列长度 1.00 / 1.00 / 1.00；两两点积 0.00 / 0.00 / 0.00；det = 1.00'], worst === '' && cd.join(' ') !== c.join(' '), worst + ' ## ' + cd.join(' '));
    await w.click('复位', 700); const c0 = await cells('wmm');
    ok('wm "复位" restores the starting matrix', c0.join(' ') === c.join(' '), c0.join(' '));
    await w.click('加一点误差', 800); st = await w.status(); const c1 = await cells('wmm'); const cls1 = await p.evaluate(() => document.getElementById('wms').className);
    both('wm "加一点误差" (first press after loading): lengths 0.97 / 1.03 / 0.90, dot products 0.24 / −0.15 / 0.13, det = 0.85, status red', 'wm', ['三列长度变成 0.97 / 1.03 / 0.90', '两两点积变成 0.24 / -0.15 / 0.13', 'det = 0.85', '状态行变红', '"不再是纯旋转"'], st + ' ## ' + cls1, '三列长度 0.97 / 1.03 / 0.90；两两点积 0.24 / -0.15 / 0.13；det = 0.85。', '不再是纯旋转', 'status bad');
    const dmax = Math.max(...c1.map((v, i) => Math.abs(+v - +c0[i])));
    ok('wm prompt: every entry moved by at most 0.14 (plus rounding), and the source adds (rnd()*2-1)*.14 from a seeded generator', TRY.wm.includes('±0.14 以内的随机数') && dmax <= .15 + 1e-9 && dmax > .05 && SRC.wm.includes('(rnd()*2-1)*.14') && !SRC.wm.includes('Math.random'), dmax);
    await w.click('投影回 SO(3)', 800); st = await w.status(); const c2 = await cells('wmm'); const cls2 = await p.evaluate(() => document.getElementById('wms').className);
    both('wm "投影回 SO(3)": the status is all 1.00 and 0.00 again, but column 1 is now 0.78, 0.52, 0.34', 'wm', ['状态行回到全是 1.00 和 0.00', '第 1 列现在是 0.78、0.52、0.34', '矩阵没有变回原来的样子'], st + ' ## ' + cls2 + ' ## ' + [c2[0], c2[3], c2[6]].join(' '), '三列长度 1.00 / 1.00 / 1.00；两两点积 0.00 / 0.00 / 0.00；det = 1.00。合格的旋转矩阵。', 'status ok', '0.78 0.52 0.34');
    ok('wm: the projected matrix differs from the starting one', c2.join(' ') !== c0.join(' '), c2.join(' '));
    // the same perturbation recomputed with the interactive's own generator; the nearest rotation computed here as U Vᵀ
    const g = await p.evaluate(() => { const h = __H.wm(), L = __L; const M1 = h.M0.map(r => r.map(v => v + (h.rnd() * 2 - 1) * .14)); const P = h.polar(M1), N = L.nearestRot(M1);
      const r = L.rng(5); let closer = 0, tried = 0; for (let i = 0; i < 3000; i++) { const R = L.mm(L.rod(L.unit(r), (r() * 2 - 1) * (i % 3 ? .2 : 3.1)), N); tried++; if (L.dist(M1, R) < L.dist(M1, N) - 1e-12) closer++; }
      const f = v => (Math.abs(v) < .005 ? 0 : v).toFixed(2);
      return { M1: M1.flat().map(f), P: P.flat().map(f), dPN: L.dist(P, N), orth: L.dist(L.mm(L.tr(N), N), L.I()), detN: L.det(N), dM0: L.dist(M1, h.M0), dN: L.dist(M1, N), closer, tried }; });
    ok('wm: the perturbed matrix recomputed in the page equals the one shown, and the interactive\'s routine gives the matrix shown after projecting', g.M1.join(' ') === c1.join(' ') && g.P.join(' ') === c2.join(' '), g.M1.join(' ') + ' / ' + g.P.join(' '));
    seeAnd('wm: the interactive\'s iteration and U Vᵀ (computed here from an eigen-decomposition) give the same matrix; it is a rotation and nearer to the bad matrix than the starting matrix and than 3000 other rotations', 'wm', ['投影找的是离那个坏矩阵最近的旋转'],
      g.dPN < 1e-9 && g.orth < 1e-9 && near(g.detN, 1, 1e-9) && g.dN < g.dM0 && g.closer === 0 && g.tried === 3000, JSON.stringify(g).slice(0, 300));
    await w.click('复位', 700); }

  // ---- step 3 · wa: three rings, and gimbal lock
  { const w = W('wa'); await w.show();
    for (const [id, v] of [['way', -70], ['wap', 40], ['wao', 100]]) await w.set(id, v, 80);
    await w.click('复位'); let v = await p.evaluate(() => ['wayv', 'wapv', 'waov'].map(i => document.getElementById(i).textContent).join(' ')), st = await w.status();
    both('wa after "复位": yaw 30°, pitch 25°, roll 15°, three axes not parallel', 'wa', ['复位以后（yaw 30°、pitch 25°、roll 15°），三根转轴互不平行'], v + ' ## ' + st, '30° 25° 15°', '三个转轴互不平行，3 个自由度都在。');
    await w.click('pitch 拉到 90°', 1100); st = await w.status(); const cA = await cells('wam'); v = await p.evaluate(() => document.getElementById('wapv').textContent);
    both('wa "pitch 拉到 90°": the status reports gimbal lock; first row of R is 0.00, −0.26, 0.97', 'wa', ['状态行报"万向锁"', '这时 R 的第一行是 0.00、-0.26、0.97'], v + ' ## ' + st + ' ## ' + cA.slice(0, 3).join(' '), '90°', '万向锁：红轴与蓝轴重合（方向相反），只剩 2 个自由度。R 只由 ψ - φ 决定。', '0.00 -0.26 0.97');
    const ax = await p.evaluate(() => { const X = RX, D = X.D; const F1 = X.Rz(30 * D), F2 = X.mm(F1, X.Ry(90 * D)); const roll = X.cl(F2, 0), yaw = [0, 0, 1]; return { roll, cross: X.len(X.cross(roll, yaw)), dot: X.dot(roll, yaw) }; });
    seeAnd('wa: at pitch 90° the roll axis (first column of Rz·Ry) is vertical, along the yaw axis and pointing the opposite way', 'wa', ['绿环把红色的 roll 轴转到了竖直方向，和蓝色的 yaw 轴落在同一条线上', '只是方向相反'], ax.cross < 1e-12 && near(ax.dot, -1, 1e-12), JSON.stringify(ax));
    await w.set('way', 60); const cB = await cells('wam');
    both('wa locked, yaw 60°: first row 0.00, −0.71, 0.71', 'wa', ['把 yaw 拖到 60°，第一行变成 0.00、-0.71、0.71'], cB.slice(0, 3).join(' '), '0.00 -0.71 0.71');
    await w.set('wao', 45); const cC = await cells('wam');
    both('wa locked, yaw 60° and roll 45°: the first row is 0.00, −0.26, 0.97 again and the whole matrix is as before', 'wa', ['再把 roll 拖到 45°，它又变回 0.00、-0.26、0.97', '整个矩阵和拖之前一模一样'], cC.join(' '), cA.join(' '));
    const eq = await p.evaluate(() => { const X = RX, D = X.D, R = (y, p, r) => X.mm(X.Rz(y * D), X.mm(X.Ry(p * D), X.Rx(r * D))); const A = R(30, 90, 15), B = R(60, 90, 45), C = R(60, 90, 15); let d = 0, e = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { d = Math.max(d, Math.abs(A[i][j] - B[i][j])); e = Math.max(e, Math.abs(A[i][j] - C[i][j])); } return [d, e]; });
    seeAnd('wa: computed with the page\'s helpers, R(60°, 90°, 45°) equals R(30°, 90°, 15°) exactly, while R(60°, 90°, 15°) does not', 'wa', ['两个都加 30°，正好互相抵消', '三个滑块只剩两个管用'], eq[0] < 1e-12 && eq[1] > .3, eq.join(' '));
    await w.click('复位'); await w.set('wap', 77); const st77 = await w.status(); await w.set('wap', 78); const st78 = await w.status(), c78 = await cells('wam'); await w.set('wap', 90); const c90 = await cells('wam');
    both('wa after a reset: the warning first appears at pitch 78° (not at 77°); the four highlighted entries are 0.18, 0.10, 0.05, 0.20 there and 0.00 at 90°', 'wa', ['78° 时状态行就提示"快锁住了"', '高亮的四格只剩 0.18、0.10、0.05、0.20', '到 90° 全是 0.00'],
      st77 + ' ## ' + st78 + ' ## ' + [c78[0], c78[3], c78[7], c78[8]].join(' ') + ' ## ' + [c90[0], c90[3], c90[7], c90[8]].join(' '), /^三个转轴互不平行，3 个自由度都在。 ## 快锁住了：/, '## 0.18 0.10 0.05 0.20 ## 0.00 0.00 0.00 0.00');
    const hot = await p.evaluate(() => [...document.getElementById('wam').children].map((e, i) => e.className ? i : -1).filter(i => i >= 0).join(' '));
    ok('wa: the highlighted entries are r11, r21, r32, r33 (positions 0, 3, 7, 8 of the grid)', hot === '0 3 7 8', hot);
    await w.click('复位'); }

  // ---- step 4 · wr: one turn about one axis
  { const w = W('wr'); await w.show(); const line = (t, i) => t.split(' | ')[i];
    await w.set('wrs', 90); let t = await T('wro');
    both('wr v ⊥ k, θ = 90°: sideways (0, 1, 0), back (−1, 0, 0), v′ = (0, 1, 0)', 'wr', ['θ = 90° 时，橙色一段是 (0.00, 1.00, 0.00)', '青色一段是 (-1.00, 0.00, 0.00)', 'v 从 (1.00, 0.00, 0.00) 到了 v′ = (0.00, 1.00, 0.00)'], t, /^v = \(1\.00, 0\.00, 0\.00\) \| sinθ \(k×v\) = \(0\.00, 1\.00, 0\.00\) \| \(1-cosθ\) k×\(k×v\)= \(-1\.00, 0\.00, 0\.00\) \| v′ = \(0\.00, 1\.00, 0\.00\)/);
    await w.set('wrs', 180); t = await T('wro');
    both('wr v ⊥ k, θ = 180°: sideways 0, back (−2, 0, 0), v′ = (−1, 0, 0)', 'wr', ['θ = 180° 时橙色一段缩成了 0', '青色一段是 (-2.00, 0.00, 0.00)', 'v′ = (-1.00, 0.00, 0.00)'], t, 'sinθ (k×v) = (0.00, 0.00, 0.00) | (1-cosθ) k×(k×v)= (-2.00, 0.00, 0.00) | v′ = (-1.00, 0.00, 0.00)');
    await w.click('v 斜着'); const tb = await T('wro'); await w.set('wrs', 90); t = await T('wro');
    both('wr "v 斜着" (still at 180°: v′ = (−0.80, 0, 0.60)), then θ = 90°: v = (0.80, 0, 0.60) → v′ = (0, 0.80, 0.60)', 'wr', ['v = (0.80, 0.00, 0.60)', 'θ = 90°：v′ = (0.00, 0.80, 0.60)', '沿着转轴的那 0.60 原样留着，转的只是水平的那 0.80'], tb + ' ## ' + t, 'v′ = (-0.80, 0.00, 0.60)', '## v = (0.80, 0.00, 0.60) | sinθ (k×v) = (0.00, 0.80, 0.00) | (1-cosθ) k×(k×v)= (-0.80, 0.00, 0.00) | v′ = (0.00, 0.80, 0.60)');
    seeAnd('wr tilted: the tip circles at radius 0.80, smaller than the 1.00 of the first case (the interactive draws the circle with the length of the part of v at right angles to k)', 'wr', ['所以尖端走的圆比刚才小'], Math.hypot(.8, 0) < 1 && SRC.wr.includes('VS=[[1,0,0],[.8,0,.6],[0,0,1]]') && SRC.wr.includes('rr=X.len(perp)'), '');
    await w.click('v 与 k 平行'); const seen = []; for (const th of [90, -120, 37, 180]) { await w.set('wrs', th, 100); seen.push(await T('wro')); }
    seeAnd('wr "v 与 k 平行": both stretches are 0 and v′ = v = (0, 0, 1) at 90°, −120°, 37° and 180°', 'wr', ['橙、青两段都是 0，v′ = v，θ 怎么拖都不动'], seen.every(s => s.startsWith('v = (0.00, 0.00, 1.00) | sinθ (k×v) = (0.00, 0.00, 0.00) | (1-cosθ) k×(k×v)= (0.00, 0.00, 0.00) | v′ = (0.00, 0.00, 1.00)')), seen[0]);
    const lens = [seen[0]]; await w.click('v 斜着'); lens.push(await T('wro')); await w.click('v 与 k 垂直'); lens.push(await T('wro'));
    seeAnd('wr: in all three cases the last line reads ‖v‖ = 1.00，‖v′‖ = 1.00', 'wr', ['‖v‖ = 1.00，‖v′‖ = 1.00'], lens.every(s => s.endsWith('‖v‖ = 1.00，‖v′‖ = 1.00（长度不变）')), lens.map(s => s.slice(-30)).join(' / '));
    await w.set('wrs', 70); t = await T('wro');
    ok('wr back at the start (v ⊥ k, θ = 70°): sideways 0.94, back −0.66 (the numbers of the figure under "罗德里格斯公式")', t.includes('sinθ (k×v) = (0.00, 0.94, 0.00) | (1-cosθ) k×(k×v)= (-0.66, 0.00, 0.00) | v′ = (0.34, 0.94, 0.00)'), t); }

  // ---- step 5 · wb: one orientation written four ways
  const KEEP = {};
  { const w = W('wb'); await w.show();
    const all = async () => ({ e: await T('wbev'), a: await T('wbav'), q: await T('wbqv'), m: await T('wbmv') });
    const snap = () => p.evaluate(() => { const g = i => document.getElementById(i); const nums = s => (s.match(/-?\d+\.\d+/g) || []).map(Number);
      return { e: nums(g('wbev').innerText), a: nums(g('wbav').innerText), q: nums(g('wbqv').innerText), fe: g('wbef').textContent, fa: g('wbaf').textContent, et: g('wbev').innerText.replace(/\n/g, ' | '), at: g('wbav').innerText.replace(/\n/g, ' | ') }; });
    const s0 = await all(); KEEP.wb0 = s0;
    both('wb at the start: Euler angles 40.0°, 30.0°, 20.0°; θ = 49.2°; quaternion (0.909, 0.070, 0.297, 0.283)', 'wb', ['欧拉角 40.0°、30.0°、20.0°', '轴角 θ = 49.2°', '四元数 (0.909, 0.070, 0.297, 0.283)'], s0.e + ' ## ' + s0.a + ' ## ' + s0.q, 'yaw 40.0° | pitch 30.0° | roll 20.0°', 'θ 49.2° | k(0.17,0.71,0.68) | r(0.15,0.61,0.58)', 'w 0.909 | x 0.070 | y 0.297 | z 0.283');
    await w.click('q → −q', 300); const s1 = await all(); const fq = await T('wbqf');
    both('wb "q → −q": all four numbers of the quaternion change sign; the other three cards do not change', 'wb', ['四元数的四个数全部变号，成了 (-0.909, -0.070, -0.297, -0.283)', '另外三张卡片和飞机一动不动'], s1.q + ' ## ' + fq + ' ## ' + (s1.e === s0.e && s1.a === s0.a && s1.m === s0.m ? 'others unchanged' : 'others CHANGED'), 'w -0.909 | x -0.070 | y -0.297 | z -0.283', '-q：物体没动', 'others unchanged');
    await w.click('复位', 300); await wait(1900);
    // drag straight down, one pixel at a time (1 pixel = 1/90 rad)
    await view('wbc'); let r = await rect('wbc'); let x = r[0] + 170, y = r[1] + 20; await p.mouse.move(x, y); await p.mouse.down();
    let prev = await snap(), dq = 0, pitchUp = true, yawRollFixed = true, jumpAt = -1, lockSeen = '', flag = '', after = null, fallAfter = true;
    for (let i = 1; i <= 120; i++) { y += 1; await p.mouse.move(x, y); const s = await snap(); dq = Math.max(dq, ...s.q.map((v, k) => Math.abs(v - prev.q[k])));
      if (jumpAt < 0) { if (s.e[0] === 40 && s.e[2] === 20) { if (!(s.e[1] > prev.e[1])) pitchUp = false; } else if (s.e[0] === 20 && s.e[2] === 0) lockSeen = s.et; else { jumpAt = i; flag = s.fe; after = s; } }
      else { if (!(s.e[1] < prev.e[1]) || s.e[0] !== -140 || s.e[2] !== -160) fallAfter = false; }
      prev = s; }
    await p.mouse.up(); await wait(100);
    seeAnd('wb dragged straight down: pitch climbs from 30° with yaw 40.0° and roll 20.0° unchanged; when it reaches 90° (pixel 95) yaw is −140.0° and roll −160.0°, the card shows "跳变", and pitch falls from then on', 'wb', ['pitch 从 30° 一路往上涨', 'yaw 从 40.0° 跳到 -140.0°', 'roll 从 20.0° 跳到 -160.0°', '各跳了 180°'],
      pitchUp && jumpAt === 95 && after.e[0] === -140 && after.e[2] === -160 && flag === '跳变' && fallAfter && 40 - (-140) === 180 && 20 - (-160) === 180, JSON.stringify({ pitchUp, jumpAt, after: after && after.et, flag, fallAfter }));
    const TXq = await secText('s-quat');
    ok('wb fold: on the pixel that lands on 90° the card shows yaw 20.0°, roll 0.0° (the difference 40° − 20°)', TXq.includes('欧拉角卡片会显示 yaw 20.0°、roll 0.0°') && TXq.includes('40° - 20° = 20°') && /^yaw 20\.0° \| pitch 89\.8° \| roll 0\.0°$/.test(norm(lockSeen)), lockSeen);
    const dqDown = dq;
    await wait(1900); await w.click('复位', 300);
    // drag to the right, one pixel at a time
    await view('wbc'); r = await rect('wbc'); x = r[0] + 20; y = r[1] + 130; await p.mouse.move(x, y); await p.mouse.down();
    prev = await snap(); dq = 0; let up = true, turnAt = -1, before = null, afterA = null, down = true, flagA = '', maxTh = 0, euFlag = '';
    for (let i = 1; i <= 300; i++) { x += 1; await p.mouse.move(x, y); const s = await snap(); dq = Math.max(dq, ...s.q.map((v, k) => Math.abs(v - prev.q[k]))); maxTh = Math.max(maxTh, s.a[0]); if (s.fe) euFlag = s.fe;
      if (turnAt < 0) { if (s.a[0] < prev.a[0]) { turnAt = i; before = prev; afterA = s; flagA = s.fa; } else if (!(s.a[0] > prev.a[0])) up = false; }
      else if (!(s.a[0] < prev.a[0])) down = false;
      prev = s; }
    await p.mouse.up(); await wait(100); const sEnd = await all();
    const flip = before && afterA && [1, 2, 3].every(k => near(before.a[k], -afterA.a[k], .011)) && [4, 5, 6].every(k => near(before.a[k], -afterA.a[k], .011));
    seeAnd('wb dragged to the right: θ climbs from 49.2° to 180° (largest value shown ≥ 179.5°), then falls; at the turn k and r change sign and the axis-angle card shows "跳变"', 'wb', ['轴角的 θ 从 49.2° 涨到 180° 就掉头往下降', '同时 k 整个翻到对面，r 的三个数全部变号'],
      up && down && turnAt === 250 && maxTh >= 179.5 && flip && flagA === '跳变' && euFlag === '', JSON.stringify({ up, down, turnAt, maxTh, before: before && before.at, after: afterA && afterA.at, flagA, euFlag }));
    const rlen = v => Math.hypot(v[4], v[5], v[6]);
    ok('wb fold: at the turn k goes from (−0.58, −0.02, 0.81) to (0.58, 0.02, −0.81) and r from (−1.82, −0.05, 2.55) to (1.82, 0.05, −2.55); the length of r is about 3.13 both times', TXq.includes('k 从 (-0.58, -0.02, 0.81) 翻成 (0.58, 0.02, -0.81)') && TXq.includes('r 从 (-1.82, -0.05, 2.55) 翻成 (1.82, 0.05, -2.55)') && TXq.includes('3.13 上下') &&
      norm(before.at).includes('k(-0.58,-0.02,0.81) | r(-1.82,-0.05,2.55)') && norm(afterA.at).includes('k(0.58,0.02,-0.81) | r(1.82,0.05,-2.55)') && near(rlen(before.a), 3.13, .006) && near(rlen(afterA.a), 3.13, .006) && rlen(before.a) < Math.PI, before.at + ' / ' + afterA.at);
    seeAnd('wb: during both drags no number of the quaternion changed by more than 0.006 from one pixel to the next', 'wb', ['四元数的四个数每次也只变千分之几'], dqDown <= .0065 && dq <= .0065 && dqDown > .001, dqDown + ' ' + dq);
    await wait(1900);
    await w.click('绕 k 一步转到位', 120); const sA = await snap(); await wait(2100); const sB = await all();
    seeAnd('wb "绕 k 一步转到位": the plane restarts near the zero orientation (θ below 5° after 0.1 s) and ends exactly on the orientation it had been dragged to', 'wb', ['先回到零姿态，再绕紫色的轴一次转过 θ，正好停在刚才拖到的姿态上'], sA.a[0] < 5 && sB.e === sEnd.e && sB.a === sEnd.a && sB.q === sEnd.q && sB.m === sEnd.m, sA.at + ' / ' + sB.a + ' / ' + sEnd.a);
    await w.click('复位', 300);
    // a drag that strays sideways by one pixel in twenty
    await view('wbc'); r = await rect('wbc'); x = r[0] + 170; y = r[1] + 20; await p.mouse.move(x, y); await p.mouse.down(); prev = await snap(); let flags = new Set(), swing = 0; const hist = [prev];
    for (let i = 0; i < 120; i++) { y += 1; if (i % 20 === 19) x += 1; await p.mouse.move(x, y); const s = await snap(); if (s.fe) flags.add(s.fe); hist.push(s); }
    await p.mouse.up(); await wait(100);
    const wrapd = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return Math.abs(d); };
    for (let i = 2; i < hist.length; i++) swing = Math.max(swing, wrapd(hist[i].e[0] - hist[i - 2].e[0]));
    ok('wb fold: with a drag that strays a little, yaw swings through more than 100° within two pixels and the card shows "剧烈变化", never "跳变"', TXq.includes('yaw 和 roll 会在一两个像素里猛转一百多度') && TXq.includes('卡片亮的是"剧烈变化"，不是"跳变"') && swing > 100 && flags.has('剧烈变化') && !flags.has('跳变'), swing + ' ' + [...flags].join(','));
    ok('wb fold: a straight downward drag turns the plane about the pitch axis, because the view direction of the interactive (40°) equals the starting yaw (40°)', TXq.includes('这个交互的视角正好让"竖着拖"绕的是 pitch 的转轴') && SRC.wb.includes('V=X.view(40*D,22*D)') && SRC.wb.includes('Q0=X.e2q(40*D,30*D,20*D)'), '');
    await wait(1900); await w.click('复位', 300); }

  // ---- step 6 · w5: adding the change, or multiplying by a small rotation
  { const w = W('w5'); await w.show();
    await w.click('重来'); const z = await T('w5x');
    await w.click('走 20 步', 1900); let a = await T('w5x'), e = await T('w5y'), hv = await T('w5v');
    both('w5 at 0.30 rad per step, 20 steps: exp stays at length 1.000, the naive point is at 2.367 and "已经不是旋转"', 'w5', ['每步转 0.30 rad、走 20 步', 'exp 方法的点一直在蓝圈上，长度 1.000', '长度到了 2.367', '"已经不是旋转"'], z + ' ## ' + hv + ' ## ' + a + ' ## ' + e, '步数 0 | 长度 1.000 | 还是旋转 ## 0.30 ## 步数 20 | 长度 2.367 | 已经不是旋转 ## 步数 20 | 长度 1.000 | 还是旋转');
    seeAnd('w5: 20 steps of 0.30 rad make 6 rad, just short of a full turn of 2π ≈ 6.28', 'w5', ['一共 6 rad，差一点满一圈'], near(20 * .3, 6, 1e-12) && 6 < 2 * Math.PI && 2 * Math.PI - 6 < .3, 2 * Math.PI);
    await w.click('重来'); await w.click('走 1 步'); a = await T('w5x');
    both('w5: after the very first step the naive length is 1.044', 'w5', ['走完第 1 步，长度就已经是 1.044 了'], a, '步数 1 | 长度 1.044 | 已经不是旋转');
    await w.set('w5s', .15); await w.click('重来'); await w.click('走 20 步', 1900); await w.click('走 20 步', 1900); a = await T('w5x'); e = await T('w5y'); hv = await T('w5v');
    both('w5 at 0.15 rad per step, 40 steps (the same 6 rad): the naive length is 1.561', 'w5', ['把步子减半到 0.15，走 40 步', '朴素方法的长度是 1.561'], hv + ' ## ' + a + ' ## ' + e, '0.15 ## 步数 40 | 长度 1.561 | 已经不是旋转 ## 步数 40 | 长度 1.000 | 还是旋转');
    await w.set('w5s', .05); await w.click('重来'); await w.click('走 1 步'); a = await T('w5x');
    seeAnd('w5: even at the smallest step (0.05) one step already leaves the circle (length 1.001)', 'w5', ['步子再小也只是跑得更慢', '每一步都会离开圆一点'], a === '步数 1 | 长度 1.001 | 已经不是旋转' && (await p.evaluate(() => document.getElementById('w5s').min)) === '0.05', a);
    await w.set('w5s', .8); await w.click('重来'); await w.click('走 1 步'); a = await T('w5x'); KEEP.w5h8 = a;
    await w.set('w5s', .3); await w.click('重来'); }

  // ---- step 8 · wd: three ways from one orientation to another
  { const w = W('wd'); await w.show();
    let lg = await T('wdlg');
    both('wd example 1: SLERP 94° uniform, Euler-angle interpolation 108° varying, SLERP with −q₁ 266° uniform', 'wd', ['SLERP 的总转角是 94°', '欧拉角线性插值转了 108°', '图例里标着"变速"', '却转了 266°'], lg, '欧拉角线性 | 总转角 108° | 变速 | SLERP | 总转角 94° | 匀速 | SLERP 用 -q₁ | 总转角 266° | 匀速');
    const played = [];
    for (const m of ['SLERP', '欧拉角线性', 'SLERP 用 −q₁']) { await w.click(m); await w.click('播放', 150); const mid = await T('wdpl'); await wait(3100); played.push(mid + '→' + (await T('wdpl')) + ' ' + (await T('wdtv'))); }
    ok('wd "播放" runs each of the three methods to t = 1.00 (the button reads "暂停" while it plays)', played.every(s => s === '暂停→播放 t = 1.00') && TRY.wd.includes('按"播放"看 SLERP，再点"欧拉角线性"和"SLERP 用 -q₁"各播一遍'), played.join(' / '));
    const g = await p.evaluate(() => { const h = __H.wd(); const a = h.run(h.EX[0][0], h.EX[0][1]), b = h.run(h.EX[1][0], h.EX[1][1]); return { a, b, EX: h.EX }; });
    const A = g.a.out, B = g.b.out; const angA = 2 * Math.acos(Math.abs(g.a.dot)) * 180 / Math.PI, angB = 2 * Math.acos(Math.abs(g.b.dot)) * 180 / Math.PI;
    seeAnd('wd example 1, recomputed with the interactive\'s own code: totals 108.2°, 93.8°, 266.2°; SLERP is uniform and equals the angle between the two orientations; 266.2° = 360° − 93.8°', 'wd', ['94° 就是起止两个姿态之间的夹角', '正好是 360° - 94°'],
      Math.round(A[0].tot) === 108 && Math.round(A[1].tot) === 94 && Math.round(A[2].tot) === 266 && near(A[1].tot, angA, 1e-6) && near(A[1].tot + A[2].tot, 360, 1e-6) && A[1].mx - A[1].mn < 1e-6 && A[2].mx - A[2].mn < 1e-6, JSON.stringify(A).slice(0, 300));
    seeAnd('wd example 1: the Euler-angle interpolation starts at about 141° per unit of t and ends at about 76°, falling all the way', 'wd', ['先快后慢（每单位 t 转过的角度从约 141° 降到约 76°）'], Math.round(A[0].first) === 141 && Math.round(A[0].last) === 76 && near(A[0].mx, A[0].first, 1e-9) && near(A[0].mn, A[0].last, 1e-9), A[0].first + ' ' + A[0].last);
    await w.click('例 2：跨 ±180°'); lg = await T('wdlg');
    both('wd example 2: the orientations are 71° apart, Euler-angle interpolation turns 292°', 'wd', ['两个姿态其实只差 71°', '欧拉角线性插值却转了 292°'], lg, '欧拉角线性 | 总转角 292° | 变速 | SLERP | 总转角 71° | 匀速 | SLERP 用 -q₁ | 总转角 289° | 匀速');
    seeAnd('wd example 2: its yaw goes from −150° to 150° (300° counted, 60° across ±180°); recomputed totals 292.3° and 71.2°', 'wd', ['它的 yaw 从 -150° 走到 150°', '老老实实数了 300°', '跨过 ±180° 只要转 60°'],
      g.EX[1][0][0] === -150 && g.EX[1][1][0] === 150 && 150 - (-150) === 300 && 360 - 300 === 60 && Math.round(B[0].tot) === 292 && Math.round(B[1].tot) === 71 && near(B[1].tot, angB, 1e-6), JSON.stringify(B).slice(0, 200));
    KEEP.wdA = { omega: Math.acos(Math.abs(g.a.dot)) * 180 / Math.PI, tot: A.map(o => o.tot) };
    await w.click('随机'); const r1 = await T('wdlg'); await w.click('随机'); const r2 = await T('wdlg');
    KEEP.rand = r1 + ' ## ' + r2;
    await w.click('例 1'); await w.click('SLERP'); }

  // ===================================================== Part B =====================================================
  sec('Part B · numbers and formulas in the text, recomputed here');
  const SECS = ['s-basics', 's-core', 's-mat', 's-euler', 's-aa', 's-quat', 's-lie', 's-conv', 's-interp', 's-sum'];
  const TX = {}; for (const id of SECS) TX[id] = await secText(id);
  TX.hdr = await p.evaluate(() => { const h = document.querySelector('header'); h.querySelectorAll('details').forEach(d => d.open = true); return h.innerText; }).then(norm);
  const miss = (id, strs) => strs.filter(x => !TX[id].includes(x)).join(' ¦ ');
  // one check: every string is in that section's text AND the recomputed condition holds
  const tx = (name, id, strs, cond, got) => ok(name, !miss(id, strs) && cond, 'text lacks: ' + miss(id, strs) + ' ¦¦ got: ' + (typeof got === 'string' ? got : JSON.stringify(got)).slice(0, 400));
  const f2 = v => (Math.abs(v) < .005 ? 0 : v).toFixed(2), f3 = v => (Math.abs(v) < .0005 ? 0 : v).toFixed(3), v3 = a => '(' + a.map(x => Math.round(x * 1e9) / 1e9 + 0).join(', ') + ')';

  // everything below is computed inside the page: with its shared helpers (RX), with the routines written for this check (__L),
  // and on random orientations drawn from a seeded generator
  const G = await p.evaluate(() => { const X = RX, L = __L, D = X.D, r = L.rng(11), o = {};
    const R3 = (y, pt, rl) => X.mm(X.Rz(y), X.mm(X.Ry(pt), X.Rx(rl)));
    const maxd = (A, B) => { const a = A.flat(), b = B.flat(); return Math.max(...a.map((v, i) => Math.abs(v - b[i]))); };
    const vd = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const ra = (lo, hi) => lo + (hi - lo) * r();
    const conj = q => [q[0], -q[1], -q[2], -q[3]];
    const rq = () => X.qa(L.unit(r), ra(-3.1, 3.1));
    // ---- step 0
    o.len = Math.hypot(3, 4, 0); o.unit = [3, 4, 0].map(v => v / 5);
    o.dots = [X.dot([1, 0, 0], [0, 1, 0]), X.dot([1, 1, 0], [1, 0, 0]), Math.acos(1 / Math.SQRT2) / D];
    o.cxy = X.cross([1, 0, 0], [0, 1, 0]); o.cyx = X.cross([0, 1, 0], [1, 0, 0]);
    o.crossPerp = 0; o.detTriple = 0; o.mvCols = 0; o.assoc = 0;
    for (let i = 0; i < 300; i++) { const a = [ra(-2, 2), ra(-2, 2), ra(-2, 2)], b = [ra(-2, 2), ra(-2, 2), ra(-2, 2)], c = X.cross(a, b); o.crossPerp = Math.max(o.crossPerp, Math.abs(X.dot(c, a)), Math.abs(X.dot(c, b)));
      const M = [0, 1, 2].map(() => [ra(-2, 2), ra(-2, 2), ra(-2, 2)]), N = [0, 1, 2].map(() => [ra(-2, 2), ra(-2, 2), ra(-2, 2)]), c1 = X.cl(M, 0), c2 = X.cl(M, 1), c3 = X.cl(M, 2);
      o.detTriple = Math.max(o.detTriple, Math.abs(X.dot(c1, X.cross(c2, c3)) - L.det(M)));
      o.mvCols = Math.max(o.mvCols, vd(X.mv(M, a), X.add(X.add(X.scl(c1, a[0]), X.scl(c2, a[1])), X.scl(c3, a[2]))));
      o.assoc = Math.max(o.assoc, vd(X.mv(X.mm(M, N), a), X.mv(M, X.mv(N, a)))); }
    const Rz90 = X.Rz(90 * D); o.Rz90 = Rz90.flat(); o.Rz90x = X.mv(Rz90, [1, 0, 0]); o.Rz90T = L.tr(Rz90).flat(); o.trRz90 = Rz90[0][0] + Rz90[1][1] + Rz90[2][2]; o.detRz90 = L.det(Rz90);
    o.rad = 180 / Math.PI; o.atan = [Math.atan2(1, 1) / D, Math.atan2(-1, -1) / D, Math.atan2(1, 0) / D];
    // ---- step 1
    o.noseA = X.mv(X.mm(X.Ry(90 * D), X.Rx(90 * D)), [1, 0, 0]); o.noseB = X.mv(X.mm(X.Rx(90 * D), X.Ry(90 * D)), [1, 0, 0]);
    // ---- step 2
    o.colsRz90 = [0, 1, 2].map(j => X.cl(Rz90, j)); o.inv = maxd(L.tr(Rz90), X.Rz(-90 * D)); o.avg = L.scl(L.add(L.I(), X.Rz(180 * D)), .5).flat();
    o.orth = 0; o.detR = 0; for (let i = 0; i < 200; i++) { const R = X.q2R(rq()); o.orth = Math.max(o.orth, maxd(L.mm(L.tr(R), R), L.I())); o.detR = Math.max(o.detR, Math.abs(L.det(R) - 1)); }
    o.chain = maxd(L.mm(Rz90, L.I()), Rz90);
    { const T = [[1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], pv = [0, 2, 0, 1]; o.T = T.map(row => row.reduce((s, v, k) => s + v * pv[k], 0)); }
    // ---- step 3
    o.RzEx = X.mv(Rz90, [1, 0, 0]); o.RyEx = X.mv(X.Ry(90 * D), [0, 0, 1]);
    o.big = 0; o.inv3 = 0; o.lockF = 0; o.rateFD = 0;
    for (let i = 0; i < 300; i++) { const ps = ra(-3.1, 3.1), th = ra(-1.5, 1.5), ph = ra(-3.1, 3.1), c = Math.cos, s = Math.sin, R = R3(ps, th, ph);
      const B = [[c(ps) * c(th), c(ps) * s(th) * s(ph) - s(ps) * c(ph), c(ps) * s(th) * c(ph) + s(ps) * s(ph)], [s(ps) * c(th), s(ps) * s(th) * s(ph) + c(ps) * c(ph), s(ps) * s(th) * c(ph) - c(ps) * s(ph)], [-s(th), c(th) * s(ph), c(th) * c(ph)]];
      o.big = Math.max(o.big, maxd(R, B));
      const th2 = -Math.asin(R[2][0]), ph2 = Math.atan2(R[2][1], R[2][2]), ps2 = Math.atan2(R[1][0], R[0][0]); o.inv3 = Math.max(o.inv3, Math.abs(th2 - th), Math.abs(X.wrap(ph2 - ph)), Math.abs(X.wrap(ps2 - ps)));
      const Lk = R3(ps, 90 * D, ph), d = ph - ps; o.lockF = Math.max(o.lockF, maxd(Lk, [[0, s(d), c(d)], [0, c(d), -s(d)], [-1, 0, 0]]));
      // yaw rate by a finite difference: turn the body by ω dt about its own axes and read the yaw angle again
      const thr = ra(-1.2, 1.2), om = [ra(-1, 1), ra(-1, 1), ra(-1, 1)], dt = 1e-6, R0 = R3(ps, thr, ph), R1 = L.mm(R0, L.rod(om.map(v => v / Math.hypot(...om)), Math.hypot(...om) * dt));
      const fd = X.wrap(Math.atan2(R1[1][0], R1[0][0]) - ps) / dt, fo = (om[1] * s(ph) + om[2] * c(ph)) / c(thr); o.rateFD = Math.max(o.rateFD, Math.abs(fd - fo) / (1 + Math.abs(fo))); }
    o.inv3ex = [-Math.asin(Rz90[2][0]) / D, Math.atan2(Rz90[2][1], Rz90[2][2]) / D, Math.atan2(Rz90[1][0], Rz90[0][0]) / D];
    o.lock = maxd(R3(0, 90 * D, 30 * D), R3(20 * D, 90 * D, 50 * D)); o.lockMinus = [maxd(R3(10 * D, -90 * D, 30 * D), R3(25 * D, -90 * D, 15 * D)), maxd(R3(10 * D, -90 * D, 30 * D), R3(25 * D, -90 * D, 45 * D))];
    o.cos89 = Math.cos(89 * D); o.rate = 10 / Math.cos(89 * D); o.equiv = maxd(R3(0, 30 * D, 0), R3(180 * D, 150 * D, 180 * D));
    o.nose30 = X.cl(R3(0, 30 * D, 0), 0); o.noseF5 = X.cl(R3(60 * D, 35 * D, 0), 0);
    // ---- step 4
    o.half = Math.PI / 2; o.m30 = -30 * D; o.Kx = L.mv(L.hat([0, 0, 1]), [1, 0, 0]); o.zx = X.cross([0, 0, 1], [1, 0, 0]);
    o.rodEx = (() => { const k = [0, 0, 1], v = [1, 0, 0], kv = X.cross(k, v), kkv = X.cross(k, kv); return [kv, kkv, X.add(X.add(v, kv), kkv)]; })();
    o.rod = 0; o.series = 0; o.K3 = 0; o.log = 0; o.hatCross = 0; o.atan2th = 0;
    for (let i = 0; i < 300; i++) { const k = L.unit(r), th = ra(.05, 3.05), K = L.hat(k), R = L.rod(k, th), v = [ra(-1, 1), ra(-1, 1), ra(-1, 1)];
      o.rod = Math.max(o.rod, maxd(R, X.q2R(X.qa(k, th)))); o.hatCross = Math.max(o.hatCross, vd(L.mv(K, v), X.cross(k, v)));
      o.K3 = Math.max(o.K3, maxd(L.mm(K, L.mm(K, K)), L.scl(K, -1)));
      let S = L.I(), term = L.I(); const A = L.scl(K, th); for (let n = 1; n <= 40; n++) { term = L.scl(L.mm(term, A), 1 / n); S = L.add(S, term); } o.series = Math.max(o.series, maxd(S, R));
      const tr = R[0][0] + R[1][1] + R[2][2], th2 = Math.acos((tr - 1) / 2), k2 = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]].map(x => x / (2 * Math.sin(th2))); o.log = Math.max(o.log, Math.abs(th2 - th), vd(k2, k));
      const vee = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]]; o.atan2th = Math.max(o.atan2th, Math.abs(Math.atan2(Math.hypot(...vee) / 2, (tr - 1) / 2) - th), Math.abs(Math.hypot(...vee) / 2 - Math.sin(th))); }
    o.logEx = (() => { const R = Rz90, tr = R[0][0] + R[1][1] + R[2][2]; return [tr, Math.acos((tr - 1) / 2) / D, R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]]; })();
    { const P = L.mm(X.Rx(90 * D), X.Ry(90 * D)), tr = P[0][0] + P[1][1] + P[2][2], th = Math.acos((tr - 1) / 2), k = [P[2][1] - P[1][2], P[0][2] - P[2][0], P[1][0] - P[0][1]].map(x => x / (2 * Math.sin(th)));
      o.ab = { th: th / D, k, sum: Math.hypot(Math.PI / 2, Math.PI / 2, 0) / D, P: P.flat() }; }
    o.small = (() => { const R = L.rod(L.unit(r), .01), vee = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]].map(x => x / 2); return Math.abs(Math.hypot(...vee) - .01); })();
    // ---- step 5
    const q90 = X.qa([0, 0, 1], 90 * D); o.q90 = q90; o.qx180 = X.qa([1, 0, 0], 180 * D); o.s1 = X.qm(q90, [0, 1, 0, 0]); o.s2 = X.qm(o.s1, conj(q90)); o.qq = X.qm(q90, q90);
    o.negEx = [X.mv(X.q2R(q90), [1, 0, 0]), X.mv(X.q2R(q90.map(v => -v)), [1, 0, 0])];
    o.prod = 0; o.axis1 = 0; o.axis2 = 0; o.neg = 0; o.sand = 0; o.unitq = 0; o.halfTurn = 0;
    for (let i = 0; i < 300; i++) { const a = rq(), b = rq(), u1 = a.slice(1), u2 = b.slice(1), cr = X.cross(u1, u2);
      const f = [a[0] * b[0] - X.dot(u1, u2), ...[0, 1, 2].map(j => a[0] * u2[j] + b[0] * u1[j] + cr[j])]; o.prod = Math.max(o.prod, vd(f, X.qm(a, b)));
      const k = L.unit(r), th = ra(-3.1, 3.1), q = X.qa(k, th), left = X.qm(q, [0, ...k]); o.axis1 = Math.max(o.axis1, vd(left, [-Math.sin(th / 2), ...k.map(x => x * Math.cos(th / 2))])); o.axis2 = Math.max(o.axis2, vd(X.qm(left, conj(q)), [0, ...k]));
      o.neg = Math.max(o.neg, maxd(X.q2R(a), X.q2R(a.map(v => -v)))); o.unitq = Math.max(o.unitq, Math.abs(Math.hypot(...q) - 1));
      const v = [ra(-1, 1), ra(-1, 1), ra(-1, 1)], sw = X.qm(X.qm(a, [0, ...v]), conj(a)); o.sand = Math.max(o.sand, Math.abs(sw[0]), vd(sw.slice(1), X.mv(X.q2R(a), v)));
      // a vector at right angles to the axis is turned through half the angle by the left multiplication alone
      const p0 = X.cross(k, v), pn = p0.map(x => x / Math.hypot(...p0)), hl = X.qm(q, [0, ...pn]).slice(1), want = L.mv(L.rod(k, th / 2), pn); o.halfTurn = Math.max(o.halfTurn, vd(hl, want)); }
    // ---- step 6
    o.pow = [Math.pow(1 + .09, 10), Math.pow(1 + .0225, 20), Math.sqrt(1 + .09), Math.sqrt(1 + .64), Math.sqrt(1 + .0025)];
    o.skew = 0; o.kin = 0; o.smallq = 0;
    for (let i = 0; i < 100; i++) { const k = L.unit(r), w = ra(.2, 2), h = 1e-5, Rp = L.rod(k, w * h), Rm = L.rod(k, -w * h), dR = L.scl(L.add(Rp, Rm, -1), 1 / (2 * h)); o.skew = Math.max(o.skew, maxd(dR, L.scl(L.hat(k), w)), maxd(L.add(dR, L.tr(dR)), [[0, 0, 0], [0, 0, 0], [0, 0, 0]]));
      const R = X.q2R(rq()), dt = 1e-6, R1 = L.mm(R, L.rod(k, w * dt)), fd = L.scl(L.add(R1, R, -1), 1 / dt); o.kin = Math.max(o.kin, maxd(fd, L.mm(R, L.scl(L.hat(k), w))));
      const d = .01, qs = [1, ...k.map(x => x * d / 2)], n = Math.hypot(...qs); o.smallq = Math.max(o.smallq, vd(qs.map(x => x / n), X.qa(k, d))); }
    // ---- step 7
    const q0 = X.e2q(40 * D, 30 * D, 20 * D), R0 = X.q2R(q0), a0 = X.q2aa(q0); o.q0 = q0; o.R0 = R0.flat(); o.a0 = [a0.th / D, ...a0.k]; o.e0 = X.R2e(R0).map(v => v / D);
    o.r11 = 1 - 2 * (.297 * .297 + .283 * .283);
    o.q2R = 0; o.R2q = 0; o.shep = 0; o.e2q = 0; o.q2e = 0; o.q2aa = 0;
    for (let i = 0; i < 300; i++) { const q = rq(), [w, x, y, z] = q, R = X.q2R(q);
      const F = [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
      const Rr = L.rod(...(() => { const s = Math.hypot(x, y, z); return [[x / s, y / s, z / s], 2 * Math.atan2(s, w)]; })()); o.q2R = Math.max(o.q2R, maxd(F, Rr), maxd(F, R));
      const tr = R[0][0] + R[1][1] + R[2][2];
      if (tr > .2) { const w2 = Math.sqrt(1 + tr) / 2, g = [w2, (R[2][1] - R[1][2]) / (4 * w2), (R[0][2] - R[2][0]) / (4 * w2), (R[1][0] - R[0][1]) / (4 * w2)], sg = w >= 0 ? 1 : -1; o.R2q = Math.max(o.R2q, vd(g, q.map(v => v * sg))); }
      if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) { const x2 = Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]) / 2, g = [(R[2][1] - R[1][2]) / (4 * x2), x2, (R[0][1] + R[1][0]) / (4 * x2), (R[0][2] + R[2][0]) / (4 * x2)], sg = x >= 0 ? 1 : -1; o.shep = Math.max(o.shep, vd(g, q.map(v => v * sg))); }
      const ps = ra(-3.1, 3.1), th = ra(-1.5, 1.5), ph = ra(-3.1, 3.1), c = a => Math.cos(a / 2), s = a => Math.sin(a / 2);
      const E = [c(ph) * c(th) * c(ps) + s(ph) * s(th) * s(ps), s(ph) * c(th) * c(ps) - c(ph) * s(th) * s(ps), c(ph) * s(th) * c(ps) + s(ph) * c(th) * s(ps), c(ph) * c(th) * s(ps) - s(ph) * s(th) * c(ps)];
      const qz = [c(ps), 0, 0, s(ps)], qy = [c(th), 0, s(th), 0], qx = [c(ph), s(ph), 0, 0]; o.e2q = Math.max(o.e2q, vd(E, X.e2q(ps, th, ph)), vd(E, X.qm(X.qm(qz, qy), qx)), maxd(X.q2R(E), R3(ps, th, ph)));
      const [w3, x3, y3, z3] = E, ph2 = Math.atan2(2 * (w3 * x3 + y3 * z3), 1 - 2 * (x3 * x3 + y3 * y3)), th2 = Math.asin(2 * (w3 * y3 - x3 * z3)), ps2 = Math.atan2(2 * (w3 * z3 + x3 * y3), 1 - 2 * (y3 * y3 + z3 * z3)); o.q2e = Math.max(o.q2e, Math.abs(th2 - th), Math.abs(X.wrap(ph2 - ph)), Math.abs(X.wrap(ps2 - ps)));
      const qp = w >= 0 ? q : q.map(v => -v), u = qp.slice(1), nu = Math.hypot(...u), thq = 2 * Math.atan2(nu, qp[0]), aa = X.q2aa(q); o.q2aa = Math.max(o.q2aa, Math.abs(thq - aa.th), vd(u.map(v => v / nu), aa.k), maxd(L.rod(u.map(v => v / nu), thq), R)); }
    o.R2qEx = (() => { const R = Rz90, tr = 1, w = Math.sqrt(1 + tr) / 2; return [w, (R[2][1] - R[1][2]) / (4 * w), (R[0][2] - R[2][0]) / (4 * w), (R[1][0] - R[0][1]) / (4 * w)]; })();
    o.shepEx = (() => { const R = X.q2R(X.qa([1, 0, 0], 180 * D)), tr = R[0][0] + R[1][1] + R[2][2], x = Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]) / 2; return { diag: [R[0][0], R[1][1], R[2][2]], tr, w0: Math.sqrt(Math.max(0, 1 + tr)) / 2, q: [(R[2][1] - R[1][2]) / (4 * x), x, (R[0][1] + R[1][0]) / (4 * x), (R[0][2] + R[2][0]) / (4 * x)] }; })();
    o.e2qEx = X.e2q(90 * D, 0, 0); o.q2aaEx = [Math.atan2(Math.SQRT1_2, Math.SQRT1_2) / D, 2 * Math.atan2(Math.SQRT1_2, Math.SQRT1_2) / D];
    // ---- step 8
    { const O = 45 * D, wgt = Math.sin(22.5 * D) / Math.sin(O), q1 = X.qa([0, 0, 1], 90 * D); o.slerp = { cosO: X.qa([0, 0, 1], 90 * D)[0], wgt, res: [1, 0, 0, 0].map((v, i) => wgt * (v + q1[i])), want: X.qa([0, 0, 1], 45 * D) }; }
    o.geo = 0; o.uniform = 0;
    for (let i = 0; i < 100; i++) { let a = rq(), b = rq(); let d = a.reduce((s, v, k) => s + v * b[k], 0); if (d < 0) { b = b.map(v => -v); d = -d; } const O = Math.acos(Math.min(1, d)); if (O < .05) continue;
      const Ra = X.q2R(a), Rb = X.q2R(b), Rel = L.mm(L.tr(Ra), Rb), tr = Rel[0][0] + Rel[1][1] + Rel[2][2], th = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))), k = [Rel[2][1] - Rel[1][2], Rel[0][2] - Rel[2][0], Rel[1][0] - Rel[0][1]].map(x => x / (2 * Math.sin(th)));
      if (th > 3.0) continue;
      for (const t of [.2, .5, .9]) { const s = [0, 1, 2, 3].map(j => (Math.sin((1 - t) * O) * a[j] + Math.sin(t * O) * b[j]) / Math.sin(O)); o.geo = Math.max(o.geo, maxd(X.q2R(s), L.mm(Ra, L.rod(k, t * th)))); o.uniform = Math.max(o.uniform, Math.abs(2 * O - th)); } }
    { const O = 120 * D, ang = t => Math.atan2(t * Math.sin(O), (1 - t) + t * Math.cos(O)) / D; o.nlerp = [ang(.25), ang(.5) - ang(.25), ang(.75) - ang(.5), 120 - ang(.75)]; }
    // ---- summary
    o.err = 0; for (let i = 0; i < 200; i++) { const a = rq(), b = rq(), Rel = L.mm(L.tr(X.q2R(a)), X.q2R(b)), tr = Rel[0][0] + Rel[1][1] + Rel[2][2], th = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))); o.err = Math.max(o.err, Math.abs(th - 2 * Math.acos(Math.min(1, Math.abs(a.reduce((s, v, k) => s + v * b[k], 0)))))); }
    // ---- figures
    o.fig = { s70: Math.sin(70 * D), c70: 1 - Math.cos(70 * D), turnAbout: [30, 120, 179, 181, 250, 359].map(a => { const q = X.q2aa(X.qa([0, 0, 1], a * D)); return [Math.round(q.th / D * 10) / 10, q.k[2]]; }) };
    return o; });
  const E9 = 1e-9, vnear = (a, b, tol) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= (tol || E9));

  // ---- header
  { const rnd = WIDS.filter(id => SRC[id].includes('Math.random')), seeded = WIDS.filter(id => SRC[id].includes('0x6D2B79F5')).sort().join(' ');
    tx('header: no interactive uses the browser\'s own random numbers; the two that use chance (wm, wd) draw from a seeded generator, and "随机" gives 240° / 120° / 240° and then 118° / 104° / 256° after loading', 'hdr', ['有两处用到随机：第 2 步的"加一点误差"和第 8 步的"随机"', '它们用的是固定的随机数序列'],
      rnd.length === 0 && seeded === 'wd wm' && KEEP.rand === '欧拉角线性 | 总转角 240° | 变速 | SLERP | 总转角 120° | 匀速 | SLERP 用 -q₁ | 总转角 240° | 匀速 ## 欧拉角线性 | 总转角 118° | 变速 | SLERP | 总转角 104° | 匀速 | SLERP 用 -q₁ | 总转角 256° | 匀速', rnd.join(' ') + ' / ' + seeded + ' / ' + KEEP.rand); }

  // ---- step 0: the nine folded cards
  tx('basics: (1, 2, 3) + (0, 1, 0) = (1, 3, 3); 2 · (1, 2, 3) = (2, 4, 6)', 's-basics', ['(1, 2, 3) + (0, 1, 0) = (1, 3, 3)', '2 · (1, 2, 3) = (2, 4, 6)'], vnear([1 + 0, 2 + 1, 3 + 0], [1, 3, 3]) && vnear([2, 4, 6], [1, 2, 3].map(v => 2 * v)), '');
  tx('basics: ‖(3, 4, 0)‖ = 5 and the unit vector (0.6, 0.8, 0)', 's-basics', ['‖v‖ = √(9 + 16 + 0) = 5', '(0.6, 0.8, 0)'], G.len === 5 && vnear(G.unit, [.6, .8, 0]), G.len);
  tx('basics: x̂ · ŷ = 0; (1, 1, 0) · (1, 0, 0) = 1, cos α = 1/√2, α = 45°', 's-basics', ['x̂ · ŷ = 1·0 + 0·1 + 0·0 = 0', '(1, 1, 0) · (1, 0, 0) = 1', 'cos α = 1/√2，α = 45°'], G.dots[0] === 0 && G.dots[1] === 1 && near(G.dots[2], 45, E9), G.dots);
  tx('basics: x̂ × ŷ = ẑ and ŷ × x̂ = −ẑ; a × b is at right angles to a and to b (300 random pairs)', 's-basics', ['x̂ × ŷ = (0·0 - 0·1, 0·0 - 1·0, 1·1 - 0·0) = (0, 0, 1) = ẑ', 'ŷ × x̂ = -ẑ', '六项两两抵消，正好是 0'], vnear(G.cxy, [0, 0, 1]) && vnear(G.cyx, [0, 0, -1]) && G.crossPerp < 1e-12, G.crossPerp);
  tx('basics: the matrix for 90° about z sends (1, 0, 0) to (0, 1, 0); R · v is the three columns mixed by v (300 random cases)', 's-basics', ['绕 z 轴转 90° 的矩阵是 0 -1 0 1 0 0 0 0 1 。v = (1, 0, 0) 时，R · v 就是第 1 列 (0, 1, 0)', 'R · v = vx c₁ + vy c₂ + vz c₃'], vnear(G.Rz90, [0, -1, 0, 1, 0, 0, 0, 0, 1], 1e-12) && vnear(G.Rz90x, [0, 1, 0], 1e-12) && G.mvCols < 1e-12, G.mvCols);
  tx('basics: (A · B) · v = A · (B · v) (300 random cases)', 's-basics', ['(A · B) · v = A · (B · v)'], G.assoc < 1e-12, G.assoc);
  tx('basics: for the 90°-about-z matrix the transpose is (0 1 0; −1 0 0; 0 0 1), the trace 1 and the determinant +1; det R = c₁ · (c₂ × c₃) agrees with the cofactor formula (300 random matrices)', 's-basics', ['它的转置是 0 1 0 -1 0 0 0 0 1 ，迹 = 0 + 0 + 1 = 1，行列式 = +1', 'det R = c₁ · (c₂ × c₃)'], vnear(G.Rz90T, [0, 1, 0, -1, 0, 0, 0, 0, 1], 1e-12) && near(G.trRz90, 1, 1e-12) && near(G.detRz90, 1, 1e-12) && G.detTriple < 1e-12, G.detTriple);
  tx('basics: 180° ÷ π ≈ 57.3°; atan2(1, 1) = 45°, atan2(−1, −1) = −135°, atan2(1, 0) = 90°', 's-basics', ['1 rad = 180° ÷ π ≈ 57.3°', 'atan2(1, 1) = 45°，atan2(-1, -1) = -135°，atan2(1, 0) = 90°'], G.rad.toFixed(1) === '57.3' && vnear(G.atan, [45, -135, 90]), G.rad);

  // ---- step 1
  tx('core idea: Ry(90°)·Rx(90°) sends the nose to (0, 0, −1), Rx(90°)·Ry(90°) sends it to (0, 1, 0) (also what the figure shows)', 's-core', ['先绕 x 转 90°，机头就在 x 轴上，不动；再绕 y 转 90°，机头变成 (0, 0, -1)，朝下', '先绕 y 转 90°，机头变成 (0, 0, -1)；再绕 x 转 90°，机头变成 (0, 1, 0)，指向 y 轴', '第二次把它压向正下方', '第二次再把它甩到 y 轴的方向'], vnear(G.noseA, [0, 0, -1], 1e-12) && vnear(G.noseB, [0, 1, 0], 1e-12), G.noseA.concat(G.noseB));
  tx('core idea: 3 − 0 = 4 − 1 = 9 − 6 = 3', 's-core', ['3 - 0 = 3', '4 - 1 = 3', '9 - 6 = 3', '四元数是 4 个数减 1 个约束，旋转矩阵是 9 个数减 6 个约束，自由度都是 3'], 3 - 0 === 3 && 4 - 1 === 3 && 9 - 6 === 3, '');

  // ---- step 2
  tx('matrix: the columns of the 90°-about-z matrix are (0, 1, 0), (−1, 0, 0), (0, 0, 1); for 200 random rotations RᵀR = I and det = +1', 's-mat', ['三列是 (0, 1, 0)、(-1, 0, 0)、(0, 0, 1)：长度都是 1，两两点积都是 0，行列式是 +1', '一共 6 个约束，9 - 6 = 3 个自由度'], vnear(G.colsRz90.flat(), [0, 1, 0, -1, 0, 0, 0, 0, 1], 1e-12) && G.orth < 1e-12 && G.detR < 1e-12, G.orth);
  tx('matrix: the transpose of Rz(90°) is Rz(−90°)', 's-mat', ['Rz(90°) 的转置是 0 1 0 -1 0 0 0 0 1 ，正好就是 Rz(-90°)'], G.inv < 1e-12, G.inv);
  tx('matrix: with R = I and t = (1, 0, 0) the point (0, 2, 0) goes to (1, 2, 0)', 's-mat', ['R = I，t = (1, 0, 0)：点 (0, 2, 0) 被搬到 (1, 2, 0)'], vnear(G.T, [1, 2, 0, 1]) && G.chain < 1e-12, G.T);
  tx('matrix: ½ (I + Rz(180°)) has a single non-zero entry, the 1 in the bottom right corner', 's-mat', ['½ · ( I + Rz(180°) ) = 0 0 0 0 0 0 0 0 1', '得到的矩阵前两列全是 0'], vnear(G.avg, [0, 0, 0, 0, 0, 0, 0, 0, 1], 1e-12), G.avg);

  // ---- step 3
  tx('Euler: Rz(90°)(1, 0, 0) = (0, 1, 0), Ry(90°)(0, 0, 1) = (1, 0, 0)', 's-euler', ['Rz(90°) · (1, 0, 0) = (0, 1, 0)：x 转到 y。Ry(90°) · (0, 0, 1) = (1, 0, 0)：z 转到 x'], vnear(G.RzEx, [0, 1, 0], 1e-12) && vnear(G.RyEx, [1, 0, 0], 1e-12), '');
  tx('Euler: the nine entries of the big matrix, as written in the card, equal Rz·Ry·Rx (300 random triples)', 's-euler', ['cψ cθ', 'cψ sθ sφ - sψ cφ', 'cψ sθ cφ + sψ sφ', 'sψ cθ', 'sψ sθ sφ + cψ cφ', 'sψ sθ cφ - cψ sφ', '-sθ', 'cθ sφ', 'cθ cφ'], G.big < 1e-12, G.big);
  tx('Euler: θ = −asin(r31), φ = atan2(r32, r33), ψ = atan2(r21, r11) give back the three angles (300 random triples with |θ| < 86°); for Rz(90°) they give 0, 0, 90°', 's-euler', ['θ = -asin(r31)', 'φ = atan2(r32, r33)', 'ψ = atan2(r21, r11)', 'ψ = atan2(1, 0) = 90°'], G.inv3 < 1e-9 && vnear(G.inv3ex, [0, 0, 90], 1e-9), G.inv3);
  tx('Euler, gimbal lock: (0°, 90°, 30°) and (20°, 90°, 50°) give the same matrix; the card\'s matrix in sin and cos of φ − ψ equals Rz·Ry(90°)·Rx (300 random pairs); at θ = −90° only φ + ψ matters', 's-euler', ['(ψ, θ, φ) = (0°, 90°, 30°) 和 (20°, 90°, 50°)：差值都是 30°', 'sin(φ - ψ)', 'cos(φ - ψ)', 'θ = -90° 时变成只看和 φ + ψ', 'r12 = cos ψ sin φ - sin ψ cos φ = sin(φ - ψ)'], G.lock < 1e-12 && G.lockF < 1e-12 && G.lockMinus[0] < 1e-12 && G.lockMinus[1] > .1, [G.lock, G.lockF, G.lockMinus]);
  tx('Euler, rates: cos 89° ≈ 0.01745 and 10 / 0.01745 ≈ 573', 's-euler', ['ψ̇ = 10 / cos 89° ≈ 10 / 0.01745 ≈ 573°/s'], G.cos89.toFixed(5) === '0.01745' && Math.round(10 / .01745) === 573 && Math.round(G.rate) === 573, [G.cos89, G.rate]);
  tx('Euler, rates: the formula ψ̇ = (ωy sin φ + ωz cos φ) / cos θ against a finite difference of the page\'s own matrices', 's-euler', ['ψ̇ = (ωy sin φ + ωz cos φ) / cos θ', '只能提供自己转速的 cos θ 倍'], G.rateFD < 1e-4, G.rateFD);
  tx('Euler, conventions: (0°, 30°, 0°) and (180°, 150°, 180°) are the same orientation; 6 + 6 orders, each intrinsic or extrinsic, make 24', 's-euler', ['例如 (0°, 30°, 0°) = (180°, 150°, 180°)', '名义上 24 种'], G.equiv < 1e-12 && (6 + 6) * 2 === 24, G.equiv);
  tx('Euler, figure: with y to the left and z up, a positive pitch points the nose down (ψ = 60°, θ = 35°: z component −0.57; in the interactive at 0° / 30° / 0° it is −0.50)', 's-euler', ['图里 ψ = 60°、θ = 35°、φ = 40°', 'θ 为正是机头往下压'], G.noseF5[2] < 0 && near(G.noseF5[2], -Math.sin(35 * Math.PI / 180), 1e-12) && near(G.nose30[2], -.5, 1e-12), G.noseF5);

  // ---- step 4
  tx('axis-angle: π/2 ≈ 1.571 and −30° = −0.524 rad', 's-aa', ['θ = π/2 ≈ 1.571，所以 r = (0, 0, 1.571)', 'r = (-0.524, 0, 0)'], G.half.toFixed(3) === '1.571' && G.m30.toFixed(3) === '-0.524', [G.half, G.m30]);
  tx('axis-angle: for k = ẑ, K (1, 0, 0) = (0, 1, 0) = ẑ × x̂; K v = k × v for 300 random k and v', 's-aa', ['K · (1, 0, 0) = (0, 1, 0)，正是 ẑ × x̂', 'K · v = k × v'], vnear(G.Kx, [0, 1, 0]) && vnear(G.zx, [0, 1, 0]) && G.hatCross < 1e-12, G.hatCross);
  tx('axis-angle: Rodrigues\' example (1, 0, 0) + (0, 1, 0) + (−1, 0, 0) = (0, 1, 0); the formula of the card equals the page\'s rotation by quaternion (300 random axes and angles)', 's-aa', ['(1, 0, 0) + (0, 1, 0) + (-1, 0, 0) = (0, 1, 0)', 'R = I + sin θ · K + (1 - cos θ) · K²', 'v′ = v + sin θ (k × v) + (1 - cos θ) k × (k × v)'], vnear(G.rodEx[0], [0, 1, 0]) && vnear(G.rodEx[1], [-1, 0, 0]) && vnear(G.rodEx[2], [0, 1, 0]) && G.rod < 1e-12, G.rod);
  tx('axis-angle: K³ = −K, and 40 terms of the series I + [r]× + [r]×²/2! + … equal Rodrigues\' formula (300 random rotation vectors)', 's-aa', ['因为 K³ = -K', 'I + [r]× + [r]×²/2! + [r]×³/3! + ⋯'], G.K3 < 1e-12 && G.series < 1e-9, [G.K3, G.series]);
  tx('axis-angle: θ = acos((tr R − 1)/2) and k from the differences across the diagonal recover axis and angle (300 random cases); for Rz(90°): tr R = 1, θ = 90°, (0, 0, 2) / 2 = (0, 0, 1)', 's-aa', ['tr R = 0 + 0 + 1 = 1，cos θ = 0，θ = 90°', '(0, 0, 1 - (-1)) = (0, 0, 2)，除以 2 sin 90° = 2，得 k = (0, 0, 1)', 'tr R = 1 + 2 cos θ'], G.log < 1e-6 && vnear(G.logEx, [1, 90, 0, 0, 2], 1e-9), [G.log, G.logEx]);
  tx('axis-angle: for a small angle, half the differences across the diagonal have length ≈ θ (0.01 rad: error below 10⁻⁶)', 's-aa', ['r ≈ (r32 - r23, r13 - r31, r21 - r12) / 2（小角度时 sin θ ≈ θ）'], G.small < 1e-6, G.small);
  tx('axis-angle: Rx(90°)·Ry(90°) is a turn of 120° about (1, 1, 1)/√3, while a + b has length 127° along (1, 1, 0)/√2', 's-aa', ['结果是绕 (1, 1, 1)/√3 转 120°', '是绕 (1, 1, 0)/√2 转 127°'], near(G.ab.th, 120, 1e-9) && vnear(G.ab.k, [1, 1, 1].map(v => v / Math.sqrt(3)), 1e-9) && Math.round(G.ab.sum) === 127, G.ab);

  // ---- step 5
  tx('quaternion: 90° about z is (0.707, 0, 0, 0.707); 180° about x is (0, 1, 0, 0); unit length for 300 random ones', 's-quat', ['q = (0.707, 0, 0, 0.707)，长度² = 0.5 + 0.5 = 1', '绕 x 转 180°：q = (0, 1, 0, 0)'], G.q90.map(f3).join(' ') === '0.707 0.000 0.000 0.707' && vnear(G.qx180, [0, 1, 0, 0], 1e-12) && G.unitq < 1e-12 && near(.5 + .5, 1, 0), G.q90);
  tx('quaternion: q ⊗ (0, v) = (0, 0.707, 0.707, 0), then ⊗ q* gives (0, 0, 1, 0); the sandwich equals the rotation matrix for 300 random q and v', 's-quat', ['q ⊗ (0, v) = (0, 0.707, 0.707, 0)，再乘 q* 得到 (0, 0, 1, 0)', 'v′ = q ⊗ (0, v) ⊗ q*'], G.s1.map(f3).join(' ') === '0.000 0.707 0.707 0.000' && vnear(G.s2, [0, 0, 1, 0], 1e-12) && G.sand < 1e-12, [G.s1, G.s2, G.sand]);
  tx('quaternion: for a vector along the axis, q ⊗ (0, k) = (−sin(θ/2), k cos(θ/2)) and the right-hand factor brings it back to (0, k); a vector at right angles is turned through θ/2 by the left factor (300 random cases)', 's-quat', ['得到 (-sin(θ/2), k · cos(θ/2))', '结果回到 (0, k)', '被左右两次各转了半角'], G.axis1 < 1e-12 && G.axis2 < 1e-12 && G.halfTurn < 1e-12, [G.axis1, G.axis2, G.halfTurn]);
  tx('quaternion: the product formula of the card equals the page\'s product (300 random pairs); q ⊗ q for 90° about z is (0, 0, 0, 1)', 's-quat', ['q₁ ⊗ q₂ = ( w₁w₂ - u₁ · u₂, w₁u₂ + w₂u₁ + u₁ × u₂ )', '结果 (0, 0, 0, 1) 正是"绕 z 转 180°"', '0.707² - 0.707² = 0'], G.prod < 1e-12 && vnear(G.qq, [0, 0, 0, 1], 1e-12), G.prod);
  tx('quaternion: 9 × 3 = 27 multiplications against 4 × 4 = 16', 's-quat', ['每个要 3 次乘法，共 27 次', '4 × 4 = 16 次'], 9 * 3 === 27 && 4 * 4 === 16, '');
  tx('quaternion: q and −q give the same rotation matrix (300 random q); both turn x to y in the example', 's-quat', ['-q = (-0.707, 0, 0, -0.707)，两个都把 x 转到 y', '(-q) ⊗ (0, v) ⊗ (-q)* = q ⊗ (0, v) ⊗ q*'], G.neg < 1e-12 && vnear(G.negEx[0], [0, 1, 0], 1e-12) && vnear(G.negEx[1], [0, 1, 0], 1e-12), G.neg);

  // ---- step 6
  tx('Lie: each naive step multiplies the length by √(1 + (ωΔt)²): 1.09¹⁰ = 2.367, 1.0225²⁰ = 1.561, √1.09 = 1.044', 's-lie', ['长度都乘以 √(1 + (ωΔt)²)', '2.367', '1.561', '1.044'], f3(G.pow[0]) === '2.367' && f3(G.pow[1]) === '1.561' && f3(G.pow[2]) === '1.044' && f3(G.pow[4]) === '1.001', G.pow);
  tx('Lie: the velocity of a rotation path at its start is the skew-symmetric matrix [ω]× (central differences, 100 random axes and rates)', 's-lie', ['Ṙ(0)ᵀ + Ṙ(0) = 0', 'so(3) = { [ω]× : ω ∈ ℝ³ } ≅ ℝ³'], G.skew < 1e-6, G.skew);
  tx('Lie: Ṙ = R [ω]× against a finite difference of R ← R · exp([ω Δt]×) (100 random cases); (1, δ/2) normalized is the small rotation to within 10⁻⁶ at |δ| = 0.01', 's-lie', ['Ṙ = R · [ωb]×', 'R ← R · exp( [ωb Δt]× )', 'q ← q ⊗ (1, δ/2)'], G.kin < 1e-5 && G.smallq < 1e-6, [G.kin, G.smallq]);
  tx('Lie, figure: a straight step of 0.8 rad ends √(1 + 0.64) = 1.28 from the middle (the interactive shows 1.281 after one step of 0.80)', 's-lie', ['这里是 0.8 rad', '走完离圆心 1.28（圈的半径是 1）'], G.pow[3].toFixed(2) === '1.28' && KEEP.w5h8 === '步数 1 | 长度 1.281 | 已经不是旋转', KEEP.w5h8);

  // ---- step 7
  { const t = KEEP.wb0, row = (s, i) => s.split(' | ')[i].replace(/ +/g, ', ');
    tx('conversions: the table repeats the four cards of the step 5 interactive at its start', 's-conv', ['40.0°, 30.0°, 20.0°', '0.909, 0.070, 0.297, 0.283', 'θ = 49.2°, k = (0.17, 0.71, 0.68)', '0.66, -0.47, 0.58 0.56, 0.83, 0.04 -0.50, 0.30, 0.81'],
      t.e === 'yaw 40.0° | pitch 30.0° | roll 20.0°' && t.q === 'w 0.909 | x 0.070 | y 0.297 | z 0.283' && t.a.startsWith('θ 49.2° | k(0.17,0.71,0.68)') && t.m === '0.66 -0.47 0.58 | 0.56 0.83 0.04 | -0.50 0.30 0.81' &&
      G.q0.map(f3).join(' ') === '0.909 0.070 0.297 0.283' && G.R0.map(f2).join(' ') === '0.66 -0.47 0.58 0.56 0.83 0.04 -0.50 0.30 0.81' && G.a0[0].toFixed(1) === '49.2' && G.a0.slice(1).map(f2).join(' ') === '0.17 0.71 0.68' && vnear(G.e0, [40, 30, 20], 1e-9), JSON.stringify(t)); }
  tx('conversions: 1 − 2 × (0.297² + 0.283²) ≈ 0.66', 's-conv', ['1 - 2 × (0.297² + 0.283²) ≈ 0.66'], f2(G.r11) === '0.66', G.r11);
  tx('conversions, quaternion → matrix: the nine entries of the card equal Rodrigues\' formula for the axis and angle of q and the page\'s routine (300 random q); the example gives Rz(90°)', 's-conv', ['1 - 2(y² + z²)', '2(xy - wz)', '2(xz + wy)', '2(xy + wz)', '1 - 2(x² + z²)', '2(yz - wx)', '2(xz - wy)', '2(yz + wx)', '1 - 2(x² + y²)', 'r11 = 1 - 2(0 + 0.5) = 0，r12 = 2(0 - 0.5) = -1，r21 = 2(0 + 0.5) = 1，r33 = 1 - 0 = 1'], G.q2R < 1e-12, G.q2R);
  tx('conversions, matrix → quaternion: the four formulas recover q up to sign (random rotations with tr R > 0.2); for Rz(90°): w = z = 0.707', 's-conv', ['w = √(1 + tr R) / 2', 'x = (r32 - r23) / (4w)', 'y = (r13 - r31) / (4w)', 'z = (r21 - r12) / (4w)', 'w = √2 / 2 = 0.707；z = (1 - (-1)) / (4 × 0.707) = 0.707'], G.R2q < 1e-9 && G.R2qEx.map(f3).join(' ') === '0.707 0.000 0.000 0.707', [G.R2q, G.R2qEx]);
  tx('conversions, Shepperd: when r11 is the largest diagonal entry the second set of formulas recovers q (random cases); for 180° about x the diagonal is 1, −1, −1, tr R = −1, w = 0, and it gives (0, 1, 0, 0)', 's-conv', ['x = √(1 + r11 - r22 - r33) / 2，再用 w = (r32 - r23) / (4x)，y = (r12 + r21) / (4x)，z = (r13 + r31) / (4x)', 'R 的对角线是 1、-1、-1，其余为 0，tr R = -1，w = 0', 'x = √(1 + 1 + 1 + 1) / 2 = 1，得 q = (0, 1, 0, 0)'], G.shep < 1e-9 && vnear(G.shepEx.diag, [1, -1, -1], 1e-12) && near(G.shepEx.tr, -1, 1e-12) && G.shepEx.w0 < 1e-7 && vnear(G.shepEx.q, [0, 1, 0, 0], 1e-9), [G.shep, G.shepEx]);
  tx('conversions, Euler → quaternion: the four closed-form components equal qz ⊗ qy ⊗ qx, the page\'s routine and the rotation matrix Rz·Ry·Rx (300 random triples); (90°, 0, 0) gives w = z = 0.707', 's-conv', ['w = cφ cθ cψ + sφ sθ sψ', 'x = sφ cθ cψ - cφ sθ sψ', 'y = cφ sθ cψ + sφ cθ sψ', 'z = cφ cθ sψ - sφ sθ cψ', 'qz(ψ) = ( cos(ψ/2), 0, 0, sin(ψ/2) )', '所以 w = 0.707、z = 0.707、x = y = 0'], G.e2q < 1e-12 && G.e2qEx.map(f3).join(' ') === '0.707 0.000 0.000 0.707', G.e2q);
  tx('conversions, quaternion → Euler: the three formulas give back the angles (300 random triples with |θ| < 86°)', 's-conv', ['φ = atan2( 2(wx + yz), 1 - 2(x² + y²) )', 'θ = asin( 2(wy - xz) )', 'ψ = atan2( 2(wz + xy), 1 - 2(y² + z²) )', 'ψ = atan2(2 × 0.5, 1 - 2 × 0.5) = atan2(1, 0) = 90°'], G.q2e < 1e-9, G.q2e);
  tx('conversions, quaternion → axis-angle: θ = 2 atan2(‖u‖, w) and k = u/‖u‖ agree with the page\'s routine and reproduce the rotation (300 random q); atan2(0.707, 0.707) = 45°, θ = 90°', 's-conv', ['θ = 2 · atan2( ‖u‖, w )', 'k = u / ‖u‖', 'atan2(0.707, 0.707) = 45°，θ = 90°，k = (0, 0, 1)'], G.q2aa < 1e-9 && vnear(G.q2aaEx, [45, 90], 1e-9), G.q2aa);

  // ---- step 8
  tx('interpolation, SLERP example: cos Ω = 0.707, the two weights are sin 22.5° / sin 45° = 0.5412, and 0.5412 × (1.7071, 0, 0, 0.7071) = (0.924, 0, 0, 0.383) is 45° about z', 's-interp', ['cos Ω = 0.707，Ω = 45°', 'sin 22.5° / sin 45° = 0.5412', '0.5412 × (1.7071, 0, 0, 0.7071) = (0.924, 0, 0, 0.383)'], f3(G.slerp.cosO) === '0.707' && G.slerp.wgt.toFixed(4) === '0.5412' && [.5412 * 1.7071, 0, 0, .5412 * .7071].map(f3).join(' ') === '0.924 0.000 0.000 0.383' && G.slerp.res.map(f3).join(' ') === '0.924 0.000 0.000 0.383' && vnear(G.slerp.res, G.slerp.want, 1e-12), G.slerp);
  tx('interpolation: R0 · exp(t · log(R0ᵀR1)) and SLERP give the same orientation at t = 0.2, 0.5, 0.9 (random pairs), and the angle between two orientations is twice the angle Ω between their quaternions', 's-interp', ['R(t) = R₀ · exp( t · log( R₀ᵀ R₁ ) )', '和 SLERP 是同一条', 'Ω q₀ 和 q₁ 在 4 维球面上的夹角，等于两个姿态之间转角的一半'], G.geo < 1e-9 && G.uniform < 1e-9, [G.geo, G.uniform]);
  tx('interpolation, figure: chord points at t = ¼, ½, ¾ pushed out to the circle are 19.1°, 40.9°, 40.9°, 19.1° apart for Ω = 120° (crowded at the ends); the arcs of example 1 are 46.9° and 133.1°, twice that is 94° and 266°', 's-interp', ['两头挤、中间稀', '到 q1 的弧是 46.9°，到 -q1 的弧是 133.1°', '所以一个是 94°，一个是 266°', '两头慢中间快'],
    G.nlerp.map(v => v.toFixed(1)).join(' ') === '19.1 40.9 40.9 19.1' && KEEP.wdA.omega.toFixed(1) === '46.9' && (180 - KEEP.wdA.omega).toFixed(1) === '133.1' && Math.round(2 * KEEP.wdA.omega) === 94 && Math.round(360 - 2 * KEEP.wdA.omega) === 266, [G.nlerp, KEEP.wdA]);

  // ---- figures of steps 4 and 5, and the summary
  tx('figure of Rodrigues\' formula: sin 70° ≈ 0.94 and 1 − cos 70° ≈ 0.66', 's-aa', ['sin 70° ≈ 0.94，1 - cos 70° ≈ 0.66'], f2(G.fig.s70) === '0.94' && f2(G.fig.c70) === '0.66', G.fig);
  tx('figure of the ball: turning on about one axis, the angle reported by the page rises to 180° and then falls while the axis flips (179° about k, then 179° about −k at 181°, 110° at 250°, 1° at 359°)', 's-quat', ['转角涨到 180°', '转满 360° 等于没转', '半径 180° 的球'], JSON.stringify(G.fig.turnAbout) === '[[30,1],[120,1],[179,1],[179,-1],[110,-1],[1,-1]]', G.fig.turnAbout);
  tx('summary: the angle of R_estᵀ R_gt equals 2 acos(|q₁ · q₂|) (200 random pairs); atan2(‖(R − Rᵀ)∨‖/2, (tr R − 1)/2) gives θ and half that length is sin θ (300 random cases)', 's-sum', ['等价于 2 · acos(|q₁ · q₂|)', 'atan2(‖(R - Rᵀ)∨‖ / 2, (tr R - 1) / 2)', '它的长度的一半正好是 sin θ'], G.err < 1e-6 && G.atan2th < 1e-9, [G.err, G.atan2th]);

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
