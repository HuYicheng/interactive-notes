// Check the numbers quoted in the text of "Try It in Your Head" (world-models/index.html) against the page itself.
// It opens the page in a headless browser, operates the interactives the way a reader would, and compares the
// readouts with the numbers the text quotes.
//   usage: node check.js /absolute/path/to/world-models/index.html
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/world-models/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(600);
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined ? '   [' + got + ']' : '')); };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'start' }), id); await p.waitForTimeout(700); },
    click: async (label, wait) => { const r = await p.evaluate(([i, l]) => { const bt = [...document.getElementById(i).querySelectorAll('button')].find(x => x.innerText.replace(/\s+/g, ' ').trim().startsWith(l)); if (!bt || bt.disabled) return false; bt.click(); return true }, [id, label]); if (!r) { ok(id + ': button "' + label + '" exists', false); } await p.waitForTimeout(wait || 350); },
    set: async (inp, v, wait) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(wait || 350); },
    met: () => p.evaluate(i => { const m = document.querySelector('#' + i + ' .met'); return m ? m.innerText.replace(/\s+/g, ' ') : '' }, id),
    status: () => p.evaluate(i => { const m = document.querySelector('#' + i + ' .status'); return m ? m.innerText.replace(/\s+/g, ' ') : '' }, id),
    text: sel => p.evaluate(s => { const m = document.querySelector(s); return m ? m.innerText.replace(/\s+/g, ' ') : '' }, sel),
  });
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/\s/g, '')) : NaN; };

  // ---- step 0: plan a push in your head (four layouts)
  { const w = W('try'); await w.show(); const real = [], diff = [];
    for (let k = 0; k < 4; k++) { if (k) await w.click('换一个局面', 700); await w.click('让它自己想 160 种', 2600); await w.click('真的推', 3600); const m = await w.met(); real.push(num(m, /真实：圆盘最后离目标 ([\d.]+) cm/)); diff.push(num(m, /想象和真实差 ([\d.]+) cm/)); }
    ok('try: real final distance 3.1 to 6.0 cm in the four layouts', near(Math.min(...real), 3.1, .05) && near(Math.max(...real), 6.0, .05), real.join(' '));
    ok('try: all four end inside the ring (< 7 cm)', real.every(v => v < 7), real.join(' '));
    ok('try: imagined vs real stopping point differ by 0.9 to 3.3 cm', near(Math.min(...diff), 0.9, .05) && near(Math.max(...diff), 3.3, .05), diff.join(' ')); }

  // ---- step 1: rolling the model out
  { const w = W('roll'); await w.show();
    const rd = async () => { const m = await w.met(); return { one: num(m, /一步的误差（24 段平均） ([\d.]+) mm/), avg: num(m, /24 段平均 ([\d.]+) cm/), par: num(m, /模型参数 ([\d\s]+)/) }; };
    await w.click('1 万步'); await w.click('一直用自己的预测'); await w.set('roll-k', 10); let r = await rd();
    ok('roll 10 000: one-step error 1.9 mm', near(r.one, 1.9, .01), r.one); ok('roll 10 000: 10 steps 1.1 cm', near(r.avg, 1.1, .01), r.avg); ok('roll: 5 124 parameters', r.par === 5124, r.par);
    await w.set('roll-k', 50); r = await rd(); ok('roll 10 000: 50 steps 14.1 cm', near(r.avg, 14.1, .01), r.avg); ok('roll: status says 73 times', /73 倍/.test(await w.status()), (await w.status()).slice(-40));
    await w.click('每步从真实状态出发'); r = await rd(); ok('roll 10 000, restart each step: stays near 2 mm at step 50', r.avg <= 0.25, r.avg); ok('roll: status says 1.9 mm', /1\.9 mm/.test(await w.status()));
    await w.click('一直用自己的预测'); await w.click('1000 步'); await w.set('roll-k', 10); r = await rd(); ok('roll 1 000: one-step 4.2 mm', near(r.one, 4.2, .01), r.one); ok('roll 1 000: 10 steps 7.1 cm', near(r.avg, 7.1, .01), r.avg);
    await w.set('roll-k', 50); r = await rd(); ok('roll 1 000: 50 steps 28.3 cm', near(r.avg, 28.3, .01), r.avg);
    await w.click('10 万步'); await w.set('roll-k', 10); r = await rd(); ok('roll 100 000: one-step 1.4 mm', near(r.one, 1.4, .01), r.one); ok('roll 100 000: 10 steps about 0.55 cm', near(r.avg, 0.55, .06), r.avg);
    await w.set('roll-k', 50); r = await rd(); ok('roll 100 000: 50 steps about 14 cm', near(r.avg, 13.9, .11), r.avg); await w.click('1 万步'); }

  // ---- step 1: where the error grows, and the unstable push (computed with the page's own world and models)
  { const html = fs.readFileSync(file, 'utf8'); const m = html.match(/const D=(\{"s0"[\s\S]*?\});\nconst KEYS/); const D = JSON.parse(m[1]);
    const r = await p.evaluate((D) => { const K = WM, T = 50, R0 = K.RP + K.RB, net = K.unq(P8M.dyn['10000']); let nt = 0, it = 0, tot = 0, N = 0, e50 = 0;
      D.s0.forEach((s0, e) => { const R = [Float64Array.from(s0)], I = [Float64Array.from(s0)]; for (let t = 0; t < T; t++) { R.push(K.step(R[t], D.a[e][2 * t], D.a[e][2 * t + 1])); I.push(K.mstep(net, I[t], D.a[e][2 * t], D.a[e][2 * t + 1])); }
        let prev = 0; for (let t = 1; t <= T; t++) { const er = Math.hypot(I[t][2] - R[t][2], I[t][3] - R[t][3]), inc = er - prev; prev = er; N++; tot += inc; if (Math.hypot(R[t][0] - R[t][2], R[t][1] - R[t][3]) < R0 + 1e-3) { nt++; it += inc; } } e50 += prev; });
      function push(delta) { const s = new Float64Array([0.20 - (K.RP + K.RB + 0.004), 0.5 + delta, 0.20, 0.5, 0, 0]), y = []; for (let t = 0; t < 36; t++) { K.step(s, t < 20 ? 1 : 0, 0, s); y.push(s[3]); } return y; }
      const a = push(0), c = push(0.001);
      return { touchShare: nt / N, growthShare: it / tot, e50: e50 / D.s0.length, lat: [8, 12, 16, 20].map(t => 1000 * (a[t - 1] - c[t - 1])), end: 100 * (a[35] - c[35]), factor: 1 + K.VMAX * K.DT / (K.RP + K.RB) }; }, D);
    ok('roll: the script reproduces 14.1 cm at step 50', near(100 * r.e50, 14.1, .05), (100 * r.e50).toFixed(2));
    ok('roll: finger touches the puck in 36% of the steps', near(100 * r.touchShare, 36, .5), (100 * r.touchShare).toFixed(1));
    ok('roll: those steps carry 67% of the error growth', near(100 * r.growthShare, 67, .6), (100 * r.growthShare).toFixed(1));
    ok('push 1 mm off centre: sideways 4.2, 10.4, 23.9, 51.2 mm at steps 8, 12, 16, 20', near(r.lat[0], 4.2, .06) && near(r.lat[1], 10.4, .06) && near(r.lat[2], 23.9, .06) && near(r.lat[3], 51.2, .06), r.lat.map(v => v.toFixed(2)).join(' '));
    ok('push 1 mm off centre: ends 6.4 cm off sideways', near(r.end, 6.4, .01), r.end.toFixed(2)); ok('1 + d/R = 1.23', near(r.factor, 1.23, .005), r.factor.toFixed(3)); }

  // ---- step 2: the ensemble (opening state)
  { const w = W('ens'); await w.show(); await p.waitForTimeout(1800); let m = await w.met();
    ok('ens: one model picks 0.97', near(num(m, /力度 ([\d.]+)/), 0.97, .001), m.slice(0, 60)); ok('ens: guesses range 12.3 to 22.1 cm', /12\.3 – 22\.1 cm/.test(m));
    await w.click('五个取平均'); m = await w.met(); ok('ens: mean of five picks 0.93', near(num(m, /力度 ([\d.]+)/), 0.93, .001));
    await w.click('五个，乐观'); m = await w.met(); ok('ens: optimistic picks 0.94', near(num(m, /力度 ([\d.]+)/), 0.94, .001));
    await w.click('五个，悲观'); m = await w.met(); ok('ens: pessimistic picks 0.93', near(num(m, /力度 ([\d.]+)/), 0.93, .001));
    await w.click('试一次', 1500); m = await w.met(); ok('ens: a real push at 0.93 slides 17.0 cm', /上次滑了 17\.0 cm/.test(m), m.slice(-30));
    await w.click('从头再来', 800); await w.set('ens-g', 24); for (let k = 0; k < 2; k++) await w.click('试一次', 900); const s = await w.status(); ok('ens: 24 cm is out of reach, full strength gives 18.3 cm', /18\.3 cm/.test(s), s.slice(0, 40)); await w.set('ens-g', 16); }

  // ---- step 3: blur
  { const w = W('blur'); await w.show(); await w.set('blur-t', 5); let m = await w.met();
    ok('blur frame 5: 1 – 25 cm, errors 28.2 and 56.3', /1 – 25 cm/.test(m) && /糊的 28\.2/.test(m) && /抽样 56\.3/.test(m), m);
    await w.set('blur-t', 8); m = await w.met(); ok('blur frame 8: 11 – 19 cm, errors 5.4 and 10.9', /11 – 19 cm/.test(m) && /糊的 5\.4/.test(m) && /抽样 10\.9/.test(m), m);
    await w.set('blur-t', 10); m = await w.met(); ok('blur frame 10: 13 – 16 cm', /13 – 16 cm/.test(m), m); await w.set('blur-t', 5); }

  // ---- step 4: what the latent keeps; collapse
  { const w = W('lat'); await w.show(); await w.click('没有背景', 900); ok('lat no background: value keeps 53% of the puck', /53%/.test(await w.status()));
    await w.click('闪烁的背景'); await w.set('lat-b', 1.0, 900); ok('lat flicker 1.0: redraw keeps 34%', /只剩 34%/.test(await w.status()), (await w.status()).slice(0, 50));
    await w.set('lat-b', 1.2, 900); ok('lat flicker 1.2: redraw keeps 1%', /只剩 1%/.test(await w.status()));
    await w.click('漂移的背景', 900); ok('lat drifting: predict-next keeps 42%', /圆盘只剩 42%/.test(await w.status())); await w.click('闪烁的背景'); await w.set('lat-b', 1.8); }
  { const w = W('col'); await w.show(); const rd = async () => { const m = await w.met(); return { e: num(m, /预测误差 ([\d.e−\-]+)/i), s: num(m, /散开程度 ([\d.]+)/), raw: m }; };
    await w.click('只要预测准', 9000); let r = await rd(); ok('col prediction only: spread about 0.01', r.s < 0.02, r.raw);
    await w.click('+ 保持散开', 9000); r = await rd(); ok('col + keep spread: error about 0.0004, spread about 1', near(r.e, 0.0004, 0.0002) && near(r.s, 1, .1), r.raw);
    await w.click('+ 也预测价值', 9000); r = await rd(); ok('col + value: error about 0.0008, spread about 0.28', near(r.e, 0.0008, 0.0003) && near(r.s, 0.28, .03), r.raw); }

  // ---- step 5: three ways to use the model
  { const w = W('use'); await w.show(); const g = async () => await w.met();
    await w.click('10 万步'); await w.click('边想边做'); let m = await g(); ok('use MPC: 768 calls, 98.5%', /调用模型 768/.test(m) && /推进去 98\.5%/.test(m), m);
    await w.click('往前搜'); m = await g(); ok('use tree: 216 calls, 93.5%', /调用模型 216/.test(m) && /推进去 93\.5%/.test(m), m);
    await w.click('先在想象里练'); m = await g(); ok('use policy: 97.5% real, 99.5% in the model', /推进去 97\.5%/.test(m) && /推进去 99\.5%/.test(m), m);
    await w.click('1000 步'); m = await g(); ok('use policy, 1 000-step model: 4.5% real, 27% in the model', /推进去 4\.5%/.test(m) && /推进去 27%/.test(m), m);
    await w.click('边想边做'); m = await g(); ok('use MPC, 1 000-step model: 11%', /推进去 11%/.test(m), m);
    await w.click('往前搜'); m = await g(); ok('use tree, 1 000-step model: 22.5%', /推进去 22\.5%/.test(m), m); await w.click('10 万步'); await w.click('边想边做'); }

  // ---- step 6: dreaming video models (first clip)
  { const w = W('drift'); await w.show(); await w.click('从真实画面重新开始', 3600); const m = await w.met();
    const mm = m.match(/普通训练.*?） (\d+)% \/ (\d+)%.*?加噪训练.*?） (\d+)% \/ (\d+)%/); const v = mm ? mm.slice(1).map(Number) : [];
    ok('drift: after twenty-odd steps the plain dream has several fingers (> 250%)', v[1] > 250, m); ok('drift: the noise-augmented dream stays within 85% to 135%', v[2] >= 85 && v[2] <= 135 && v[3] >= 85 && v[3] <= 135, v.join(' ')); await w.click('暂停'); }

  // ---- step 7: counterfactual tests
  { const w = W('cf'); await w.show(); await w.click('不看动作'); await w.click('桌子中间', 900); let m = await w.met(); ok('cf action-blind: 0 against 61 cm', /0 \/ 61 cm/.test(m), m);
    await w.click('没见过桌边'); await w.click('贴着墙', 900); m = await w.met(); ok('cf never saw the rim, against the wall: 29 cm through', /穿出桌边 29 cm/.test(m), m);
    await w.click('都见过', 900); m = await w.met(); ok('cf saw it all, against the wall: 5 cm through', /穿出桌边 5 cm/.test(m), m); await w.click('桌子中间'); }

  // ---- step 8: ranking policies
  { const w = W('eval'); await w.show(); await p.waitForTimeout(2500); const rd = async () => { const m = await w.met(); return { rho: num(m, /完全一致） ([\d.]+)/), m }; };
    await w.click('10 万步', 2500); let r = await rd(); ok('eval 100 000: rank correlation 0.98, policy 8 is 98% / 82%', near(r.rho, 0.98, .001) && /98% \/ 82%/.test(r.m), r.m);
    const tb = await w.text('#eval-t'); ok('eval: score table lists 8 policies', (tb.match(/%（\d）/g) || []).length === 16, tb.slice(0, 80));
    await w.click('1 万步', 2500); r = await rd(); ok('eval 10 000: rank correlation 0.99, policy 8 is 57% / 82%', near(r.rho, 0.99, .001) && /57% \/ 82%/.test(r.m), r.m);
    await w.click('1000 步', 2500); r = await rd(); ok('eval 1 000: rank correlation 0.68; picks policy 7, real rank 2; policy 8 is 8% / 82%', near(r.rho, 0.68, .001) && /第 7 种；第 2 名/.test(r.m) && /8% \/ 82%/.test(r.m), r.m);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#eval-t tbody tr')].map(tr => [...tr.children].map(td => td.innerText)));
    const rate = s => parseFloat(s), avgRank = v => v.map(x => { const hi = v.filter(y => y > x).length, eq = v.filter(y => y === x).length; return hi + (eq + 1) / 2; });
    const ra = avgRank(rows.map(r => rate(r[2]))), rb = avgRank(rows.map(r => rate(r[3]))), d2 = ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0);
    ok('eval 1 000: squared rank differences add up to 25, simple formula gives 0.70', near(d2, 25, 1e-9) && near(1 - 6 * d2 / (8 * 63), 0.70, .005), d2 + ' ' + (1 - 6 * d2 / 504).toFixed(3)); await w.click('10 万步', 2500);
    const rows2 = await p.evaluate(() => [...document.querySelectorAll('#eval-t tbody tr')].map(tr => [...tr.children].map(td => td.innerText)));
    const ra2 = avgRank(rows2.map(r => rate(r[2]))), rb2 = avgRank(rows2.map(r => rate(r[3]))), d22 = ra2.reduce((s, x, i) => s + (x - rb2[i]) ** 2, 0);
    ok('eval 100 000: squared rank differences add up to 1.5', near(d22, 1.5, 1e-9), d22); }

  // ---- step 9: the map
  { const k = await p.evaluate(() => document.querySelectorAll('#sp .spk').length); ok('map: 49 methods', k === 49, k); }

  ok('no page errors', perr.length === 0, perr.join(' | '));
  console.log(log.join('\n')); console.log(bad ? ('\n' + bad + ' of ' + n + ' CHECKS FAILED') : ('\nALL ' + n + ' CHECKS OK'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
