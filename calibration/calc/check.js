// Check the numbers quoted in the "你会看到 / What you will see" lines of "Error and Calibration"
// (calibration/index.html) against the page itself. It opens the page in a headless browser, operates each
// interactive the way a reader would, and compares the readouts with the numbers the text quotes.
//   usage: node check.js /absolute/path/to/calibration/index.html
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/calibration/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(600);
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined ? '   [' + got + ']' : '')); };
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol) + 1e-9;
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(600); },
    click: async (label, wait) => { const r = await p.evaluate(([i, l]) => { const nm = s => s.replace(/\s+/g, ' ').trim();
        const els = [...document.getElementById(i).querySelectorAll('button,[role=button],[data-k],[tabindex]')].filter(e => e.getClientRects().length > 0);
        const e = els.find(x => nm(x.innerText) === l) || els.find(x => nm(x.innerText).startsWith(l)) || els.find(x => nm(x.innerText).includes(l));
        if (!e) return 'no control "' + l + '"'; e.click(); return 'ok' }, [id, label]);
      if (r !== 'ok') { bad++; log.push('FAIL ' + id + ': ' + r); } await p.waitForTimeout(wait || 200); },
    set: async (inp, v, wait) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(wait || 200); },
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .met')].map(m => m.innerText).join(' ').replace(/\s+/g, ' ').replace(/−/g, '-'), id),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ').replace(/\s+/g, ' ').replace(/−/g, '-'), id),
  });
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/[\s,]/g, '')) : NaN; };
  const N = '([-+]?[\\d.,]+)';
  const R = (s) => new RegExp(s.replace(/N/g, N));

  // ---- step 0: the error chain
  { const w = W('chain18'); await w.show();
    const rd = async () => { const m = await w.met(); return { b: num(m, R('偏差 b N mm')), s: num(m, R('散布 σ N mm')), P: num(m, R('理论成功率 P N')), hit: num(m, R('这 20 次 N / 20')), m }; };
    let r = await rd(); ok('chain: opens with b 5.80, σ 4.49, P 0.825', near(r.b, 5.80) && near(r.s, 4.49) && near(r.P, 0.825), [r.b, r.s, r.P].join(' '));
    await w.click('▶ 抓 20 次', 4500); r = await rd(); ok('chain: 17 of 20 hold, the 3 misses all on the right', r.hit === 17 && /失败 3 次，全在右边/.test(r.m), r.m.slice(-30));
    await w.click('相机外参'); await w.click('▶ 抓 20 次', 4500); r = await rd(); ok('chain, extrinsics off: b 0, σ 4.49, P 0.974, 19 of 20', near(r.b, 0) && near(r.s, 4.49) && near(r.P, 0.974) && r.hit === 19, [r.b, r.s, r.P, r.hit].join(' '));
    await w.click('再看一眼'); r = await rd(); ok('chain, both off: b 0, σ 6.28, P 0.889', near(r.b, 0) && near(r.s, 6.28) && near(r.P, 0.889), [r.b, r.s, r.P].join(' '));
    await w.click('相机外参'); await w.click('▶ 抓 20 次', 4500); r = await rd(); ok('chain, extrinsics on, one look: b 7.98, σ 6.28, P 0.624, 12 of 20, 8 misses on the right', near(r.b, 7.98) && near(r.s, 6.28) && near(r.P, 0.624) && r.hit === 12 && /失败 8 次，全在右边/.test(r.m), [r.b, r.s, r.P, r.hit].join(' ') + r.m.slice(-16));
    await w.click('再看一眼'); }

  // ---- step 1: bias and scatter on a target
  { const w = W('target'); await w.show();
    const rd = async () => { const m = await w.met(); return { ap: num(m, R('平均落点 AP N mm')), rp: num(m, R('重复性 RP N mm')), rms: num(m, R('均方根误差 N mm')), hit: num(m, R('成功 N / 30')), right: num(m, R('右 N，')), left: num(m, R('左 N')), P: num(m, /理论 P ([<>]?\s*[\d.]+)/), m }; };
    await w.click('重装以后'); let r = await rd(); ok('target, after remount, n 1: centre 5.76 mm off, RP 14.01, 25 of 30, 5 misses right, P 0.825, RMS 7.33', near(r.ap, 5.76) && near(r.rp, 14.01) && r.hit === 25 && r.right === 5 && r.left === 0 && near(r.P, 0.825) && near(r.rms, 7.33), [r.ap, r.rp, r.hit, r.right, r.P, r.rms].join(' '));
    await w.set('target-n', 16); r = await rd(); ok('target, n 16: centre 5.66, RP 9.10, 28 of 30, P 0.925', near(r.ap, 5.66) && near(r.rp, 9.10) && r.hit === 28 && near(r.P, 0.925), [r.ap, r.rp, r.hit, r.P].join(' '));
    await w.click('偏得比余量还多'); await w.set('target-n', 1); r = await rd(); ok('target, b 12, n 1: 10 of 30, P 0.328', r.hit === 10 && near(r.P, 0.328), [r.hit, r.P].join(' '));
    await w.set('target-n', 16); r = await rd(); ok('target, b 12, n 16: 7 of 30, P 0.247', r.hit === 7 && near(r.P, 0.247), [r.hit, r.P].join(' '));
    const four = {}; for (const k of ['准且稳', '偏但稳', '不偏但散', '又偏又散']) { await w.click(k); four[k] = await rd(); }
    ok('target, small targets: the two precise ones both have RP 4.81 mm', near(four['准且稳'].rp, 4.81) && near(four['偏但稳'].rp, 4.81), four['准且稳'].rp + ' ' + four['偏但稳'].rp);
    ok('target, biased but precise: centre 8.06 mm off, P 0.909; true but scattered: P 0.904', near(four['偏但稳'].ap, 8.06) && near(four['偏但稳'].P, 0.909) && near(four['不偏但散'].P, 0.904), [four['偏但稳'].ap, four['偏但稳'].P, four['不偏但散'].P].join(' '));
    await w.click('重装以前'); r = await rd(); ok('target, before remount: P 0.974, 30 of 30', near(r.P, 0.974) && r.hit === 30, [r.P, r.hit].join(' '));
    await w.click('重装以后'); }

  // ---- step 2: the error field
  { const w = W('field'); await w.show();
    const rd = async () => { const m = await w.met(); return { A: num(m, R('杯子 A 处 \\|δy\\| N mm')), latA: num(m, R('杯子 A 处 \\|δy\\| [-+\\d.]+ mm 横向 N mm')), B: num(m, R('杯子 B 处 \\|δy\\| N mm')), mx: num(m, R('网格上最大 N mm')), rms: num(m, R('网格 RMS N mm')), m }; };
    let r = await rd(); ok('field, yaw 0.5°: A 6.99 (sideways 6.98), B 7.06, max 10.37, RMS 7.59 mm', near(r.A, 6.99) && near(r.latA, 6.98) && near(r.B, 7.06) && near(r.mx, 10.37) && near(r.rms, 7.59), [r.A, r.latA, r.B, r.mx, r.rms].join(' '));
    await w.click('在杯子 A 处对准'); r = await rd(); ok('field, aligned at A: A 0, B 1.48, max 5.09 mm', near(r.A, 0) && near(r.B, 1.48) && near(r.mx, 5.09), [r.A, r.B, r.mx].join(' ') + ' ' + r.m.slice(0, 120));
    await w.click('在杯子 A 处对准'); await w.click('相机转了 0.5°'); await w.click('相机挪了 1 mm'); r = await rd(); ok('field, shift 1 mm: 1.00 mm everywhere', near(r.A, 1) && near(r.B, 1) && near(r.mx, 1), [r.A, r.B, r.mx].join(' '));
    await w.click('在杯子 A 处对准'); r = await rd(); ok('field, shift 1 mm aligned at A: 0 everywhere', near(r.A, 0) && near(r.B, 0) && near(r.mx, 0), [r.A, r.B, r.mx].join(' '));
    await w.click('在杯子 A 处对准'); await w.click('相机挪了 1 mm'); await w.click('深度比例错 1 %'); r = await rd(); ok('field, depth scale 1 %: A 8.02 (sideways 0.50), max 11.88', near(r.A, 8.02) && near(r.latA, 0.50) && near(r.mx, 11.88), [r.A, r.latA, r.mx].join(' '));
    await w.click('深度比例错 1 %'); await w.click('相机转了 0.5°'); }

  // ---- step 3: fitting a scale and an offset
  { const w = W('fit'); await w.show();
    const rd = async () => { const m = await w.met(); return { ds: num(m, R('比例 ŝ [-+\\d.]+ ± N %')), b: num(m, R('偏移 b̂ N ±')), db: num(m, R('偏移 b̂ [-+\\d.]+ ± N mm')), rho: num(m, R('相关 ρ N')), s055: num(m, R('预测 σ（0.55 m） N mm')), s08: num(m, R('预测 σ（0.80 m） N mm')), s2: num(m, R('预测 σ（2.0 m） N mm')), d2: num(m, R('预测 σ（2.0 m） [\\d.]+ mm 实际差 N mm')), chi: num(m, R('χ²/ν = N')), m }; };
    let r = await rd(); ok('fit, 0.4–2.0 m: ρ -0.909, ŝ ± 0.131 %, b̂ ± 0.70 mm, σ 0.31 / 0.51 / 2.01 mm, χ²/ν 1.00', near(r.rho, -0.909) && near(r.ds, 0.131) && near(r.db, 0.70) && near(r.s055, 0.31) && near(r.s08, 0.51) && near(r.s2, 2.01) && near(r.chi, 1), [r.rho, r.ds, r.db, r.s055, r.s08, r.s2, r.chi].join(' '));
    await w.click('全在 0.80 m'); r = await rd(); const st = await w.status(); ok('fit, all at 0.80 m: only 800·s + b is fixed; σ there 0.37 mm', /800·s \+ b/.test(st + r.m) && near(r.s08, 0.37), r.s08 + ' ' + (st.match(/800·s \+ b[^。，]*/) || [''])[0]);
    await w.click('0.75–0.85 m'); r = await rd(); ok('fit, 0.75–0.85 m: ρ -0.999, ŝ ± 1.060 %, b̂ ± 8.43 mm, σ 0.38 mm at 0.80 m and 12.79 mm at 2.0 m', near(r.rho, -0.999) && near(r.ds, 1.060) && near(r.db, 8.43) && near(r.s08, 0.38) && near(r.s2, 12.79), [r.rho, r.ds, r.db, r.s08, r.s2].join(' '));
    await w.click('0.4–2.0 m'); await w.click('只估偏移'); r = await rd(); ok('fit, offset only: b̂ -0.94 ± 0.29, χ²/ν 2.38, at 2.0 m σ 0.29 but off by +9.06 mm', near(r.b, -0.94) && near(r.db, 0.29) && near(r.chi, 2.38) && near(r.s2, 0.29) && near(r.d2, 9.06) && /10\.0σ/.test(await w.status()), [r.b, r.db, r.chi, r.s2, r.d2].join(' '));
    await w.click('只估偏移'); }

  // ---- step 4: photographing the board
  { const w = W('board'); await w.show();
    const rd = async () => { const m = await w.met(); return { f: num(m, R('焦距 f̂ N ±')), df: num(m, R('焦距 f̂ [\\d.,]+ ± N px')), k: num(m, R('畸变 k̂1 N ±')), dk: num(m, R('畸变 k̂1 [-+\\d.]+ ± N')), tr: num(m, R('训练误差 RMS N px')), te: num(m, R('测试误差 RMS N px')), edge: num(m, R('边上最大测试误差 N px')), m }; };
    let r = await rd(); ok('board, tilted (5 photos): f̂ 921.0 ± 8.6, k̂1 -0.111 ± 0.004, train 0.264, test 0.306, edge 0.57 px', near(r.f, 921.0) && near(r.df, 8.6) && near(r.k, -0.111, 6e-4) && near(r.dk, 0.004, 6e-4) && near(r.tr, 0.264) && near(r.te, 0.306) && near(r.edge, 0.57), [r.f, r.df, r.k, r.dk, r.tr, r.te, r.edge].join(' '));
    await w.click('正对着拍'); r = await rd(); const st = await w.status(); ok('board, facing straight on: σ of f is 38,426 px', /38[ ,]?426/.test(r.m + st), (r.m.match(/焦距[^主]*/) || [''])[0]);
    await w.click('只在中间'); r = await rd(); ok('board, centre only: f̂ 951.4 ± 15.4, k̂1 -0.085 ± 0.027, train 0.269, test 0.395, edge 1.39 px', near(r.f, 951.4) && near(r.df, 15.4) && near(r.k, -0.085, 6e-4) && near(r.dk, 0.027, 6e-4) && near(r.tr, 0.269) && near(r.te, 0.395) && near(r.edge, 1.39), [r.f, r.df, r.k, r.dk, r.tr, r.te, r.edge].join(' '));
    await w.click('铺满'); r = await rd(); ok('board, full coverage (8 photos): f̂ 928.9 ± 6.5, train 0.272, test 0.297, edge 0.55 px', near(r.f, 928.9) && near(r.df, 6.5) && near(r.tr, 0.272) && near(r.te, 0.297) && near(r.edge, 0.55), [r.f, r.df, r.tr, r.te, r.edge].join(' '));
    await w.click('斜着拍'); }

  // ---- step 5: depth bias against distance
  { const w = W('depth'); await w.show();
    const rd = async () => { const m = await w.met(); return { noise: num(m, R('噪声 σ_z = N mm')), bias: num(m, R('不算噪声是 N mm')), b055: num(m, R('0.55 m 处的偏差 N mm')), b08: num(m, R('0.80 m 处的偏差 N mm')), b2: num(m, R('2.0 m 处的偏差 N mm')), m }; };
    let r = await rd(); ok('depth, wall at 0.80 m: noise 1.60, bias -5.99; 0.55 m -3.69; 2.0 m -22.36 mm', near(r.noise, 1.60) && near(r.bias, -5.99) && near(r.b055, -3.69) && near(r.b2, -22.36), [r.noise, r.bias, r.b055, r.b2].join(' '));
    await w.set('depth-z', 0.3); r = await rd(); ok('depth, wall at 0.30 m: noise 0.23, bias -1.78 mm', near(r.noise, 0.23) && near(r.bias, -1.78), [r.noise, r.bias].join(' '));
    await w.set('depth-z', 2.5); r = await rd(); ok('depth, wall at 2.5 m: noise 15.63, bias -31.78 mm', near(r.noise, 15.63) && near(r.bias, -31.78), [r.noise, r.bias].join(' '));
    await w.set('depth-z', 0.8); await w.click('在 0.80 m 做一次 tare'); r = await rd(); ok('depth, one tare at 0.80 m: 0.55 m -0.86, 0.80 m 0, 2.0 m +15.19 mm', near(r.b055, -0.86) && near(r.b08, 0) && near(r.b2, 15.19), [r.b055, r.b08, r.b2].join(' '));
    await w.click('两个距离一起标'); r = await rd(); ok('depth, two distances: 0 everywhere', near(r.b055, 0) && near(r.b08, 0) && near(r.b2, 0), [r.b055, r.b08, r.b2].join(' '));
    await w.set('depth-dd', 0); await w.click('不修正'); r = await rd(); ok('depth, no disparity offset, uncorrected: -2.75, -4.00, -10.00 mm', near(r.b055, -2.75) && near(r.b08, -4) && near(r.b2, -10), [r.b055, r.b08, r.b2].join(' '));
    await w.click('在 0.80 m 做一次 tare'); r = await rd(); ok('depth, no disparity offset, one tare: 2.0 m becomes +15.19 mm (worse than -10.00)', near(r.b2, 15.19), [r.b055, r.b08, r.b2].join(' '));
    await w.set('depth-dd', 0.1); await w.set('depth-e', 0); r = await rd(); ok('depth, no scale error, one tare: 0 everywhere', near(r.b055, 0) && near(r.b08, 0) && near(r.b2, 0), [r.b055, r.b08, r.b2].join(' '));
    await w.set('depth-e', -0.5); await w.click('不修正'); }

  // ---- step 6: hand–eye
  { const w = W('handeye'); await w.show();
    const rd = async () => { const m = await w.met(); return { rot: num(m, R('X 的转角误差 N°')), tr: num(m, R('X 的平移误差 N mm')), A: num(m, R('杯子 A 处（0.55 m） N mm')), amp: num(m, R('噪声放大 ×N')), m }; };
    let r = await rd(); ok('hand–eye, two axes ±45°, 12 poses: 0.20°, 2.19 mm, 1.50 mm at cup A, ×1.31', near(r.rot, 0.20) && near(r.tr, 2.19) && near(r.A, 1.50) && near(r.amp, 1.31), [r.rot, r.tr, r.A, r.amp].join(' '));
    await w.click('只平移'); let st = await w.status(); ok('hand–eye, translation only: X cannot be found', /X 的平移误差 定不出/.test(await w.met()) && /t_X 从方程里消失了/.test(st), st.slice(0, 60));
    await w.click('绕一根轴大幅转'); r = await rd(); st = await w.status(); ok('hand–eye, one axis ±45°: still not pinned down, solved rotation 89.7° off', /绕 y 定不出 解出来差 89\.7°/.test(r.m) && /沿 y 定不出/.test(r.m), r.m.slice(0, 60));
    await w.click('随机 15 个姿态'); r = await rd(); ok('hand–eye, 15 random poses: 0.13°, 1.12 mm, 0.83 mm at cup A', near(r.rot, 0.13) && near(r.tr, 1.12) && near(r.A, 0.83), [r.rot, r.tr, r.A].join(' '));
    await w.click('绕两根轴大幅转'); const amp = {}; for (const a of [60, 30, 15, 5]) { await w.set('handeye-r', a, 500); amp[a] = await rd(); }
    ok('hand–eye, amplitude ±60°: 0.16°, 1.58 mm', near(amp[60].rot, 0.16) && near(amp[60].tr, 1.58), [amp[60].rot, amp[60].tr, amp[60].amp].join(' '));
    ok('hand–eye, amplitude ±30°: 0.29°, 3.25 mm', near(amp[30].rot, 0.29) && near(amp[30].tr, 3.25), [amp[30].rot, amp[30].tr, amp[30].amp].join(' '));
    ok('hand–eye, amplitude ±15°: 0.56°, 6.37 mm', near(amp[15].rot, 0.56) && near(amp[15].tr, 6.37), [amp[15].rot, amp[15].tr, amp[15].amp].join(' '));
    ok('hand–eye, amplitude ±5°: 1.66°, 19.1 mm, noise ×11.46', near(amp[5].rot, 1.66) && near(amp[5].tr, 19.1, .06) && near(amp[5].amp, 11.46), [amp[5].rot, amp[5].tr, amp[5].amp].join(' '));
    await w.set('handeye-r', 45, 500); }

  // ---- step 7: arm kinematics
  { const w = W('arm'); await w.show();
    const rd = async () => { const m = await w.met(); const a = m.match(/标定前（mm） ([\d.]+) \/ ([\d.]+)/) || [], c = m.match(/标定后（mm） ([\d.]+) \/ ([\d.]+)/) || [], k = m.match(/秩 \/ 参数个数 (\d+) \/ (\d+)/) || []; return { b0: +a[1], b1: +a[2], a0: +c[1], a1: +c[2], rank: +k[1], np: +k[2], cond: num(m, R('条件数 N')), fit: num(m, R('拟合残差 RMS N mm')), m }; };
    let r = await rd(); let st = await w.status(); ok('arm, full coverage: nominal 2.87 / 4.03 mm, calibrated 0.031 / 0.047 mm, rank 6/6, cond 18.1, δq̂1 +0.300°', near(r.b0, 2.87) && near(r.b1, 4.03) && near(r.a0, 0.031) && near(r.a1, 0.047) && r.rank === 6 && r.np === 6 && near(r.cond, 18.1) && /δq̂₁ = \+0.300°/.test(st), [r.b0, r.b1, r.a0, r.a1, r.rank, r.cond].join(' '));
    await w.click('一小块'); r = await rd(); ok('arm, small patch: fit residual 0.087 mm, elsewhere 0.76 / 2.12 mm', near(r.fit, 0.087) && near(r.a0, 0.76) && near(r.a1, 2.12), [r.cond, r.a0, r.a1, r.fit].join(' '));
    await w.click('只动第 1 关节'); r = await rd(); ok('arm, joint 1 only: rank 2 of 6, elsewhere 1.11 / 2.71 mm', r.rank === 2 && near(r.a0, 1.11) && near(r.a1, 2.71), [r.rank, r.a0, r.a1, r.fit].join(' '));
    await w.click('铺满'); await w.click('底座转角'); r = await rd(); st = await w.status(); ok('arm, base yaw added: 6 of 7 parameters, only the sum +0.300° is fixed', r.rank === 6 && r.np === 7 && /δq̂₁ \+ β̂ = \+0\.300°/.test(st), r.rank + '/' + r.np);
    await w.click('底座转角'); }

  // ---- step 8: IMU, six faces and Allan
  { const w = W('allan'); await w.show();
    await w.click('清空'); await w.click('+z 朝上', 4500); let st = await w.status(); ok('IMU, only +z up measured: no axis has both faces yet', /已测 1 个面。还没有哪根轴的两个面都测过/.test(st), st.slice(0, 40));
    await w.click('−z 朝上', 4500); st = await w.status(); ok('IMU, -z up as well: the z axis has its pair', /z 轴的一对面都有了/.test(st), st.slice(0, 40));
    await w.click('▶ 依次翻', 100); for (let k = 0; k < 80; k++) { await p.waitForTimeout(500); st = await w.status(); if (/六个面都测完了/.test(st)) break; }
    ok('IMU six faces: x reads 9.946 and -9.746, so b̂ 0.100 and k̂ 1.0040', /\+g 读 9\.946，-g 读 -9\.746/.test(st) && /b̂ = 0\.100/.test(st) && /k̂ = 1\.0040/.test(st), st.slice(60, 150));
    await w.click('Allan 方差', 600); await w.set('allan-T', 11, 700); st = await w.status(); ok('Allan, 24 h: bottom at τ = 158 s, B̂ 0.0052', /τ = 158 s 的底/.test(st) && /B̂ = 0\.0052/.test(st), st.slice(150, 230));
    await w.set('allan-T', 0, 700); st = await w.status(); ok('Allan, 1 min: curve ends at τ = 25 s, B only bounded by 0.0081', /到 τ = 25 s 就没了/.test(st) && /B̂ = 0\.0081 只是个上限/.test(st), st.slice(-110));
    await w.set('allan-T', 11, 700); await w.click('升温 20 K', 700); st = await w.status(); ok('Allan, 24 h warming by 20 K: bias moves 0.30 °/s, bottom pushed to τ = 63 s, K̂ 6 times too big', /= 0\.30 °\/s/.test(st) && /最低点被推到 τ = 63 s/.test(st) && /是真值的 6 倍/.test(st), st.slice(150, 290));
    await w.click('升温 20 K', 300); await w.set('allan-T', 7, 300); await w.click('翻六个面', 300); }

  // ---- step 9: lidar on the base
  { const w = W('lidar'); await w.show();
    const rd = async () => { const m = await w.met(); return { th: num(m, R('墙的厚度 N mm')), map: num(m, R('到地图墙面的平均距离 N mm')), e: num(m, R('\\|e\\| N mm')), d90: num(m, R('差 90° 的两帧对不上 N mm')), psi: num(m, R('整体转角 δψ N°')), far: num(m, R('4 m 外偏 N mm')), m }; };
    let r = await rd(); let st = await w.status(); ok('lidar, as mounted: wall 12.6 mm thick (6.1 when right), frames 90° apart 28.6 mm, 180° apart 40.4 mm, angle off 0.80° = 55.9 mm at 4 m', near(r.th, 12.6) && near(r.d90, 28.6) && /差 180° 的对不上 40\.4 mm/.test(st) && near(Math.abs(r.psi), 0.80) && near(r.far, 55.9) && /放对时 6\.1 mm/.test(r.m), [r.th, r.map, r.d90, r.psi, r.far].join(' '));
    await w.set('lidar-w', 0.8); r = await rd(); ok('lidar, only the angle set right: wall still 12.4 mm thick', near(r.th, 12.4), r.th);
    await w.set('lidar-x', 0.22); r = await rd(); ok('lidar, x set right as well: wall 6.1 mm', near(r.th, 6.1), r.th);
    await w.click('重来', 400); await w.click('自动找', 2500); r = await rd(); st = await w.status(); ok('lidar, auto-fit with the map: x 0.2198 m, angle +0.80°, wall 6.1 mm', near(r.th, 6.1) && /x = 0\.2198 m/.test(st) && /安装角 \+0\.80°/.test(st), [r.th, r.map, r.psi].join(' ') + ' ' + st.slice(0, 60));
    await w.click('重来', 400); await w.click('不用地图'); await w.set('lidar-w', 1.5); await w.click('自动找', 2500); r = await rd(); ok('lidar, no map, start angle +1.5°: wall 6.1 mm but angle still 0.70° off, 48.9 mm at 4 m', near(r.th, 6.1) && near(r.psi, 0.70) && near(r.far, 48.9), [r.th, r.psi, r.far].join(' '));
    await w.click('用地图'); await w.click('重来', 400); }

  // ---- step 10: clocks
  { const w = W('sync'); await w.show();
    const rd = async () => { const m = await w.met(); return { peak: num(m, R('估出的 Δt̂（峰） N ms')), sd: num(m, R('± N ms')), e: num(m, R('杯子看偏 e（用 Δt） N mm')), m }; };
    let r = await rd(); ok('sync: peak 24.77 ms, ± 0.9 ms, cup 10.0 mm off at Δt 0', near(r.peak, 24.77) && near(r.sd, 0.9) && near(r.e, 10.0), [r.peak, r.sd, r.e].join(' '));
    await w.click('用估出的 Δt̂'); r = await rd(); ok('sync: with the estimated offset the cup is 0.09 mm off', /用 Δt̂ 补上以后 0\.09 mm/.test(r.m), r.m.slice(-50));
    await w.click('重来', 300); await w.click('匀速转', 500); r = await rd(); const st = await w.status(); ok('sync, constant rate: no peak (highest 0.20), ± 93 ms, cup still 10.0 mm off, same as a 0.72° yaw', /没有峰/.test(r.m) && /最高 0\.20/.test(st) && /± 93 ms/.test(st) && near(r.e, 10.0) && /0\.72°/.test(st), r.m.slice(0, 80));
    await w.click('匀速转', 300); }

  // ---- step 11: tool tip and payload
  { const w = W('pivot'); await w.show();
    const rd = async () => { const m = await w.met(); return { lat: num(m, R('σ_x （横向） N mm')), ax: num(m, R('σ_z （沿工具） N mm')), m }; };
    let r = await rd(); ok('pivot, α 15°, 8 poses: σ 0.192 sideways, 0.137 mm along the tool', near(r.lat, 0.192) && near(r.ax, 0.137), [r.lat, r.ax].join(' '));
    await w.set('pivot-al', 60); r = await rd(); ok('pivot, α 60°: 0.053 / 0.041 mm', near(r.lat, 0.053) && near(r.ax, 0.041), [r.lat, r.ax].join(' '));
    await w.set('pivot-al', 2); r = await rd(); ok('pivot, α 2°: 1.433 / 1.013 mm', near(r.lat, 1.433) && near(r.ax, 1.013), [r.lat, r.ax].join(' '));
    await w.set('pivot-al', 15); await w.set('pivot-n', 3); r = await rd(); ok('pivot, 3 poses: 0.314 / 0.223 mm', near(r.lat, 0.314) && near(r.ax, 0.223), [r.lat, r.ax].join(' '));
    await w.set('pivot-n', 8); await w.click('只在一个平面里'); let st = await w.status(); ok('pivot, all in one plane: rank 5, not 6', /秩是 5，不是 6/.test(st), st.slice(60, 130));
    await w.click('锥面'); await w.click('负载', 400); let m = await w.met(); ok('load, 0.15 kg not declared: phantom force 1.47 N, 1.53 N left below the 3 N threshold', /估出来的外力 1\.47 N/.test(m) && /余量还剩 1\.53 N/.test(m), m.slice(-90));
    await w.set('pivot-ms', 0.5); m = await w.met(); ok('load, 0.50 kg not declared: 4.90 N, already over the threshold', /估出来的外力 4\.90 N/.test(m) && /已经超过/.test(m), m.slice(-90));
    await w.click('告诉了机器人'); m = await w.met(); ok('load, declared: estimated external force back to 0', /估出来的外力 0\.00 N/.test(m), m.slice(-90));
    await w.click('告诉了机器人'); await w.set('pivot-ms', 0.15); await w.click('枢轴法', 300); }

  // ---- step 12: training and test error
  { const w = W('overfit'); await w.show();
    const rd = async () => { const m = await w.met(); return { tr: num(m, R('训练 RMS N px')), te: num(m, R('测试 RMS N px')), edge: num(m, R('边上（r = 1）的误差 N px')), m }; };
    let r = await rd(); ok('overfit, centre only, K 2: train 0.310, test 0.497, corner -1.53 px', near(r.tr, 0.310) && near(r.te, 0.497) && near(r.edge, -1.53), [r.tr, r.te, r.edge].join(' '));
    const ks = {}; for (const k of [3, 4, 6]) { await w.set('overfit-k', k); ks[k] = await rd(); }
    ok('overfit, centre only, K 3: train 0.307, test 53.6', near(ks[3].tr, 0.307) && near(ks[3].te, 53.6), [ks[3].tr, ks[3].te].join(' '));
    ok('overfit, centre only, K 4: train 0.285, test 1,885', near(ks[4].tr, 0.285) && near(ks[4].te, 1885), [ks[4].tr, ks[4].te].join(' '));
    ok('overfit, centre only, K 6: train 0.283, test 68,794, corner off by 4.0 × 10⁵ px', near(ks[6].tr, 0.283) && near(ks[6].te, 68794) && /-4\.0 × 10⁵ px/.test(ks[6].m), [ks[6].tr, ks[6].te].join(' '));
    await w.click('铺满'); await w.set('overfit-k', 6); r = await rd(); ok('overfit, full coverage, K 6: train 0.283, test 0.308', near(r.tr, 0.283) && near(r.te, 0.308), [r.tr, r.te].join(' '));
    await w.set('overfit-k', 2); r = await rd(); ok('overfit, full coverage, K 2: train 0.310, test 0.280', near(r.tr, 0.310) && near(r.te, 0.280), [r.tr, r.te].join(' '));
    await w.click('中间拍得多'); }

  // ---- step 13: drift and monitoring
  { const w = W('drift'); await w.show();
    const rd = async () => { const m = await w.met(); return { over: num(m, R('的天数 N')), unk: num(m, R('没人知道的：N 天')), alarm: num(m, R('报警 N')), recal: num(m, R('重标 N')), worst: num(m, R('没发现时最大的误差 N mm')), m }; };
    let r = await rd(); let st = await w.status(); ok('drift, daily check, no recalibration: first alarm day 24, 37 alarms, 11.9 mm at day 60, 38 days over budget', /第 24 天第一次报警/.test(st) && r.alarm === 37 && /到第 60 天是 11\.9 mm/.test(st) && r.over === 38, [r.over, r.alarm].join(' '));
    await w.click('发现就重标'); r = await rd(); ok('drift, daily + recalibrate: 2 alarms, 2 recalibrations, 3 days over, 1 unnoticed (5.1 mm)', r.alarm === 2 && r.recal === 2 && r.over === 3 && r.unk === 1 && near(r.worst, 5.1), [r.alarm, r.recal, r.over, r.unk, r.worst].join(' '));
    await w.click('每 7 天'); r = await rd(); st = await w.status(); ok('drift, weekly + recalibrate: 10 days over, 8 unnoticed, worst 6.6 mm', r.over === 10 && r.unk === 8 && near(r.worst, 6.6), [r.over, r.unk, r.worst].join(' '));
    await w.click('每天'); await w.click('发现就重标'); await w.click('在线估计'); r = await rd(); st = await w.status(); ok('drift, online estimation only: 35 % of the gap per day, 5 days over budget, largest error 6.1 mm', /35 %/.test(st) && r.over === 5 && /最大误差 6\.1 mm/.test(st), [r.over, r.alarm].join(' '));
    await w.click('在线估计'); }

  // ---- step 15: the calibration plan
  { const w = W('plan18'); await w.show();
    const rd = async () => { const m = await w.met(); return { b: num(m, R('偏差 b N mm')), s: num(m, R('散布 σ N mm')), P: num(m, R('成功率 P N')), m }; };
    let r = await rd(); ok('plan, everything done: σ 3.60 mm, P 0.9945', near(r.b, 0) && near(r.s, 3.60) && near(r.P, 0.9945), [r.b, r.s, r.P].join(' '));
    await w.click('重装后没重标手眼'); r = await rd(); ok('plan, hand–eye skipped: b 5.80, σ 4.49, P 0.8250', near(r.b, 5.80) && near(r.s, 4.49) && near(r.P, 0.8250), [r.b, r.s, r.P].join(' '));
    await w.click('手臂用名义模型'); r = await rd(); ok('plan, arm left nominal: b 5.00, σ 3.60, P 0.9176', near(r.b, 5.00) && near(r.s, 3.60) && near(r.P, 0.9176), [r.b, r.s, r.P].join(' '));
    await w.click('什么都不标'); r = await rd(); ok('plan, nothing calibrated: b 15.49, P 0.1107', near(r.b, 15.49) && near(r.P, 0.1107), [r.b, r.s, r.P].join(' '));
    await w.click('全做'); await w.click('1相机内参'); await w.click('跳过这一步'); await w.click('9负载和 TCP'); await w.click('跳过这一步'); r = await rd(); ok('plan, intrinsics and TCP skipped: b 2.36 + 2.00 = 4.36, P 0.9414', near(r.b, 4.36) && near(r.P, 0.9414), [r.b, r.s, r.P].join(' '));
    await w.click('全做'); }

  ok('no page errors', perr.length === 0, perr.join(' | ').slice(0, 200));
  console.log(log.join('\n')); console.log('\n' + (n - bad) + ' / ' + n + ' checks pass' + (bad ? '   <<< ' + bad + ' FAILED' : ''));
  await b.close(); process.exit(bad ? 1 : 0);
})();
