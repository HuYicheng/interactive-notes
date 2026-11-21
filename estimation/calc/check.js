// Check the numbers quoted in the "你会看到 / What you will see" lines and figure captions of "State Estimation"
// (estimation/index.html) against the page itself. It opens the page in a headless browser, operates each
// interactive the way a reader would, and compares the readouts with the numbers the text quotes.
//   usage: node check.js /absolute/path/to/estimation/index.html      (takes about 6 minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/estimation/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(600);
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined ? '   [' + got + ']' : '')); };
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(600); },
    click: async (label, wait) => { const r = await p.evaluate(([i, l]) => { const nm = s => s.replace(/\s+/g, ' ').trim();
        const els = [...document.getElementById(i).querySelectorAll('button,[role=button],[data-k],[tabindex]')].filter(e => e.getClientRects().length > 0);
        const e = els.find(x => nm(x.innerText) === l) || els.find(x => nm(x.innerText).startsWith(l)) || els.find(x => nm(x.innerText).includes(l));
        if (!e) return 'no control "' + l + '"'; e.click(); return 'ok' }, [id, label]);
      if (r !== 'ok') { bad++; log.push('FAIL ' + id + ': ' + r); } await p.waitForTimeout(wait || 200); },
    set: async (inp, v, wait) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(wait || 200); },
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .met')].map(m => m.innerText).join(' ').replace(/\s+/g, ' ').replace(/−/g, '-'), id),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ').replace(/[\s⁠]+/g, ' ').replace(/−/g, '-'), id),
    // true while the widget is not animating: its play button shows "▶ …" again
    idle: () => p.evaluate(i => [...document.getElementById(i).querySelectorAll('button')].some(e => e.getClientRects().length > 0 && /^▶/.test(e.innerText.trim())), id),
    // scroll an element of the widget to the middle of the viewport and return its box (repeated: widgets above are laid out lazily)
    view: async (sel) => { let r; for (let k = 0; k < 8; k++) { r = await p.evaluate(([i, s]) => { const e = document.querySelector('#' + i + ' ' + s); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, [id, sel]); await p.waitForTimeout(350);
        const r2 = await p.evaluate(([i, s]) => { const q = document.querySelector('#' + i + ' ' + s).getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, [id, sel]); if (Math.abs(r2.y - r.y) < 1 && r2.y > 0 && r2.y + r2.h < 900) return r2; r = r2; } return r; },
  });
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/[\s,>]/g, '')) : NaN; };
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const waitIdle = async (w, maxS) => { await p.waitForTimeout(700); for (let k = 0; k < (maxS || 40) * 4; k++) { if (await w.idle()) return true; await p.waitForTimeout(250); } return false; };

  // ---- step 0: one lap of the kitchen, four estimates
  { const w = W('robot'); await w.show(); await w.click('▶ 播放'); await waitIdle(w, 30); let st = await w.status();
    ok('lap: 50.6 s, 11.40 m; wheels 55.1 cm / -15.5°', has(st, '一圈走完（50.6 s，11.40 m）', '只用轮子：差 55.1 cm，朝向差 -15.5°'), st.slice(0, 60));
    ok('lap: IMU leaves the kitchen at 10.1 s, 14.40 m off', has(st, '只用 IMU：10.1 s 就出了厨房，现在差 14.40 m'));
    ok('lap: lidar point 1.7 cm off; fused 0.6 cm', has(st, '只用激光：这一个点差 1.7 cm', '融合：差 0.6 cm'));
    await w.click('▶ 播放'); await waitIdle(w, 20); st = await w.status(); const m = await w.met();
    ok('grasp pose at 71.7 s: wheels 1.05 m, fused 1.0 cm and never above 3.0 cm', has(m, '时间 71.7 s') && has(st, '只用轮子：差 1.05 m', '融合：差 1.0 cm，整程从没超过 3.0 cm'), st.slice(0, 50)); }

  // ---- step 1: bias, noise, covariance
  { const w = W('noise'); await w.show(); let st = await w.status();
    ok('lidar: mean 2.0013 m, sample σ 30.5 mm, 1.3 mm from the truth', has(st, '平均 2.0013 m，样本 σ = 30.5 mm', '平均离真值 1.3 mm'), st.slice(0, 50));
    await w.set('noise-bi', 20); st = await w.status(); ok('bias +20 mm: mean +21.3 mm from the truth', has(st, '平均离真值 +21.3 mm'));
    await w.set('noise-n', 100); st = await w.status(); ok('average of 100: σ 3.0 mm, centre still at 2.0197 m', has(st, /√100 = 3\.0 mm/, '中心停在 2.0197 m'), (st.match(/平均 100 次[^。]*/) || [''])[0]);
    await w.click('深度相机测杯子'); let m = await w.met(); ok('depth camera at 0.8 m: σ 1.60 mm', has(m, '设的是 1.60 mm'));
    await w.set('noise-d', 4); m = await w.met(); ok('depth camera at 4 m: σ 40.0 mm (25 times)', has(m, '设的是 40.0 mm') && Math.abs(40.0 / 1.60 - 25) < 1e-9);
    await w.set('noise-r', 0); m = await w.met(); ok('ρ = 0: semi-axes 5.00 and 2.00 cm; 118 and 260 of 300 inside', has(m, '长轴 5.00 cm', '短轴 2.00 cm', '39.3 % 118 / 300', '86.7 % 260 / 300'), m.slice(-90));
    await w.set('noise-r', 0.95); m = await w.met(); ok('ρ = 0.95: semi-axes 5.35 and 0.58 cm at +21.1°; still 118 and 260 inside', has(m, '长轴 5.35 cm', '短轴 0.58 cm', '角度 +21.1°', '39.3 % 118 / 300', '86.7 % 260 / 300'), m.slice(-90)); }

  // ---- step 2: dead reckoning
  { const w = W('drift'); await w.show(); await w.click('▶ 播放'); await waitIdle(w, 20); let m = await w.met(), st = await w.status();
    ok('default lap: wheels 25.3 cm / -6.9°; wheels + gyro 9.6 cm / 2.6°; IMU 3.60 m, out at 20.2 s', has(m, '轮子 · 位置误差 25.3 cm 朝向误差 -6.9°', '轮子 + 陀螺 · 位置误差 9.6 cm 朝向误差 2.6°', '只用 IMU · 位置误差 3.60 m') && has(st, '20.2 s 就出了厨房'), m.slice(0, 90));
    ok('default: 3.6° per lap from the wheelbase, 3.3° from the wheel radii', has(st, '每转一圈朝向差 3.6°', '一圈 11.4 m 直道 3.3°'));
    await w.set('drift-eb', 0); m = await w.met(); ok('wheelbase error 0: wheels 11.9 cm / -3.3°', has(m, '轮子 · 位置误差 11.9 cm 朝向误差 -3.3°'), m.slice(0, 60));
    await w.click('湿地打滑'); m = await w.met(); st = await w.status();
    ok('+ wet-floor slip: wheels 42.4 cm / -11.9°; wheels + gyro 11.4 cm; IMU unchanged 3.60 m; 8.6° per pass', has(m, '轮子 · 位置误差 42.4 cm 朝向误差 -11.9°', '轮子 + 陀螺 · 位置误差 11.4 cm', '只用 IMU · 位置误差 3.60 m') && has(st, '每过一次再差 8.6°'), m.slice(0, 90));
    await w.set('drift-ba', 70); m = await w.met(); st = await w.status(); ok('accelerometer bias 70 mg: IMU 278.50 m, out at 3.1 s', has(m, '只用 IMU · 位置误差 278.50 m') && has(st, '3.1 s 就出了厨房')); }

  // ---- step 3: fusing two readings
  { const w = W('fuse'); await w.show(); let m = await w.met();
    ok('default: lidar 1.520 m, wheels 1.450 m; weights 87.7 / 12.3 %, 1.511 m, σ 28.1 mm', has(m, '权重 87.7 / 12.3 %', '合成值 1.511 m', '合成 σ 28.1 mm') && has(await w.status(), '激光说 1.520 m（σ 30.0 mm），轮子推算说 1.450 m（σ 80.0 mm）'), m.slice(0, 80));
    await w.set('fuse-s2', 0.03); m = await w.met(); ok('σ₂ = σ₁: 50 / 50, 1.485 m, σ 21.2 mm', has(m, '权重 50.0 / 50.0 %', '合成值 1.485 m', '合成 σ 21.2 mm'), m.slice(0, 80));
    // drag the wheel reading (the small triangle under the axis) to 1.25 m: canvas x is linear in z
    const box = await w.view('canvas'); const z2 = async () => num(await w.status(), /轮子推算说 ([\d.]+) m/); let grab = null;
    for (let fx = 0.2; fx <= 0.8 && !grab; fx += 0.02) { const x = box.x + fx * box.w, y = box.y + 0.93 * box.h; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 3, y); const a = await z2(); if (Math.abs(a - 1.45) > 1e-9) grab = { x: x + 3, y, a }; else await p.mouse.up(); }
    if (grab) { await p.mouse.move(grab.x + 40, grab.y); const za = await z2(); await p.mouse.move(grab.x - 60, grab.y); const zb = await z2(); const k = (za - zb) / 100; let x = grab.x - 60 + (1.25 - zb) / k; await p.mouse.move(x, grab.y); let z = await z2();
      for (let i = 0; i < 20 && Math.abs(z - 1.25) > 1e-9; i++) { x += (1.25 - z) / k; await p.mouse.move(x, grab.y); z = await z2(); } await p.mouse.up(); }
    let st = await w.status(); ok('wheel reading dragged to 1.25 m: "disagree", 270 mm = 6.36 × 42 mm, formula still says 1.385 m ± 21.2 mm', !!grab && has(st, '两个读数对不上：至少一个坏了', '轮子推算说 1.250 m，差 270 mm', '（42 mm）的 6.36 倍', '1.385 m ± 21.2 mm'), st.slice(0, 90));
    await w.click('同一个读数用两次'); st = await w.status(); ok('same reading twice: σ 17.3 mm, pulled to 1.430 m, 18 % too narrow', has(st, 'σ 只有 17.3 mm', '拉到 1.430 m', '少算了 18 %'), (st.match(/滤波器以为[^。]*/) || [''])[0]); }

  // ---- step 4: the Bayes filter on a corridor
  { const w = W('bayes'); await w.show(); await w.click('重来'); let st = await w.status();
    ok('start: 108 bins at 0.93 %, 90 % width 4.90 m', has(st, '108 格，每格 0.93 %，90 % 区间宽 4.90 m'), st.slice(0, 60));
    await w.click('测一次'); st = await w.status(); ok('1st measurement 0.594 m: 2 peaks, 90 % width 3.80 m', has(st, '测到 z = 0.594 m', '均匀 → 2 个峰，90 % 区间 4.90 → 3.80 m'));
    await w.click('前进 0.5 m'); let m = await w.met(); ok('after one move (motion noise 0.05 m) the flat top is 1.65–3.25 m (1.60 m wide)', has(m, '最可能的位置 1.65–3.25 m'), m.slice(0, 40));
    await w.click('测一次'); await w.click('前进 0.5 m'); await w.click('测一次'); await w.click('前进 0.5 m'); m = await w.met(); ok('before the 4th measurement there are still 2 peaks', has(m, '峰的个数 2'));
    await w.click('测一次'); st = await w.status(); ok('4th measurement 0.417 m (oven cabinet): 1 peak, 90 % width 1.60 → 0.50 m', has(st, '测到 z = 0.417 m', '2 个峰 → 1 个峰，90 % 区间 1.60 → 0.50 m'), st.slice(0, 40));
    await w.click('前进 0.5 m'); await w.click('测一次'); st = await w.status(); await w.click('显示真值'); m = await w.met(); ok('5th measurement: 90 % width 0.15 m, 1.5 cm from the truth', has(st, '90 % 区间 0.50 → 0.15 m') && has(m, '和真值差 +1.5 cm'), m.slice(-60));
    await w.click('重来'); await w.set('bayes-sz', 0.2); await w.click('测一次'); st = await w.status(); ok('measurement noise 0.2 m: 1st measurement only 4.90 → 4.50 m', has(st, '90 % 区间 4.90 → 4.50 m'));
    let k = 1; for (; k < 14; ) { await w.click('前进 0.5 m'); await w.click('测一次'); k++; if (has(await w.met(), '峰的个数 1')) break; } ok('measurement noise 0.2 m: a single peak only at the 9th measurement (8 moves)', k === 9, 'measurement ' + k);
    await w.click('重来'); await w.set('bayes-sz', 0.03); await w.set('bayes-sm', 0.2); await w.click('测一次'); await w.click('前进 0.5 m'); m = await w.met(); ok('motion noise 0.2 m: after one move the flat top is 2.25–2.65 m (0.40 m wide)', has(m, '最可能的位置 2.25–2.65 m'), m.slice(0, 40)); }

  // ---- step 5: the one-dimensional Kalman filter
  { const w = W('kf'); await w.show(); await w.click('重来'); const Ks = []; let st4 = '';
    for (let k = 1; k <= 5; k++) { await w.click('下一步', 1500); const st = await w.status(); Ks.push((st.match(/K = ([\d.]+)/) || [])[1]); if (k === 1) ok('step 1: σ back to 29.9 mm', has(st, 'σ 回到 29.9 mm')); if (k === 4) st4 = st; }
    ok('K = 0.996, 0.502, 0.338, 0.258, 0.212 at steps 1–5', Ks.join(',') === '0.996,0.502,0.338,0.258,0.212', Ks.join(', '));
    ok('figure: at step 4 the prediction has σ 17.7 mm and K = 17.7² / (17.7² + 30²) = 0.258', has(st4, '撑到 17.7 mm', 'K = 0.258') && Math.abs(17.7 ** 2 / (17.7 ** 2 + 900) - 0.258) < 5e-4, st4.slice(0, 50));
    await w.click('▶ 播放'); for (let k = 0; k < 120; k++) { await p.waitForTimeout(250); if (has(await w.status(), '20 s 走完')) break; } let st = await w.status(), m = await w.met();
    ok('20 s: K settles at 0.095, σ 9.25 mm; RMS 9.64 mm vs lidar 28.1 mm; wheels -59.0 mm; 4.0 % outside ±2σ', has(st, 'K 稳定在 0.095，σ = 9.25 mm', '滤波误差 RMS 9.64 mm，只用激光 28.1 mm，只用轮子此刻差 -59.0 mm') && has(m, '±2σ 带外 4.0 %'), st.slice(0, 60));
    await w.click('激光断 3 秒'); st = await w.status(); ok('lidar off for 3 s: σ 9.25 → 18.9 mm, first K back 0.288', has(st, 'σ 从 9.25 mm 长到 18.9 mm', 'K = 0.288'), (st.match(/激光断的[^。]*/) || [''])[0]);
    await w.click('激光断 3 秒'); await w.click('地面打滑'); st = await w.status(); ok('wheel slip (120 mm): worst -65.7 mm, back within ±20 mm at 15.0 s', has(st, '共 120 mm', '滤波误差最大 -65.7 mm', 't = 15.0 s 回到 ±20 mm 以内'), (st.match(/滤波误差最大[^；]*/) || [''])[0]);
    await w.set('kf-q', 0); st = await w.status(); m = await w.met(); ok('√Q = 0.30 mm with slip: K 0.010, worst -136.7 mm, not back by 20 s, 81.5 % outside', has(st, '√Q = 0.30 mm', 'K = 0.010', '滤波误差最大 -136.7 mm', '到 20 s 还没回到') && has(m, '±2σ 带外 81.5 %'), (st.match(/滤波误差最大[^；]*/) || [''])[0]);
    await w.set('kf-q', 50); await w.click('地面打滑'); await w.set('kf-r', 3); st = await w.status(); m = await w.met(); ok('√R = 3 mm: K 0.618, RMS 19.6 mm (about twice 9.64), 82.5 % outside', has(st, 'K 稳定在 0.618', '滤波误差 RMS 19.6 mm') && has(m, '±2σ 带外 82.5 %') && Math.abs(19.6 / 9.64 - 2) < 0.05, st.slice(0, 60)); }

  // ---- step 6: position and velocity
  { const w = W('kf2'); await w.show(); let m = await w.met(); ok('start: σx 200.0 mm, σv 300.0 mm/s, ρ 0', has(m, 'σx 200.0 mm σv 300.0 mm/s ρ 0.000'));
    await w.click('预测', 350); m = await w.met(); ok('predict 1: ρ 0.148, σx 202.2 mm', has(m, 'σx 202.2 mm', 'ρ 0.148'));
    await w.click('修正', 350); m = await w.met(); ok('correct 1 (position only): σx 29.7 mm, σv 297.4 mm/s', has(m, 'σx 29.7 mm σv 297.4 mm/s'));
    await w.click('预测', 350); m = await w.met(); ok('predict 2: ρ 0.715', has(m, 'ρ 0.715')); const sv = [];
    for (let k = 2; k <= 5; k++) { if (k > 2) await w.click('预测', 350); await w.click('修正', 350); sv.push((await w.met()).match(/σv ([\d.]+) mm\/s/)[1]); }
    ok('σv after corrections 2–5: 241.9, 171.9, 123.1, 92.9 (below 100 at step 5)', sv.join(',') === '241.9,171.9,123.1,92.9', sv.join(', '));
    await w.click('重来'); await w.click('只测速度'); await w.click('预测', 350); await w.click('修正', 350); m = await w.met(); ok('velocity only, step 1: σv 20.0 mm/s, σx 200.0 mm', has(m, 'σx 200.0 mm σv 20.0 mm/s'));
    for (let k = 2; k <= 10; k++) { await w.click('预测', 300); await w.click('修正', 300); } m = await w.met(); ok('velocity only, step 10: σx still 200.1 mm', has(m, '步 10', 'σx 200.1 mm'), m.slice(0, 50)); }

  // ---- step 7: the banana
  { const w = W('banana'); await w.show(); await w.click('5°', 350); let m = await w.met();
    ok('5°: mean 1.992 m vs EKF 2.000 m (0.8 cm); EKF ellipse 86.4 %', has(m, '样本平均 x 1.992 m', 'EKF 的 x 2.000 m', '差 -0.8 cm', 'EKF 2σ 椭圆里的样本 86.4 % 该是 86.5 %'), m.slice(0, 40));
    await w.click('20°', 350); m = await w.met(); ok('20°: mean 1.882 m, EKF 11.8 cm off, ellipse 70.3 %; UKF 1.882 m, 89.8 %', has(m, '样本平均 x 1.882 m', '差 -11.8 cm', 'EKF 2σ 椭圆里的样本 70.3 %', 'UKF 的 x 1.882 m', 'UKF 2σ 椭圆里的样本 89.8 %'));
    await w.click('45°', 350); m = await w.met(); ok('45°: mean 1.469 m, EKF 53.1 cm off, 40.1 %; UKF 1.473 m, 88.5 %', has(m, '样本平均 x 1.469 m', '差 -53.1 cm', 'EKF 2σ 椭圆里的样本 40.1 %', 'UKF 的 x 1.473 m', 'UKF 2σ 椭圆里的样本 88.5 %'));
    await w.set('banana-d', 4, 350); m = await w.met(); ok('45°, d = 4 m: miss doubles to 106.2 cm, still 40.1 %', has(m, '差 -106.2 cm', 'EKF 2σ 椭圆里的样本 40.1 %')); }

  // ---- step 8: the particle filter (nav2_amcl)
  { const w = W('pf'); await w.show(); const upd = async () => num(await w.met(), /更新次数 (\d+)/);
    const stepTo = async (k) => { for (let i = 0; i < 400 && (await upd()) < k; i++) await w.click('下一次更新', 120); };
    const lap = async () => { await w.click('▶ 播放'); await p.waitForTimeout(1500); for (let k = 0; k < 160; k++) { if ((await w.idle()) && has(await w.status(), '这一圈走完了')) return; await p.waitForTimeout(250); } };
    let m = await w.met(); ok('start: 2000 particles, spread', has(m, '粒子数 N 2000', '团数 散开'));
    await stepTo(11); m = await w.met(); ok('update 11: still spread', has(m, '团数 散开', '更新次数 11'), m.slice(0, 70));
    await stepTo(12); m = await w.met(); let st = await w.status(); ok('update 12: 2 clusters; the heavier holds 52 % and is the wrong one, 2.8 m from the truth', has(m, '团数 2', '更新次数 12') && has(st, '较重的一团占 52 %', '现在发布的是错的那一团，离真值 2.8 m'), st.slice(-40));
    await stepTo(16); st = await w.status(); const wrong16 = has(st, '现在发布的是错的那一团'); await stepTo(17); st = await w.status(); ok('the right cluster overtakes it at update 17', wrong16 && has(st, '第 17 次更新') && !has(st, '错的那一团'), st.slice(-30));
    await stepTo(61); m = await w.met(); ok('update 61: still 2 clusters', has(m, '团数 2', '更新次数 61'));
    await stepTo(62); m = await w.met(); ok('update 62: one cluster', has(m, '团数 1', '更新次数 62'));
    await stepTo(63); m = await w.met(); st = await w.status(); ok('update 63: N = 611, "one cluster since update 62"', has(m, '粒子数 N 611') && has(st, '从第 62 次更新起只剩一团'));
    await lap(); m = await w.met(); ok('end of the lap (73 updates): N = 501, error 8.7 cm', has(m, '粒子数 N 501', '误差 8.7 cm', '更新次数 73'), m.slice(0, 80));
    await w.click('重来'); await w.click('教科书：乘起来'); await lap(); st = await w.status();
    ok('textbook product: at update 1 the best beats the second by 1.8 × 10⁵, N_eff = 1.0, 2000 copies; locked on the mirror image 4.2 m away', has(st, '第 1 次更新时', '≈ 1.8 × 10⁵ 倍，N_eff = 1.0', '2000 个粒子几乎全是它的复制品', '锁在了对称的那一边', '离真值 4.2 m'), st.slice(60, 150));
    await w.click('AMCL：加起来'); await w.click('重来'); await lap(); await w.click('绑架'); await lap(); st = await w.status();
    ok('kidnapped, no recovery: still 1 cluster, N_eff = 469, 4.1 m from the truth', has(st, '还剩 1 团，N_eff = 469', '估计离真值 4.1 m'), (st.match(/可是还剩[^。]*。/) || [''])[0]);
    await w.click('重来'); await lap(); await w.click('随机补粒子'); await w.click('绑架'); let found = -1;
    for (let i = 0; i < 80; i++) { await w.click('下一次更新', 120); st = await w.status(); if (has(st, '找回来了')) { found = num(st, /绑架以后第 (\d+) 次更新/); break; } }
    ok('kidnapped with random particles on: back near the truth at the 41st update after the kidnapping', found === 41, 'update ' + found);
    await lap(); st = await w.status(); ok('… 73 random particles in all, 3 cm off at the end of the lap', has(st, '到现在一共补了 73 个', '估计离真值 3 cm'), (st.match(/到现在一共[^。]*。[^。（]*/) || [''])[0]);
    await w.click('全局定位'); await lap(); st = await w.status(); m = await w.met(); ok('global localisation: one cluster from update 39, 1.5 cm at the end', has(st, '从第 39 次更新起只剩一团') && has(m, '误差 1.5 cm'), m.slice(0, 80)); }

  // ---- step 9: late data
  { const w = W('timeline'); await w.show(); let m = await w.met(), st = await w.status();
    ok('treat as now: 3.4 cm = 0.50 × 0.85 × 0.080; the base turned 2.3°', has(m, '杯子位置误差 3.4 cm') && has(st, 'ω·Δt = 2.3°', '0.50 × 0.85 × 0.080 = 3.4 cm'), m.slice(0, 30));
    await w.set('timeline-w', 0); m = await w.met(); ok('turn rate 0: 0.5 cm', has(m, '杯子位置误差 0.5 cm'));
    await w.set('timeline-w', 0.5); await w.click('迟到的扔掉'); m = await w.met(); ok('drop late data: no estimate, all 29 detections dropped', has(m, '没有估计：29 条检测全扔了'), m.slice(0, 40));
    await w.click('退回去重算'); m = await w.met(); st = await w.status(); ok('rewind and replay: 0.4 cm; back 78.0 ms, redo 16 gyro and 4 odometry messages', has(m, '杯子位置误差 0.4 cm') && has(st, '往回 78.0 ms', '16 条陀螺和 4 条里程计'));
    await w.set('timeline-d', 30); m = await w.met(); st = await w.status(); ok('clock offset 30 ms: 1.4 cm (0.50 × 0.85 × 0.030 = 1.3 cm)', has(m, '杯子位置误差 1.4 cm') && has(st, '0.50 × 0.85 × 0.030 = 1.3 cm')); }

  // ---- step 10: SLAM
  { const w = W('slam'); await w.show(); const run = async () => { await w.click('▶ 播放'); await waitIdle(w, 40); };
    await run(); let m = await w.met(), st = await w.status();
    ok('lap: 29 nodes, 28 + 1 edges, drift at the loop 14.0 cm (5.3°), wall 30 cm; node 26 closes the loop', has(m, '节点 29', '28 + 1', '回到起点时的偏差 14.0 cm', '墙的厚度 30 cm') && has(st, '节点 26 回到了走过的地方', '偏了 14.0 cm、朝向 5.3°'), m);
    await w.click('优化', 4500); st = await w.status(); ok('optimise: cost 561 → 0.26; drift 14.0 → 1.6 cm; mean error 7.5 → 1.2 cm; wall 30 → 15 cm', has(st, '代价 561 → 0.28 → 0.26', '偏差 14.0 → 1.6 cm', '平均误差 7.5 → 1.2 cm', '厚度 30 → 15 cm'), st.slice(0, 80));
    await w.click('允许回环'); await w.click('重来'); await run(); m = await w.met(); st = await w.status(); ok('no loop closure: 28 + 0 edges, wall stays 30 cm, nothing to optimise', has(m, '28 + 0', '墙的厚度 30 cm') && has(st, '无事可做'), m);
    await w.click('允许回环'); await w.set('slam-d', 3); await w.click('重来'); await run(); m = await w.met(); ok('drift 3 %: 23.4 cm at the loop, wall 45 cm', has(m, '回到起点时的偏差 23.4 cm', '墙的厚度 45 cm'), m);
    await w.click('优化', 4500); st = await w.status(); ok('drift 3 %, optimised: 23.4 → 1.6 cm, wall 45 → 15 cm', has(st, '偏差 23.4 → 1.6 cm', '厚度 45 → 15 cm')); }

  // ---- step 11: the factor graph
  { const w = W('graph'); await w.show(); let m = await w.met();
    ok('start: 408 / 1296 non-zero (31.5 %), cost 489.2, mean error 20.4 cm', has(m, '非零元 408 / 1296 31.5 %', '489.2', '位置误差 20.4 cm'), m.slice(60, 150));
    await w.click('优化一步', 400); m = await w.met(); ok('step 1: cost 19.6, 7.0 cm', has(m, '19.6', '位置误差 7.0 cm'));
    await w.click('优化一步', 400); m = await w.met(); ok('step 2: cost 17.1, 5.7 cm', has(m, '17.1', '位置误差 5.7 cm'));
    await w.click('优化一步', 400); m = await w.met(); let st = await w.status(); ok('step 3: no change, converged', has(m, '17.1', '位置误差 5.7 cm') && has(st, '已经收敛'));
    await w.click('回环', 400); m = await w.met(); st = await w.status(); ok('loop closure on: 426 non-zero (32.9 %), cost 335.0, x9 20.2 cm off', has(m, '非零元 426 / 1296 32.9 %', '335.0') && has(st, '现在误差 20.2 cm'));
    await w.click('优化一步', 400); m = await w.met(); const a1 = has(m, '29.4', '位置误差 4.6 cm'); await w.click('优化一步', 400); m = await w.met(); ok('then cost 29.4 → 27.3, mean error 4.6 → 4.4 cm', a1 && has(m, '27.3', '位置误差 4.4 cm'));
    await w.click('重来', 400); m = await w.met(); ok('restart keeps the loop closure (426 non-zero)', has(m, '非零元 426 / 1296 32.9 %'));
    await w.click('边缘化最旧的', 400); m = await w.met(); st = await w.status(); const b1 = has(m, '419 / 1089 38.5 %') && has(st, '邻居 x1、l1、l3、x9');
    await w.click('边缘化最旧的', 400); m = await w.met(); const b2 = has(m, '380 / 900 42.2 %'); await w.click('边缘化最旧的', 400); m = await w.met();
    ok('marginalise the oldest ×3: 38.5 %, 42.2 %, 46.8 % non-zero; first prior among x1, l1, l3, x9', b1 && b2 && has(m, '341 / 729 46.8 %'), m.slice(60, 130));
    await w.click('只留最新的（滤波）', 400); m = await w.met(); st = await w.status(); ok('keep only the latest: 81 / 81 full, error 53.0 cm vs 1.1 cm for the whole path', has(m, '81 / 81 100.0 %', '位置误差 53.0 cm') && has(st, '平均误差是 1.1 cm')); }

  // ---- step 12: tracking the cups
  { const w = W('track'); await w.show(); const sw = []; let last = 0;
    for (let f = 1; f <= 120; f++) { await w.click('下一步', 50); const s = num(await w.met(), /ID 交换 (\d+)/); if (s !== last) { sw.push(f / 10); last = s; } }
    let m = await w.met(); ok('default: 6 ID switches (5 between 4.7 and 5.9 s, 1 at 7.7 s), 9 tracks started, A within 2.3 mm', has(m, '共建过 9 条', 'ID 交换 6', 'A 的位置误差 2.3 mm') && sw.length === 6 && sw[0] === 4.7 && sw[4] === 5.9 && sw[5] === 7.7, sw.join(', '));
    await w.click('匀速', 400); m = await w.met(); ok('constant velocity: 3 tracks, 2 switches, the robot’s "A" is really B, 198 mm away', has(m, '共建过 3 条', 'ID 交换 2', 'A 的位置误差 198 mm', '其实是 B'), m.slice(0, 90));
    await w.click('全局最优（匈牙利）', 400); m = await w.met(); ok('+ global assignment: 0 switches, A within 1.2 mm', has(m, 'ID 交换 0', 'A 的位置误差 1.2 mm'));
    await w.click('门限', 400); m = await w.met(); ok('gate off: only 2 tracks, 6 switches, "A" 187 mm away', has(m, '轨迹 2 共建过 2 条', 'ID 交换 6', 'A 的位置误差 187 mm'), m.slice(0, 60)); }

  // ---- step 13: the momentum observer
  { const w = W('observer'); await w.show(); let m = await w.met(), st = await w.status(); const sig = () => num(st, /平时 r 的噪声 σ = ([\d.]+) N·m/);
    ok('K_O 50: theory 10.2 ms; noise of r about 0.07 N·m; double differencing 122 N·m', has(m, '理论 10.2 ms') && has(st, 'σ/Δt² = 122') && sig() > 0.06 && sig() < 0.085, 'σ(r) ' + sig());
    await w.click('推一下', 400); for (let k = 0; k < 60; k++) { await p.waitForTimeout(250); if (!has(await w.status(), '放慢看')) break; } m = await w.met(); const d2 = num(m, /检测延迟 ([\d.]+) ms/); ok('another push: the measured delay is within 1 ms of 10.2 ms', Math.abs(d2 - 10.2) < 1, d2 + ' ms');
    await w.set('observer-k', 16); m = await w.met(); st = await w.status(); ok('K_O 200: theory 2.55 ms; noise of r about 0.29 N·m', has(st, 'KO = 200 s⁻¹') && has(m, '理论 2.55 ms') && sig() > 0.26 && sig() < 0.32, 'σ(r) ' + sig());
    await w.set('observer-k', 0); m = await w.met(); st = await w.status(); const pk5 = num(m, /r 的峰值 ([\d.]+) N·m/); ok('K_O 5: theory 102 ms; noise 0.008 N·m; r climbs only to about 3.2 N·m (5(1 − 1/e) = 3.16)', has(st, 'KO = 5 s⁻¹') && has(m, '理论 102 ms') && Math.abs(pk5 - 3.16) < 0.05 && Math.abs(5 * (1 - Math.exp(-1)) - 3.16) < 0.005 && sig() === 0.008, 'peak ' + pk5);
    await w.set('observer-k', 10); await w.click('模型不准'); await w.set('observer-th', 0.5); m = await w.met(); st = await w.status(); const fa = num(m, /误报 (\d+)/);
    ok('wrong model, threshold 0.5: r rests at -0.30 N·m, 0.20 from the threshold; false alarms appear', has(st, 'r 平时就停在 -0.30 N·m', '只剩 0.20 N·m') && fa >= 1, fa + ' false alarms');
    await w.click('模型不准'); await w.set('observer-th', 2); await w.click('只有电机电流'); m = await w.met(); const pk = num(m, /r 的峰值 ([\d.]+) N·m/); ok('motor current only: theory 11.8 ms; r stays below 5 N·m', has(m, '理论 11.8 ms') && pk < 5, 'peak ' + pk); }

  // ---- step 14: failures and the NIS
  { const w = W('fail'); await w.show(); let m = await w.met();
    ok('normal (a 37.2 s stretch): NIS mean 1.92, 4.0 % above 5.99, 1 / 372 gated, error 0.8 cm', has(m, '位置误差 0.8 cm', 'NIS 平均 1.92', '超过 95 % 线 4.0 %', '被门限挡掉 1 / 372') && has(await w.status(), '这一段 37.2 s 结束'), m.slice(0, 60));
    await w.click('长走廊'); await waitIdle(w, 30); let st = await w.status(); ok('long corridor: ellipse 2.6 → 9.0 cm along the corridor, NIS mean still 1.92', has(st, '拉长到 9.0 cm（进通道时 2.6 cm）', 'NIS 平均 1.92'));
    await w.click('太自信'); await waitIdle(w, 30); st = await w.status(); const a1 = has(st, '报警（6.9 s）'); await w.click('▶ 播放'); await waitIdle(w, 30); st = await w.status();
    ok('over-confident: alarm at 6.9 s; then 302 readings gated, error 11.6 cm', a1 && has(st, '已挡 302 次', '误差 11.6 cm'), (st.match(/已挡[^，]*，[^，]*/) || [''])[0]);
    await w.click('算了两遍'); await waitIdle(w, 30); st = await w.status(); const a2 = has(st, '报警（11.1 s）'); await w.click('▶ 播放'); await waitIdle(w, 30); st = await w.status();
    ok('counted twice: alarm at 11.1 s; at the end NIS mean 7.06, error 11.3 cm', a2 && has(st, 'NIS 平均 7.06', '误差 11.3 cm'));
    await w.click('外参偏了 2°'); await waitIdle(w, 30); st = await w.status(); ok('extrinsic off by 2°: NIS mean 1.92, error 1.2 cm, about 17 cm at 5 m', has(st, 'NIS 平均 1.92', '误差 1.2 cm', '≈ 17 cm'));
    await w.click('被绑架'); await waitIdle(w, 30); st = await w.status(); const a3 = has(st, '报警（6.0 s）', 'd² = 755'); await w.click('重新定位'); await waitIdle(w, 30); st = await w.status();
    ok('kidnapped: alarm at 6.0 s with d² = 755; relocalise brings the error back to 0.7 cm and the alarm goes out', a3 && has(st, '误差回到 0.7 cm。报警已经熄灭'), st.slice(0, 60)); }

  // ---- step 15: the map of methods
  { const w = W('landscape'); await w.show(); let m = await w.met(), st = await w.status(); const card = () => p.evaluate(() => document.querySelector('#landscape-cd').innerText.replace(/\s+/g, ' '));
    ok('25 methods; "Gaussian × present only" has 7', has(m, '显示 25 / 25') && has(st, '高斯 × 只留现在”（7 种）'), st.slice(0, 40));
    await w.click('激光', 350); m = await w.met(); st = await w.status(); ok('lidar: 8 methods', has(m, '显示 8 / 25') && has(st, 'slam_toolbox、粒子 SLAM、LIO-SAM'));
    await w.click('nav2_amcl', 350); const c1 = await card(); await w.click('slam_toolbox', 350); const c2 = await card(); ok('nav2_amcl: particles × present only; slam_toolbox: graph × whole path', has(c1, '粒子 × 只留现在') && has(c2, '图和优化 × 整条路'));
    await w.click('相机', 350); m = await w.met(); st = await w.status(); ok('camera: 7 methods; three keep a window; of the learned ones only FoundationPose keeps just the present', has(m, '显示 7 / 25') && has(st, 'MSCKF、VINS-Mono、cuVSLAM', 'FoundationPose 只管现在这一帧里的物体，DROID-SLAM 和 MASt3R-SLAM 留整条路')); }

  // ---- step 16: the error budget
  { const w = W('budget'); await w.show(); let m = await w.met(), st = await w.status();
    ok('base_link chain: σ 6.28 mm, 2σ 12.56 mm, not enough; detection centre is 63 % of the variance', has(m, '合计 σ 6.28 mm 2σ 12.56 mm', '够不够 不够') && has(st, '检测中心 5.00 mm，占方差的 63 %'), m.slice(0, 40));
    await w.set('budget-t', 0); m = await w.met(); ok('extrinsic translation 0: σ 5.95 mm', has(m, '合计 σ 5.95 mm'));
    await w.set('budget-t', 2); await w.set('budget-k', 2.5); m = await w.met(); ok('detection centre halved: σ 4.55 mm, 2σ 9.10 mm, enough', has(m, '合计 σ 4.55 mm 2σ 9.10 mm', '够不够 够'));
    await w.click('重来'); await w.click('靠近再看一次'); m = await w.met(); st = await w.status(); ok('second look from 0.55 m: 0.76, 3.44, 1.92 mm → σ 4.49 mm, 2σ 8.98 mm, enough', has(m, '合计 σ 4.49 mm 2σ 8.98 mm', '够不够 够') && has(st, '相机离杯子 0.55 m', '深度噪声 0.76 mm', '3.44 mm', '转角误差 1.92 mm'));
    await w.click('走 map 那条'); m = await w.met(); st = await w.status(); ok('via map: σ 42.7 mm; localisation is 99 % of the variance; each would need 1.6 mm', has(m, '合计 σ 42.7 mm') && has(st, '两次定位占了方差的 99 %', '准到 1.6 mm 以内'), m.slice(0, 40)); }

  ok('no page errors', perr.length === 0, perr.join(' | ').slice(0, 200));
  console.log(log.join('\n')); console.log('\n' + (n - bad) + ' / ' + n + ' checks pass' + (bad ? '   <<< ' + bad + ' FAILED' : ''));
  await b.close(); process.exit(bad ? 1 : 0);
})();
