// Check the numbers of "Generative Models" (generative/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt literally: pressing buttons, moving sliders, tapping and dragging on the pictures, and
// letting the fits, the samplers and the live GAN run) and compares the readouts with the numbers quoted in the
// "你会看到 / What you will see" lines. Numbers a readout does not show (what is drawn only on a canvas, values at an
// exact number of training steps, what the figures state) are recomputed inside the page with the page's own engine,
// window.GEN, with the same loops and the same random seeds as the interactives; the comments say "same loop as the
// interactive" where that is done.
// Part B recomputes the numbers quoted in the formula cards, the paragraphs and the figures.
//   usage: node check.js /absolute/path/to/generative/index.html      (takes several minutes)
// The random numbers are seeded, so every number is the same on every run in a Chromium browser.
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/generative/index.html'); process.exit(2); }
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
  // run a snippet inside the page, where the engine GEN lives; the snippet is the body of a function
  const EV = (fn, arg) => p.evaluate(fn, arg);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-')) : NaN; };
  // the visible text of a section, folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);

  // ------------------------------------------------------------------------------------------------------------
  // Part A: the interactives, operated along the "先玩" prompts; the quoted strings must be in the "你会看到" lines
  // ------------------------------------------------------------------------------------------------------------
  const KEEP = {};
  const SEE = await p.evaluate(() => { const o = {}; document.querySelectorAll('p.see').forEach(e => { const id = e.closest('section').id; (o[id] = o[id] || []).push(e.innerText); }); return o; });
  for (const k in SEE) SEE[k] = SEE[k].map(norm);
  const see = (id, i, ...strs) => strs.every(s => SEE[id] && SEE[id][i || 0] && SEE[id][i || 0].includes(s));
  // tap a picture that is drawn with GEN.view on a centred square (nf, den): data coordinates -> mouse position
  const tap = async (cvId, x, y) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const pt = await p.evaluate(([i, x, y]) => { const cv = document.getElementById(i), r = cv.getBoundingClientRect(), Wd = cv.clientWidth, H = cv.clientHeight, s = Math.min(Wd, H), V = GEN.view((Wd - s) / 2, (H - s) / 2, s, s); return [r.left + V.X(x), r.top + V.Y(y)]; }, [cvId, x, y]);
    await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0] + .01, pt[1]); await p.mouse.up(); await p.waitForTimeout(250); };
  const pct = (m, label) => num(m, new RegExp(label + ' (-?[\\d.]+)%'));

  sec('step 0 · what: four ways to "generate"');
  { const w = W('what'); await w.show();
    await w.click('抽新的', 500); let m = await w.met();
    ok('draw new points: 98% on a petal, 8 / 8, nearest training point 0.07 (spacing of the training points 0.07)', see('k-gen', 0, '98% 落在花瓣上', '离最近的训练点 0.07', '（0.07）') && has(m, '落在花瓣上 98%', '8 / 8', '（中位数） 0.07', '训练点之间的距离 0.07'), m);
    await w.click('照抄训练集', 500); m = await w.met();
    ok('copy training points: 100%, 8 / 8, "new" is 0', see('k-gen', 0, '像（100%）、多样（8 / 8）', '"新"那一格是 0') && has(m, '落在花瓣上 100%', '8 / 8', '0（就是训练点）'), m);
    await w.click('乱撒', 500); m = await w.met();
    ok('scatter at random: 20% on a petal, 6 petals touched, 0.71', see('k-gen', 0, '新（0.71）', '只有 20% 落在花瓣上', '只沾到 6 片') && has(m, '落在花瓣上 20%', '6 / 8', '（中位数） 0.71'), m);
    for (let k = 0; k < 4; k++) await w.click('再生成 40 个', 300); m = await w.met();
    ok('scatter, after four more batches: all 8 petals touched, still about a fifth on a petal (15 to 25%)', see('k-gen', 0, '再生成几批，8 片都会沾到', '两成上下') && has(m, '8 / 8') && pct(m, '落在花瓣上') >= 15 && pct(m, '落在花瓣上') <= 25, m);
    await w.click('取平均', 500); m = await w.met(); const st = await w.status();
    ok('take the average: 0% on a petal, 0 petals, 0.92; all 40 in the centre', see('k-gen', 0, '全叠在花心，0% 落在花瓣上', '（0.92）') && has(m, '落在花瓣上 0%', '0 / 8', '（中位数） 0.92') && has(st, '花心'), m);
  }

  sec('step 1 · mle: one Gaussian, mixtures, a small Gaussian on every point');
  { const w = W('mle'); await w.show();
    const waitEM = async () => { for (let k = 0; k < 300; k++) { if (!/EM 正在/.test(await w.status())) break; await p.waitForTimeout(100); } await p.waitForTimeout(150); };
    const tr = m => num(m, /训练集上的平均 log p (-?[\d.]+)/), te = m => num(m, /越大越好） (-?[\d.]+)/);
    await w.click('一个高斯', 300); await w.click('从模型里抽 300 个', 400); let m = await w.met();
    ok('one Gaussian: 22% of the samples on a petal, test score -3.57', see('k-mle', 0, '只有 22% 落在花瓣上，测试分 -3.57') && has(m, '样本落在花瓣上 22%') && te(m) === -3.57, m);
    KEEP.mle = { g1: te(m) }; ok('the true distribution scores -1.94 on the test set', see('k-mle', 0, '真分布的 -1.94') && has(m, '真分布在测试集上 -1.94'), m);
    await w.click('混合高斯', 300); await waitEM(); const T = [];
    for (let k = 2; k <= 8; k++) { await w.set('mle-k', k, 100); await waitEM(); m = await w.met(); T.push(te(m)); }
    ok('mixture, K = 2…8: test scores -3.43, -3.18, -3.06, -2.85, -2.66, -2.35, -2.06', see('k-mle', 0, '-3.43、-3.18、-3.06、-2.85、-2.66、-2.35、-2.06') && T.join() === '-3.43,-3.18,-3.06,-2.85,-2.66,-2.35,-2.06', T.join());
    ok('K = 8: training -1.71, 97% on a petal, about 0.1 short of the true distribution', see('k-mle', 0, '97% 落在花瓣上', '只差 0.1 左右', '8 个时的 -1.71') && tr(m) === -1.71 && has(m, '样本落在花瓣上 97%') && near(-1.94 - te(m), 0.12, 0.011), m);
    // the starts a reader reaches with 0…8 presses of "refit": K = 8 and K = 12 at each (a refit at the same start gives the same fit)
    const R8 = [], R12 = []; await w.set('mle-k', 12, 100); await waitEM(); m = await w.met(); R12.push([tr(m), te(m)]); await w.set('mle-k', 8, 100); await waitEM();
    for (let k = 1; k <= 8; k++) { await w.click('换个起点重新拟合', 100); await waitEM(); m = await w.met(); R8.push(te(m)); await w.set('mle-k', 12, 100); await waitEM(); m = await w.met(); R12.push([tr(m), te(m)]); await w.set('mle-k', 8, 100); await waitEM(); m = await w.met(); if (te(m) !== R8[R8.length - 1]) R8.push('refit differs'); }
    ok('8 refits at K = 8: only the 2nd, 6th and 7th get back to -2.06; the other five stop between -2.31 and -2.76', see('k-mle', 0, '只有第 2、6、7 次回到 -2.06', '停在 -2.31 到 -2.76') && R8.length === 8 && [1, 5, 6].every(i => R8[i] === -2.06) && [0, 2, 3, 4, 7].every(i => R8[i] <= -2.31 && R8[i] >= -2.76) && Math.max(...[0, 2, 3, 4, 7].map(i => R8[i])) === -2.31 && Math.min(...R8) === -2.76, R8.join());
    KEEP.mle.R8 = R8.slice(); KEEP.mle.k8 = T[6];
    const t12 = R12.map(r => r[0]), e12 = R12.map(r => r[1]);
    ok('K = 12 on those nine starts: training -1.61 to -1.65 (above the -1.71 of K = 8), test -2.13 to -2.29 (below -2.06)', see('k-mle', 0, '（-1.61 到 -1.65）', '-2.13 到 -2.29') && Math.max(...t12) === -1.61 && Math.min(...t12) === -1.65 && Math.max(...e12) === -2.13 && Math.min(...e12) === -2.29, JSON.stringify(R12));
    await w.set('mle-k', 12, 100); await waitEM(); const st12 = await w.status();
    ok('the status at K = 12 says the training score keeps rising while the test score stops improving', has(st12, '训练分', '还在涨', '却不再变好'), st12);
    await w.click('每个点一个小高斯', 400); await w.set('mle-w', 0, 300); m = await w.met(); const row = await w.text('.row');
    KEEP.mle.kde = [tr(m), te(m)];
    ok('a small Gaussian on every point, h = 0.01: training +2.11, test -83.56, more than 85 apart', see('k-mle', 0, 'h 拉到最左（0.01）', '训练分 +2.11，测试分 -83.56', '差了 85 还多') && has(row, '0.01') && tr(m) === 2.11 && te(m) === -83.56 && tr(m) - te(m) > 85, m + ' || ' + row);
  }

  sec('step 2 · cdf: matching by rank in one dimension');
  { const w = W('cdf'); await w.show(); let m = await w.met();
    ok('on opening: z = -0.55, stretch 1.09', see('k-flow', 0, 'z = -0.55，拉伸倍数 1.09') && has(m, '-0.55 → -1.27', '走几步 1.09'), m);
    for (let k = 0; k < 4; k++) await w.click('抽 250 个噪声，变过去', 700);
    // the same draws as the interactive (rng 3; values beyond ±3.4 are skipped), binned as its histogram is (40 bins on [-3.4, 3.4])
    const H = await EV(() => { const K = GEN; const M1 = K.FLOWER.map(c => ({ w: c.w, m: c.m[0], s: Math.sqrt(c.S[0]) }));
      const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y };
      const Phi = z => .5 * (1 + erf(z / Math.SQRT2)), phi = z => Math.exp(-z * z / 2) / Math.sqrt(K.TAU);
      const F = x => M1.reduce((s, c) => s + c.w * Phi((x - c.m) / c.s), 0), pX = x => M1.reduce((s, c) => s + c.w * phi((x - c.m) / c.s) / c.s, 0);
      const ZL = 3.4, NZ = 681, XS = []; for (let i = 0; i < NZ; i++) { const z = -ZL + 2 * ZL * i / (NZ - 1), u = Phi(z); let a = -8, b = 8; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (F(m) < u) a = m; else b = m } XS.push((a + b) / 2) }
      const xOf = z => { const f = (z + ZL) / (2 * ZL) * (NZ - 1), i = Math.max(0, Math.min(NZ - 2, Math.floor(f))), t = f - i; return XS[i] * (1 - t) + XS[i + 1] * t };
      const slope = z => phi(z) / pX(xOf(z)); const r = K.rng(3), hx = new Array(40).fill(0); let n = 0;
      for (let i = 0; i < 1000; i++) { const z = K.gauss(r); if (Math.abs(z) > ZL) continue; const bx = Math.floor((xOf(z) + 3.4) / 6.8 * 40); if (bx >= 0 && bx < 40) hx[bx]++; n++ }
      let mx = [0, 0]; for (let z = -3.2; z <= 3.2001; z += 0.005) { const s = slope(z); if (s > mx[0]) mx = [s, z] }
      let g0 = null, g1 = null; for (let z = 0; z <= 1; z += 0.005) { if (slope(z) > 1.8) { if (g0 === null) g0 = z; g1 = z } }
      return { hx, n, max: mx, gapX: [xOf(g0), xOf(g1)], s0: slope(0), s32: slope(-0.32), p0: [phi(0), pX(0)], side: Math.max(...[1.2, 1.3, 1.4, 1.46, 1.5, 1.6].map(pX)) } });
    const peak = H.hx.indexOf(Math.max(...H.hx)), left = Math.max(...H.hx.slice(8, 14)), right = Math.max(...H.hx.slice(26, 32)), gapL = Math.min(...H.hx.slice(16, 19)), gapR = Math.min(...H.hx.slice(21, 24));
    ok('after four batches the histogram has three peaks: a tall narrow one in the middle and a lower one on each side, with gaps between (same draws as the interactive)', see('k-flow', 0, '长出三个峰', '正中一个又高又窄，两边各一个矮而宽') && (peak === 19 || peak === 20) && left > 3 * gapL && right > 3 * gapR && H.hx[peak] > 1.5 * left && H.hx[peak] > 1.5 * right, JSON.stringify(H.hx));
    const pick = async z => { await p.evaluate(() => document.getElementById('cdf-cv').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
      const pt = await p.evaluate(z => { const cv = document.getElementById('cdf-cv'), r = cv.getBoundingClientRect(), Wd = cv.clientWidth, Hh = cv.clientHeight, lw = Math.min(84, Math.max(58, Wd * .16)), bh = Math.min(96, Math.max(70, Hh * .22)), mx = lw + 10, my = 8, mw = Wd - lw - 18, mh = Hh - bh - 46; return [r.left + mx + mw / 2, r.top + my + mh - (z + 3.4) / 6.8 * mh]; }, z);
      await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0] + .01, pt[1]); await p.mouse.up(); await p.waitForTimeout(200); };
    await pick(0.5); await pick(0); m = await w.met();
    ok('dragged to z = 0: stretch 0.48, density 0.399 → 0.831 (the spike in the middle)', see('k-flow', 0, '拉伸倍数只有 0.48', '密度从 0.399 涨到 0.831', '不足一半长') && has(m, '0.00 → 0.00', '走几步 0.48', '0.399 ÷ 0.48 = 0.831') && near(H.s0, 0.48, 0.005), m);
    await pick(-0.32); m = await w.met(); const s32 = num(m, /走几步 (-?[\d.]+)/); KEEP.s32 = s32;
    ok('dragged to about z = -0.32: the readout shows a large stretch (the curve is so steep there that a hair’s breadth changes it; exactly at -0.32 it is 70.9)', see('k-flow', 0, '从 2、3 一路涨到几十') && s32 > 5 && near(H.s32, 70.9, 0.2), m);
    ok('the largest stretch is about 73, at z = ±0.32 (scan in steps of 0.005 with the interactive’s own functions)', see('k-flow', 0, '最大约 73', 'z = ±0.32') && near(H.max[0], 73.3, 0.3) && near(Math.abs(H.max[1]), 0.315, 0.006), JSON.stringify(H.max));
    ok('the stretched sliver of z lands on x from 0.2 to 1.1, the gap between two peaks', see('k-flow', 0, 'x 从 0.2 到 1.1') && near(H.gapX[0], 0.21, 0.03) && near(H.gapX[1], 1.09, 0.03), JSON.stringify(H.gapX));
    KEEP.cdf = H;
  }

  sec('step 2 · nf: ten coupling layers');
  { const w = W('nf'); await w.show(); await p.waitForTimeout(900);
    await w.click('从噪声一层层播放', 300); let seenLow = false; for (let k = 0; k < 100; k++) { const r = await w.text('.row'); if (/ [0-8] \/ 10/.test(r)) seenLow = true; if (seenLow && /10 \/ 10/.test(r)) break; await p.waitForTimeout(150); } await p.waitForTimeout(700);
    let m = await w.met();
    ok('layer 10 after playing: 78% on a petal, test score -2.27 (truth -1.94, best 8 Gaussians -2.06), 11 860 parameters', seenLow && see('k-flow', 1, '78% 落在花瓣上，测试分 -2.27', '真分布 -1.94', '8 个高斯 -2.06') && has(m, '（第 10 层） -2.27', '-1.94 / -2.06', '落在花瓣上 78%', '11 860'), m);
    KEEP.nf = { test: num(m, /（第 10 层） (-?[\d.]+)/), best8: num(m, /-1\.94 \/ (-?[\d.]+)/), par: /11 860/.test(m) };
    await tap('nf-cv', Math.cos(157.5 * Math.PI / 180), Math.sin(157.5 * Math.PI / 180)); m = await w.met(); const br = m.match(/log p（真值） (-?[\d.]+) \((-?[\d.]+)\)/);
    ok('tap between the left and upper-left petals, 1 from the centre: the flow says -2.13, the truth -8.60: over six hundred times too dense', see('k-flow', 1, '流给的 log p 是 -2.13，真值只有 -8.60', '六百多倍') && br && +br[1] === -2.13 && +br[2] === -8.60 && Math.exp(br[1] - br[2]) > 600 && Math.exp(br[1] - br[2]) < 700, m);
    await tap('nf-cv', 2, 0); m = await w.met(); const pc = m.match(/log p（真值） (-?[\d.]+) \((-?[\d.]+)\)/);
    ok('tap the centre of the right-hand petal: -1.19 against a true -0.93 (a little too low)', see('k-flow', 1, '-1.19，真值 -0.93') && pc && +pc[1] === -1.19 && +pc[2] === -0.93, m);
    await w.click('300 步', 600); m = await w.met();
    ok('300 steps of training: 41% on a petal, test score -2.94', see('k-flow', 1, '只有 41% 落在花瓣上，测试分 -2.94') && has(m, '（第 10 层） -2.94', '落在花瓣上 41%'), m);
    await w.click('1000 步', 600); m = await w.met();
    ok('1000 steps: 56% and -2.70', see('k-flow', 1, '是 56% 和 -2.70') && has(m, '（第 10 层） -2.70', '落在花瓣上 56%'), m);
    await w.click('1 万步', 400);
  }

  sec('step 3 · vae: six values of β');
  { const w = W('vae'); await w.show(); await p.waitForTimeout(900); let m = await w.met();
    ok('β = 0.3: reconstruction error 0.233, KL 2.46, 67% on a petal, decoder noise 0.39', see('k-vae', 0, 'β = 0.3', '样本 67% 落在花瓣上') && has(m, '0.233', '2.46', '样本落在花瓣上 67%', '0.39'), m);
    KEEP.vae = { rec3: num(m, /均方） (-?[\d.]+)/), kl3: num(m, /多远 (-?[\d.]+)/), sx3: num(m, /√\(β\/2\) (-?[\d.]+)/) };
    // the six shipped models, read out of the page's script: codes of the eight petal centres, and what the midpoint between neighbouring codes decodes to
    const V = await EV(() => { const K = GEN; const sc = [...document.scripts].map(s => s.textContent).find(t => t.includes('const VD=')); const i0 = sc.indexOf('const VD=') + 9; let d = 0, k = i0, ins = false, esc = false;
      for (; k < sc.length; k++) { const c = sc[k]; if (ins) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') ins = false } else { if (c === '"') ins = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break } } }
      const VD = JSON.parse(sc.slice(i0, k + 1)); return VD.models.map(mm => { const enc = K.unq(mm.enc), dec = K.unq(mm.dec), C = K.FLOWER.map(c => c.m), E = C.map(c => Array.from(K.fwd(enc, Float64Array.from(c), 1).Y));
        const ang = E.map(e => Math.atan2(e[1], e[0]) * 180 / Math.PI), rad = E.map(e => Math.hypot(e[0], e[1])), sd = E.map(e => Math.exp(.5 * e[2]));
        const mids = []; for (let j = 0; j < 8; j++) { const a = E[j], b = E[(j + 1) % 8], x = Array.from(K.fwd(dec, Float64Array.from([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), 1).Y); mids.push({ r: Math.hypot(x[0], x[1]), ang: Math.atan2(x[1], x[0]) * 180 / Math.PI, petal: K.petalOf(x[0], x[1]) }) }
        const far = Array.from(K.fwd(dec, Float64Array.from([1.5, -0.7]), 1).Y); return { beta: mm.beta, ang, rad, sd, mids, far: Math.hypot(far[0], far[1]), mid01: [(E[0][0] + E[1][0]) / 2, (E[0][1] + E[1][1]) / 2] } }) });
    const v3 = V[2]; const steps = v3.ang.map((a, j) => { let d = v3.ang[(j + 1) % 8] - a; while (d > 180) d -= 360; while (d < -180) d += 360; return d; });
    ok('β = 0.3: the codes of the eight petals lie on a ring, neighbouring petals next to each other (each step 30° to 60° the same way round)', see('k-vae', 0, '围成一圈，相邻的花瓣在圈上也相邻') && v3.beta === 0.3 && (steps.every(d => d > 30 && d < 60) || steps.every(d => d < -30 && d > -60)) && v3.rad.every(r => r > 1.1 && r < 1.5), steps.map(d => d.toFixed(0)).join());
    ok('β = 0.3: the point midway between two neighbouring codes decodes to a place between the two petals, on neither (all eight pairs)', see('k-vae', 0, '落在那两片花瓣之间的空白里，哪一片都不在') && v3.mids.every((q, j) => { let d = q.ang - (45 * j + 22.5); while (d > 180) d -= 360; while (d < -180) d += 360; return q.petal === -1 && Math.abs(d) < 12 && q.r > 1.5 && q.r < 2.1; }), JSON.stringify(v3.mids.map(q => [q.r.toFixed(2), q.ang.toFixed(0), q.petal])));
    // the tap itself (the decoded dot is drawn on the canvas only): it must not disturb the readouts
    { const pt = await p.evaluate(z => { const cv = document.getElementById('vae-cv'); cv.scrollIntoView({ block: 'center' }); const r = cv.getBoundingClientRect(), Wd = cv.clientWidth, Hh = cv.clientHeight; let B; if (Wd < 560) B = GEN.view(0, Wd + 30, Wd, Wd, 3.4); else { const s = Math.min((Wd - 16) / 2, Hh - 22); B = GEN.view(Wd - s, 20, s, s, 3.4); } return [r.left + B.X(z[0]), r.top + B.Y(z[1])]; }, v3.mid01);
      await p.waitForTimeout(300); const pt2 = await p.evaluate(z => { const cv = document.getElementById('vae-cv'); const r = cv.getBoundingClientRect(), Wd = cv.clientWidth, Hh = cv.clientHeight; let B; if (Wd < 560) B = GEN.view(0, Wd + 30, Wd, Wd, 3.4); else { const s = Math.min((Wd - 16) / 2, Hh - 22); B = GEN.view(Wd - s, 20, s, s, 3.4); } return [r.left + B.X(z[0]), r.top + B.Y(z[1])]; }, v3.mid01);
      await p.mouse.move(pt2[0], pt2[1]); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300); const m2 = await w.met(); ok('tapping between two colours in the code space leaves the readouts as they were', has(m2, '0.233', '2.46'), m2); await w.click('清除点选', 200); }
    await w.set('vae-b', 0, 500); m = await w.met();
    ok('β = 0.01: reconstruction error 0.010, 29% on a petal; the clouds have shrunk to dots (width about 0.05)', see('k-vae', 0, '重建误差只有 0.010', '只有 29% 落在花瓣上', '云缩成了小点') && has(m, '0.010', '5.84', '样本落在花瓣上 29%') && V[0].sd.every(s => s < 0.08) && V[2].sd.every(s => s > 0.15), m + ' sd ' + V[0].sd.map(s => s.toFixed(2)).join());
    await w.set('vae-b', 5, 500); m = await w.met();
    KEEP.vae.rec10 = num(m, /均方） (-?[\d.]+)/); KEEP.vae.kl10 = num(m, /多远 (-?[\d.]+)/);
    ok('β = 10: KL 0.00, reconstruction error 4.134, 0% on a petal; every code at the origin, everything decodes to the centre', see('k-vae', 0, 'KL 是 0.00，重建误差 4.134', '0% 落在花瓣上', '缩到了原点') && has(m, '4.134', '0.00', '样本落在花瓣上 0%', '2.24') && V[5].rad.every(r => r < 0.03) && V[5].far < 0.1, m);
    await w.click('解码器加噪声', 400); const on = [];
    for (let bi = 0; bi <= 5; bi++) { await w.set('vae-b', bi, 400); on.push(pct(await w.met(), '样本落在花瓣上（加了噪声）')); }
    ok('with decoder noise, β from small to large: 29%, 57%, 43%, 29%, 25%, 19% on a petal; the noise at β = 10 is 2.24', see('k-vae', 0, '29%、57%、43%、29%、25%、19%', 'β = 10 时是 2.24') && on.join() === '29,57,43,29,25,19' && near(Math.sqrt(10 / 2), 2.24, 0.005), on.join());
    await w.click('解码器加噪声', 300); await w.set('vae-b', 2, 300);
  }

  sec('step 4 · gan: a small GAN trained live, and re-run step by step in the page');
  { const w = W('gan'); await w.show(); await p.waitForTimeout(600);
    const runTo = async n => { for (let k = 0; k < 6000; k++) { const m = await w.met(); if (num(m, /训练步数 (\d+)/) >= n) break; await p.waitForTimeout(60); } };
    await w.click('开始训练', 100); await runTo(3000); await w.click('暂停', 300); let m = await w.met(), st = await w.status();
    ok('matched pace, paused after 3000 steps: 8 / 8 petals, 70 to 90% on a petal, the discriminator’s average score near 0.5', has(m, '8 / 8') && pct(m, '样本落在花瓣上') >= 70 && pct(m, '样本落在花瓣上') <= 90 && near(num(m, /平均分 (-?[\d.]+)/), 0.49, 0.03) && has(st, '0.5 附近'), m);
    await w.click('生成器太急', 100); await runTo(3000); await w.click('暂停', 300); m = await w.met();
    ok('impatient generator, paused after 3000 steps: the training ran and the readouts are there (the exact numbers come from the re-run below)', num(m, /训练步数 (\d+)/) >= 3000 && /\d \/ 8/.test(m), m);
    await w.click('太急，但判别器一次看两个', 100); await runTo(1500); await w.click('暂停', 300); m = await w.met(); st = await w.status();
    ok('impatient, but D sees pairs, paused after 1500 steps: at least 5 petals have samples; the status explains why pairs help', num(m, /（每片至少 3%） (\d) \/ 8/) >= 5 && has(st, '一次看两个样本', '几乎一样'), m + ' || ' + st.slice(0, 80));
    // the same training, step by step, inside the page: same networks, same optimiser, same seed and order of random draws as the interactive
    const G = await EV(() => { const K = GEN, DATA = K.sampleMix(K.FLOWER, 4000, K.rng(3)).P, ND = 4000, B = 128;
      const SET = { even: { lg: 1e-3, ld: 1e-3, pk: 1 }, fast: { lg: 5e-3, ld: 5e-4, pk: 1 }, pack: { lg: 5e-3, ld: 5e-4, pk: 2 } };
      const sig = v => 1 / (1 + Math.exp(-v)); const NZ = 400, ZF = new Float64Array(2 * NZ); { const r = K.rng(77); for (let i = 0; i < 2 * NZ; i++) ZF[i] = K.gauss(r) }
      function train(mode, seed, steps, every) { const o = SET[mode], r = K.rng(1000 * seed + 7); const g = K.mlp([2, 32, 32, 2], 'leaky', r), d = K.mlp([2 * o.pk, 32, 32, 1], 'leaky', r);
        const M = { og: K.adam(g, o.lg, .5, .99), od: K.adam(d, o.ld, .5, .99), it: 0, lastD: .5 };
        const gz = n => { const Z = new Float64Array(2 * n); for (let i = 0; i < 2 * n; i++) Z[i] = K.gauss(r); return Z };
        const step = () => { const pk = o.pk, m = B / pk; const Xr = new Float64Array(2 * B); for (let i = 0; i < B; i++) { const j = Math.floor(r() * ND); Xr[2 * i] = DATA[2 * j]; Xr[2 * i + 1] = DATA[2 * j + 1] }
          const Xf = K.fwd(g, gz(B), B).Y; const fr = K.fwd(d, Xr, m), ff = K.fwd(d, Xf, m), Gd = K.zeros(d), dr = new Float64Array(m), df = new Float64Array(m);
          for (let i = 0; i < m; i++) { dr[i] = (sig(fr.Y[i]) - 1) / m; df[i] = sig(ff.Y[i]) / m } K.bwd(d, fr, dr, m, Gd); K.bwd(d, ff, df, m, Gd); K.step(M.od, Gd);
          const Z = gz(B), fg = K.fwd(g, Z, B), fd = K.fwd(d, fg.Y, m), dl = new Float64Array(m); let sD = 0; for (let i = 0; i < m; i++) { const s = sig(fd.Y[i]); sD += s / m; dl[i] = (s - 1) / m }
          const dX = K.bwd(d, fd, dl, m, K.zeros(d)), Gg = K.zeros(g); K.bwd(g, fg, dX, B, Gg); K.step(M.og, Gg); M.it++; M.lastD = .9 * M.lastD + .1 * sD };
        const evaluate = () => { const S = K.fwd(g, ZF, NZ).Y, h = K.petalHist(S, NZ); return { it: M.it, on: Math.round(100 * (1 - h.off / NZ)), cov: h.c.filter(c => c >= .03 * NZ).length, D: +M.lastD.toFixed(2) } };
        const Hs = []; while (M.it < steps) { step(); if (M.it % every === 0) Hs.push(evaluate()) } return Hs }
      const rng2 = (H, a, b, f) => { const v = H.filter(h => h.it >= a && h.it <= b).map(f); return [Math.min(...v), Math.max(...v)] }; const out = {};
      { const H = train('even', 1, 3000, 20); out.even = { c300: H.find(h => h.it === 300).cov, c800: H.find(h => h.it === 800).cov, first8: H.find(h => h.cov === 8).it, on: rng2(H, 2000, 3000, h => h.on), D: rng2(H, 2000, 3000, h => h.D) } }
      { const H = train('fast', 1, 6000, 20); const e = H.filter(h => h.it >= 100 && h.it <= 1500); out.fast = { maxCov: Math.max(...H.filter(h => h.it <= 1500).map(h => h.cov)), share12: e.filter(h => h.cov === 1 || h.cov === 2).length / e.length, zeros: e.filter(h => h.cov === 0).length, first8: H.find(h => h.cov === 8).it, late: rng2(H, 3000, 6000, h => h.cov) } }
      { const H = train('pack', 1, 6000, 20); const l = H.filter(h => h.it >= 1000); out.pack = { first8: H.find(h => h.cov === 8).it, share8: l.filter(h => h.cov === 8).length / l.length, min: Math.min(...l.map(h => h.cov)) } }
      return out; });
    ok('matched pace: 5 petals at 300 steps, all 8 for the first time between 700 and 800 steps (and again at 800); 76 to 85% on a petal and a score of 0.48 to 0.49 between 2000 and 3000 steps', see('k-gan', 0, '三百步上下占到 5 片', '七八百步 8 片都有', '（76% 到 85%）', '0.48、0.49') && G.even.c300 === 5 && G.even.c800 === 8 && G.even.first8 >= 700 && G.even.first8 <= 800 && G.even.on.join() === '76,85' && G.even.D.join() === '0.48,0.49', JSON.stringify(G.even));
    ok('impatient generator, first 1500 steps: never more than 4 petals at once, one or two most of the time, and sometimes none', see('k-gan', 0, '多半只亮一两片（从没超过 4 片）', '一片也不亮') && G.fast.maxCov === 4 && G.fast.share12 > 0.6 && G.fast.zeros > 0, JSON.stringify(G.fast));
    ok('impatient generator, later: all 8 petals for the first time a little after 1800 steps; 6 to 8 petals from 3000 to 6000 steps', see('k-gan', 0, '1800 多步第一次 8 片都有', '3000 步以后一直有 6 到 8 片') && G.fast.first8 > 1800 && G.fast.first8 < 1900 && G.fast.late.join() === '6,8', JSON.stringify(G.fast));
    ok('D sees pairs: all 8 petals for the first time after three or four hundred steps; after 1000 steps all 8 nearly nine tenths of the time, never fewer than 5', see('k-gan', 0, '三四百步就第一次 8 片都有', '近九成的时间 8 片齐全（最少也有 5 片）') && G.pack.first8 >= 300 && G.pack.first8 <= 400 && G.pack.share8 > 0.84 && G.pack.share8 < 0.9 && G.pack.min === 5, JSON.stringify(G.pack));
  }

  sec('step 5 · ar: one number at a time');
  { const w = W('ar'); await w.show(); await p.waitForTimeout(500);
    for (let k = 0; k < 3; k++) { await w.click('一步步抽一个', 200); await p.waitForTimeout(1700); }
    let m = await w.met(); ok('three single draws: 3 distinct points, 2 steps per point', has(m, '不同的点 3', '每个点要几步 2'), m);
    await w.click('一次抽 300 个', 300); m = await w.met();
    ok('classification head, 300 at once: about 95% on a petal (94 to 97), all 8 petals', see('k-ar', 0, '95% 上下落在花瓣上，8 片都有') && pct(m, '落在花瓣上') >= 94 && pct(m, '落在花瓣上') <= 97 && has(m, '8 / 8'), m); KEEP.arCat = pct(m, '落在花瓣上');
    await w.click('高斯头', 300); await w.click('一次抽 300 个', 300); m = await w.met(); let st = await w.status();
    ok('Gaussian head, 300: about 45% on a petal (42 to 47); the status speaks of vertical streaks', see('k-ar', 0, '只有 45% 上下落在花瓣上', '竖条') && pct(m, '落在花瓣上') >= 42 && pct(m, '落在花瓣上') <= 47 && has(st, '竖条'), m); KEEP.arGauss = pct(m, '落在花瓣上');
    const tapCol = async x1 => { const pt = await p.evaluate(x1 => { const cv = document.getElementById('ar-cv'); cv.scrollIntoView({ block: 'center' }); const r = cv.getBoundingClientRect(), Wd = cv.clientWidth, Hh = cv.clientHeight, s = Hh - 86, ox = Math.max(0, (Wd - (s + 64)) / 2), V = GEN.view(ox, 0, s, s); return [r.left + V.X(x1), r.top + V.Y(0.5)] }, x1); await p.waitForTimeout(250);
      const pt2 = await p.evaluate(x1 => { const cv = document.getElementById('ar-cv'); const r = cv.getBoundingClientRect(), Wd = cv.clientWidth, Hh = cv.clientHeight, s = Hh - 86, ox = Math.max(0, (Wd - (s + 64)) / 2), V = GEN.view(ox, 0, s, s); return [r.left + V.X(x1), r.top + V.Y(0.5)] }, x1); await p.mouse.move(pt2[0], pt2[1]); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300); };
    await tapCol(0.07);
    // the true conditional distribution of the middle column and the Gaussian head's mean and width (same cells as the interactive: 48 x 48, 3 x 3 points per cell)
    const C = await EV(() => { const K = GEN, NB = 48, LIM = K.L, BW = 2 * LIM / NB, N0 = K.noised(K.FLOWER, 1, 0), i = 24, col = [];
      for (let j = 0; j < NB; j++) { let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const x = -LIM + (i + (a + .5) / 3) * BW, y = -LIM + (j + (b + .5) / 3) * BW; s += Math.exp(K.logp(N0, x, y)) } col.push(s) }
      const z = col.reduce((a, b) => a + b, 0); let mean = 0, v = 0; col.forEach((q, j) => mean += q / z * (-LIM + (j + .5) * BW)); col.forEach((q, j) => v += q / z * (-LIM + (j + .5) * BW - mean) ** 2);
      const up = col.indexOf(Math.max(...col.slice(24))), lo = col.indexOf(Math.max(...col.slice(0, 24))); return { x1: -LIM + (i + .5) * BW, mean, sd: Math.sqrt(v + BW * BW / 12), peaksY: [-LIM + (lo + .5) * BW, -LIM + (up + .5) * BW], mid: col[23] / col[up], onPetalAtMean: K.petalOf(-LIM + (i + .5) * BW, mean) } });
    ok('the middle column: the true distribution has two peaks (near y = -2 and +2) and almost nothing in between; the Gaussian head has mean 0.00 and width 2.04', see('k-ar', 0, '上下两个峰', '均值 0.00、宽度 2.04', '两片花瓣之间的空白') && near(C.peaksY[0], -2, 0.3) && near(C.peaksY[1], 2, 0.3) && C.mid < 0.01 && near(C.mean, 0, 0.005) && near(C.sd, 2.04, 0.006) && C.onPetalAtMean === -1, JSON.stringify(C));
    await w.set('ar-t', 0, 300); await w.click('一次抽 300 个', 300); m = await w.met(); st = await w.status();
    ok('temperature 0, Gaussian head, 300 draws: 1 distinct point, 0% on a petal (it sits in the gap in the centre)', see('k-ar', 0, '不同的点只有 1 个', '就在花心，0% 落在花瓣上') && has(m, '不同的点 1', '落在花瓣上 0%') && has(st, '同一个点'), m);
    await w.click('清空', 200); await tapCol(0.07); st = await w.status();
    ok('with the picture cleared, tapping the middle column makes the status state the Gaussian head’s mean 0.00 and width 2.04', has(st, '均值 0.00', '宽度 2.04'), st);
    await w.click('分类头', 300); await w.click('一次抽 300 个', 300); m = await w.met();
    ok('temperature 0, classification head: still 1 distinct point, but on a petal', see('k-ar', 0, '换成分类头，这个点在花瓣上') && has(m, '不同的点 1', '落在花瓣上 100%', '1 / 8'), m);
    await w.set('ar-t', 1, 200);
  }

  sec('step 6 · sc: the score field, Langevin sampling, annealing');
  { const w = W('sc'); await w.show(); await p.waitForTimeout(700);
    const stAt = async i => { await w.set('sc-s', i, 250); return (await w.text('.row')) + ' || ' + (await w.status()); };
    const s9 = await stAt(9), s5 = await stAt(5), s2 = await stAt(2), s0 = await stAt(0);
    ok('σ = 0.10: every arrow points to the nearest petal, the arrows between petals push against each other', see('k-score', 0, 'σ = 0.1：箭头都指向最近的花瓣，花瓣之间的箭头互相顶着') && has(s9, '0.10', '指向最近的花瓣', '互相顶着'), s9);
    ok('σ = 0.45 (between 0.3 and 1): the petals blur and neighbours begin to join', see('k-score', 0, 'σ 调到 0.3 至 1', '相邻的花瓣开始连在一起') && has(s5, '0.45', '相邻的花瓣开始连在一起'), s5);
    ok('σ = 1.41 and 3.00: one big blob, arrows towards the centre almost everywhere', see('k-score', 0, 'σ 到 1.4 以上，整朵花糊成一大团') && has(s2, '1.41', '糊成一大团') && has(s0, '3.00', '糊成一大团', '花心附近'), s2);
    await w.click('画出这个噪声下的训练样本', 300);
    // the 300 training samples of the interactive (rng 41 for the data, rng 42 for the noise) at every noise level
    const Cv = await EV(() => { const K = GEN, TR = K.sampleMix(K.FLOWER, 300, K.rng(41)).P, NE = new Float64Array(600); { const r = K.rng(42); for (let i = 0; i < 600; i++) NE[i] = K.gauss(r) } const o = {};
      for (let si = 0; si < 10; si++) { const sg = 3 * Math.pow(.1 / 3, si / 9); let inside = 0; const c6 = new Set(); for (let i = 0; i < 300; i++) { const x = TR[2 * i] + sg * NE[2 * i], y = TR[2 * i + 1] + sg * NE[2 * i + 1]; if (Math.abs(x) < K.L && Math.abs(y) < K.L) { inside++; c6.add(Math.floor((x + K.L) / (2 * K.L) * 6) + ',' + Math.floor((y + K.L) / (2 * K.L) * 6)) } } o[sg.toFixed(2)] = [c6.size, inside] } return o; });
    ok('training samples: 22 of 36 blocks hold a dot at σ = 0.10, 35 at 0.97, all 36 at 1.41; at σ = 3 only 152 of the 300 are inside the picture', see('k-score', 0, '6 × 6 = 36 块，只有 22 块里有点', '0.97 时 35 块，1.41 时 36 块都有', '只剩 152 个还在画面里') && Cv['0.10'][0] === 22 && Cv['0.97'][0] === 35 && Cv['1.41'][0] === 36 && Cv['3.00'][1] === 152 && Cv['0.10'][1] === 300, JSON.stringify(Cv));
    const run = async () => { await w.click('开始采样', 200); for (let k = 0; k < 600; k++) { if (/走了几步（共 600） 600/.test(await w.met())) break; await p.waitForTimeout(150); } await p.waitForTimeout(400); return [await w.met(), await w.status()]; };
    await w.click('只用小噪声', 300); await w.click('角落里一团', 300); let [m, st] = await run();
    ok('small noise only, from the corner: nearly everything in one petal (the fullest holds 87%), 1 / 8 petals', see('k-score', 0, '最多的一片占 87%，分到粒子的花瓣是 1 / 8') && has(m, '1 / 8 (87%)', '粒子落在花瓣上 89%') && has(st, '再也出不来'), m);
    await w.click('从大到小（退火）', 300); [m, st] = await run();
    ok('annealing, from the same corner: all 8 petals, the fullest only 15% (ideal 12.5%), 90% on a petal', see('k-score', 0, '8 片花瓣都分到了粒子，最多的一片只占 15%（理想是 12.5%），90% 落在花瓣上') && has(m, '8 / 8 (15%)', '粒子落在花瓣上 90%') && near(100 / 8, 12.5, 1e-9), m);
  }

  sec('step 7 · den: the best guess of the original point');
  { const w = W('den'); await w.show(); await p.waitForTimeout(500);
    const at = async s => { await w.set('den-s', s, 200); const m = await w.met(); return [num(m, /多远 (-?[\d.]+)/), pct(m, '那片花瓣的概率'), m]; };
    await tap('den-cv', 2, 0); const R = {}; for (const s of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.9, 1]) R[s] = await at(s);
    ok('cross on the centre of the right-hand petal, σ up to 0.5: the guess stays 2.0 to 2.1 from the centre; one bar (100%; 96% at σ = 0.5)', see('k-diff', 0, '（离花心 2.0 到 2.1）', '100%，σ = 0.5 时 96%') && [0, 0.1, 0.2, 0.3, 0.4, 0.5].every(s => R[s][0] >= 2.0 && R[s][0] <= 2.1) && [0, 0.1, 0.2, 0.3, 0.4].every(s => R[s][1] === 100) && R[0.5][1] === 96, JSON.stringify([0, 0.1, 0.2, 0.3, 0.4, 0.5].map(s => R[s].slice(0, 2))));
    ok('σ = 0.7: 1.93 from the centre (73%); σ = 0.9: 1.50 (43%); σ = 1: in the centre (0.00), eight equal bars (13%)', see('k-diff', 0, 'σ = 0.7 时离花心 1.93（最可能的那片 73%）', '0.9 时 1.50（43%）', '（0.00）', '13%，也就是八分之一') && R[0.7][0] === 1.93 && R[0.7][1] === 73 && R[0.9][0] === 1.5 && R[0.9][1] === 43 && R[1][0] === 0 && R[1][1] === 13 && Math.round(100 / 8) === 13, JSON.stringify([0.7, 0.9, 1].map(s => R[s].slice(0, 2))));
    await tap('den-cv', 2 * Math.cos(Math.PI / 8), 2 * Math.sin(Math.PI / 8)); const b = await at(0.3);
    // same computation as the interactive: the posterior mean of the original point, given the noisy one
    const Dm = await EV(() => { const K = GEN, s = 0.3, a = Math.sqrt(1 - s * s), x = 2 * Math.cos(Math.PI / 8), y = 2 * Math.sin(Math.PI / 8), h = K.post(K.NZ(K.FLOWER, a, s), a, x, y).mean; return { r: Math.hypot(h[0], h[1]), ang: Math.atan2(h[1], h[0]) * 180 / Math.PI, petal: K.petalOf(h[0], h[1]) } });
    ok('cross midway between two petals, σ = 0.3: 50% each, the guess lies between them (1.85 from the centre), on neither petal', see('k-diff', 0, '两片各占 50%', '（离花心 1.85）', '哪一片都不在') && b[0] === 1.85 && b[1] === 50 && near(Dm.r, 1.85, 0.006) && near(Dm.ang, 22.5, 0.5) && Dm.petal === -1, b[2] + ' ' + JSON.stringify(Dm));
  }

  sec('step 7 · dif: sampling by denoising step by step');
  { const w = W('dif'); await w.show(); await p.waitForTimeout(1500);
    const at = async n => { await w.set('dif-n', n, 200); await p.waitForTimeout(2300); return await w.met(); };
    let m = await at(0); let st = await w.status();
    ok('1 step: all 400 points in the centre, 0% on a petal', see('k-diff', 1, '1 步：400 个点全落在花心，0% 落在花瓣上') && has(m, '去噪步数 1', '落在花瓣上 0%', '0 / 8') && has(st, '400 个点全落在花心'), m);
    m = await at(2);
    // the same loop as the interactive (DDIM and DDPM, seed 1): the guesses, the routes and how bent they are
    const Q = await EV(() => { const K = GEN, NP = 400; const run = (N, mode) => { const r = K.rng(301), X0 = new Float64Array(2 * NP); for (let i = 0; i < 2 * NP; i++) X0[i] = K.gauss(r); let cur = X0; const fr = [X0], gr = [];
        for (let k = 0; k < N; k++) { const u = 1 - k / N, u2 = 1 - (k + 1) / N, s = Math.sin(Math.PI / 2 * u), a = Math.cos(Math.PI / 2 * u), s2 = Math.sin(Math.PI / 2 * u2), a2 = Math.cos(Math.PI / 2 * u2), nx = new Float64Array(2 * NP); const Nz = a > 1e-9 ? K.NZ(K.FLOWER, a, s) : null, mu = K.cmean(K.FLOWER); let g = 0;
          for (let i = 0; i < NP; i++) { const x = cur[2 * i], y = cur[2 * i + 1], h = Nz ? K.post(Nz, a, x, y).mean : mu; g += Math.hypot(h[0], h[1]) / NP;
            if (mode === 'ddim' || s2 < 1e-9) { const ex = (x - a * h[0]) / s, ey = (y - a * h[1]) / s; nx[2 * i] = a2 * h[0] + s2 * ex; nx[2 * i + 1] = a2 * h[1] + s2 * ey }
            else { const A = a / a2, b2 = s * s - A * A * s2 * s2, pc = A * A / b2 + 1 / (s2 * s2), sd = Math.sqrt(1 / pc); nx[2 * i] = (A * x / b2 + a2 * h[0] / (s2 * s2)) / pc + sd * K.gauss(r); nx[2 * i + 1] = (A * y / b2 + a2 * h[1] / (s2 * s2)) / pc + sd * K.gauss(r) } } gr.push(g); cur = nx; fr.push(nx) }
        const ratio = n => { let L = 0, Dd = 0; for (let i = 0; i < n; i++) { let l = 0; for (let k = 1; k < fr.length; k++) l += Math.hypot(fr[k][2 * i] - fr[k - 1][2 * i], fr[k][2 * i + 1] - fr[k - 1][2 * i + 1]); L += l; Dd += Math.hypot(fr[N][2 * i] - fr[0][2 * i], fr[N][2 * i + 1] - fr[0][2 * i + 1]) } return L / Dd };
        let inward = 0, back = 0, rEnd = 0; for (let i = 0; i < NP; i++) { if (Math.hypot(fr[1][2 * i], fr[1][2 * i + 1]) < Math.hypot(fr[0][2 * i], fr[0][2 * i + 1])) inward++; const ax = fr[1][2 * i] - fr[0][2 * i], ay = fr[1][2 * i + 1] - fr[0][2 * i + 1], bx = fr[N][2 * i] - fr[0][2 * i], by = fr[N][2 * i + 1] - fr[0][2 * i + 1]; if (ax * bx + ay * by < 0) back++; rEnd += Math.hypot(fr[N][2 * i], fr[N][2 * i + 1]) / NP }
        const h = K.petalHist(cur, NP); return { guess0: gr[0], guess1: gr[1], inward, back, ratioAll: ratio(NP), ratio60: ratio(60), rEnd, on: Math.round(100 * (1 - h.off / NP)) } };
      return { n3: run(3, 'ddim'), n10: run(10, 'ddim'), d100: run(100, 'ddim'), p100: run(100, 'ddpm') } });
    ok('3 steps: at the first step every guess sits in the centre; in the end only 49% on a petal, many between the centre and the petals (mean distance 1.6 from the centre)', see('k-diff', 1, '第一步时青色的猜测全叠在花心', '最后只有 49% 落在花瓣上') && has(m, '去噪步数 3', '落在花瓣上 49%') && Q.n3.guess0 < 1e-9 && Q.n3.on === 49 && Q.n3.rEnd > 1.4 && Q.n3.rEnd < 1.8, m + ' ' + JSON.stringify(Q.n3));
    m = await at(4);
    ok('10 steps: 94% on a petal; in the first step all 400 points shrink towards the centre; for 379 the first step differs by more than 90° from where they end; the route is 23% longer than the straight line', see('k-diff', 1, '10 步：94% 落在花瓣上', '400 个点里有 379 个', '长 23%') && has(m, '去噪步数 10', '落在花瓣上 94%') && Q.n10.inward === 400 && Q.n10.back === 379 && near(Q.n10.ratioAll, 1.232, 0.004), m + ' ' + JSON.stringify(Q.n10));
    m = await at(7); const mi = m; await w.click('DDPM', 300); await p.waitForTimeout(2300); const mp = await w.met();
    ok('100 steps: DDIM 95% and DDPM 97% on a petal, all 8 petals in both', see('k-diff', 1, 'DDIM 95%、DDPM 97% 落在花瓣上，8 片都有') && has(mi, '去噪步数 100', '落在花瓣上 95%', '8 / 8') && has(mp, '落在花瓣上 97%', '8 / 8') && Q.d100.on === 95 && Q.p100.on === 97, mi + ' || ' + mp);
    ok('the 60 routes drawn at 100 steps: DDPM’s path is about 12 times the straight line, DDIM’s only 1.2 times', see('k-diff', 1, '12 倍上下，DDIM 只有 1.2 倍') && near(Q.p100.ratio60, 12.2, 0.3) && near(Q.d100.ratio60, 1.19, 0.01), JSON.stringify([Q.p100.ratio60, Q.d100.ratio60]));
    await w.click('DDIM', 300); KEEP.dif = Q;
  }

  sec('step 8 · fm: flow matching, the diffusion routes, reflow');
  { const w = W('fm'); await w.show(); await p.waitForTimeout(2300);
    const at = async n => { await w.set('fm-n', n, 200); await p.waitForTimeout(2000); return await w.met(); };
    const m1 = await at(0), m2 = await at(1), m4 = await at(2);
    ok('1 step: 0% on a petal (everything in the centre); 2 steps 35%; 4 steps 73%', see('k-fm', 0, '0% 落在花瓣上；2 步 35%，4 步 73%') && has(m1, '步数 1', '落在花瓣上 0%') && has(m2, '落在花瓣上 35%') && has(m4, '落在花瓣上 73%') && has(await (async () => { await w.set('fm-n', 0, 200); await p.waitForTimeout(1900); const s = await w.status(); await w.set('fm-n', 2, 200); await p.waitForTimeout(1900); return s; })(), '所有点都到了花心'), m1 + ' | ' + m2 + ' | ' + m4);
    await w.click('画训练用的直线', 400);
    // the 50 training lines of the interactive (rng 61 for the data, rng 62 for the noise): which of them cross
    const X = await EV(() => { const K = GEN, NL = 50; const PZ = new Float64Array(2 * NL), PX = K.sampleMix(K.FLOWER, NL, K.rng(61)).P; { const r = K.rng(62); for (let i = 0; i < 2 * NL; i++) PZ[i] = K.gauss(r) }
      const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); let n = 0, near = 0; const per = new Array(NL).fill(0);
      for (let i = 0; i < NL; i++) for (let j = i + 1; j < NL; j++) { const a = [PZ[2 * i], PZ[2 * i + 1]], b = [PX[2 * i], PX[2 * i + 1]], c = [PZ[2 * j], PZ[2 * j + 1]], d = [PX[2 * j], PX[2 * j + 1]];
        if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) { n++; per[i]++; per[j]++; const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / (r[0] * s[1] - r[1] * s[0]); if (Math.hypot(a[0] + t * r[0], a[1] + t * r[1]) < 1) near++ } }
      return { crossing: n, within1: near, lines: per.filter(v => v > 0).length, mean: 2 * n / NL } });
    ok('the 50 training lines: 48 cross another line, 8 crossings per line on average, half of the crossings within 1 of the centre', see('k-fm', 0, '50 条里有 48 条和别的线相交', '平均每条被 8 条线穿过', '交点有一半挤在离花心 1 以内') && X.lines === 48 && X.mean === 8 && X.within1 / X.crossing > 0.45 && X.within1 / X.crossing < 0.55, JSON.stringify(X));
    let m = await at(5);
    ok('64 steps: 94% on a petal', see('k-fm', 0, '64 步：94% 落在花瓣上') && has(m, '步数 64', '落在花瓣上 94%'), m);
    await w.click('叠上扩散的路线', 400); await p.waitForTimeout(2000); m = await w.met(); const st = await w.status();
    KEEP.fmRead = { fm1: pct(m1, '落在花瓣上'), fm64: pct(m, '落在花瓣上'), ratio: num(m, /笔直） (-?[\d.]+)/), vp: num(m, /扩散 (-?[\d.]+)/) };
    ok('with the diffusion routes overlaid: path ÷ straight distance 1.54 for flow matching, 1.18 for diffusion', see('k-fm', 0, 'Flow Matching 是 1.54，扩散是 1.18') && has(m, '1.54（扩散 1.18）') && has(st, '终点却几乎重合'), m);
    // same functions as the interactive: flow matching and DDIM from the same noise (rng 401), 64 steps each
    const E = await EV(() => { const K = GEN, NP = 400; const r = K.rng(401), Z = new Float64Array(2 * NP); for (let i = 0; i < 2 * NP; i++) Z[i] = K.gauss(r);
      const fmI = (Z, N) => { const fr = [Z.slice()]; let cur = Z.slice(); for (let k = 0; k < N; k++) { const t = k / N, nx = new Float64Array(cur.length), n = cur.length / 2; for (let i = 0; i < n; i++) { const v = K.vel(K.FLOWER, t, cur[2 * i], cur[2 * i + 1]); nx[2 * i] = cur[2 * i] + v[0] / N; nx[2 * i + 1] = cur[2 * i + 1] + v[1] / N } fr.push(nx); cur = nx } return fr };
      const ddim = (Z, N) => { const fr = [Z.slice()]; let cur = Z.slice(); const n = Z.length / 2; for (let k = 0; k < N; k++) { const u = 1 - k / N, u2 = 1 - (k + 1) / N, s = Math.sin(Math.PI / 2 * u), a = Math.cos(Math.PI / 2 * u), s2 = Math.sin(Math.PI / 2 * u2), a2 = Math.cos(Math.PI / 2 * u2), Nz = a > 1e-9 ? K.NZ(K.FLOWER, a, s) : null, nx = new Float64Array(2 * n);
          for (let i = 0; i < n; i++) { const x = cur[2 * i], y = cur[2 * i + 1], h = Nz ? K.post(Nz, a, x, y).mean : K.cmean(K.FLOWER); nx[2 * i] = a2 * h[0] + s2 * (x - a * h[0]) / s; nx[2 * i + 1] = a2 * h[1] + s2 * (y - a * h[1]) / s } fr.push(nx); cur = nx } return fr };
      const F = fmI(Z, 64), Dm = ddim(Z.slice(0, 120), 64); let d = 0, same = 0, md = 0; for (let i = 0; i < 60; i++) { d += Math.hypot(F[64][2 * i] - Dm[64][2 * i], F[64][2 * i + 1] - Dm[64][2 * i + 1]) / 60; md += Math.hypot(F[32][2 * i] - Dm[32][2 * i], F[32][2 * i + 1] - Dm[32][2 * i + 1]) / 60; if (K.petalOf(F[64][2 * i], F[64][2 * i + 1]) === K.petalOf(Dm[64][2 * i], Dm[64][2 * i + 1])) same++ }
      return { end: d, mid: md, same } });
    ok('the 60 routes drawn: the two kinds are about 0.46 apart at the halfway point, yet end only 0.004 apart on average, always on the same petal', see('k-fm', 0, '平均相距约 0.46', '平均只差 0.004，都在同一片花瓣上') && near(E.mid, 0.455, 0.006) && near(E.end, 0.004, 0.0006) && E.same === 60, JSON.stringify(E));
    await w.click('拉直一次', 400); m = await at(0); const str = await w.status();
    KEEP.fmRead.rf1 = pct(m, '落在花瓣上');
    ok('straightened once, 1 step: 76% on a petal, path ÷ straight distance 1.00', see('k-fm', 0, '76% 落在花瓣上，路程 ÷ 直线距离是 1.00') && has(m, '步数 1', '落在花瓣上 76%', '笔直） 1.00') && has(str, '比原版低一些'), m + ' || ' + str.slice(-60));
    m = await at(5);
    ok('straightened once, 64 steps: only 86%, short of the original’s 94%', see('k-fm', 0, '只到 86%（64 步），比不上原版 64 步的 94%') && has(m, '步数 64', '落在花瓣上 86%'), m);
    KEEP.fmRead.rf64 = pct(m, '落在花瓣上'); await w.click('随机配对', 300); KEEP.fm = E;
  }

  sec('step 9 · src: five starting distributions');
  { const w = W('src'); await w.show(); await p.waitForTimeout(2300);
    const at = async n => { await w.set('src-n', n, 200); await p.waitForTimeout(2000); return await w.met(); };
    await w.click('一个点', 300); await p.waitForTimeout(2000); let m = await w.met(); const st = await w.status();
    ok('one point: 1 distinct sample, in the centre, start-to-end distance 0.00', see('k-gauss', 0, '只有 1 个不同的点，就在花心', '0.00') && has(m, '落在花瓣上 0%', '0 / 8', '不同的样本 1', '平均距离 0.00') && has(st, '花心'), m);
    await w.click('一个点，路上加随机', 300); const b64 = await at(6);
    ok('one point with randomness on the way, 64 steps: 300 distinct samples, 97% on a petal, all 8 petals', see('k-gauss', 0, '300 个各不相同，97% 落在花瓣上，8 片都有') && has(b64, '落在花瓣上 97%', '8 / 8', '不同的样本 300'), b64);
    const b8 = await at(3), b4 = await at(2), b2 = await at(1), b1 = await at(0);
    ok('the same with fewer steps: 75% at 8, 56% at 4, 35% at 2, and with 1 step everything back in the centre', see('k-gauss', 0, '8 步 75%，4 步 56%，2 步 35%，1 步又全回到花心') && has(b8, '落在花瓣上 75%') && has(b4, '落在花瓣上 56%') && has(b2, '落在花瓣上 35%') && has(b1, '落在花瓣上 0%', '不同的样本 1'), [b8, b4, b2, b1].map(x => x.slice(0, 12)).join(' | '));
    await w.click('标准高斯', 300); const g8 = await at(3); await w.click('均匀的方块', 300); await p.waitForTimeout(2000); const u8 = await w.met();
    ok('8 steps: standard Gaussian 94% (start-to-end distance 0.66), uniform square 89%', see('k-gauss', 0, '标准高斯 94%，均匀的方块 89%', '8 步时是 0.66') && has(g8, '落在花瓣上 94%', '平均距离 0.66') && has(u8, '落在花瓣上 89%'), g8 + ' | ' + u8);
    await w.click('一个粗略的答案', 300); const r1 = await at(0), r2 = await at(1);
    ok('a rough answer: 64% on a petal with 1 step, 90% with 2; start to end only 0.40 and 0.46', see('k-gauss', 0, '1 步就有 64% 落在花瓣上，2 步 90%', '0.40 和 0.46') && has(r1, '落在花瓣上 64%', '平均距离 0.40') && has(r2, '落在花瓣上 90%', '平均距离 0.46'), r1 + ' | ' + r2);
    await w.click('标准高斯', 300); const g1 = await at(0); await at(3);
    ok('standard Gaussian, 1 step: everything in the centre, counted as 1 distinct sample', has(g1, '落在花瓣上 0%', '不同的样本 1'), g1);
    KEEP.src = { r1: pct(r1, '落在花瓣上'), r2: pct(r2, '落在花瓣上'), g8: pct(g8, '落在花瓣上') };
  }

  sec('step 10 · cfg: classifier-free guidance');
  { const w = W('cfg'); await w.show(); await p.waitForTimeout(2300); await w.click('只要右边那片', 300); await p.waitForTimeout(1700);
    const at = async v => { await w.set('cfg-w', v, 200); await p.waitForTimeout(400); return await w.met(); };
    const c0 = await at(0), c05 = await at(0.5), c1 = await at(1), c3 = await at(3), c5 = await at(5), c7 = await at(7), c8 = await at(8);
    ok('only the right-hand petal, w = 0: 12% on it', see('k-fast', 0, 'w = 0：条件被完全忽略，只有 12% 落在这片花瓣上') && has(c0, '落在要求的花瓣上 12%'), c0);
    ok('w = 0.5: 46% on it, 50% off every petal', see('k-fast', 0, '46% 落在这片上，却有 50% 落在所有花瓣之外') && has(c05, '落在要求的花瓣上 46%', '落在所有花瓣外 50%'), c05);
    ok('w = 1: 96% on it, sideways width 0.103, 1.99 from the centre', see('k-fast', 0, 'w = 1：96% 落在这片上，横着的宽度 0.103', '从 1.99 到 2.66') && has(c1, '落在要求的花瓣上 96%', '（花瓣中心是 2） 1.99', '（真实是 0.12） 0.103'), c1);
    ok('w = 3: 2.66 from the centre, width 0.030, a quarter of the true 0.12', see('k-fast', 0, '宽度缩到 0.030，只有真实宽度 0.12 的四分之一') && has(c3, '（花瓣中心是 2） 2.66', '（真实是 0.12） 0.030') && near(0.030 / 0.12, 0.25, 1e-9), c3);
    ok('w = 5: 66% pushed off the petal; from 7 up not one is left', see('k-fast', 0, 'w = 5：66% 被推出了花瓣；到 7 以上，一个也不剩') && has(c5, '落在所有花瓣外 66%') && has(c7, '落在要求的花瓣上 0%', '落在所有花瓣外 100%') && has(c8, '落在要求的花瓣上 0%', '落在所有花瓣外 100%'), c5 + ' | ' + c7);
    await w.click('只要横竖四片', 300); const p6 = await at(6);
    ok('only the four on the axes, w = 6: 97% on them, sideways width only 0.009', see('k-fast', 0, '97% 落在这四片上', '宽度只有 0.009') && has(p6, '落在要求的花瓣上 97%', '（真实是 0.12） 0.009'), p6);
    KEEP.cfg = { c1, c5, c25: await (async () => { await w.click('只要右边那片', 300); return await at(2.5); })() };
    await at(1);
  }

  sec('step 11 · pol: regression, redraw every step, a chunk at a time');
  { const w = W('pol'); await w.show(); await p.waitForTimeout(800);
    // the action distribution at the start, with the interactive's own functions
    const A = await EV(() => { const K = GEN, Y0 = -2.3, Y1 = 2.3, LEN = Y1 - Y0, AMIN = 1.05, AMAX = 1.45, TAU = .3, GAIN = 1; const sOf = y => K.clamp((y - Y0) / LEN, 0, 1);
      function fam(f, x, y) { const s = sOf(y), sn = Math.sin(Math.PI * s), xa = f * AMIN * sn, xb = f * AMAX * sn, lo = Math.min(xa, xb), hi = Math.max(xa, xb), d = x < lo ? lo - x : x > hi ? x - hi : 0;
        const Am = sn > 1e-3 ? K.clamp(f * x / sn, AMIN, AMAX) : (AMIN + AMAX) / 2, cx = f * Am * sn; let tx = f * Am * Math.PI * Math.cos(Math.PI * s), ty = LEN; const l = Math.hypot(tx, ty); tx /= l; ty /= l; let ax = tx + GAIN * (cx - x), ay = ty; const m = Math.hypot(ax, ay); return { d, a: [ax / m, ay / m] } }
      const L = fam(-1, 0, Y0), R = fam(1, 0, Y0), lL = -L.d * L.d / (2 * TAU * TAU), lR = -R.d * R.d / (2 * TAU * TAU), mm = Math.max(lL, lR), a = Math.exp(lL - mm), b = Math.exp(lR - mm), wL = a / (a + b);
      return { wL, L: L.a, R: R.a, mean: [wL * L.a[0] + (1 - wL) * R.a[0], wL * L.a[1] + (1 - wL) * R.a[1]] } });
    ok('at the start: one arrow up-left, one up-right, 50% each; their average points straight up, at the obstacle', see('k-robot', 0, '一个指左上、一个指右上，各 50%', '笔直向上，正对着障碍物') && near(A.wL, 0.5, 1e-9) && A.L[0] < -0.3 && A.L[1] > 0.3 && A.R[0] > 0.3 && A.R[1] > 0.3 && Math.abs(A.mean[0]) < 1e-9 && A.mean[1] > 0.3, JSON.stringify(A));
    await w.click('回归', 300); await w.click('跑一次', 300); let m = ''; for (let k = 0; k < 100; k++) { m = await w.met(); if (/已经跑了 1/.test(m)) break; await p.waitForTimeout(150); } await p.waitForTimeout(600); m = await w.met(); const st = await w.status();
    ok('regression, one run: it crashes into the obstacle (0 / 1)', see('k-robot', 0, '一头撞上去（0 / 1 成功）') && has(m, '成功到达终点 0 / 1') && has(st, '撞上障碍物'), m);
    await w.click('生成：每步重新抽', 300); await w.click('连跑 20 次', 600); m = await w.met(); KEEP.polStep = m;
    ok('redraw every step, 20 runs: 20 / 20, 6.5 reversals on average, closest approach 0.33', see('k-robot', 0, '20 / 20 成功', '平均要左右改向 6.5 次', '平均只有 0.33') && has(m, '成功到达终点 20 / 20', '（平均） 0.33', '（平均几次） 6.5', '已经跑了 20'), m);
    await w.click('生成：一次抽一段', 300); await w.click('连跑 20 次', 600); m = await w.met(); const stc = await w.status();
    ok('a chunk at a time, 20 runs: 20 / 20, 0.3 reversals, closest approach 0.46; a chunk is 8 steps', see('k-robot', 0, '也是 20 / 20，改向降到平均 0.3 次', '（0.46）') && has(m, '成功到达终点 20 / 20', '（平均） 0.46', '（平均几次） 0.3') && has(stc, '动作块，8 步'), m);
  }

  sec('step 12 · sp: the map of methods');
  { const w = W('sp'); await w.show(); await p.waitForTimeout(600);
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp-g .spgr')].map(g => ({ h: g.querySelector('.spgh b').innerText.trim(), n: +g.querySelector('.spgh i').innerText, names: [...g.querySelectorAll('.spk')].map(b => b.firstChild.textContent), rel: [...g.querySelectorAll('.spk.rel')].map(b => b.firstChild.textContent) })));
    const detail = () => p.evaluate(() => { const d = document.getElementById('sp-d'); return d.hidden ? '' : d.innerText.replace(/\s+/g, ' '); });
    const tile = async name => { const r = await p.evaluate(nm => { const b = [...document.querySelectorAll('#sp-g .spk')].find(b => b.firstChild.textContent === nm); if (!b) return 'no'; b.click(); return 'ok'; }, name); if (r !== 'ok') { bad++; log.push('FAIL sp: no tile ' + name); } await p.waitForTimeout(300); };
    await w.click('家族', 300); const fam = await groups(); const famOf = {}; fam.forEach(g => g.names.forEach(nm => famOf[nm] = g.h)); const total = fam.reduce((s, g) => s + g.n, 0);
    const dif = fam.find(g => g.h === '扩散'), fmg = fam.find(g => g.h === 'Flow Matching');
    ok('by family: 9 groups, 64 methods in all; diffusion is the largest group, with 16', see('k-map', 0, '扩散那一组最大，有 16 种') && fam.length === 9 && total === 64 && dif.n === 16 && fam.every(g => g.n <= 16) && fam.every(g => g.n === g.names.length), fam.map(g => g.h + ' ' + g.n).join(', '));
    KEEP.total = total;
    await tile('DDPM'); const f2 = await groups(); const rel = [].concat(...f2.map(g => g.rel)); const d1 = await detail();
    ok('tap DDPM: DDIM and Score SDE get dashed boxes; the panel says DDIM is the same trained network with a deterministic sampler, a few dozen steps', see('k-map', 0, 'DDIM 和分数 SDE 都被虚线框了出来', '同一个训练好的网络，只是换了一种确定的采样，几十步就够') && rel.includes('DDIM') && rel.includes('分数 SDE（统一框架）') && has(d1, '同一个训练好的网络，换一种确定的采样，几十步就够'), rel.join());
    await tile('DDIM'); await tile('分数 SDE（统一框架）'); const d3 = await detail();
    ok('Score SDE: the unifying framework, DDPM and NCSN are two special cases of it', see('k-map', 0, 'DDPM 和 NCSN 是它的两个特例') && has(d3, 'DDPM 和 NCSN 是它的两个特例'), d3.slice(0, 120));
    await w.click('学的是什么', 400); const lr = await groups(); const field = lr.find(g => g.h.startsWith('一个场')), fn = lr.find(g => g.h === '一个从噪声到数据的函数'), sc = lr.find(g => g.h.startsWith('一个打分'));
    ok('what it learns: all 16 diffusion and all 8 flow-matching methods are in the "field" group (30 in all)', see('k-map', 0, '16 种扩散和 8 种 Flow Matching 全在"一个场"那一组（这组共 30 种）') && field.n === 30 && fmg.n === 8 && dif.names.every(nm => field.names.includes(nm)) && fmg.names.every(nm => field.names.includes(nm)), field.n);
    const gan = fam.find(g => g.h === '对抗');
    ok('the adversarial family is split: GAN, DCGAN, StyleGAN … under "a function from noise to data"; GAIL and AMP under "a rating"', see('k-map', 0, 'GAN、DCGAN、StyleGAN 这些在"一个从噪声到数据的函数"里', 'GAIL 和 AMP 在"一个打分"里') && ['生成对抗网络（GAN）', 'DCGAN', 'StyleGAN'].every(nm => fn.names.includes(nm)) && ['GAIL（对抗式模仿学习）', 'AMP（对抗运动先验）'].every(nm => sc.names.includes(nm)) && gan.names.every(nm => fn.names.includes(nm) || sc.names.includes(nm)), gan.names.join());
    await w.click('生成要几步', 400); const stg = await groups(); const one = stg.find(g => g.h === '一步');
    const dist = ['一致性模型', '对抗蒸馏（SDXL Turbo）', 'Consistency Policy'], avg = ['Shortcut 模型', 'MeanFlow'], nat = one.names.filter(nm => !dist.includes(nm) && !avg.includes(nm));
    ok('steps to generate: 22 one-step methods = 17 from the mixture, VAE, GAN and flow families + 3 distilled + 2 that learn an average velocity', see('k-map', 0, '"一步"那组有 22 种', '17 种', '一致性模型、对抗蒸馏、Consistency Policy', 'Shortcut 模型、MeanFlow') && one.n === 22 && dist.every(nm => one.names.includes(nm)) && avg.every(nm => one.names.includes(nm)) && nat.length === 17 && nat.every(nm => ['经典的密度模型', '变分自编码器', '对抗', '标准化流'].includes(famOf[nm])), nat.map(nm => famOf[nm]).join());
    await w.click('在机器人里干什么', 400); const rb = await groups(); const act = rb.find(g => g.h.startsWith('生成动作')); const fams = [...new Set(act.names.map(nm => famOf[nm]))], missing = fam.map(g => g.h).filter(h => !fams.includes(h));
    ok('in robots: 15 methods generate actions, from seven of the nine families (all but normalizing flows and adversarial)', see('k-map', 0, '"生成动作"那组有 15 种，九个家族里用到了七个，只缺标准化流和对抗') && act.n === 15 && fams.length === 7 && missing.sort().join() === ['对抗', '标准化流'].sort().join(), fams.join() + ' / missing ' + missing.join());
    await w.click('家族', 300);
  }

  // ------------------------------------------------------------------------------------------------------------
  // Part B: numbers quoted in the formula cards, the paragraphs and the figures. Each check requires the quoted
  // string to be in the page AND the recomputed value to agree with it.
  // ------------------------------------------------------------------------------------------------------------
  const TX = {}; for (const id of ['k-gen', 'k-mle', 'k-flow', 'k-vae', 'k-gan', 'k-ar', 'k-score', 'k-diff', 'k-fm', 'k-gauss', 'k-fast', 'k-robot', 'k-map', 'k-sum']) TX[id] = await secText(id);
  const HDR = norm(await p.evaluate(() => { document.querySelectorAll('header details').forEach(d => d.open = true); return document.querySelector('header').innerText; }));
  const SRC = await p.evaluate(() => [...document.scripts].map(s => s.textContent).join('\n'));
  const figText = (id, k) => p.evaluate(([id, k]) => { const f = document.querySelectorAll('#' + id + ' figure.fig')[k]; return [...f.querySelectorAll('svg text')].map(t => t.textContent).join(' | ') + ' ## ' + f.querySelector('figcaption').innerText; }, [id, k]).then(norm);

  sec('the flower (notation table) and step 0');
  { const Fl = await EV(() => { const K = GEN; const P = K.sampleMix(K.FLOWER, 100000, K.rng(5)).P; let r2 = 0; for (let i = 0; i < 100000; i++) r2 += (P[2 * i] ** 2 + P[2 * i + 1] ** 2) / 100000;
      return { n: K.FLOWER.length, w: K.FLOWER.map(c => c.w), r: K.FLOWER.map(c => Math.hypot(c.m[0], c.m[1])), sd: K.FLOWER.map(c => { const tr = c.S[0] + c.S[2], dt = c.S[0] * c.S[2] - c.S[1] * c.S[1], d = Math.sqrt(Math.max(0, tr * tr / 4 - dt)); return [Math.sqrt(tr / 2 + d), Math.sqrt(tr / 2 - d)]; }), on: K.onPetals(P, 100000), r2, L: K.L }; });
    ok('the flower: 8 petals, each with probability 1/8, centres 2 from the origin, standard deviations 0.42 along and 0.12 across', has(HDR, '中心离原点 2，沿半径方向的标准差 0.42，横着的标准差 0.12', '每片的概率都是 1/8') && Fl.n === 8 && Fl.w.every(v => near(v, 1 / 8, 1e-12)) && Fl.r.every(v => near(v, 2, 1e-9)) && Fl.sd.every(v => near(v[0], 0.42, 1e-9) && near(v[1], 0.12, 1e-9)), JSON.stringify(Fl.sd[1]));
    ok('"on a petal" = within 2.5 standard deviations: about 96% of true samples (1 - exp(-2.5²/2) = 95.6%; 100 000 samples of the engine: 95.6%)', has(HDR, '2.5 倍标准差的椭圆以内', '约 96% 在花瓣上') && near(1 - Math.exp(-2.5 * 2.5 / 2), 0.956, 0.001) && near(Fl.on, 0.956, 0.004), Fl.on);
    KEEP.r2 = Fl.r2; KEEP.L = Fl.L;
    ok('a 64 × 64 colour image is 64 × 64 × 3 = 12288 numbers', has(TX['k-gen'], '64 × 64 × 3 = 12288 个数') && 64 * 64 * 3 === 12288);
    const w = W('what'); await w.show(); await w.click('乱撒', 400); const st = await w.status();
    ok('the petals cover about 15% of the box (8 ellipses with half-axes 2.5 × 0.42 and 2.5 × 0.12 in a box of side 7.2)', has(st, '花瓣只占方框的约 15%') && near(8 * Math.PI * (2.5 * 0.42) * (2.5 * 0.12) / (2 * Fl.L) ** 2, 0.153, 0.002) && near(2 * Fl.L, 7.2, 1e-9), st.slice(0, 60));
    await w.click('抽新的', 300);
  }

  sec('step 1 · text and figure');
  { ok('the covariance of one Gaussian over 12288 numbers has 12288² ≈ 1.5 亿 entries', has(TX['k-mle'], '12288² ≈ 1.5 亿个数') && near(12288 * 12288 / 1e8, 1.5, 0.02), 12288 * 12288);
    const stuck = KEEP.mle.R8.filter(v => v <= -2.3 && v >= -2.4).length;
    ok('card: one Gaussian about -3.57 on the test set; 8 Gaussians about -2.06 from a good start (from another start often only about -2.3); the true distribution -1.94', has(TX['k-mle'], '平均 log p 约 -3.57', '约 -2.06（换个起点，常常只到 -2.3 左右）', '真分布本身是 -1.94') && KEEP.mle.g1 === -3.57 && KEEP.mle.k8 === -2.06 && stuck >= 3, KEEP.mle.R8.join());
    ok('a difference of 1 in log p is a factor e ≈ 2.7 in density', has(TX['k-mle'], '概率密度就差 e ≈ 2.7 倍') && near(Math.E, 2.7, 0.02));
    // figure F1: the same 8 training points, 6 test points and three models as in the drawing
    const TR = [-1.55, -1.30, -1.15, -0.90, 0.85, 1.10, 1.30, 1.60], TE = [-1.62, -1.22, -0.85, 0.78, 1.22, 1.68];
    const npdf = (x, m, s) => Math.exp(-.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)), mean = a => a.reduce((p, q) => p + q, 0) / a.length, sd = a => { const u = mean(a); return Math.sqrt(mean(a.map(v => (v - u) ** 2))); };
    const Lp = TR.filter(x => x < 0), Rp = TR.filter(x => x > 0);
    const models = [x => npdf(x, mean(TR), sd(TR)), x => .5 * npdf(x, mean(Lp), sd(Lp)) + .5 * npdf(x, mean(Rp), sd(Rp)), x => mean(TR.map(t => npdf(x, t, 0.02)))];
    const sc = models.map(f => [mean(TR.map(x => Math.log(f(x)))), mean(TE.map(x => Math.log(f(x))))]); const f1 = await figText('k-mle', 0);
    const fm2 = v => (v < 0 ? '-' : '+') + Math.abs(v).toFixed(2);
    ok('figure 1: training / test scores of the three one-dimensional fits: -1.64 / -1.66, -0.74 / -1.14, +0.91 / -5.31', has(f1, '训练分 -1.64', '测试分 -1.66', '训练分 -0.74', '测试分 -1.14', '训练分 +0.91', '测试分 -5.31', '8 个训练点、6 个测试点', '宽 0.02') && sc.map(s => fm2(s[0]) + '/' + fm2(s[1])).join(' ') === '-1.64/-1.66 -0.74/-1.14 +0.91/-5.31', sc.map(s => fm2(s[0]) + '/' + fm2(s[1])).join(' '));
    // the area under each of the three curves is 1 (numerical integral over [-6, 6])
    const areas = models.map(f => { let a = 0; for (let i = 0; i < 120000; i++) a += f(-6 + (i + .5) * 1e-4) * 1e-4; return a; });
    ok('figure 1: the area under each of the three curves is 1', has(f1, '三条曲线下面的面积都是 1') && areas.every(a => near(a, 1, 1e-3)), areas.map(a => a.toFixed(4)).join());
    ok('summary quiz: memorising drops the test score from about -2 to below -80', has(TX['k-sum'], '从 -2 左右掉到 -80 以下') && near(KEEP.mle.k8, -2, 0.1) && KEEP.mle.kde[1] < -80, KEEP.mle.kde.join());
  }

  sec('step 2 · text');
  { const H = KEEP.cdf;
    ok('card: at z = 0 the stretch is 0.48 and the density goes from 0.40 to 0.40 ÷ 0.48 ≈ 0.83; near z = -0.32 a sliver of z is stretched about 70-fold', has(TX['k-flow'], '拉伸倍数只有 0.48：密度从 pZ = 0.40 变成 pX = 0.40 ÷ 0.48 ≈ 0.83', 'z = -0.32 附近，一小段 z 被拉长了 70 倍左右') && near(H.s0, 0.48, 0.005) && near(H.p0[0], 0.40, 0.005) && near(H.p0[1], 0.83, 0.005) && near(H.s32, 70, 2), JSON.stringify([H.s0, H.p0, H.s32]));
    ok('card: 10 layers, each with a two-layer network of 32 units for s and t: 10 × (64 + 1056 + 66) = 11 860 parameters; test score -2.27 against -2.06', has(TX['k-flow'], '10 层', '每层 32 个神经元的小网络给出，一共 11 860 个参数', '平均 log p 是 -2.27', '8 个高斯（-2.06）') && 10 * ((1 * 32 + 32) + (32 * 32 + 32) + (32 * 2 + 2)) === 11860 && KEEP.nf.par && KEEP.nf.test === -2.27 && KEEP.nf.best8 === -2.06 && KEEP.mle.k8 === -2.06, JSON.stringify(KEEP.nf));
  }

  sec('step 3 · text');
  { ok('card: training minimises squared error + β × KL with β = 2σ²; at β = 0.3 the readout σ is 0.39, the KL about 2.5 and the reconstruction error about 0.23', has(TX['k-vae'], 'β = 2σ²', 'β = 0.3 时，KL 约 2.5，测试集上的均方重建误差约 0.23') && near(Math.sqrt(0.3 / 2), KEEP.vae.sx3, 0.005) && near(KEEP.vae.kl3, 2.5, 0.05) && near(KEEP.vae.rec3, 0.23, 0.005), JSON.stringify(KEEP.vae));
    ok('card: at β = 10 the KL drops to 0 and the reconstruction error is about 4.1, close to the mean squared distance of the data from the centre, about 4.2 (2² + 0.42² + 0.12² = 4.19; 100 000 samples: 4.19)', has(TX['k-vae'], 'β = 10 时，KL 降到 0，重建误差约 4.1', '平均平方距离约 4.2') && KEEP.vae.kl10 === 0 && near(KEEP.vae.rec10, 4.1, 0.05) && near(4 + 0.42 ** 2 + 0.12 ** 2, 4.19, 0.005) && near(KEEP.r2, 4.19, 0.03), KEEP.r2);
    ok('Stable Diffusion compresses an image to 1/48: 512 × 512 × 3 numbers into 64 × 64 × 4', has(TX['k-vae'], '压缩到原来的 1/48') && 512 * 512 * 3 / (64 * 64 * 4) === 48);
  }

  sec('step 4 · the legend against the interactive’s own code');
  { ok('learning rates 0.001 / 0.001 (matched), 0.005 / 0.0005 (impatient, with and without pairs); batches of 128; two layers of 32 units', has(TX['k-gan'], '两个网络的学习率都是 0.001', '生成器 0.005，判别器 0.0005', '每步用 128 个真数据和 128 个生成样本', '两层、每层 32 个神经元') && has(SRC, 'even:{lg:1e-3,ld:1e-3,pk:1},fast:{lg:5e-3,ld:5e-4,pk:1},pack:{lg:5e-3,ld:5e-4,pk:2}', 'SHOW=300,B=128', "K.mlp([2,32,32,2],'leaky',r)", "K.mlp([2*o.pk,32,32,1],'leaky',r)"));
  }

  sec('step 5 · text');
  { ok('card: the classification head puts 96% of the samples on a petal, the Gaussian head only about 45%', has(TX['k-ar'], '前者 96% 的样本落在花瓣上，后者只有 45% 左右') && near(KEEP.arCat, 96, 1) && near(KEEP.arGauss, 45, 2), KEEP.arCat + ' / ' + KEEP.arGauss);
    ok('the plane is cut into 48 × 48 cells', has(TX['k-ar'], '平面被切成 48 × 48 个格子') && has(SRC, 'const NB=48,LIM=K.L'));
  }

  sec('step 6 · text');
  { ok('card: step size η = 0.003, so each step’s random jiggle is about √0.003 ≈ 0.055, against a petal’s sideways 0.12', has(TX['k-score'], '步长 η = 0.003', '√0.003 ≈ 0.055', '横着的标准差是 0.12') && near(Math.sqrt(0.003), 0.055, 0.0005) && has(SRC, 'NP=400,TPL=60,EPS=.003'));
    ok('card: with σ = 0.1 the target -ε/σ has length about |ε|/σ ≈ 10', has(TX['k-score'], 'σ = 0.1', '长度约 |ε|/σ ≈ 10') && near(1 / 0.1, 10, 1e-9));
    ok('legend: 10 noise levels from 3 to 0.1; 600 Langevin steps at the smallest, or 60 at each of the 10 levels; 400 particles', has(TX['k-score'], '从 3 到 0.1，共 10 级', '跑 600 步朗之万', '10 个噪声级别各跑 60 步', '400 个橙色粒子') && has(SRC, 'for(let i=0;i<10;i++)SIG.push(3*Math.pow(.1/3,i/9))') && 10 * 60 === 600);
  }

  sec('step 7 · text');
  { ok('card: at σ = 0.6, α = 0.8, and a point 2 from the centre is shrunk to 1.6; it corresponds to 0.75 in the notation of step 6', has(TX['k-diff'], 'σ = 0.6 时 α = 0.8：一个离花心 2 的点被缩到 1.6', '这里 σ = 0.6 对应那里的 0.75') && near(Math.sqrt(1 - 0.36), 0.8, 1e-12) && near(2 * 0.8, 1.6, 1e-12) && near(0.6 / 0.8, 0.75, 1e-12));
    ok('card: 1 step 0% on a petal, 3 steps about 50%, 10 steps about 94%', has(TX['k-diff'], '1 步 0% 落在花瓣上，3 步约 50%，10 步约 94%') && near(KEEP.dif.n3.on, 50, 1.5) && KEEP.dif.n10.on === 94);
    // Tweedie's formula with the engine's own posterior mean and score, at a few points and noise levels
    const Tw = await EV(() => { const K = GEN; let worst = 0; for (const [s, x, y] of [[0.3, 1.2, 0.4], [0.6, -0.5, 1.7], [0.9, 0.3, -0.2]]) { const a = Math.sqrt(1 - s * s), q = K.post(K.NZ(K.FLOWER, a, s), a, x, y); worst = Math.max(worst, Math.hypot(q.mean[0] - (x + s * s * q.score[0]) / a, q.mean[1] - (y + s * s * q.score[1]) / a)) } return worst; });
    ok('card: Tweedie’s formula E[x | xσ] = (xσ + σ² ∇log pσ) ÷ α holds for the engine’s denoiser and score (three test points)', has(TX['k-diff'], 'E[x | xσ] = ( xσ + σ² · ∇log pσ(xσ) ) ÷ α') && Tw < 1e-9, Tw);
    ok('the first step: every point first moves in a little towards the centre (all 400 at 10 steps, same loop as the interactive)', has(TX['k-diff'], '第一步，所有点都先往花心那边缩一点') && KEEP.dif.n10.inward === 400 && KEEP.dif.d100.inward === 400, KEEP.dif.n10.inward);
    ok('legend: noise levels σ = sin(90° × u); step counts 1, 2, 3, 5, 10, 20, 50, 100', has(TX['k-diff'], 'σ = sin(90° × u)', '1、2、3、5、10、20、50、100') && has(SRC, 'const NS=[1,2,3,5,10,20,50,100],NP=400,NTR=60', 'sigOf=u=>Math.sin(Math.PI/2*u)'));
    const f6 = await p.evaluate(() => { const f = [...document.querySelectorAll('#k-diff figure.fig')].pop(); return { dots: f.querySelectorAll('svg circle').length, cap: f.querySelector('figcaption').innerText }; });
    ok('figure (the two directions): 72 points per panel, 8 petals × 9 (5 panels, at most 360 dots)', has(norm(f6.cap), '72 个点') && 8 * 9 === 72 && f6.dots > 4 * 72 - 20 && f6.dots <= 360, f6.dots);
  }

  sec('step 8 · text');
  { ok('card: the route is about 1.5 times the straight distance; diffusion 1.18 times, flow matching 1.54 times', has(TX['k-fm'], '直线距离的 1.5 倍左右', '扩散的路程是直线距离的 1.18 倍，Flow Matching 反而是 1.54 倍') && KEEP.fmRead.ratio === 1.54 && KEEP.fmRead.vp === 1.18, JSON.stringify(KEEP.fmRead));
    ok('reflow: one step puts about three quarters on a petal (the original: 0); 64 steps only 86% against the original’s 94%', has(TX['k-fm'], '约四分之三的样本落在花瓣上，而原版走 1 步是 0', '拉直以后走 64 步也只有 86% 落在花瓣上，原版是 94%') && near(KEEP.fmRead.rf1, 75, 2) && KEEP.fmRead.fm1 === 0 && KEEP.fmRead.rf64 === 86 && KEEP.fmRead.fm64 === 94, JSON.stringify(KEEP.fmRead));
    // x_t / t = x + ((1 - t)/t) z, and v = (D - x_t)/(1 - t) with D the best denoiser: checked with the engine's velocity and posterior mean
    const Vd = await EV(() => { const K = GEN; let worst = 0; for (const [t, x, y] of [[0.3, 0.4, -0.6], [0.6, 0.9, 0.5], [0.85, -1.4, 1.1]]) { const v = K.vel(K.FLOWER, t, x, y), D = K.post(K.NZ(K.FLOWER, 1, (1 - t) / t), 1, x / t, y / t).mean; worst = Math.max(worst, Math.hypot(v[0] - (D[0] - x) / (1 - t), v[1] - (D[1] - y) / (1 - t))) } return worst; });
    ok('the line is a diffusion path in other units: σ = (1 - t) ÷ t, and v = (D - xt) ÷ (1 - t) holds for the engine’s velocity and denoiser (three test points)', has(TX['k-fm'], 'xt ÷ t = x + ((1 - t) ÷ t) · z', 'σ = (1 - t) ÷ t', 'v = (D - xt) ÷ (1 - t)') && Vd < 1e-9, Vd);
    ok('summary quiz: the route is about 1.5 times the straight distance', has(TX['k-sum'], '路程约是直线距离的 1.5 倍') && near(KEEP.fmRead.ratio, 1.5, 0.05));
  }

  sec('step 9 · text and figure');
  { // the distance of a standard Gaussian sample from the centre in d = 10 000 dimensions: density ∝ r^(d-1) exp(-r²/2), integrated numerically on [90, 110]
    const d = 10000, rs = Math.sqrt(d - 1), f = r => Math.exp((d - 1) * (Math.log(r) - Math.log(rs)) - (r * r - rs * rs) / 2); let z = 0, m1 = 0, m2 = 0, mid = 0; const h = 1e-3;
    for (let r = 90 + h / 2; r < 110; r += h) { const v = f(r) * h; z += v; m1 += v * r; m2 += v * r * r; if (r > 98 && r < 102) mid += v; } m1 /= z; const sd = Math.sqrt(m2 / z - m1 * m1); mid /= z;
    ok('in 10 000 dimensions: samples are about 100 from the centre, give or take about 0.7, and more than 99% lie between 98 and 102', has(TX['k-gauss'], 'd = 10000 时，样本离中心都是 100 左右，上下一般只差 0.7 左右，99% 以上在 98 到 102 之间') && near(m1, 100, 0.01) && near(sd, 0.707, 0.002) && mid > 0.99 && mid < 0.999, [m1.toFixed(3), sd.toFixed(4), mid.toFixed(4)].join());
    const f8 = await figText('k-gauss', 0);
    ok('figure (distance from the centre): at d = 10 000 the radius is 100, give or take about 0.7', has(f8, 'd = 10 000', '半径是 100，上下只差 0.7 左右') && near(m1, 100, 0.01) && near(sd, 0.7, 0.01));
    ok('a rough answer: about two thirds on a petal with 1 step and nearly nine tenths with 2; from a Gaussian it takes about 8 steps to get there', has(TX['k-gauss'], '1 步就有约三分之二、2 步就有近九成落在花瓣上；从高斯出发，要 8 步左右才到这个水平') && near(KEEP.src.r1, 66.7, 3) && near(KEEP.src.r2, 90, 1) && KEEP.src.g8 >= KEEP.src.r2, JSON.stringify(KEEP.src));
    ok('legend: a uniform square of side 3.6 made of 36 small Gaussians; a rough answer = a data point plus noise of standard deviation 0.6; step counts 1 … 64', has(TX['k-gauss'], '边长 3.6，这里用 36 个小高斯', '标准差 0.6 的噪声', '1、2、4、8、16、32、64') && has(SRC, 'NS=[1,2,4,8,16,32,64],NP=300,NTR=50,SP=.6', 'const h=1.8,n=6') && near(2 * 1.8, 3.6, 1e-12) && 6 * 6 === 36);
  }

  sec('step 10 · text');
  { ok('a 512 × 512 colour image is more than 780 thousand numbers; a 64 × 64 × 4 latent is about 16 thousand', has(TX['k-fast'], '512 × 512 的彩色图有 78 万多个数', '64 × 64 × 4', '1.6 万个数') && 512 * 512 * 3 === 786432 && 64 * 64 * 4 === 16384);
    const c = KEEP.cfg;
    ok('card: w = 1: 96% on the petal, width 0.10 (true 0.12); w = 2.5: width 0.04, 2.55 from the centre; w = 5: about two thirds pushed off', has(TX['k-fast'], 'w = 1 时，96% 落在这片花瓣上，横着的宽度 0.10（真实是 0.12）', 'w = 2.5 时，宽度只剩 0.04，样本挤到花瓣的外端（离花心 2.55）', 'w = 5 时，约三分之二被推出了花瓣') && has(c.c1, '落在要求的花瓣上 96%') && near(num(c.c1, /（真实是 0\.12） (-?[\d.]+)/), 0.10, 0.005) && near(num(c.c25, /（真实是 0\.12） (-?[\d.]+)/), 0.04, 0.005) && has(c.c25, '（花瓣中心是 2） 2.55') && near(pct(c.c5, '落在所有花瓣外'), 66.7, 2), c.c25);
    ok('legend: 40 steps, 400 samples', has(TX['k-fast'], '走 40 步') && has(SRC, 'const NP=400,NSTEP=40,NTR=40'));
  }

  sec('step 11 · text and figure');
  { const f10 = await figText('k-robot', 0);
    ok('card and figure agree on the Diffusion Policy setup they quote: generate 16 time steps, execute the first 8; π0: 50 time steps at up to 50 per second = one second', has(TX['k-robot'], '一次生成未来 16 个时刻的动作，执行前 8 个就重新看、重新生成', '一次生成未来 50 个时刻的动作，控制频率最高每秒 50 次，一段相当于一秒钟') && has(f10, '执行前 8 步', '后 8 步作废', '生成接下来 16 步', '一次生成接下来 16 个时刻的动作；只执行前 8 个') && 50 / 50 === 1 && 16 - 8 === 8);
    ok('legend: 16 demonstrations, 8 on each side; a chunk is 8 steps', has(TX['k-robot'], '16 条示范，左右各 8 条', '接下来 8 步都按那一边走') && has(SRC, 'DT=.05,TAU=.3,GAIN=1,H=8,NOISE=.05', 'for(const f of[-1,1])for(let j=0;j<8;j++)') && has(KEEP.polStep, '已经跑了 20'));
  }

  sec('step 12 · text');
  { ok('the map holds 64 methods', has(TX['k-map'], '这张图收了 64 种方法') && KEEP.total === 64, KEEP.total); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
