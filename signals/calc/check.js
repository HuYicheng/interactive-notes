// Check the numbers quoted in the "你会看到 / What you will see" lines and figure captions of "Signals and Systems"
// (signals/index.html) against the page itself. It opens the page in a headless browser, operates each interactive the
// way a reader would (following the "先玩 / Try first" prompt literally, including dragging poles with the mouse), and
// compares the readouts with the numbers the text quotes. The small sums the text does itself, and the answers of the
// quiz, are recomputed at the end.
//   usage: node check.js /absolute/path/to/signals/index.html      (takes about 3 minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/signals/index.html'); process.exit(2); }
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
  const part = (s, i) => s.split(' ## ')[i] || '';
  // the text of the slider row that holds an input (label and current value)
  const row = inp => p.evaluate(i => { const e = document.getElementById(i); return (e.closest('.row') || e.parentElement).innerText; }, inp).then(norm);
  // find the slider position whose row shows the frequency nearest to the wanted one
  const seekHz = async (w, inp, want, lo, hi) => { let best = null; for (let v = lo; v <= hi; v++) { await w.set(inp, v, 15); const f = parseFloat(((await row(inp)).match(/([\d.]+) Hz/) || [])[1]); if (best === null || Math.abs(f - want) < Math.abs(best[1] - want)) best = [v, f]; } await w.set(inp, best[0], 300); return best; };
  // drag with the mouse inside a canvas: from(rect) and to(rect) give positions in CSS pixels of the canvas
  const cbox = async sel => { let r; for (let k = 0; k < 6; k++) { r = await p.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, sel); await p.waitForTimeout(250); } return r; };
  const dragTo = async (sel, from, to) => { const r = await cbox(sel); const a = from(r), c = to(r); await p.mouse.move(r.x + a[0], r.y + a[1]); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(r.x + a[0] + (c[0] - a[0]) * k / 8, r.y + a[1] + (c[1] - a[1]) * k / 8); await p.mouse.up(); await p.waitForTimeout(350); };
  const log10 = Math.log10, dB = x => 20 * log10(x), dBp = x => 10 * log10(x);

  // ---- step 0 · the recording
  { sec('step 0 · rec'); const w = W('rec'); await w.show(); let s = await w.status();
    ok('rec, frame ① (start): only the hum, repeating every 20 ms (50 Hz), and the hiss', has(s, '每 20 ms 重复一次，是 50 Hz 的电源带出来的嗡嗡声', '沙沙声'), s);
    await w.click('✓ 人声', 300); await w.click('✓ 拍手', 300); let bt = await w.text('button');
    ok('rec: voice and clap can be switched off; hum, hiss and echo stay on', has(bt, '## 拍手 ## 人声 ## ✓ 嗡嗡声 ## ✓ 沙沙声 ## ✓ 厨房的回声'), bt);
    await w.click('人声', 300); await w.click('拍手', 300); bt = await w.text('button');
    ok('rec: and switched back on', has(bt, '✓ 拍手 ## ✓ 人声'), bt);
    await w.click('③ 啊', 400); s = await w.status();
    ok('rec, frame ③: zoomed to 20 ms, the "ah" repeats every 4.55 ms, 220 times a second, and is not a smooth sine', has(s, '放大到 20 ms', /的波形每 4\.55 ms 重复一次，一秒重复 220 次/, '可它不是一条光滑的正弦'), s);
    await w.click('✓ 厨房的回声', 400); await w.click('② 拍手', 400); s = await w.status();
    ok('rec, frame ② with the echo off: no tail after the clap; the clap lasts a few milliseconds and peaks at 0.6', has(s, '回声已关：拍手和人声直接进了话筒，后面没有拖尾', '拍手只有几毫秒，最高到 0.6'), s);
    await w.click('厨房的回声', 400); s = await w.status();
    ok('rec, frame ② with the echo on: the spikes are reflections off walls, worktop and cupboard doors, gone after half a second', has(s, '是墙、台面和柜门反射回来的同一声拍手', '半秒以后才沉下去') && !s.includes('回声已关'), s);
    const spec = await p.evaluate(() => ({ f0: TB.SPEC.f0, clap: TB.SPEC.clapPeak, hum: TB.SPEC.hum.map(h => h[0]), rt60: TB.SPEC.rt60, fs: TB.FS, n: TB.N }));
    ok('rec, the recipe of the recording: voice at 220 Hz, clap peak 0.6, hum at 50, 100 and 150 Hz, reverberation time 0.5 s, 16 000 samples a second, 32 000 samples', spec.f0 === 220 && spec.clap === 0.6 && spec.hum.join() === '50,100,150' && spec.rt60 === 0.5 && spec.fs === 16000 && spec.n === 32000, JSON.stringify(spec));
    ok('rec: 1 ÷ 220 Hz = 4.55 ms; 1 ÷ 50 Hz = 20 ms', near(1000 / 220, 4.55, 0.005) && 1000 / 50 === 20); }

  // ---- step 1 · a sine as a turning arrow
  { sec('step 1 · sine'); const w = W('sine'); await w.show(); let m = await w.met(), s = await w.status();
    ok('sine at 220 Hz: 220 turns a second, one turn every 4.545 ms', has(m, '频率 f 220 Hz 周期 T = 1/f 4.545 ms') && has(s, '每秒转 220 圈'), m);
    const best = await seekHz(w, 'sine-f', 440, 560, 620); m = await w.met(); s = await w.status();
    ok('sine: the slider position nearest 440 Hz is 439 Hz: 439 turns a second, one turn every 2.278 ms', best[1] === 439 && has(m, '频率 f 439 Hz 周期 T = 1/f 2.278 ms') && has(s, '每秒转 439 圈'), JSON.stringify(best) + ' ' + m);
    ok('sine: 439 ÷ 220 = 2.0, an octave; 1 ÷ 220 = 4.545 ms; 1 ÷ 439 = 2.278 ms', near(439 / 220, 2, 0.01) && near(1000 / 220, 4.545, 0.0006) && near(1000 / 439, 2.278, 0.0006));
    await w.click('加第二个声音', 400); const d0 = await p.evaluate(() => document.getElementById('sine-d').value); const R = {};
    for (const d of [180, 150, 120, 90, 0]) { await w.set('sine-d', d, 250); R[d] = { s: await w.status(), m: await w.met() }; }
    ok('sine, second sound, Δφ = 180° (where it opens): the two arrows cancel, sum 0', d0 === '180' && has(R[180].m, '合起来的幅度 0.00') && has(R[180].s, '合起来是 0，完全抵消'), d0 + ' ' + R[180].m);
    ok('sine, Δφ = 150°: sum 0.26, 5.7 dB quieter than one sound', has(R[150].s, '= 0.26，比一个声音轻 5.7 dB'), R[150].s);
    ok('sine, Δφ = 120°: sum 0.50, as loud as one sound', has(R[120].s, '合起来还是 A = 0.50：和一个声音一样响（0.0 dB）'), R[120].s);
    ok('sine, Δφ = 90°: sum 0.71, +3.0 dB', has(R[90].s, '合起来长 √2·A = 0.71，功率翻倍，+3.0 dB'), R[90].s);
    ok('sine, Δφ = 0°: sum 1.00, twice one sound, 6.0 dB louder', has(R[0].s, '合起来长 2A = 1.00', '比一个声音响 6.0 dB'), R[0].s);
    const sum = d => 2 * 0.5 * Math.abs(Math.cos(d * Math.PI / 360));
    ok('sine: 2A·|cos(Δφ/2)| with A = 0.5 gives 0, 0.26, 0.50, 0.71, 1.00; in dB against one sound: −5.7, 0.0, +3.0, +6.0',
      near(sum(180), 0, 1e-9) && near(sum(150), 0.26, 0.005) && near(sum(120), 0.5, 1e-9) && near(sum(90), 0.71, 0.005) && near(sum(0), 1, 1e-9) && near(dB(sum(150) / 0.5), -5.7, 0.05) && near(dB(sum(90) / 0.5), 3.0, 0.05) && near(dB(sum(0) / 0.5), 6.0, 0.05)); }

  // ---- step 2 · decibels
  { sec('step 2 · db'); const w = W('db'); await w.show(); const R = {};
    for (const g of ['−3 dB', '−6 dB', '−20 dB']) { await w.click(g, 300); R[g] = { m: await w.met(), s: await w.status() }; }
    ok('db, −3 dB: amplitude × 0.708 (about 1/√2), power × 0.501 (half); the voice goes from −20.0 to −23.0 dB', has(R['−3 dB'].m, '增益 G -3 dB 幅度 × 0.708 功率 × 0.501 功率剩 1/2.0 人声 × G -23.0 dB') && has(R['−3 dB'].s, '幅度乘 0.708 ≈ 1/√2', '人声从 -20.0 dB 变成 -23.0 dB'), R['−3 dB'].m);
    ok('db, −6 dB: amplitude × 0.501 (half), power × 0.251 (a quarter)', has(R['−6 dB'].m, '增益 G -6 dB 幅度 × 0.501 功率 × 0.251 功率剩 1/4.0'), R['−6 dB'].m);
    ok('db, −20 dB: amplitude 1/10, power 1/100; the voice at −40.0 dB is as loud as the hum', has(R['−20 dB'].m, '增益 G -20 dB 幅度 × 0.100 功率 × 0.0100 功率剩 1/100 人声 × G -40.0 dB') && has(R['−20 dB'].s, '幅度剩 1/10，功率剩 1/100', '和嗡嗡声（-40.0 dB）一样响了'), R['−20 dB'].m + ' | ' + R['−20 dB'].s);
    ok('db: 10^(−3/20) = 0.708; 10^(−3/10) = 0.501; 10^(−6/20) = 0.501; 10^(−6/10) = 0.251; 1/√2 = 0.707',
      near(Math.pow(10, -3 / 20), 0.708, 0.0005) && near(Math.pow(10, -3 / 10), 0.501, 0.0005) && near(Math.pow(10, -6 / 20), 0.501, 0.0005) && near(Math.pow(10, -6 / 10), 0.251, 0.0005) && near(Math.SQRT1_2, 0.707, 0.0005));
    ok('db, lead-in: RMS 0.1 is −20 dB, 0.01 is −40 dB, 0.0032 is −50 dB (against full scale 1); 10 times the power is +10 dB, 100 times +20 dB',
      near(dB(0.1), -20, 1e-9) && near(dB(0.01), -40, 1e-9) && near(dB(0.0032), -49.9, 0.05) && dBp(10) === 10 && dBp(100) === 20); }

  // ---- step 3 · signal-to-noise ratio and averaging
  { sec('step 3 · snr'); const w = W('snr'); await w.show(); const R = {};
    for (const v of [-50, -40, -30, -20]) { await w.set('snr-n', v, 250); R[v] = { m: await w.met(), s: await w.status() }; }
    ok('snr, noise at −50 dB: SNR 30.0 dB (30.1 dB measured), noise power 1/1000 of the voice, hardly audible', has(R[-50].m, '噪声电平（有效值） -50 dB 信噪比（-20 dB 减噪声电平） 30.0 dB 信噪比，用样本实测 30.1 dB 噪声功率 人声的 1/1000') && has(R[-50].s, '几乎听不出来'), R[-50].m);
    ok('snr, noise at −40 dB: SNR 20.0 dB, the hiss is clearly audible', has(R[-40].m, '信噪比（-20 dB 减噪声电平） 20.0 dB') && has(R[-40].s, '听得见明显的沙沙声'), R[-40].m + ' | ' + R[-40].s.slice(0, 80));
    ok('snr, noise at −30 dB: SNR 10.0 dB, already very noisy', has(R[-30].m, '信噪比（-20 dB 减噪声电平） 10.0 dB') && has(R[-30].s, '已经很吵了'), R[-30].m);
    ok('snr, noise at −20 dB: SNR 0 dB, noise and voice equally loud', has(R[-20].m, '信噪比（-20 dB 减噪声电平） 0.0 dB', '噪声功率 和人声一样') && has(R[-20].s, '信噪比 0 dB：噪声和人声一样响，功率相等'), R[-20].m);
    const A = {}; for (const c of ['平均 4 次', '平均 16 次', '平均 64 次']) { await w.click(c, 400); A[c] = await w.met(); }
    ok('snr, average of 4 at −20 dB: noise −26.0 dB, SNR 6.0 dB', has(A['平均 4 次'], '噪声电平（有效值） -20 → -26.0 dB 信噪比（-20 dB 减噪声电平，再加 10 log10 4） 6.0 dB'), A['平均 4 次']);
    ok('snr, average of 16: SNR 12.0 dB; average of 64: SNR 18.1 dB', has(A['平均 16 次'], '-20 → -32.0 dB', '再加 10 log10 16） 12.0 dB') && has(A['平均 64 次'], '-20 → -38.1 dB', '再加 10 log10 64） 18.1 dB'), A['平均 16 次'] + ' | ' + A['平均 64 次']);
    ok('snr: −20 − (−50) = 30 dB; 10 log10 1000 = 30; 10 log10 4 = 6.0; 10 log10 16 = 12.0; 10 log10 64 = 18.1', -20 + 50 === 30 && near(dBp(1000), 30, 1e-9) && near(dBp(4), 6.0, 0.03) && near(dBp(16), 12.0, 0.05) && near(dBp(64), 18.1, 0.05));
    ok('figure (averaging): 16 equal arrows in line are 16 long; 16 arrows in random directions get √16 = 4 away on average; amplitude gains √16 = 4, power 16', Math.sqrt(16) === 4 && 16 / Math.sqrt(16) === 4 && near(dBp(16), 12.0, 0.05)); }

  // ---- step 4 · harmonics
  { sec('step 4 · harm'); const w = W('harm'); await w.show(); const R = {};
    for (let k = 1; k <= 6; k++) { await w.set('harm-k', k, 250); R[k] = { m: await w.met(), s: await w.status() }; }
    ok('harm, first 3 harmonics: 8.42% of the power', has(R[3].m, '前 3 个占原声功率 8.42%'), R[3].m);
    ok('harm, the 4th harmonic (880 Hz, next to F1 = 850 Hz) alone carries 76.7%; the first 4 make 85.10%', has(R[4].m, '第 4 个谐波（-21.3 dB） 880 Hz 前 4 个占原声功率 85.10%') && has(R[4].s, '紧挨着 F1（850 Hz）', '一个就占原声功率的 76.7%', '粗线已经跟上了淡线的主要起伏'), R[4].m + ' | ' + R[4].s);
    ok('harm, first 5: 96.73%; first 6: 99.74%, difference 25.9 dB below the original, lines almost coincide', has(R[5].m, '前 5 个占原声功率 96.73%') && has(R[6].m, '前 6 个占原声功率 99.74% 差值的有效值（比原声） -25.9 dB') && has(R[6].s, '粗线和淡线几乎重合'), R[5].m + ' | ' + R[6].m);
    ok('harm: 85.10 − 8.42 = 76.7 (the share of the 4th harmonic)', near(85.10 - 8.42, 76.7, 0.03));
    await w.click('打乱相位', 400); const s = await w.status(), m = await w.met();
    ok('harm, phases scrambled: every amplitude unchanged (still 99.74% with 6), the waveform completely different, the sound almost the same', has(s, '相位打乱了：每个谐波的幅度一点没变', '波形完全变了样，可耳朵听起来几乎一样') && has(m, '前 6 个占原声功率 99.74%'), s); }

  // ---- step 5 · the Fourier transform as an average over a turning arrow
  { sec('step 5 · ft'); const w = W('ft'); await w.show(); await w.click('啊 40 ms', 400); const amp = async f => { await w.set('ft-f', f, 120); return parseFloat(((await w.met()).match(/幅度 2\|z̄\| ([\d.]+)/) || [])[1]); };
    const a = {}; for (let f = 800; f <= 1000; f += 10) a[f] = await amp(f); const fmax = Object.keys(a).sort((x, y) => a[y] - a[x])[0];
    ok('ft, 40 ms of "ah", dragging from 800 to 1000 Hz: the dot is furthest out at 880 Hz (the 4th harmonic), 2|z̄| = 0.1246', fmax === '880' && a[880] === 0.1246, fmax + ' ' + a[880]);
    ok('ft, "ah": 0.0081 at 800 Hz; about 0.028 at 860 and 900 Hz; 0.0079 at 950 Hz', a[800] === 0.0081 && near(a[860], 0.028, 0.0006) && near(a[900], 0.028, 0.0006) && a[950] === 0.0079, JSON.stringify([a[800], a[860], a[900], a[950]]));
    await w.set('ft-f', 880, 200); let s = await w.status(); ok('ft: 880 Hz is exactly the 4th harmonic', has(s, 'f = 880 Hz 正好是第 4 个谐波'), s.slice(0, 80));
    await w.click('嗡嗡声 100 ms', 400); const h = {}; for (let f = 20; f <= 200; f += 5) h[f] = await amp(f);
    const peaks = Object.keys(h).map(Number).filter(f => f > 20 && f < 200 && h[f] > h[f - 5] && h[f] > h[f + 5]).sort((x, y) => h[y] - h[x]).slice(0, 3).sort((x, y) => x - y);
    ok('ft, 100 ms of hum: three peaks, at 50, 100 and 150 Hz, with 2|z̄| = 0.0060, 0.0122 and 0.0040; only 0.0017 at 75 Hz', peaks.join() === '50,100,150' && h[50] === 0.006 && h[100] === 0.0122 && h[150] === 0.004 && h[75] === 0.0017, peaks.join() + ' ' + JSON.stringify([h[50], h[100], h[150], h[75]]));
    await w.click('拍手 10 ms', 400); await w.set('ft-f', 1000, 200); s = await w.status();
    ok('ft, 10 ms of clap: no frequency stands out; above half the maximum from 926 Hz to 3788 Hz', has(s, '没有哪一个特别突出', '从 926 Hz 一直散到 3788 Hz', '越短的声音，频谱摊得越宽'), s);
    ok('ft: 880 = 4 × 220; 20 Hz off for 40 ms is 0.80 of a turn; a whole turn (full cancellation) needs 25 Hz', 4 * 220 === 880 && near(20 * 0.040, 0.8, 1e-9) && near(1 / 0.040, 25, 1e-9)); }

  // ---- step 6 · bandwidth
  { sec('step 6 · bw'); const w = W('bw'); await w.show(); await w.click('电话', 400); let m = part(await w.met(), 0), s = part(await w.status(), 0);
    ok('bw, telephone 300–3400 Hz: bandwidth 3100 Hz, 97.67% of the power kept, the 220 Hz fundamental removed, harmonics 2 to 15 left, pitch still 220 Hz',
      has(m, '带宽（上边减下边） 3100 Hz 保留的功率 97.67% 基频 220 Hz 被滤掉了') && has(s, '剩下第 2 到第 15 个谐波', '可你听到的音高还是 220 Hz', '缺失的基频'), m + ' | ' + s);
    const B = {}; for (const t of [40, 10, 1]) { await w.set('bw-t', t, 250); B[t] = part(await w.met(), 1); }
    ok('bw, short tone: Δt 40 ms → Δf 11.0 Hz; 10 ms → 44.1 Hz; 1 ms → 441.3 Hz; the product stays 0.441',
      has(B[40], '时长 Δt（|x|² 的半高宽） 40 ms 带宽 Δf（-3 dB） 11.0 Hz 乘积 Δt·Δf 0.441') && has(B[10], '10 ms 带宽 Δf（-3 dB） 44.1 Hz 乘积 Δt·Δf 0.441') && has(B[1], '1 ms 带宽 Δf（-3 dB） 441.3 Hz 乘积 Δt·Δf 0.441'), B[40] + ' | ' + B[10] + ' | ' + B[1]);
    const c = 2 * Math.LN2 / Math.PI;
    ok('bw: 3400 − 300 = 3100; harmonics 2 to 15 are 440 to 3300 Hz; 2 ln 2 ÷ π = 0.441; ÷ 40 ms = 11.0 Hz, ÷ 10 ms = 44.1 Hz, ÷ 1 ms = 441.3 Hz',
      3400 - 300 === 3100 && 2 * 220 === 440 && 15 * 220 === 3300 && 16 * 220 > 3400 && near(c, 0.441, 0.0005) && near(c / 0.040, 11.0, 0.05) && near(c / 0.010, 44.1, 0.05) && near(c / 0.001, 441.3, 0.05)); }

  // ---- step 7 · envelope, AM and FM
  { sec('step 7 · mod'); const w = W('mod'); await w.show(); await w.click('包络', 400); let m = await w.met(), s = await w.status();
    ok('mod, envelope of the "ah": rises over 60 ms from 0.80 s, plateau about 0.142 = 1.42 × the RMS value 0.100, falls over 120 ms from 1.68 s',
      has(m, '上升（升余弦） 60 ms 下降 120 ms 包络的峰值 0.142 稳定段 1.0–1.6 s 的有效值 0.100') && has(s, '0.80 s 起用 60 ms 升上去', '约 0.142，是有效值 0.100 的 1.42 倍', '1.68 s 起用 120 ms 落下来'), m + ' | ' + s.slice(0, 200));
    await w.click('调幅（AM）', 500); const f5 = await seekHz(w, 'mod-fm', 5, 200, 320); m = await w.met(); s = await w.status();
    ok('mod, AM, carrier 1000 Hz, m = 0.50, modulation 5 Hz: swells 5 times a second; lines at 995, 1000 and 1005 Hz; each sideband 12.0 dB below the carrier',
      f5[1] === 5 && has(m, '载波 fc 1000 Hz 调制频率 fm 5 Hz 调制深度 m 0.50 每条边带比载波：m/2 0.250 = -12.0 dB') && has(s, '每秒起伏 5 次', '载波 1000 Hz 和两条边带 995、1005 Hz'), JSON.stringify(f5) + ' ' + m);
    const f100 = await seekHz(w, 'mod-fm', 100, 700, 780); s = await w.status(); const s100 = s;
    const f200 = await seekHz(w, 'mod-fm', 200, 820, 880); s = await w.status();
    ok('mod, AM: at 100 Hz the sidebands are at 900 and 1100 Hz; the slider position nearest 200 Hz is 199 Hz, sidebands at 801 and 1199 Hz', f100[1] === 100 && has(s100, '两条边带 900、1100 Hz') && f200[1] === 199 && has(s, '两条边带 801、1199 Hz'), JSON.stringify([f100, f200]) + ' ' + s.slice(0, 160));
    await w.set('mod-dp', 120, 300); m = await w.met(); s = await w.status();
    ok('mod, AM, depth 1.20: the envelope 1 + m cos(…) dips to −0.20: overmodulation', has(m, '调制深度 m 1.20', '包络最大 / 最小：1 ± m 2.20 / -0.20') && has(s, '过调制：m = 1.20', '最低 -0.20', '载波上下颠倒', '包络检波器再也取不回原来的调制信号'), m + ' | ' + s);
    await w.click('调频（FM）', 500); await w.click('FM 合成', 500); m = await w.met(); s = await w.status();
    ok('mod, FM synthesis: carrier 1760 Hz, modulation 440 Hz, deviation 880 Hz; sidebands every 440 Hz on multiples of 440 Hz; the pitch heard is 440 Hz, a bright tone',
      has(m, '调制指数 β = Δf/fm 2.00') && has(s, 'FM 合成：载波 1760 Hz，调制频率 440 Hz，Δf = 880 Hz。边带每隔 440 Hz 一条，正好落在 440 Hz 的整数倍上', '听到的却是一个音高 440 Hz 的明亮的音'), m + ' | ' + s.slice(0, 200));
    ok('mod: 0.142 ÷ 0.100 = 1.42 ≈ √2; 20 log10(0.25) = −12.0 dB; 1000 ± 5, ± 100, ± 199; 1 − 1.20 = −0.20; 1760 = 4 × 440; 880 ÷ 440 = 2.00',
      near(0.142 / 0.100, 1.42, 1e-9) && near(Math.SQRT2, 1.41, 0.005) && near(dB(0.25), -12.0, 0.05) && 1000 - 5 === 995 && 1000 + 100 === 1100 && 1000 - 199 === 801 && 1000 + 199 === 1199 && near(1 - 1.2, -0.2, 1e-9) && 1760 === 4 * 440 && 880 / 440 === 2); }

  // ---- step 8 · sampling, aliasing, quantisation
  { sec('step 8 · alias'); const w = W('alias'); await w.show(); await w.click('8 kHz', 300); const R = {};
    for (const f of [3000, 4000, 4500, 5000]) { await w.set('alias-f', f, 250); R[f] = part(await w.met(), 0); }
    ok('alias, fs = 8 kHz, f = 3000 Hz: Nyquist frequency 4000 Hz, 2.67 samples per cycle, heard as 3000 Hz', has(R[3000], '采样率 fs 8000 Hz 奈奎斯特频率 fs/2 4000 Hz 真实频率 f 3000 Hz 听到的频率 f_a 3000 Hz 每个周期的样本 2.67'), R[3000]);
    ok('alias: exactly 2 samples per cycle at 4000 Hz; 4500 Hz looks like 3500 Hz; 5000 Hz looks like 3000 Hz with 1.60 samples per cycle',
      has(R[4000], '每个周期的样本 2.00') && has(R[4500], '真实频率 f 4500 Hz 听到的频率 f_a 3500 Hz') && has(R[5000], '真实频率 f 5000 Hz 听到的频率 f_a 3000 Hz 每个周期的样本 1.60'), R[4000] + ' | ' + R[4500] + ' | ' + R[5000]);
    await w.click('扫频', 500); let s = part(await w.status(), 0);
    ok('alias, the sweep 0 → 8 kHz sampled at 8 kHz: the pitch rises to 4 kHz in the first second, then folds back down to 0', has(s, '2 秒里从 0 升到 8 kHz', '前一秒音调升到 4 kHz；后一秒真实的频率还在升，听到的却折回来往下降，到最后回到 0'), s);
    const Q = {}; for (const b of [16, 8, 6, 4]) { await w.set('alias-q', b, 250); Q[b] = { m: part(await w.met(), 1), s: part(await w.status(), 1) }; }
    ok('alias, quantisation: 16 bits 65536 levels, voice SNR 81.1 dB; 8 bits 256 levels, 32.9 dB; 6 bits 20.8 dB; 4 bits 16 levels, step 0.125, 9.1 dB, harsh and gritty',
      has(Q[16].m, '级数 2^b 65536', '人声实测的信噪比 81.1 dB') && has(Q[8].m, '级数 2^b 256', '人声实测的信噪比 32.9 dB') && has(Q[6].m, '人声实测的信噪比 20.8 dB') && has(Q[4].m, '级数 2^b 16 台阶 Δ = 2/2^b 0.125', '人声实测的信噪比 9.1 dB') && has(Q[4].s, '听起来又刺又沙'), Q[16].m + ' | ' + Q[8].m + ' | ' + Q[6].m + ' | ' + Q[4].m);
    ok('alias: 8000 ÷ 3000 = 2.67; |4500 − 8000| = 3500; |5000 − 8000| = 3000; 8000 ÷ 5000 = 1.60; 2¹⁶ = 65536; 2⁸ = 256; 2 ÷ 2⁴ = 0.125; (81.1 − 32.9) ÷ 8 bits = 6.0 dB a bit',
      near(8000 / 3000, 2.67, 0.005) && Math.abs(4500 - 8000) === 3500 && Math.abs(5000 - 8000) === 3000 && 8000 / 5000 === 1.6 && Math.pow(2, 16) === 65536 && Math.pow(2, 8) === 256 && 2 / 16 === 0.125 && near((81.1 - 32.9) / 8, 6.0, 0.05)); }

  // ---- step 9 · the DFT, windows, the spectrogram
  { sec('step 9 · stft'); const w = W('stft'); await w.show(); const R = {};
    for (const n of ['2048', '1024', '512', '256', '128', '64']) { await w.click(n, 500); R[n] = { m: await w.met(), s: await w.status() }; }
    ok('stft, N = 2048: a piece lasts 128 ms, bins 7.8125 Hz apart, frame chosen at 1.200 s; the clap is smeared over 128 ms', has(R['2048'].m, '窗长 N 2048 时长 N/fs 128 ms 频点间隔 fs/N 7.8125 Hz 选中的时刻 1.200 s') && has(R['2048'].s, '谐波是清清楚楚的细线；可拍手被抹成 128 ms 宽'), R['2048'].m);
    ok('stft, N = 512: 32 ms, bins 31.25 Hz apart, harmonics 7.0 bins apart and clearly separate', has(R['512'].m, '窗长 N 512 时长 N/fs 32 ms 频点间隔 fs/N 31.25 Hz') && has(R['512'].s, '谐波之间隔 7.0 个频点，一条条分得清'), R['512'].m + ' | ' + R['512'].s.slice(60, 160));
    ok('stft, N = 128: 8 ms, harmonics only 1.8 bins apart, blurred; N = 64: 4 ms, bins 250 Hz apart, 0.9 bins between harmonics, the clap a thin vertical line',
      has(R['128'].m, '时长 N/fs 8 ms') && has(R['128'].s, '谐波之间只隔 1.8 个频点，一根根谐波糊成了一片') && has(R['64'].m, '窗长 N 64 时长 N/fs 4 ms 频点间隔 fs/N 250 Hz') && has(R['64'].s, '拍手是一条细细的竖线', '谐波之间只隔 0.9 个频点'), R['128'].s.slice(60, 200) + ' | ' + R['64'].m);
    await w.click('512', 500); await w.click('矩形', 500); let s = await w.status(); const sr = s; await w.click('汉宁', 500); s = await w.status();
    ok('stft, N = 512: rectangular window, side lobes only 13 dB down (leakage); Hann window, −31 dB, at the price of a main lobe twice as wide', has(sr, '矩形窗把信号一刀切下来：旁瓣只低 13 dB', '频谱泄漏') && has(s, '旁瓣低到 -31 dB（矩形窗只有 -13 dB）', '代价是主瓣宽一倍'), sr.slice(-120) + ' | ' + s.slice(-120));
    // the valleys between the harmonics in that frame, computed with the page's own functions
    const fl = await p.evaluate(() => { const R = TB.makeRec(), FS = 16000, N = 512, i0 = Math.round(1.2 * FS) - N / 2, out = {};
      for (const wt of ['rect', 'hann']) { const S = TB.spectrum(R.rec, i0, N, wt, N, FS), db = k => 20 * Math.log10(Math.max(S.mag[k], 1e-30)); let sum = 0;
        for (let h = 1; h <= 6; h++) { const a = Math.ceil(220 * h / S.df) + 1, b = Math.floor(220 * (h + 1) / S.df) - 1; let mn = 1e9; for (let k = a; k <= b; k++) mn = Math.min(mn, db(k)); sum += mn; } out[wt] = sum / 6; }
      return out; });
    ok('stft, frame at 1.2 s, N = 512: the valleys between harmonics 1 to 7 (220 to 1540 Hz) average about −54 dB with the rectangular window and about −74 dB with the Hann window, about 20 dB lower',
      near(fl.rect, -54, 0.6) && near(fl.hann, -74, 0.6) && near(fl.rect - fl.hann, 20, 1), JSON.stringify(fl));
    ok('stft: 2048 ÷ 16000 = 128 ms; 16000 ÷ 2048 = 7.8125 Hz; 16000 ÷ 512 = 31.25 Hz; 220 ÷ 31.25 = 7.0; 220 ÷ 125 = 1.8; 220 ÷ 250 = 0.9',
      2048 / 16 === 128 && 16000 / 2048 === 7.8125 && 16000 / 512 === 31.25 && near(220 / 31.25, 7.0, 0.05) && near(220 / 125, 1.8, 0.05) && near(220 / 250, 0.9, 0.03));
    ok('figure (window): a sine that makes 3.3 cycles in the piece ends at sin(2π × 3.3) = 0.95 and restarts at 0: a jump at every joint; a Hann window is 0 at both ends', near(Math.sin(2 * Math.PI * 3.3), 0.951, 0.001) && near(0.5 - 0.5 * Math.cos(0), 0, 1e-12) && near(0.5 - 0.5 * Math.cos(2 * Math.PI), 0, 1e-12)); }

  // ---- step 10 · impulse response and convolution
  { sec('step 10 · conv'); const w = W('conv'); await w.show(); await w.click('一下', 500); let m = await w.met(), s = await w.status();
    ok('conv, one click into the kitchen: x has 1 sample (0.5 high, at 10 ms); the output is h itself, scaled by 0.5 and shifted by 10 ms', has(m, 'x 的长度（样本） 1 h 的长度 8000 y 的长度 = x + h - 1 8000 y 的峰值 0.500') && has(s, '高 0.5，在 10 ms。输出就是 h 本身，乘 0.5、往后挪 10 ms'), m + ' | ' + s.slice(0, 80));
    await w.click('三下', 600); s = await w.status();
    ok('conv, three clicks (0.5, −0.3, 0.4 at 10, 60, 90 ms): three copies of h add up; the output is 580 ms long', has(s, '三下：0.5、-0.3、0.4，在 10、60、90 ms', '负的那一下发出倒过来的一份', '长 9280 个样本（580 ms）'), s.slice(0, 160));
    await w.click('一小段', 600); s = await w.status(); const sk = s; await w.click('浴室', 700); const sb = await w.status(); await w.click('大厅', 700); const sh = await w.status();
    ok('conv, a bit of "ah" (150 ms, 2400 samples): 650 ms in the kitchen, 1350 ms in the bathroom (RT60 1.2 s), 2650 ms in the large hall (2.5 s)',
      has(sk, '有 150 ms，2400 个样本', '2400 份层层叠在一起', '输出长 650 ms') && has(sb, '输出长 1350 ms', 'RT60 1.2 s') && has(sh, '输出长 2650 ms', '尾巴拖到 2.5 s'), sk.slice(0, 110) + ' | ' + sb.slice(60, 150) + ' | ' + sh.slice(60, 150));
    await w.click('一次回声', 700); s = await w.status();
    ok('conv, one echo (1, then 0.6 after 3 ms): |H| swings between 1.6 (+4.1 dB) and 0.4 (−8.0 dB); dips at 167, 500, 833 Hz …, one every 333 Hz',
      has(s, '这里的 h 只有两下：1，和 3 ms 以后的 0.6', '|H| 在 1 + 0.6 = 1.6（+4.1 dB）和 1 - 0.6 = 0.4（-8.0 dB）之间起伏，低谷在 167、500、833 Hz……每隔 333 Hz = 1/(3 ms) 一个'), s);
    ok('conv: 9280 ÷ 16 = 580 ms; (2400 + 8000 − 1) ÷ 16 = 650 ms; (2400 + 19200 − 1) ÷ 16 = 1350 ms; (2400 + 40000 − 1) ÷ 16 = 2650 ms; 20 log10 1.6 = +4.1 dB; 20 log10 0.4 = −8.0 dB; 1 ÷ 3 ms = 333 Hz; first dip at 167 Hz',
      9280 / 16 === 580 && Math.round((2400 + 8000 - 1) / 16) === 650 && Math.round((2400 + 19200 - 1) / 16) === 1350 && Math.round((2400 + 40000 - 1) / 16) === 2650 && near(dB(1.6), 4.1, 0.05) && near(dB(0.4), -8.0, 0.05) && Math.round(1000 / 3) === 333 && Math.round(500 / 3) === 167); }

  // ---- step 11 · filters
  { sec('step 11 · filt'); const w = W('filt'); await w.show(); await w.click('去嗡嗡声', 600); const R = {}; R[4] = { m: await w.met(), s: await w.status() };
    for (const n of [1, 8]) { await w.set('filt-n', n, 500); R[n] = { m: await w.met(), s: await w.status() }; }
    ok('filt, remove hum (high-pass 140 Hz), order 4: 50/100/150 Hz down by 35.8/12.0/2.0 dB, 220 Hz by 0.1 dB; hum −40.0 → −50.1 dB; SNR 19.6 → 27.1 dB',
      has(R[4].m, '|H(fc)| -3.0 dB 嗡嗡 50 Hz -35.8 dB 嗡嗡 100 Hz -12.0 dB 嗡嗡 150 Hz -2.0 dB 基频 220 Hz -0.1 dB', '嗡嗡声（dB） -40.0 → -50.1', '信噪比（dB） 19.6 → 27.1'), R[4].m);
    ok('filt, order 1: 50 Hz down by only 9.5 dB; hum −45.0 dB; SNR 23.7 dB; still −3.0 dB at the cut-off', has(R[1].m, '|H(fc)| -3.0 dB 嗡嗡 50 Hz -9.5 dB', '嗡嗡声（dB） -40.0 → -45.0', '信噪比（dB） 19.6 → 23.7'), R[1].m);
    ok('filt, order 8: 50 Hz down by 71.6 dB, 150 Hz by only 1.2 dB (95% of the hum left); hum −52.0 dB; SNR 28.0 dB; still −3.0 dB at the cut-off',
      has(R[8].m, '|H(fc)| -3.0 dB 嗡嗡 50 Hz -71.6 dB 嗡嗡 100 Hz -23.4 dB 嗡嗡 150 Hz -1.2 dB', '嗡嗡声（dB） -40.0 → -52.0', '信噪比（dB） 19.6 → 28.0') && has(R[8].s, '150 Hz 那条占了 95%'), R[8].m + ' | ' + R[8].s.slice(100, 260));
    await w.click('去沙沙声', 700); let m = await w.met(), s = await w.status();
    ok('filt, tame hiss (low-pass 4 kHz): hiss −50.1 → −53.1 dB; the hum, 10.1 dB stronger, untouched; SNR only 19.6 → 19.8 dB', has(m, '嗡嗡声（dB） -40.0 → -40.0 沙沙声（dB） -50.1 → -53.1', '信噪比（dB） 19.6 → 19.8') && has(s, '比沙沙声强 10.1 dB'), m + ' | ' + s);
    await w.click('只去 100 Hz', 700); m = await w.met(); s = await w.status();
    ok('filt, just 100 Hz (notch, r = 0.995): a slot 24.8 Hz wide; 50 and 150 Hz remain; hum −46.0 dB; SNR 24.7 dB', has(m, '-3 dB 宽度 24.8 Hz 嗡嗡 50 Hz -0.2 dB 嗡嗡 100 Hz -∞ 嗡嗡 150 Hz -0.1 dB', '嗡嗡声（dB） -40.0 → -46.0', '信噪比（dB） 19.6 → 24.7') && has(s, '剩下的是 50 Hz 和 150 Hz 那两条'), m + ' | ' + s.slice(0, 200));
    const hp = (f, mm) => -dBp(1 + Math.pow(140 / f, 2 * mm));
    ok('filt: Butterworth high-pass at 140 Hz, −10 log10(1 + (140/f)^(2m)): order 4 at 50, 100, 150 Hz = −35.8, −12.0, −2.0 dB; order 1 at 50 Hz = −9.5 dB; order 8 at 50 Hz = −71.6 dB; always −3.0 dB at 140 Hz; half the band = −3 dB',
      near(hp(50, 4), -35.8, 0.1) && near(hp(100, 4), -12.0, 0.1) && near(hp(150, 4), -2.0, 0.1) && near(hp(50, 1), -9.5, 0.1) && near(hp(50, 8), -71.6, 0.1) && near(hp(140, 1), -3.0, 0.02) && near(hp(140, 8), -3.0, 0.02) && near(dBp(0.5), -3.0, 0.02), [hp(50, 4), hp(100, 4), hp(150, 4), hp(50, 1), hp(50, 8)].join(' ')); }

  // ---- step 12 · poles in the s-plane (the poles are dragged with the mouse)
  { sec('step 12 · splane'); const w = W('splane'); await w.show(); await w.click('一个共振', 500); let m = await w.met(), s = await w.status();
    const sp = (sig, F) => r => [46 + (sig + 1000) / 1250 * (r.w - 58), 24 + (r.h - 50) - (F + 3600) / 7200 * (r.h - 50)];
    ok('splane, one resonance: poles at σ = −251 /s, F = 850 Hz; B = 80.0 Hz, Q = 10.6; −60 dB after 27.5 ms; peak 20.5 dB above 0 Hz',
      has(m, 'F = ω/2π 850 Hz B = -σ/π 80.0 Hz Q = F/B 10.6 时间常数 1/|σ| 3.98 ms 衰减 60 dB：6.91/|σ| 27.5 ms') && has(s, 'σ = -251 /s、F = 850 Hz', '峰比 0 Hz 高 20.5 dB'), m + ' | ' + s);
    await dragTo('#splane-a', sp(-Math.PI * 80, 850), sp(-100, 850)); m = await w.met(); s = await w.status();
    ok('splane, pole dragged to σ = −100: B = 31.8 Hz, Q = 26.7, −60 dB after 69.1 ms, peak 28.5 dB', has(m, 'F = ω/2π 850 Hz B = -σ/π 31.8 Hz Q = F/B 26.7', '衰减 60 dB：6.91/|σ| 69.1 ms') && has(s, 'σ = -100 /s', '峰比 0 Hz 高 28.5 dB'), m + ' | ' + s.slice(0, 160));
    await dragTo('#splane-a', sp(-100, 850), sp(-20, 850)); m = await w.met(); s = await w.status();
    ok('splane, pole dragged to σ = −20: B = 6.37 Hz, ringing for 345 ms, peak 42.5 dB', has(m, 'B = -σ/π 6.37 Hz', '衰减 60 dB：6.91/|σ| 345 ms') && has(s, '峰比 0 Hz 高 42.5 dB', '离 jω 轴越近，峰越尖，响得越久'), m + ' | ' + s.slice(0, 160));
    await dragTo('#splane-a', sp(-20, 850), sp(40, 850)); m = await w.met(); s = await w.status();
    ok('splane, pole dragged across the axis to σ = +40: growth by e every 25.0 ms, by 60 dB (× 1000) in 173 ms: unstable', has(m, '放大 e 倍：1/σ 25.0 ms 放大 60 dB：6.91/σ 173 ms') && has(s, '右半平面：σ = +40 /s', '173 ms 放大 60 dB（1000 倍）', '这就是不稳定'), m + ' | ' + s);
    await w.click('元音', 600); const V = {}; for (const v of ['/ɑ/', '/i/', '/u/']) { await w.click(v, 500); V[v] = await w.status(); }
    ok('splane, vowels: /ɑ/ 850, 1220, 2810 Hz; /i/ 310, 2790, 3310 Hz; /u/ 370, 950, 2670 Hz', has(V['/ɑ/'], 'F1 = 850、F2 = 1220、F3 = 2810 Hz') && has(V['/i/'], 'F1 = 310、F2 = 2790、F3 = 3310 Hz') && has(V['/u/'], 'F1 = 370、F2 = 950、F3 = 2670 Hz'), V['/ɑ/'].slice(0, 70) + ' | ' + V['/i/'].slice(0, 70) + ' | ' + V['/u/'].slice(0, 70));
    await w.click('/ɑ/', 500); await dragTo('#splane-a', sp(-Math.PI * 80, 850), sp(-Math.PI * 80, 310)); await dragTo('#splane-a', sp(-Math.PI * 90, 1220), sp(-Math.PI * 90, 2790)); s = await w.status();
    ok('splane, on /ɑ/, F1 dragged to 310 Hz and F2 to 2790 Hz: the poles are almost those of /i/ (F3 2810 against 3310 Hz)', has(s, 'F1 = 310、F2 = 2790、F3 = 2810 Hz', '极点已经被拖动过'), s.slice(0, 120));
    ok('splane: π × 80 = 251; 6.91 ÷ 251 = 27.5 ms; 100 ÷ π = 31.8 Hz; 850 ÷ 31.8 = 26.7; 6.91 ÷ 100 = 69.1 ms; 20 ÷ π = 6.37 Hz; 6.91 ÷ 20 = 345 ms; 1 ÷ 40 = 25.0 ms; 6.91 ÷ 40 = 173 ms; 60 dB = × 1000',
      near(Math.PI * 80, 251, 0.5) && near(Math.log(1000) / (Math.PI * 80) * 1000, 27.5, 0.05) && near(100 / Math.PI, 31.8, 0.05) && near(850 / (100 / Math.PI), 26.7, 0.05) && near(Math.log(1000) / 100 * 1000, 69.1, 0.05) && near(20 / Math.PI, 6.37, 0.005) && near(Math.log(1000) / 20 * 1000, 345, 0.5) && 1000 / 40 === 25 && near(Math.log(1000) / 40 * 1000, 173, 0.5) && near(Math.pow(10, 60 / 20), 1000, 1e-9)); }

  // ---- step 13 · zeros and poles in the z-plane (dragged with the mouse)
  { sec('step 13 · zplane'); const w = W('zplane'); await w.show(); await w.click('陷波 100 Hz', 600); let m = await w.met(), s = await w.status();
    const zp = (re, im, zoom) => r => { const S = Math.min(r.w, r.h) - 44, cx = r.w / 2, cy = r.h / 2 + 4, c = zoom ? .96 : 0, half = zoom ? .068 : 1.3, k = S / 2 / half; return [cx + (re - c) * k, cy - im * k]; };
    const pol = (rr, deg) => [rr * Math.cos(deg * Math.PI / 180), rr * Math.sin(deg * Math.PI / 180)]; const a0 = 360 * 100 / 16000, a1 = 360 * 850 / 16000;
    ok('zplane, notch 100 Hz: zeros on the unit circle at ±2.25° (100 Hz), poles at radius 0.995; notch about 25 Hz wide (24.8 Hz on the curve); the 100 Hz line −41.3 dB → below −120 dB; voice −20.0 → −19.9 dB',
      has(m, '零点：角度 → 频率 ±2.25° → 100 Hz 零点半径 1.0000', '极点半径 0.9950 凹口 -3 dB 宽 ≈ (1 - r)·fs/π 25.5 Hz 录音的 100 Hz 嗡嗡线（dB） -41.3 → < -120 人声，稳定段（dB） -20.0 → -19.9') && has(s, '从曲线上量是 24.8 Hz'), m + ' | ' + s.slice(0, 200));
    await dragTo('#zplane-a', zp(...pol(.995, a0), true), zp(...pol(.99, a0), true)); m = await w.met(); s = await w.status();
    ok('zplane, poles dragged towards the origin, radius 0.99: the notch measures 46.1 Hz', has(m, '极点半径 0.9900') && has(s, '从曲线上量是 46.1 Hz'), m + ' | ' + (s.match(/从曲线上量是[^）]*/) || [''])[0]);
    await dragTo('#zplane-a', zp(...pol(.99, a0), true), zp(...pol(.98, a0), true)); m = await w.met(); s = await w.status();
    ok('zplane, radius 0.98: the notch measures 73.1 Hz and the voice changes too (−18.0 dB)', has(m, '极点半径 0.9800', '人声，稳定段（dB） -20.0 → -18.0') && has(s, '从曲线上量是 73.1 Hz'), m + ' | ' + (s.match(/从曲线上量是[^）]*/) || [''])[0]);
    await dragTo('#zplane-a', zp(...pol(.98, a0), true), zp(...pol(.995, a0), true)); m = await w.met();
    ok('zplane, dragged back to radius 0.995: 25.5 Hz again', has(m, '极点半径 0.9950 凹口 -3 dB 宽 ≈ (1 - r)·fs/π 25.5 Hz'), m);
    await w.click('共振 850 Hz', 600); m = await w.met(); s = await w.status();
    ok('zplane, resonance 850 Hz: poles at radius 0.9844, ±19.1°; peak 20.6 dB above 0 Hz; 440 samples (27.5 ms) to decay by 60 dB', has(m, '极点：角度 → 频率 ±19.1° → 850 Hz 极点半径 0.9844') && has(s, '比 0 Hz 高 20.6 dB', '衰减 60 dB 要 440 个样本（27.5 ms）'), m + ' | ' + s);
    await dragTo('#zplane-a', zp(...pol(Math.exp(-Math.PI * 80 / 16000), a1), false), zp(...pol(1.05, a1), false)); m = await w.met(); s = await w.status();
    ok('zplane, poles dragged outside the circle (radius 1.05): × 1.05 per sample, doubling every 14.2 samples: unstable', has(m, '极点半径 1.0500 每个样本放大 × 1.0500') && has(s, '极点跑到了单位圆外面（r = 1.0500）', '每 14.2 个样本（0.9 ms）翻一倍', '极点必须在单位圆里面，系统才稳定'), m + ' | ' + s);
    await w.click('回声和它的逆', 700); m = await w.met(); s = await w.status();
    ok('zplane, an echo and its inverse: the 48 zeros of 1 + 0.6 z⁻⁴⁸ lie on a ring of radius 0.6^(1/48) = 0.9894; |H| is lowest (−8.0 dB) at 167, 500, 833 Hz …',
      has(m, '48 个零点的半径 0.6^(1/48) = 0.9894 角度 → 频率 ±3.75°, ±11.3° … → 167 Hz, 500 Hz …') && has(s, '48 个零点均匀排在半径 0.6^(1/48) = 0.9894 的圆上', '167、500、833 Hz……最小（-8.0 dB）', '梳状滤波'), m + ' | ' + s);
    ok('zplane: 360° × 100 ÷ 16000 = 2.25°; 360° × 850 ÷ 16000 = 19.1°; e^(−π × 80 ÷ 16000) = 0.9844; (1 − 0.995) × 16000 ÷ π = 25.5 Hz; ln 1000 ÷ −ln 0.9844 = 440 samples = 27.5 ms; ln 2 ÷ ln 1.05 = 14.2; 0.6^(1/48) = 0.9894; 180° ÷ 48 = 3.75° = 167 Hz',
      360 * 100 / 16000 === 2.25 && near(360 * 850 / 16000, 19.1, 0.05) && near(Math.exp(-Math.PI * 80 / 16000), 0.9844, 0.00005) && near(0.005 * 16000 / Math.PI, 25.5, 0.05) && near(Math.log(1000) / (Math.PI * 80 / 16000), 440, 1) && near(440 / 16, 27.5, 1e-9) && near(Math.LN2 / Math.log(1.05), 14.2, 0.05) && near(Math.pow(0.6, 1 / 48), 0.9894, 0.00005) && 180 / 48 === 3.75 && near(3.75 / 360 * 16000, 167, 0.5));
    ok('figure (s-plane to z-plane): z = e^(sT) takes the pole pair of step 12 (σ = −251 /s, 850 Hz) to r = 0.9844, θ = 19.1°; σ < 0 gives r < 1, σ = 0 gives r = 1',
      near(Math.exp(-251.3 / 16000), 0.9844, 0.00005) && near(360 * 850 / 16000, 19.1, 0.05) && Math.exp(-1 / 16000) < 1 && Math.exp(0) === 1); }

  // ---- step 14 · the same ideas in a photo
  { sec('step 14 · img'); const w = W('img'); await w.show(); await p.waitForTimeout(2000); let m = await w.met();
    ok('img, the photo: 256 × 256 pixels; Nyquist 0.5 cycles/pixel; tiles every 32 pixels → 1/32 = 0.031; 6 flicker bands at v = ±0.0234; towel stripes at (0.375, 0.0625); mean brightness 178.6',
      has(m, '图像大小 256 × 256 奈奎斯特频率 0.5 周期/像素 瓷砖：每 32 像素 1/32 = 0.031 闪烁条纹：6 道 v = ±0.0234 抹布条纹 ±(u, v) (0.375,0.0625) 平均亮度（直流） 178.6'), m);
    await w.click('去掉闪烁条纹', 1000); m = await w.met();
    ok('img, remove the flicker bands: their amplitude goes from 6.00 to 0.00; the rest changes by 0.48 grey levels (RMS)', has(m, '条纹的频率 v = ±0.0234 条纹幅度：之前 6.00 条纹幅度：之后 0.00 其余部分的变化（有效值） 0.48'), m);
    await w.click('降采样', 1000); m = await w.met(); let s = await w.status();
    ok('img, downsample by 2 without blurring: new Nyquist 0.25; the towel’s u = 0.375 folds to −0.125; fake stripes with a period of 7.2 pixels (was 2.6): moiré',
      has(m, '小图 128 × 128 新的奈奎斯特频率 0.25 周期/像素 抹布条纹 (u, v) (0.375,0.0625) 折到 (u, v) (-0.125,0.0625) 折回去以后的周期 7.2 px') && has(s, '折回到 0.375 - 0.5 = -0.125', '周期 7.2 像素（原来 2.6），歪向另一边', '这就是摩尔纹'), m + ' | ' + s);
    await w.click('幅度和相位互换', 1200); m = await w.met(); s = await w.status();
    ok('img, magnitude and phase swapped: kitchen magnitude + AH phase looks like AH (0.67 against 0.03); AH magnitude + kitchen phase looks like the kitchen (0.67 against 0.22)',
      has(m, '相关系数：左下与 AH 0.67 相关系数：左下与厨房 0.03 相关系数：右下与厨房 0.67 相关系数：右下与 AH 0.22') && has(s, '左下用厨房的幅度、AH 的相位，看上去是 AH', '右下用 AH 的幅度、厨房的相位，看上去是厨房'), m + ' | ' + s.slice(0, 160));
    await w.click('噪声', 1000); const N = {}; N[1] = await w.met(); await w.click('4 张', 1000); N[4] = await w.met(); await w.click('16 张', 1000); N[16] = await w.met();
    ok('img, noise σ = 3: PSNR 38.6 dB for one shot, 44.6 dB for the average of 4, 50.6 dB for 16, 12.0 dB more', has(N[1], '噪声 σ 3 张数 N 1 均方误差 MSE 9.00 PSNR 38.6 dB') && has(N[4], 'PSNR 44.6 dB 比 1 张多 +6.0 dB') && has(N[16], 'PSNR 50.6 dB 比 1 张多 +12.0 dB'), N[1] + ' | ' + N[4] + ' | ' + N[16]);
    ok('img: 6 ÷ 256 = 0.0234; 1 ÷ 32 = 0.031; 0.375 − 0.5 = −0.125; 1 ÷ |(0.125, 0.0625)| = 7.2 px; 1 ÷ |(0.375, 0.0625)| = 2.6 px; 10 log10(255² ÷ 9) = 38.6 dB; + 10 log10 4 = 6.0; + 10 log10 16 = 12.0',
      near(6 / 256, 0.0234, 0.00005) && near(1 / 32, 0.031, 0.0005) && 0.375 - 0.5 === -0.125 && near(1 / Math.hypot(0.125, 0.0625), 7.2, 0.05) && near(1 / Math.hypot(0.375, 0.0625), 2.6, 0.05) && near(dBp(255 * 255 / 9), 38.6, 0.05) && near(dBp(4), 6.0, 0.03) && near(dBp(16), 12.0, 0.05)); }

  // ---- step 15 · the map of methods
  { sec('step 15 · sp'); await W('sp').show();
    const btn = async l => { await p.evaluate(l => { [...document.querySelectorAll('#sp button')].find(b => b.innerText.replace(/\s+/g, ' ').trim() === l).click(); }, l); await p.waitForTimeout(500); };
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp .spgr')].map(g => ({ name: g.querySelector('.spgh b').innerText.trim(), desc: (g.querySelector('.spgh span') || {}).innerText || '', count: g.querySelector('.spgh i').innerText.trim(), ids: [...g.querySelectorAll('.spk')].map(k => k.getAttribute('data-id')), names: [...g.querySelectorAll('.spk')].map(k => k.firstChild.textContent.trim()), on: [...g.querySelectorAll('.spk.on')].map(k => k.firstChild.textContent.trim()), tiles: [...g.querySelectorAll('.spk')].map(k => k.innerText.replace(/\s+/g, ' ').trim()) })));
    await btn('管什么'); const g1 = await groups(); const ml = g1.find(g => g.name === '机器学习里'); const total = new Set(g1.flatMap(g => g.ids)).size;
    ok('sp: 93 items in all; grouped by what it is for, "In machine learning" has 15', total === 93 && !!ml && ml.ids.length === 15 && ml.count === '15', total + ' ' + (ml && ml.ids.length));
    await p.evaluate(() => { [...document.querySelectorAll('#sp .spk')].find(k => k.firstChild.textContent.trim() === 'SincNet').click(); }); await p.waitForTimeout(500);
    await btn('本页的步'); const g2 = await groups(); const lit = g2.filter(g => g.on.includes('SincNet')).map(g => g.name);
    ok('sp: an item selected under one grouping stays lit after regrouping by "Steps of this page": SincNet lights up in step ⑪', lit.join() === '⑪ 滤波器', lit.join());
    const stepOf = {}; for (let i = 0; i < ml.ids.length; i++) stepOf[ml.names[i]] = g2.filter(g => g.ids.includes(ml.ids[i])).map(g => g.name.slice(0, 1)).join('');
    const want = { '卷积神经网络': '⑩', '用 FFT 训练卷积网络': '⑩', 'Hyena 长卷积': '⑩', '傅里叶特征': '⑤', '傅里叶神经算子': '⑤', '用傅里叶变换混合词元': '⑤', 'WaveNet': '⑧', '不混叠的神经网络': '⑧', 'SincNet': '⑪', '可微数字信号处理': '⑪', '结构化状态空间模型': '⑬', 'Whisper 的对数梅尔谱': '⑨' };
    const rest = Object.keys(stepOf).filter(k => !(k in want));
    ok('sp, the 15 machine-learning items by step: 3 in ⑩ (convolution), 3 in ⑤ (spectrum), 2 in ⑧ (sampling), 2 in ⑪ (filters), 1 in ⑬ (z-transform), 1 in ⑨ (DFT), and the other 3 in ⑭',
      Object.keys(want).every(k => stepOf[k] === want[k]) && rest.length === 3 && rest.every(k => stepOf[k] === '⑭'), JSON.stringify(stepOf));
    await btn('年代'); const g3 = await groups(); const e1 = g3.find(g => g.name === '1900–1949'), e2 = g3.find(g => g.name === '1950–1979');
    ok('sp, grouped by era: 26 items in 1900–1949 ("the age of the telephone and of radio"), second only to the 29 of 1950–1979', !!e1 && !!e2 && e1.ids.length === 26 && e2.ids.length === 29 && g3.every(g => g.ids.length <= 29) && has(e1.desc, '电话和无线电的年代'), g3.map(g => g.name + ' ' + g.ids.length).join('; ') + ' ' + (e1 && e1.desc.slice(0, 20)));
    ok('sp, 1900–1949 includes the decibel (1929), thermal noise (1928), how wide FM is (1922, 1937), the sampling theorem (1915–1949) and Shannon capacity (1927, 1948)',
      ['分贝1929', '热噪声1928', '调频要多宽1922、1937', '采样定理1915–1949', '香农容量1927、1948'].every(x => e1.tiles.includes(x)), e1.tiles.join(' | ')); }

  // ---- the text itself: counts, figure captions, the quiz
  { sec('text'); const tx = await p.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = true; }); const o = { sec: {} }; for (const s of document.querySelectorAll('section')) o.sec[s.id] = s.innerText; o.wg = document.querySelectorAll('.wg').length; o.see = document.querySelectorAll('p.see').length; o.try = document.querySelectorAll('p.try').length; o.fig = document.querySelectorAll('figure.fig').length;
      o.seeIn = [...document.querySelectorAll('section')].filter(s => s.querySelector('.wg')).every(s => s.querySelectorAll('p.see').length === 1 && s.querySelectorAll('p.try').length === 1); return o; });
    ok('page: 16 interactives, each in its own step with one "先玩" prompt and one "你会看到" line; 4 figures', tx.wg === 16 && tx.see === 16 && tx.try === 16 && tx.fig === 4 && tx.seeIn, JSON.stringify([tx.wg, tx.see, tx.try, tx.fig, tx.seeIn]));
    const Q = tx.sec['k-sum'];
    ok('quiz 1: 1 ÷ 4.55 ms = 220 Hz; the 5th harmonic is at 1100 Hz', has(Q, '≈ 220 Hz', '5 × 220 = 1100 Hz') && near(1 / 0.00455, 220, 0.3) && 5 * 220 === 1100);
    ok('quiz 2: 20 log10 10 = 20 dB; power ratio 10² = 100', has(Q, '= 20 dB；功率差 10² = 100 倍') && dB(10) === 20 && 10 * 10 === 100);
    ok('quiz 3: uncorrelated, power doubles: +3 dB; in phase, amplitude doubles: +6 dB', has(Q, '多 3 dB', '多 6 dB') && near(dBp(2), 3.0, 0.02) && near(dB(2), 6.0, 0.03));
    ok('quiz 4: 16 recordings averaged: 10 log10 16 = 12 dB', has(Q, '= 12 dB') && near(dBp(16), 12.0, 0.05));
    ok('quiz 5: Δf ≈ 0.44 ÷ 2 ms = 220 Hz', has(Q, '0.44 / 0.002 s = 220 Hz') && near(0.44 / 0.002, 220, 1e-6));
    ok('quiz 6: AM lines at 900, 1000 and 1100 Hz; FM: β = 500 ÷ 100 = 5; Carson 2 × (500 + 100) = 1200 Hz, from 400 to 1600 Hz', has(Q, '900 Hz 和 1100 Hz 两根边带', 'β = 500 / 100 = 5', '2 × (500 + 100) = 1200 Hz，大约从 400 Hz 到 1600 Hz') && 2 * (500 + 100) === 1200 && 1000 - 600 === 400 && 1000 + 600 === 1600);
    ok('quiz 7: |5000 − 8000| = 3000 Hz', has(Q, '= 3000 Hz') && Math.abs(5000 - 8000) === 3000);
    ok('quiz 8: 16000 ÷ 1024 = 15.6 Hz; 50 Hz is 3 bins', has(Q, '16000 / 1024 = 15.6 Hz', '隔了 3 个频点') && near(16000 / 1024, 15.6, 0.03) && Math.round(50 / 15.625) === 3);
    ok('quiz 9: one echo after 2 ms: dips at 250, 750, 1250 Hz, 500 Hz apart; 1 − 0.5 = 0.5 = −6 dB', has(Q, '250、750、1250 Hz', '间隔 1/0.002 = 500 Hz', '0.5 倍（−6 dB）') && 1 / 0.002 === 500 && 1 / (2 * 0.002) === 250 && near(dB(0.5), -6.0, 0.03));
    ok('quiz 10: 4th-order Butterworth high-pass: −3 dB at the cut-off; a tenth of the cut-off is about −80 dB', has(Q, '总是 −3 dB', '约 −80 dB') && near(-dBp(1 + Math.pow(10, 8)), -80, 0.01));
    ok('quiz 11: poles at −100 ± j2π·440: rings at 440 Hz, time constant 10 ms, bandwidth 100/π = 32 Hz, Q about 14', has(Q, '1/100 s = 10 ms', '100/π ≈ 32 Hz，Q ≈ 14') && near(100 / Math.PI, 32, 0.2) && near(440 / (100 / Math.PI), 14, 0.2));
    ok('quiz 12: zeros at ±90° with fs = 16 kHz remove fs/4 = 4 kHz', has(Q, 'f = fs/4 = 4 kHz') && 16000 / 4 === 4000);
    ok('quiz 13: tiles every 32 px → points 1/32 = 0.031 apart; downsampling by 2: Nyquist 0.25; 0.375 folds to −0.125; 2.6 px stripes become 7.2 px stripes', has(Q, '间隔 1/32 ≈ 0.031 周期/像素', '从 0.5 降到 0.25 周期/像素', '0.375 − 0.5 = −0.125', '2.6 像素一道的细条纹变成约 7.2 像素一道') && near(1 / 32, 0.031, 0.0005)); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
