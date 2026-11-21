// Check the numbers quoted in the "你会看到 / What you will see" lines and figure captions of "Chips, Memory and GPUs"
// (silicon/index.html) against the page itself. It opens the page in a headless browser, operates each interactive the
// way a reader would (following the "先玩 / Try first" prompt literally), and compares the readouts with the numbers
// the text quotes. The small sums the text does itself, and the answers of the quiz, are recomputed at the end.
//   usage: node check.js /absolute/path/to/silicon/index.html      (takes about 2 minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/silicon/index.html'); process.exit(2); }
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

  // ---- step 0 · the time magnifier
  { sec('step 0 · one'); const w = W('one'); await w.show(); await w.click('③ 伸手', 400); await w.click('1 s', 400); let m = await w.met();
    ok('one ③, window 1 s: 163 MB of raw data, 120 camera frames', has(m, '涌进来的原始数据 163 MB ', '相机帧（4 台合计） 120 '), m);
    ok('one ③, 1 s: a large model starts 10 times (the action model), whole-body control runs 1000 times, the current loops 420000 times for 21 joints',
      has(m, '全身控制算了几次 1000 ', '电流环（21 个关节合计） 420000 ', /大模型开始算了几次 10( |$)/), m);
    ok('one: 420000 ÷ 21 = 20000 per joint, 2000 times the action model\'s 10', 420000 / 21 === 20000 && 20000 / 10 === 2000);
    await w.click('0.1 ms', 400); m = await w.met();
    ok('one ③, 0.1 ms: 8 B of data, 0 camera frames, whole-body control 0, current loops 42 (2 per joint)',
      has(m, '涌进来的原始数据 8 B ', '相机帧（4 台合计） 0 ', '全身控制算了几次 0 ', '电流环（21 个关节合计） 42 ') && 42 / 21 === 2, m);
    // the rows of the chart, read from the page's own table of rates and phases
    const rows = await p.evaluate(() => { const s = document.documentElement.innerHTML; const out = []; const re = /\{k:'(\w+)',L:'\w',zh:'([^']+)'[^\n]*?\}[,\]]/g; let m;
      while ((m = re.exec(s))) { const g = k => { const q = new RegExp('[,{]' + k + ':([\\d.]+)').exec(m[0]); return q ? parseFloat(q[1]) : null; };
        out.push({ k: m[1], zh: m[2], r: g('r'), ph: g('ph') || 0, bytes: /bytes:/.test(m[0]), ev: (/ev:(\[\[[\d.,\[\]]+\]\])/.exec(m[0]) || [])[1] || '', on: (/on:\[([\d.]+),([\d.]+)\]/.exec(m[0]) || []).slice(1).map(Number) }); }
      return out; });
    const cnt = (r, t0, win) => { if (!r.r) return 0; if (r.on.length && (t0 < r.on[0] || t0 > r.on[1])) return 0; let c = 0; const k0 = Math.floor((t0 - win / 2 - r.ph) * r.r) - 2;
      for (let k = k0; k < k0 + 6 + win * r.r; k++) { const t = r.ph + k / r.r; if (t >= t0 - win / 2 - 1e-12 && t < t0 + win / 2 - 1e-12) c++; } return c; };
    const moving = rows.filter(r => cnt(r, 5, 1e-4) > 0).map(r => r.zh).join(', ');
    ok('one ③, 0.1 ms: the only rows with an event in that window are the microphones, the current loops and the power switches (12 rows in all)',
      rows.length === 12 && moving === '麦克风 ×4, 电流环 ×21, 功率管开关 ×21', rows.length + ': ' + moving);
    const least = rows.filter(r => cnt(r, 5, 1) > 0 && !r.bytes).map(r => [r.zh, cnt(r, 5, 1)]).sort((a, b) => a[1] - b[1]);
    ok('one ③, 1 s: of the rows that compute, the action model runs least (10) and a current loop most (20000 per joint)',
      least.length && least[0][0] === '动作模型（快）' && least[0][1] === 10 && least[least.length - 1][1] === 20000, JSON.stringify(least));
    await w.click('1 s', 400); await w.click('① 听', 500); let s = await w.status();
    ok('one ①, window back at 1 s: the second around t = 1.40 s', has(s, 't = 1.40 s 为中心的 1 s'), s.slice(-70));
    await w.click('② 看', 500); s = await w.status();
    ok('one ②: the second around t = 2.20 s', has(s, 't = 2.20 s 为中心的 1 s'), s.slice(-70));
    const sys2 = rows.find(r => r.k === 'sys2');
    ok('one ① and ②: the planner (purple bars) starts at 1.45 s and runs 0.45 s, then starts at 2.05 s and runs 0.6 s; both bars lie inside those windows',
      !!sys2 && sys2.zh === '规划模型（慢）' && sys2.ev.startsWith('[[1.45,.45],[2.05,.6],') && 1.45 >= 0.9 && 1.45 + 0.45 <= 1.9 + 1e-9 && 2.05 >= 1.7 && 2.05 + 0.6 <= 2.7, sys2 && sys2.ev); }

  // ---- step 1 · switch, NAND gate, adder, clock
  { sec('step 1 · gate'); const w = W('gate'); await w.show(); await w.click('与非门', 400); const out = [await w.met()];
    await w.click('A：0', 300); out.push(await w.met()); await w.click('B：0', 300); out.push(await w.met()); await w.click('A：1', 300); out.push(await w.met());
    const o = out.map(x => (x.match(/A (\d) B (\d) 输出 (\d)/) || []).slice(1).join(''));
    ok('gate, NAND: the output is 0 only for A = 1, B = 1 (then it is tied to ground); 4 transistors', o.join(',') === '001,101,110,011' && has(out[2], '输出接到 地（0）', '一共几个晶体管 4'), o.join(',') + ' ' + out[2]);
    await w.click('加法器', 400); let s = await w.status(); ok('gate, adder: it opens with 5 + 3 = 8', has(s, '5 + 3 = 8'), s.slice(0, 80));
    const xc = i => Wd => { const nw = Wd < 480, lx = nw ? 28 : 46, dw = nw ? 42 : 84, c5 = (Wd - lx - dw - 6) / 5; return lx + (4 - i + .5) * c5; };
    await w.cvclick('#gate-cv', xc(1), 46); await w.cvclick('#gate-cv', xc(1), 74); await w.cvclick('#gate-cv', xc(3), 74);   // A: 5 → 7, B: 3 → 9
    let m = await w.met(); s = await w.status();
    ok('gate, adder: 7 + 9 = 16; the carry travels 4 stages and leaves at the top as the 5th bit of the sum',
      has(s, '7 + 9 = 16。进位往左传了 4 级，从最高位出去，成了和的第 5 位') && has(m, 'A 7（0111） B 9（1001） A + B 16（10000）', '进位走了几级 4 级', '门延迟（已过 / 最坏） 9 / 9'), s.slice(0, 90) + ' | ' + m);
    const d = []; for (let k = 0; k < 5; k++) { await w.click('一步一步', 500); const mm = await w.met(); d.push((mm.match(/进位走了几级 (\d) 级 门延迟（已过 \/ 最坏） (\d) \/ 9/) || []).slice(1).join(':')); }
    ok('gate, adder step by step: 3 gate delays for the first stage, 2 more for each further stage, 9 in all', d.join(' ') === '0:0 1:3 2:5 3:7 4:9', d.join(' '));
    await w.click('时钟', 400); const f0 = await w.val('gate-f'); const rdc = async f => { await w.set('gate-f', f, 300); return w.met(); };
    m = await rdc(20); ok('gate, clock: opens at 2.0 GHz (slider 0.5 to 5.0 GHz): one period is 500 ps, 150 ps more than the 350 ps path', f0 === '20 [5…50]' && has(m, '时钟频率 2.0 GHz 一拍有多长 500 ps 余量（一拍 - 350 ps） 150 ps'), f0 + ' ' + m);
    m = await rdc(28); ok('gate, clock at 2.8 GHz: 357 ps, 7 ps to spare', has(m, '时钟频率 2.8 GHz 一拍有多长 357 ps 余量（一拍 - 350 ps） 7 ps'), m);
    let first = null; for (let f = 20; f <= 50 && first === null; f++) { const mm = await rdc(f); if (/余量（一拍 - 350 ps） -/.test(mm)) first = f; }
    m = await w.met(); s = await w.status();
    ok('gate, clock, dragging up in steps of 0.1 GHz: the first failure is at 2.9 GHz (period 345 ps, 5 ps short): the register latches an unfinished result',
      first === 29 && has(m, '一拍有多长 345 ps 余量（一拍 - 350 ps） -5 ps') && has(s, '还差 5 ps', '寄存器收进来的是半成品'), first + ' ' + m);
    ok('gate, clock at 2.9 GHz: speed ×1.45, power ×2.18 of 2 GHz; the limit is 1 / 350 ps ≈ 2.86 GHz; the voltage is marked as illustrative',
      has(m, '电压（示意）', '速度，和 2 GHz 比 ×1.45 功率，和 2 GHz 比 ×2.18') && has(s, '1 / 350 ps ≈ 2.86 GHz'), m + ' | ' + s.slice(0, 150));
    ok('gate: 1 ÷ 350 ps = 2.857 GHz; 2.9 ÷ 2.0 = 1.45; 1 ÷ 2.9 GHz = 345 ps', near(1 / 350e-12 / 1e9, 2.857, 0.001) && near(2.9 / 2, 1.45, 1e-9) && Math.round(1e12 / 2.9e9) === 345); }

  // ---- step 2 · a toy CPU; PyTorch calling the GPU
  { sec('step 2 · stack'); const w = W('stack'); await w.show(); await w.click('CPU 执行指令', 400);
    let last = ''; for (let k = 0; k < 60; k++) { await w.click('一步', 150); const mm = await w.met(); if (mm === last) break; last = mm; }
    let m = await w.met(), s = await w.status();
    ok('stack, toy CPU stepped to the end: 6 instructions in 24 clock ticks, 4 ticks each, 12 ns at 2 GHz', has(m, '时钟走了几下 24 做完几条指令 6 / 6 每条几下时钟（CPI） 4 用时（假设 2 GHz） 12 ns'), m);
    ok('stack, toy CPU: y = 3 × 2 + 1 = 7 is written back to memory', has(s, 'y = 3 × 2 + 1 = 7 已经写回内存地址 9'), s.slice(0, 120));
    ok('stack: 24 ÷ 6 = 4; 24 ticks ÷ 2 GHz = 12 ns', 24 / 6 === 4 && near(24 / 2e9 * 1e9, 12, 1e-9));
    await w.click('PyTorch 调用 GPU', 400); const n0 = await w.val('stack-n'); m = await w.met(); s = await w.status();
    ok('stack, PyTorch, 4096 × 4096 (H100): the GPU computes 10.0 µs per call, a command takes 0.90 µs, 4 calls 41.1 µs, the GPU waits for commands 2.2% of the time',
      n0 === '12 [8…13]' && has(m, 'GPU 算一次（理想值） 10.0 µs 发一次命令 0.90 µs', '4 次一共 41.1 µs GPU 在等命令 2.2%') && has(s, 'H100', 'W 是 4096 × 4096 的矩阵（BF16，33.6 MB）'), n0 + ' ' + m);
    await w.set('stack-n', 8, 400); m = await w.met(); s = await w.status();
    ok('stack, PyTorch, smallest matrix 256 × 256: 0.04 µs of GPU work per call; the GPU waits for commands 95% of the time', has(m, 'GPU 算一次（理想值） 0.04 µs 发一次命令 0.90 µs', 'GPU 在等命令 95%') && has(s, 'W 是 256 × 256 的矩阵'), m);
    await w.set('stack-n', 12, 400); await w.click('权重留在显存里', 500); m = await w.met(); s = await w.status();
    ok('stack, 4096 × 4096 with the weights NOT kept in GPU memory: moving W over PCIe takes 524 µs per call; 4 calls 2.14 ms, ×52 slower',
      has(m, '每次搬 W（PCIe） 524 µs 4 次一共 2.14 ms 比留在显存里慢 ×52'), m);
    ok('stack: 524 µs ÷ 10.0 µs = 52; 2.14 ms ÷ 41.1 µs = 52; 4096² × 2 bytes = 33.6 MB', Math.round(524 / 10.0) === 52 && Math.round(2140 / 41.1) === 52 && near(4096 * 4096 * 2 / 1e6, 33.6, 0.05));
    await w.set('stack-n', 10, 400); m = await w.met(); const n1 = await w.val('stack-n');
    ok('stack, 1024 × 1024 (slider at 2¹⁰) with the weights not kept: ×32 slower', n1 === '10 [8…13]' && Math.pow(2, 10) === 1024 && has(m, '比留在显存里慢 ×32'), n1 + ' ' + m); }

  // ---- step 3 · the storage ladder
  { sec('step 3 · mem'); const w = W('mem'); await w.show(); await w.click('8B 规划模型', 300); await w.click('FP8 每个 1 字节', 300); let m = await w.met(), s = await w.status();
    ok('mem, 8B FP8 = 8 GB: fits the robot\'s 128 GB (273 GB/s), one read 29 ms, at most 34 tokens a second; one B200 (180 GB, 8 TB/s): 1 ms, 1000 a second',
      has(m, '模型占多少 8 GB 机器人内存（128 GB） 34 词/秒 一块 B200（180 GB） 1000 词/秒') && has(s, '（273 GB/s）：放得下，读一遍要 29 ms', '（8 TB/s）：读一遍 1 ms，每秒最多 1000 个词'), m + ' | ' + s.slice(0, 200));
    await w.click('70B', 300); m = await w.met(); s = await w.status();
    ok('mem, 70B FP8 = 70 GB: still fits the robot; one read 0.26 s, 3.9 tokens a second; 114 on a B200', has(m, '模型占多少 70 GB 机器人内存（128 GB） 3.9 词/秒 一块 B200（180 GB） 114 词/秒') && has(s, '放得下，读一遍要 0.26 s'), m);
    await w.click('405B', 300); m = await w.met();
    ok('mem, 405B FP8 = 405 GB: fits neither; at least 3 B200s', has(m, '模型占多少 405 GB 机器人内存（128 GB） 放不下 一块 B200（180 GB） 放不下，要 3 块'), m);
    await w.click('换成人的尺度', 500); m = await w.met(); s = await w.status();
    ok('mem, human scale (1 ns → 1 s): register 0.02 s, L1 cache 1 s, memory 80 s, SSD 1.2 days, network about 5 months',
      has(m, '从内存取一个数（人的尺度） 80 秒') && has(s, '把 1 ns 当成 1 s。寄存器 0.02 秒；L1 缓存 1 秒', '要等 80 秒', '从固态硬盘 1.2 天；隔着网络约 5 个月'), m + ' | ' + s.slice(0, 160));
    ok('mem: 8 ÷ 273 = 29 ms; 273 ÷ 8 = 34; 8000 ÷ 8 = 1000; 70 ÷ 273 = 0.26 s; 273 ÷ 70 = 3.9; 8000 ÷ 70 = 114; ⌈405 ÷ 180⌉ = 3',
      Math.round(8 / 273 * 1000) === 29 && Math.round(273 / 8) === 34 && 8000 / 8 === 1000 && near(70 / 273, 0.26, 0.005) && near(273 / 70, 3.9, 0.05) && Math.round(8000 / 70) === 114 && Math.ceil(405 / 180) === 3); }

  // ---- step 4 · the energy of computing and of moving
  { sec('step 4 · energy'); const w = W('energy'); await w.show(); await w.click('16 位整数乘法', 300); let t = await w.text('');
    ok('energy: one 32-bit read from off-chip DRAM costs 640 pJ = 1032 16-bit integer multiplies (0.62 pJ each)', has(t, '读一个 32 位数要 640 pJ，够做 1032 次「16 位整数乘法」（每次 0.62 pJ'), t.slice(0, 200));
    await w.click('32 位整数加法', 300); t = await w.text('');
    ok('energy: … = 6400 32-bit integer additions (0.1 pJ each)', has(t, '640 pJ，够做 6400 次「32 位整数加法」（每次 0.1 pJ）'), t.slice(0, 200));
    await w.click('FP8', 300, 0); t = await w.text('');
    ok('energy: π stored as FP8 is 3.25 (+3.5%): 3 mantissa bits, steps of 0.25 between 2 and 4', has(t, '3 位尾数，存成 3.25，差 +3.5%', '2 到 4 之间只能每隔 0.25 存一个数'), (t.match(/π 用 FP8.{0,120}/) || [t.slice(0, 200)])[0]);
    await w.click('FP4', 300, 0); t = await w.text('');
    ok('energy: π stored as FP4 is 3 (−4.5%); 4 bits have only 15 distinct values', has(t, '存成 3，差 -4.5%', '4 位一共只有 15 个不同的值'), (t.match(/π 用 FP4.{0,120}/) || [t.slice(0, 200)])[0]);
    await w.click('8B', 300); await w.click('FP8', 300, 1); const m = await w.met();
    ok('energy, bottom, 8B FP8: computing one token 6.4 mJ, moving 6.4 × 10¹⁰ bits 1.3 J, ratio 200', has(m, '算：每个词的乘加 6.4 mJ 要搬的比特 6.4 × 10¹⁰ 搬：读一遍权重 1.3 J 搬 ÷ 算 200'), m);
    ok('energy: 640 ÷ 0.62 = 1032; 640 ÷ 0.1 = 6400; 640 pJ ÷ 32 bits = 20 pJ per bit; 8 × 10⁹ × 0.8 pJ = 6.4 mJ; 6.4 × 10¹⁰ × 20 pJ = 1.28 J; 1.28 ÷ 0.0064 = 200; |3.25 − π| ÷ π = 3.5%; |3 − π| ÷ π = 4.5%',
      Math.round(640 / 0.62) === 1032 && Math.round(640 / 0.1) === 6400 && 640 / 32 === 20 && near(8e9 * 0.8e-12, 6.4e-3, 1e-9) && near(6.4e10 * 20e-12, 1.28, 1e-9) && near(1.28 / 6.4e-3, 200, 1e-6)
      && near((3.25 - Math.PI) / Math.PI * 100, 3.5, 0.05) && near((Math.PI - 3) / Math.PI * 100, 4.5, 0.05)); }

  // ---- step 5 · five kinds of chip multiply two 8 × 8 matrices
  { sec('step 5 · arch'); const w = W('arch'); await w.show(); const tot = {}; const st = {};
    for (const c of ['脉动阵列', 'CPU', 'GPU', 'FPGA', '单片机']) { await w.click(c, 350); tot[c] = ((await w.met()).match(/用了几拍 \d+ \/ (\d+)/) || [])[1]; st[c] = await w.status(); }
    ok('arch, 512 multiply-adds: systolic array 22 cycles, CPU 512, GPU 8, FPGA 67, microcontroller 1536', [tot['脉动阵列'], tot.CPU, tot.GPU, tot.FPGA, tot['单片机']].join(',') === '22,512,8,67,1536', JSON.stringify(tot));
    await w.click('脉动阵列', 350); let s = await w.status();
    ok('arch, systolic array: the rows of A enter from the left, the columns of B from the top', has(s, 'A 的各行从左边进、B 的各列从上边进'), s.slice(0, 160));
    let m = ''; for (let k = 0; k < 60; k++) { await w.click('一步', 300); m = await w.met(); if (m.includes('用了几拍 22 / 22')) break; }
    ok('arch, systolic array stepped to the end: 22 of 22 cycles, 64 units', has(m, '用了几拍 22 / 22', /这一拍在算的单元 \d+ \/ 64/), m);
    ok('arch: 3 × 8 − 2 = 22; 8 × 8 × 8 = 512; 64 + 3 = 67; 3 × 512 = 1536', 3 * 8 - 2 === 22 && 8 * 8 * 8 === 512 && 64 + 3 === 67 && 3 * 512 === 1536);
    await w.click('换成很多 if 的代码', 500); const ti = {}, si = {}, mi = {};
    for (const c of ['CPU', 'GPU', '脉动阵列', 'FPGA', '单片机']) { await w.click(c, 400); mi[c] = await w.met(); ti[c] = (mi[c].match(/用了几拍 \d+ \/ (\d+)/) || [])[1]; si[c] = await w.status(); }
    ok('arch, code full of ifs: CPU 192 cycles, microcontroller 576, GPU 17 with utilisation 53%', ti.CPU === '192' && ti['单片机'] === '576' && ti.GPU === '17' && has(si.GPU, '1 + 8 + 8 = 17 拍，利用率 53%'), JSON.stringify(ti) + ' ' + si.GPU.slice(0, 120));
    ok('arch, code full of ifs: the systolic array cannot do it; the FPGA has to be rewired', has(si['脉动阵列'], '脉动阵列：做不了') && has(mi.FPGA, '能改，要重新接线'), si['脉动阵列'].slice(0, 60) + ' | ' + mi.FPGA); }

  // ---- step 6 · CUDA: blocks, waves, branches, layers
  { sec('step 6 · cuda'); const w = W('cuda'); await w.show(); await w.set('cuda-n', 60, 300); await w.click('256', 300); let m = await w.met(), t = await w.text('.row');
    ok('cuda, N = 1 million, 256 threads per block: 3907 blocks, 8 warps per block, 1,000,192 threads', has(t, '元素个数 N 100 万') && has(m, '线程块 3907 每块的 warp 8 线程一共 1,000,192'), t.slice(0, 80) + ' | ' + m.slice(0, 120));
    ok('cuda, B200: 148 SMs × 8 blocks at a time (assumed) = 1184 blocks per wave → 4 waves', has(m, 'SM 个数（B200） 148 每个 SM 同时放（假设） 8 一批最多几块 1184 要分几批 4'), m);
    ok('cuda: ⌈1 000 000 ÷ 256⌉ = 3907; 3907 × 256 − 1 000 000 = 192 idle threads; 256 ÷ 32 = 8; 148 × 8 = 1184; ⌈3907 ÷ 1184⌉ = 4',
      Math.ceil(1e6 / 256) === 3907 && 3907 * 256 - 1e6 === 192 && 256 / 32 === 8 && 148 * 8 === 1184 && Math.ceil(3907 / 1184) === 4);
    await w.click('一批批发出去', 300); await w.settle(); let s = await w.status();
    ok('cuda, dealing out the blocks: ⌈3907 ÷ 1184⌉ = 4 waves', has(s, '⌈3907 ÷ 1184⌉ = 4 批'), s.slice(0, 300));
    ok('cuda, default (all take the if): 3 steps, warp efficiency 100%', has(m, '要走几步 3 warp 的效率 100% 要花的时间 ×1'), m.slice(-80));
    await w.click('一半走 if、一半走 else', 500); m = await w.met();
    ok('cuda, half if / half else: 6 steps, warp efficiency 50%, time ×2', has(m, '要走几步 6 warp 的效率 50% 要花的时间 ×2'), m.slice(-80));
    await w.click('PyTorch', 400); t = await w.text('');
    ok('cuda, layers: PyTorch is a framework, the top layer', has(t, 'PyTorch（框架，最上面一层）'), t.slice(-300)); }

  // ---- step 7 · the roofline
  { sec('step 7 · roof'); const w = W('roof'); await w.show(); await w.click('B200', 300); await w.click('8B', 300); await w.click('FP8', 300); await w.click('逐词 · 1 人', 400); let m = await w.met(), s = await w.status();
    ok('roof, B200, 8B FP8, one user decoding: intensity 2, 16 TFLOPS = 0.4% of the peak, memory-bound', has(m, '算术强度 I（FLOP/字节） 2 实际算力 16 TFLOPS 占峰值 0.4% 卡在 内存带宽'), m);
    ok('roof, B200: FP8 dense peak 4.5 PFLOPS, 8 TB/s, ridge point ≈ 560 FLOP/byte; about 280 users reach it', has(s, 'FP8 稠密峰值 4.5 PFLOPS，带宽 8 TB/s，拐点 I* = 4.5 PFLOPS ÷ 8 TB/s ≈ 560 FLOP/字节', '得约 280 个人一起生成'), s.slice(0, 260));
    await w.click('逐词 · 一批', 400); m = await w.met(); let t = await w.text('.row');
    ok('roof, decoding as a batch, default batch 16: intensity 32, 5.7% of the peak', has(t, '批大小 16') && has(m, '算术强度 I（FLOP/字节） 32 ', '占峰值 5.7% 卡在 内存带宽'), t.slice(0, 60) + ' | ' + m);
    await w.set('roof-b', 895, 250); const m1 = await w.met(); await w.set('roof-b', 903, 250); m = await w.met(); t = await w.text('.row');
    ok('roof, dragging the batch up: at 266 users still memory-bound (95%); at 280 users intensity 560 = the ridge point, 100% of the peak', has(m1, '占峰值 95% 卡在 内存带宽') && has(t, '批大小 280') && has(m, '算术强度 I（FLOP/字节） 560 ', '占峰值 100%'), m1.slice(0, 80) + ' | ' + t.slice(0, 40) + ' | ' + m.slice(0, 80));
    await w.click('Thor（机器人）', 400); s = await w.status();
    ok('roof, Thor: bandwidth 273 GB/s, ridge point ≈ 7600 FLOP/byte', has(s, '带宽 273 GB/s', '≈ 7600 FLOP/字节'), s.slice(0, 200));
    await w.click('逐词 · 1 人', 400); m = await w.met();
    ok('roof, Thor, one user decoding: 0.03% of the peak, 34 tokens a second', has(m, '占峰值 0.03% 卡在 内存带宽', '每秒几个词元 34'), m);
    await w.click('动作模型', 400); m = await w.met(); s = await w.status();
    ok('roof, Thor, one call of the action model: 800 tokens prefilled together, intensity ≈ 1600, left of the ridge point, memory-bound, at least 11 ms',
      has(m, '算术强度 I（FLOP/字节） 1600 ', '卡在 内存带宽 算一次（下限） 11 ms') && has(s, '800 个词元一起预填充', '在拐点左边，内存受限：算一次至少 11 ms'), m + ' | ' + s.slice(-200));
    await w.click('B200', 400); m = await w.met(); s = await w.status();
    ok('roof, B200, the same call: right of the ridge point, compute-bound, at least 1.1 ms', has(m, '卡在 算力 算一次（下限） 1.1 ms') && has(s, '在拐点右边，算力受限：算一次至少 1.1 ms'), m + ' | ' + s.slice(-160));
    ok('roof: 4.5 × 10¹⁵ ÷ 8 × 10¹² = 562 ≈ 560; 560 ÷ 2 = 280; 2 × 8 TB/s = 16 TFLOPS = 0.36% of 4.5 PFLOPS; 2 × 16 = 32; 2070 × 10¹² ÷ 273 × 10⁹ = 7582 ≈ 7600; 2 × 800 = 1600; 273 ÷ 8 = 34',
      near(4.5e15 / 8e12, 562.5, 0.01) && 560 / 2 === 280 && near(16e12 / 4.5e15 * 100, 0.36, 0.005) && near(2070e12 / 273e9, 7582, 1) && 2 * 800 === 1600 && Math.round(273 / 8) === 34); }

  // ---- step 8 · one token's round trip
  { sec('step 8 · token'); const w = W('token'); await w.show(); await w.click('一块 B200 上的 70B', 500); let m = await w.met(), s = await w.status();
    ok('token, 70B on one B200: 8.83 ms per token, 113 tokens a second; reading the 70 GB of parameters is 8.75 ms (99%), computing 32 µs',
      has(m, '一个词元（理想下限） 8.83 ms 每个用户每秒几个词元 113', '最大的一段 读参数 99%') && has(s, '读参数（70 GB）8.75 ms', '计算只要 32 µs'), m + ' | ' + s.slice(0, 200));
    await w.click('8 块 B200 一起跑 70B', 500); m = await w.met(); s = await w.status();
    ok('token, 70B on 8 B200s: each reads its 1/8 in 1.09 ms; KV cache 0.01 ms; 160 all-reduces × 5 µs (assumed) = 0.80 ms; 1.90 ms per token, 525 tokens a second',
      has(m, '一个词元（理想下限） 1.90 ms 每个用户每秒几个词元 525') && has(s, '读参数（每块 8.75 GB）1.09 ms', '0.01 ms；160 次全规约，每次假设 5 µs，共 0.80 ms'), m + ' | ' + s.slice(0, 220));
    await w.set('token-t', 14, 400); m = await w.met(); s = await w.status(); let t = await w.text('.row');
    ok('token, context dragged to 128 000 tokens: reading the KV cache grows to 0.66 ms; 2.55 ms per token', has(t, '上下文长度 128 000') && has(s, '读键值缓存（128 000 个词元，每块 5.24 GB）0.66 ms') && has(m, '一个词元（理想下限） 2.55 ms'), t.slice(0, 60) + ' | ' + m.slice(0, 60));
    await w.click('同样 8 块、一批 64 人', 500); m = await w.met(); s = await w.status();
    ok('token, the same 8 GPUs with a batch of 64: 392 tokens a second per user (25% slower than 525), 25 100 in all (48 times one user)',
      has(m, '每个用户每秒几个词元 392 整组 GPU 每秒一共几个词元 25 100') && has(s, '每个人慢了 25%（每秒 525 → 392 个），整组却是一个人时的 48 倍'), m + ' | ' + s.slice(-200));
    ok('token: 70 GB ÷ 8 TB/s = 8.75 ms; 8.83 ÷ 1.90 = 4.6; 2 × 80 layers = 160; 160 × 5 µs = 0.80 ms; 1.09 + 0.01 + 0.80 = 1.90; 1 − 392 ÷ 525 = 25%; 25 100 ÷ 525 = 48; 1000 ÷ 1.90 = 526',
      near(70 / 8000 * 1000, 8.75, 1e-9) && near(8.83 / 1.90, 4.6, 0.05) && 2 * 80 === 160 && near(160 * 5 / 1000, 0.8, 1e-9) && near(1.09 + 0.01 + 0.80, 1.90, 1e-9) && near((1 - 392 / 525) * 100, 25, 0.5) && near(25100 / 525, 48, 0.3) && near(1000 / 1.90, 525, 2)); }

  // ---- step 9 · the data centre
  { sec('step 9 · dc'); const w = W('dc'); await w.show(); await w.click('70B', 300); await w.click('B200', 300); await w.set('dc-d', 15, 300); await w.set('dc-n', 13, 300); let m = await w.met(), s = await w.status(), t = await w.text('.row');
    ok('dc, 70B, 15 trillion tokens, 10 000 B200s: 6.3 × 10²⁴ operations; one GPU 222 years; 10 000 GPUs 8.1 days', has(t, '训练用的词元数 15 万亿', 'GPU 数量 10 000') && has(s, '算得完：6.3 × 10²⁴ 次运算', '10 000 块 8.1 天（一块 222 年）'), t.slice(0, 120) + ' | ' + s.slice(0, 300));
    ok('dc, one all-reduce: 0.31 s inside a rack, 2.8 s across racks, 9 times slower', has(s, '连得上：全规约一次，柜内 0.31 s，跨柜 2.8 s，慢 9 倍'), s.slice(-200));
    ok('dc, fitting: training state 1.12 TB (16 bytes per parameter) → at least 7 B200s', has(s, '装得下：训练状态 1.12 TB（每个参数 16 字节，还没算中间结果），至少 7 块 B200'), s.slice(0, 200));
    await w.set('dc-n', 17, 300); m = await w.met(); s = await w.status(); t = await w.text('.row');
    ok('dc, 100 000 GPUs: 19 hours; 1 389 racks, 183 MW; 600 000 transceivers (6 per GPU, 10 W each, assumed) = 6 MW = 3.2%',
      has(t, 'GPU 数量 100 000') && has(s, '100 000 块 19 小时') && has(m, '机柜（72 卡） 1 389 用电（每柜 132 kW） 183 MW 光模块（每块 GPU 6 个，假设） 600 000 光模块的电（每个 10 W） 6 MW · 3.2%'), s.slice(0, 200) + ' | ' + m);
    const C = 6 * 7e10 * 1.5e13, sec1 = C / (2.25e15 * 0.4);
    ok('dc: 6 × 7 × 10¹⁰ × 1.5 × 10¹³ = 6.3 × 10²⁴; ÷ (2.25 PFLOPS × 40%) = 7 × 10⁹ s = 222 years; ÷ 10 000 = 8.1 days; ÷ 100 000 = 19 hours',
      near(C, 6.3e24, 1e18) && near(sec1 / 3.156e7, 222, 1) && near(sec1 / 1e4 / 86400, 8.1, 0.05) && near(sec1 / 1e5 / 3600, 19.4, 0.1), [C, sec1 / 3.156e7, sec1 / 1e4 / 86400, sec1 / 1e5 / 3600].join(' '));
    ok('dc: ⌈100 000 ÷ 72⌉ = 1389 racks × 132 kW = 183 MW; 600 000 × 10 W = 6 MW; 6 ÷ (183.3 + 6) = 3.2%; 16 bytes × 7 × 10¹⁰ = 1.12 TB; ⌈1120 ÷ 180⌉ = 7; 2.8 ÷ 0.31 = 9',
      Math.ceil(1e5 / 72) === 1389 && near(1389 * 132 / 1000, 183.3, 0.1) && 6e5 * 10 === 6e6 && near(6 / (183.348 + 6) * 100, 3.2, 0.05) && near(16 * 7e10 / 1e12, 1.12, 1e-9) && Math.ceil(1120 / 180) === 7 && Math.round(2.8 / 0.31) === 9); }

  // ---- step 10 · scaling laws
  { sec('step 10 · scale'); const w = W('scale'); await w.show(); const R = {};
    for (const c of [21, 24, 25]) { await w.set('scale-c', c, 350); R[c] = { m: await w.met(), s: await w.status() }; }
    ok('scale, compute 10²¹: best model 2.9B, loss 2.306, about 95 tokens a second on the robot\'s module', has(R[21].m, '最划算的 N（每参数 20 词元） 2.9B', '损失 L 2.306', '机器人模块 Thor（FP8） 95 词元/秒'), R[21].m);
    ok('scale, compute 10²⁴: best model 91B, 3.0 tokens a second on the robot', has(R[24].m, '最划算的 N（每参数 20 词元） 91B', '机器人模块 Thor（FP8） 3.0 词元/秒'), R[24].m);
    ok('scale, compute 10²⁵: best model 289B, loss 1.912 (floor 1.82); 289 GB of weights fit neither the robot\'s 128 GB nor one B200',
      has(R[25].m, '最划算的 N（每参数 20 词元） 289B', '损失 L 1.912', '机器人模块 Thor（FP8） 放不下 一块 B200（FP8） 放不下') && has(R[25].s, '（底是 1.82）', '权重 289 GB'), R[25].m + ' | ' + R[25].s.slice(0, 200));
    ok('scale: 2.306 − 1.912 = 0.39; 289 ÷ 2.9 = 100; √10 = 3.2; 273 ÷ 2.9 = 94 ≈ 95 (the page uses unrounded N); 273 ÷ 91 = 3.0',
      near(2.306 - 1.912, 0.394, 1e-9) && near(289 / 2.9, 100, 0.5) && near(Math.sqrt(10), 3.2, 0.05) && near(273 / 2.9, 95, 1.5) && near(273 / 91, 3.0, 0.01)); }

  // ---- step 11 · data per second; one clock per chip
  { sec('step 11 · sense'); const w = W('sense'); await w.show(); await w.click('数据', 300); let m = await w.met();
    ok('sense, the opening set-up: 163.1 MB/s, cameras 99.7%, 587 GB an hour', has(m, '合计 163.1 MB/s 相机占 99.7% 一小时 587 GB'), m);
    await w.click('1080p', 300); await w.click('60 帧', 300); m = await w.met();
    ok('sense, cameras at 1080p and 60 fps: 1.17 GB/s, 4.21 TB an hour, 101 TB a day', has(m, '合计 1.17 GB/s', '一小时 4.21 TB 一天 101 TB'), m);
    await w.set('sense-v', 30, 300); await w.set('sense-t', 9, 300); m = await w.met(); let s = await w.status();
    ok('sense, the model looks 30 times a second and remembers 10 minutes: 23 040 tokens a second; KV cache 1.81 TB, 14 times the robot\'s 128 GB',
      has(m, '每秒的词元 23 040 键值缓存（10 分钟） 1.81 TB') && has(s, '放不进 Thor 的 128 GB，是它的 14 倍'), m + ' | ' + s.slice(-200));
    await w.set('sense-t', 6, 300); m = await w.met(); ok('sense, remembering 1 minute: 181 GB', has(m, '键值缓存（1 分钟） 181 GB'), m);
    await w.click('时钟', 400); const pp = (await w.val('sense-p0')) + ' ' + (await w.val('sense-p1'));
    await w.click('开机对一次', 400); m = await w.met(); s = await w.status();
    ok('sense, clocks (camera +20 ppm, IMU −20 ppm) synced once at power-on: 40 µs apart per second; 2.4 ms after a minute, 144 ms after an hour = 14.4 cm at 1 m/s',
      pp === '20 [-50…50] -20 [-50…50]' && has(s, '每过 1 s 两者就差 40 µs：1 分钟 2.4 ms，1 小时 3600 × 40 × 10⁻⁶ ≈ 144 ms') && has(m, '时间戳最多差 2.4 ms 144 ms 手每秒移动 1 m 2.4 mm 14.4 cm'), pp + ' | ' + m + ' | ' + s.slice(0, 200));
    await w.click('PTP 每秒对一次', 400); m = await w.met();
    ok('sense, PTP once a second: at most 40.2 µs apart (0.04 mm at 1 m/s)', has(m, '时间戳最多差 40.2 µs 40.2 µs 手每秒移动 1 m 0.04 mm 0.04 mm'), m);
    await w.click('硬件触发', 400); m = await w.met();
    ok('sense, hardware trigger: 20.1 µs', has(m, '时间戳最多差 20.1 µs 20.1 µs'), m);
    const cam = 1280 * 720 * 3 + 2 * 640 * 480 * 3 + 848 * 480 * 2, rest = 4 * 2 * 16000 + 20 * 1000 + (21 * 12 + 2 * 24) * 1000, tot = cam * 30 + rest;
    ok('sense: cameras (1280 × 720 × 3 + 2 × 640 × 480 × 3 + 848 × 480 × 2) × 30 = 162.7 MB/s; with microphones, IMU and joints 163.1 MB/s; cameras 99.7%; × 3600 = 587 GB',
      near(cam * 30 / 1e6, 162.7, 0.05) && near(tot / 1e6, 163.1, 0.05) && near(cam * 30 / tot * 100, 99.7, 0.05) && near(tot * 3600 / 1e9, 587, 0.5), [cam * 30 / 1e6, tot / 1e6, cam * 30 / tot * 100, tot * 3600 / 1e9].join(' '));
    ok('sense: 3 × 256 × 30 = 23 040; × 600 s × 131 072 bytes = 1.81 TB; (1.81 TB + 16 GB) ÷ 128 GB = 14; × 60 s = 181 GB; 40 ppm × 60 s = 2.4 ms; × 3600 s = 144 ms; 0.144 s × 1 m/s = 14.4 cm',
      3 * 256 * 30 === 23040 && near(23040 * 600 * 131072 / 1e12, 1.81, 0.005) && Math.round((23040 * 600 * 131072 / 1e9 + 16) / 128) === 14 && near(23040 * 60 * 131072 / 1e9, 181, 0.5) && near(40e-6 * 60 * 1000, 2.4, 1e-9) && near(40e-6 * 3600 * 1000, 144, 1e-9) && near(0.144 * 100, 14.4, 1e-9)); }

  // ---- step 12 · the latency budget
  { sec('step 12 · budget'); const w = W('budget'); await w.show(); await w.click('像 π0 那样的动作模型', 500); let m = await w.met(), s = await w.status();
    ok('budget, an action model like π0 (3B, FP8, Thor, 10 Hz): about 29.5 ms of a 100 ms period (30%), keeps up', has(m, '算一次（估算） 29.5 ms 要求的节拍 100 ms 模块忙 30%') && has(s, '跟得上'), m + ' | ' + s.slice(0, 80));
    ok('budget, π0-like: prefilling 800 tokens 18.6 ms; the action expert 11 ms; measured GR00T N1.7 (3B) on Thor at FP8: 44 ms',
      has(s, '预填充：800 个词元', '要 18.6 ms', '出动作：3 亿参数的动作专家走 10 步，每步读 300 MB 参数，共 11 ms', '30 亿参数的 GR00T N1.7 在 Thor 上算一次，TensorRT BF16 81 ms，FP8 44 ms'), s.slice(60, 420));
    await w.click('FP4', 400); m = await w.met(); ok('budget, the same at FP4: about 14.8 ms', has(m, '算一次（估算） 14.8 ms 要求的节拍 100 ms'), m);
    await w.click('问云端的大模型', 500); m = await w.met(); s = await w.status();
    ok('budget, asking a 70B model in the cloud (20 tokens out): about 282 ms; the largest part is bandwidth', has(m, '算一次（估算） 282 ms 要求的节拍 500 ms', '卡在哪 带宽（跟得上）') && has(s, '说 20 个词元：每个都要把 70 GB 参数'), m + ' | ' + s.slice(0, 200));
    await w.set('budget-n', 200, 400); m = await w.met(); let t = await w.text('.row');
    ok('budget, network round trip dragged to 200 ms: 432 ms; the largest part is now the network', has(t, '网络来回 200 ms') && has(m, '算一次（估算） 432 ms', '卡在哪 网络（跟得上）'), t.slice(-60) + ' | ' + m);
    await w.click('未来：身上跑 70B', 500); m = await w.met(); s = await w.status();
    ok('budget, future: 70B on board (FP4, 10 Hz, 5 tokens out): about 912 ms against 100 ms, 9.1 times too slow, bandwidth-bound: 5 × 128 ms = 641 ms to read 35 GB five times',
      has(m, '算一次（估算） 912 ms 要求的节拍 100 ms', '卡在哪 带宽') && has(s, '慢了 9.1 倍。卡在带宽', '说 5 个词元：每个都要把 35 GB 参数读一遍，128 ms × 5 = 641 ms'), m + ' | ' + s.slice(0, 400));
    ok('budget: 2 × 3 × 10⁹ × 800 = 4.8 × 10¹² operations ÷ (517.5 TFLOPS × 0.5) = 18.6 ms; 10 × 0.3 GB ÷ 273 GB/s = 11 ms; 18.6 + 11 = 29.5; 29.5 ÷ 14.8 = 2.0; 35 GB ÷ 273 GB/s = 128 ms; 912 ÷ 100 = 9.1; 282 + 150 = 432',
      near(2 * 3e9 * 800 / (517.5e12 * 0.5) * 1000, 18.6, 0.05) && near(10 * 0.3 / 273 * 1000, 11, 0.05) && near(18.55 + 10.99, 29.5, 0.05) && near(29.5 / 14.8, 2.0, 0.01) && near(35 / 273 * 1000, 128.2, 0.05) && near(912 / 100, 9.1, 0.02) && 282 + (200 - 50) === 432); }

  // ---- step 13 · the robot's computer
  { sec('step 13 · body'); const w = W('body'); await w.show(); await w.click('按六层上色', 400); let m = await w.met(), s = await w.status();
    ok('body, coloured by layer: sensing has the most chips, 33; control is 21 microcontrollers plus the SoC, actuation 21 sets of power transistors; perception, decision and planning share the one SoC',
      has(m, '传感 33 块芯片 感知与估计 1 块：SoC 决策 1 块：SoC，偶尔加云端 规划 1 块：SoC 控制 21 块单片机 + SoC 执行 21 组功率管') && has(s, '传感最多，33 块'), m + ' | ' + s.slice(0, 200));
    ok('body: 4 cameras + 4 microphones + 1 IMU + 2 force sensors + 21 joint encoders + 1 FPGA = 33', has(s, '4 台相机、4 个麦克风、1 个 IMU、2 个力传感器、21 个关节编码器') && 4 + 4 + 1 + 2 + 21 + 1 === 33, s.slice(0, 260));
    await w.click('按时钟上色', 400); m = await w.met();
    ok('body, coloured by clock: 32 free-running clocks; the FPGA is the master clock', has(m, '各自走的钟 32 个 主钟 FPGA'), m);
    await w.click('递水那一下', 500); m = await w.met();
    ok('body, the handover reflex, worst case: ≤ 1 ms + ≤ 1 ms + ≤ 1 ms + 50 µs → the current changes within 3.05 ms; force sensor → real-time core → microcontroller → power transistors',
      has(m, 'tsense（测量） ≤ 1 ms tlink（EtherCAT 上行） ≤ 1 ms tcompute（全身控制 + 下一帧） ≤ 1 ms tact（电流环 + 电机） 50 µs + 几 ms 到电流改变 ≤ 3.05 ms 经过的芯片 力传感器 → 实时核 → 单片机 → 功率管'), m);
    await w.click('交给动作模型', 500); m = await w.met(); ok('body, the same reaction via the action model: about 146 ms, 48 times slower', has(m, '到电流改变 ≈ 146 ms 比反射慢 ×48'), m);
    await w.click('交给云端', 500); m = await w.met(); ok('body, via the cloud: about 352 ms', has(m, '到电流改变 ≈ 352 ms'), m);
    ok('body: 1 + 1 + 1 + 0.05 = 3.05 ms; 146 ÷ 3.05 = 48', near(1 + 1 + 1 + 0.05, 3.05, 1e-9) && Math.round(146 / 3.05) === 48); }

  // ---- step 14 · nine years of data-centre GPUs
  { sec('step 14 · trend'); const w = W('trend'); await w.show(); let m = await w.met(), s = await w.status();
    ok('trend, V100 (2017) → Rubin (2026): compute ×280, memory bandwidth ×21, NVLink ×10, memory capacity ×9', has(m, '算力 V100 → Rubin（FP16 → FP4） ×280 显存带宽 ×21 NVLink（每块 GPU） ×10 显存容量 ×9') && has(s, '从 V100（2017）到 Rubin（2026）'), m + ' | ' + s.slice(0, 120));
    ok('trend: the ridge point rises from 139 to 1823 operations per byte', has(s, 'V100 每从显存读 1 字节要做 139 次运算才喂得饱，Rubin 要 1823 次'), s.slice(0, 300));
    ok('trend, the robot\'s module: Thor\'s bandwidth is 29 times behind the B300 of the same year and 70 times behind Rubin', has(m, 'Thor 的带宽落后同年 B300 29 倍 落后 Rubin 70 倍'), m);
    await w.click('同一精度比', 500); m = await w.met(); s = await w.status();
    ok('trend, at the same precision (16 bits): compute ×32; the other 8.75× (280 ÷ 32) came from going from 16 bits to 4', has(m, '算力 V100 → Rubin（FP16 → BF16） ×32 ') && has(s, '涨了 32 倍；另外的 8.75 倍（280 ÷ 32）'), m + ' | ' + s.slice(0, 200));
    ok('trend: 280 ÷ 32 = 8.75; 280 ÷ 21 = 13 ("more than ten times faster than bandwidth"); 19.2 TB/s ÷ 273 GB/s = 70', 280 / 32 === 8.75 && near(280 / 21, 13.3, 0.05) && near(19200 / 273, 70, 0.5)); }

  // ---- step 15 · routes that have not landed yet
  { sec('step 15 · radar'); const w = W('radar'); await w.show(); await w.click('内存带宽', 400); let s = await w.status();
    ok('radar, column "memory bandwidth": 2 routes aim at it: analogue in-memory computing and digital near-memory computing', has(s, /冲着.内存带宽.的有 2 条：模拟存内计算、数字近存计算（实心，主要冲着）/, '一条在存储里直接算，一条把运算挪到存储旁边'), s.slice(0, 200));
    await w.click('连线', 400); s = await w.status();
    ok('radar, column "interconnect": 2 routes: optical interconnect with co-packaged optics, and computing in the sensor; the two closest to deployment', has(s, /冲着.连线.的有 2 条：光互连和共封装光学、传感器里算/, '一条把铜线换成光，一条在源头少传；这正是离落地最近的两条'), s.slice(0, 200));
    await w.click('对厨房机器人', 400); s = await w.status();
    ok('radar, "for the kitchen robot": most useful would be analogue in-memory computing once mature; a 3B action model needs about three hundred IBM-type chips; usable today: computing in the sensor',
      has(s, '对厨房机器人最有用的，会是模拟存内计算，前提是它成熟：几瓦就能跑一个中等大小的感知或动作模型', '卡在精度和噪声、换算电路和容量', '一个 30 亿参数的动作模型要约三百块', '今天就能用上的是传感器里算'), s.slice(0, 300));
    ok('radar: 3 × 10⁹ weights × 2 to 4 devices ÷ 3.6 × 10⁷ devices per chip = 170 to 330 chips ("about three hundred")', has(s, '约 3600 万个相变器件，每个权重要占 2 到 4 个') && near(3e9 * 2 / 3.6e7, 167, 1) && near(3e9 * 4 / 3.6e7, 333, 1), s.slice(0, 300)); }

  // ---- step 16 · the map of methods
  { sec('step 16 · sp'); await W('sp').show();
    const btn = async l => { await p.evaluate(l => { [...document.querySelectorAll('#sp button')].find(b => b.innerText.replace(/\s+/g, ' ').trim() === l).click(); }, l); await p.waitForTimeout(500); };
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp .spgr')].map(g => ({ name: g.querySelector('.spgh b').innerText.trim(), count: g.querySelector('.spgh i').innerText.trim(), ids: [...g.querySelectorAll('.spk')].map(k => k.getAttribute('data-id')), names: [...g.querySelectorAll('.spk')].map(k => k.firstChild.textContent.trim()) })));
    await btn('管什么'); const byWhat = await groups(); const chuan = byWhat.find(g => g.name === '传'); const total = byWhat.reduce((a, g) => a + g.ids.length, 0);
    ok('sp: 96 items in all; grouped by "what it is for", the group 传 (moving data) has 11', total === 96 && !!chuan && chuan.ids.length === 11 && chuan.count === '11', total + ' ' + (chuan && chuan.ids.length));
    await btn('在哪一层'); const byLayer = await groups(); const where = {}; const nameOf = {};
    for (const g of byLayer) for (let i = 0; i < g.ids.length; i++) if (chuan.ids.includes(g.ids[i])) { (where[g.name] = where[g.name] || []).push(g.names[i]); }
    const dist = Object.keys(where).map(k => k + ' ' + where[k].length).sort().join('; ');
    ok('sp, the 11 items of 传 by layer: interconnect and networks 6, storage 3, devices and manufacturing 1, systems and data centres 1', dist === ['连线和网络 6', '存储 3', '器件和制造 1', '整机和数据中心 1'].sort().join('; '), dist);
    ok('sp, 传: storage = the memory wall, HBM, digital near-memory computing; devices = silicon-interposer packaging; systems = the rack-scale NVLink domain; interconnect includes NVLink, ring all-reduce, optical I/O, co-packaged optics',
      (where['存储'] || []).slice().sort().join('|') === ['内存墙', '数字近存计算', '高带宽内存 HBM'].sort().join('|') && (where['器件和制造'] || []).join() === '硅中介层封装' && (where['整机和数据中心'] || []).join() === '机柜级 NVLink 域'
      && ['NVLink', '环形全规约', '光 I/O', '共封装光学'].every(x => (where['连线和网络'] || []).includes(x)), JSON.stringify(where));
    await btn('年代'); const byEra = await groups(); const late = byEra.find(g => /2020/.test(g.name));
    ok('sp, grouped by era: 48 of the 96 items are from 2020 onwards, exactly half', !!late && late.ids.length === 48 && late.count === '48' && 96 / 2 === 48, byEra.map(g => g.name + ' ' + g.ids.length).join('; '));
    await p.evaluate(() => { [...document.querySelectorAll('#sp .spk')].find(k => k.firstChild.textContent.trim() === '内存墙').click(); }); await p.waitForTimeout(600);
    const rel = await p.evaluate(() => [...document.querySelectorAll('#sp .spk.rel')].map(k => k.firstChild.textContent.trim())); const t = await W('sp').text('');
    ok('sp, tile "the memory wall": 7 related items get a dashed frame', rel.length === 7 && ['高带宽内存 HBM', '屋顶线模型', 'FlashAttention', '模拟存内计算', '数字近存计算', '晶圆级芯片', '只用 SRAM 的推理芯片'].every(x => rel.includes(x)), rel.join(', '));
    const aims = (t.match(/冲着它/g) || []).length;
    ok('sp, the memory wall: 4 routes aim at it (analogue in-memory, digital near-memory, wafer-scale chips, SRAM-only inference chips); HBM is the most direct remedy',
      aims === 4 && has(t, '模拟存内计算冲着它', '数字近存计算冲着它', 'Cerebras 把权重全放进片上 SRAM，也是冲着它', 'Groq 用片上 SRAM 存权重，也是冲着它', 'HBM 是拆内存墙最直接的办法', '屋顶线左边那段斜坡，就是内存墙卡住的地方', 'FlashAttention 快，是因为少读写 HBM'), aims + ' ' + (t.match(/它的亲戚.{0,300}/) || [''])[0]); }

  // ---- the text itself: counts, figure captions, the quiz
  { sec('text'); const tx = await p.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = true; }); const o = { sec: {} }; for (const s of document.querySelectorAll('section')) o.sec[s.id] = s.innerText; o.wg = document.querySelectorAll('.wg').length; o.see = document.querySelectorAll('p.see').length; o.try = document.querySelectorAll('p.try').length; o.fig = document.querySelectorAll('figure.fig').length;
      o.seeIn = [...document.querySelectorAll('section')].filter(s => s.querySelector('.wg')).every(s => s.querySelectorAll('p.see').length === 1 && s.querySelectorAll('p.try').length === 1); return o; });
    ok('page: 17 interactives, each in its own step with one "先玩" prompt and one "你会看到" line; 7 figures', tx.wg === 17 && tx.see === 17 && tx.try === 17 && tx.fig === 7 && tx.seeIn, JSON.stringify([tx.wg, tx.see, tx.try, tx.fig, tx.seeIn]));
    const S = tx.sec;
    ok('figure (HBM stack) agrees with the text of step 3: 8 to 16 DRAM dies in a stack; 1024 data lines per HBM3E stack', has(S['k-mem'], '8 到 16 片 DRAM 叠成一摞', 'HBM3E 每摞 1024 根数据线，HBM4 是 2048 根'), '');
    ok('figure (ring all-reduce) and its card: 2(n − 1) steps; each GPU sends 2(n − 1) × M ÷ n bytes: 1.5 M for the 4 drawn, 1.97 M for 72, so "about 2M"',
      has(S['k-dc'], '两圈一共 2(n − 1) 步') && near(2 * 3 / 4, 1.5, 1e-9) && near(2 * 71 / 72, 1.97, 0.005), '');
    ok('figure (action chunks) agrees with step 12 and the quiz: 50 actions per chunk at 50 a second = 1 s; a new chunk every 25 actions = 0.5 s = twice a second',
      has(S['k-emb'], '一块 50 个动作，机器人每秒执行 50 个', '每执行完 25 个（0.5 秒）', '每秒只要算两次') && 50 / 50 === 1 && 25 / 50 === 0.5 && 1 / 0.5 === 2, '');
    ok('step 4 card: 16-bit multiply 0.62 pJ + add 0.18 pJ = 0.8 pJ per multiply-add', has(S['k-mac'], '0.62 + 0.18 = 0.8 pJ') && near(0.62 + 0.18, 0.8, 1e-9), '');
    // the quiz at the end
    const Q = S['k-sum'];
    ok('quiz 1: 1 ÷ 350 ps ≈ 2.86 GHz; at 3 GHz a period is 333 ps', has(Q, 'fmax = 1 / 350 ps ≈ 2.86 GHz', '只有 333 ps') && Math.round(1e12 / 3e9) === 333);
    ok('quiz 2: (1.0 ÷ 0.8)² × (3 ÷ 2) = 2.34', has(Q, '1.5625 × 1.5 ≈ 2.34') && near(Math.pow(1.0 / 0.8, 2) * 1.5, 2.34, 0.005));
    ok('quiz 3: 1 ÷ (0.05 + 0.95 ÷ 100) = 16.8; the limit is 20', has(Q, '≈ 16.8 倍') && near(1 / (0.05 + 0.95 / 100), 16.8, 0.05) && 1 / 0.05 === 20);
    ok('quiz 4: ⌈10 000 ÷ 128⌉ = 79 blocks, 10 112 threads, 112 idle', has(Q, '= 79 块', '10 112 个线程，闲着 112 个') && Math.ceil(10000 / 128) === 79 && 79 * 128 === 10112 && 10112 - 10000 === 112);
    ok('quiz 5: 273 ÷ 70 = 3.9 tokens a second', has(Q, '273 / 70 ≈ 3.9') && near(273 / 70, 3.9, 0.01));
    ok('quiz 6: 1979 ÷ 3.35 = 590; 2 × 3.35 = 6.7 TFLOPS = 0.34%', has(Q, '≈ 590 FLOP/字节', '6.7 TFLOPS，约 0.34%') && near(1979 / 3.35, 590, 1) && near(6.7 / 1979 * 100, 0.34, 0.005));
    ok('quiz 7: 2 × 32 × 8 × 128 × 2 = 131 072 bytes per token; × 32 000 = 4.2 GB', has(Q, '= 131 072 字节，乘 32 000 约 4.2 GB') && 2 * 32 * 8 * 128 * 2 === 131072 && near(131072 * 32000 / 1e9, 4.2, 0.01));
    ok('quiz 8: 2 × 80 × 5 µs = 0.8 ms', has(Q, '2 × 80 × 5 µs = 0.8 ms') && near(2 * 80 * 5 / 1000, 0.8, 1e-9));
    ok('quiz 9: 16 × 8 × 10⁹ bytes = 128 GB, less than a B200\'s 180 GB', has(Q, '= 128 GB；B200 约 180 GB') && 16 * 8e9 / 1e9 === 128);
    ok('quiz 10: D = 20 × 10⁹ = 2 × 10¹⁰ tokens; C = 6 × 10⁹ × 2 × 10¹⁰ = 1.2 × 10²⁰', has(Q, '= 1.2 × 1020 次运算') && 6 * 1e9 * 2e10 === 1.2e20);
    ok('quiz 11: 1280 × 720 × 3 × 30 = 82.9 MB/s = 299 GB an hour, more than half of 163.1 MB/s', has(Q, '≈ 82.9 MB/s，一小时约 299 GB') && near(1280 * 720 * 3 * 30 / 1e6, 82.9, 0.05) && near(1280 * 720 * 3 * 30 * 3600 / 1e9, 299, 0.5) && 82.9 / 163.1 > 0.5);
    ok('quiz 12: 20 ppm = 20 µs a second; 1 ms ÷ 20 µs = 50 s', has(Q, '1 ms / 20 µs = 50 s') && 1000 / 20 === 50);
    ok('quiz 13: 50 ÷ 25 = 2 calls a second; 25 actions = 0.5 s', has(Q, '每秒 2 次', '25 个动作（0.5 s）') && 50 / 25 === 2);
    ok('quiz 14: 130 W ÷ 2.07 × 10¹⁵ = 0.063 pJ; 1 ÷ 12.4 = 0.081 pJ', has(Q, '≈ 0.063 pJ；1 / 12.4 ≈ 0.081 pJ') && near(130 / 2.07e15 * 1e12, 0.063, 0.0005) && near(1 / 12.4, 0.081, 0.0005)); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
