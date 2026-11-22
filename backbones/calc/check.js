// Check the numbers of "Neural Network Architectures" (backbones/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Try first" prompt literally: pressing buttons, moving sliders, stepping through the walk-throughs) and compares
// the readouts with the numbers quoted in the "你会看到 / What you will see" lines; every check first requires the quoted
// string to be in that line. The interactives are step-by-step demonstrations, not real-time simulations, so the
// readouts are the same on every run. A few numbers are drawn on a canvas only (the bars of "what is left after t
// steps", the 10 refinement passes of the action model, the colours of a chain of blocks): for these the piece of the
// interactive's own code that produces them is cut out of the page's HTML and run here unchanged (see "harness").
// Part B recomputes, with arithmetic written out in this file, the numbers quoted in the formula cards, the paragraphs,
// the tables, the quiz and the figures, and requires each quoted string to be in the page.
//   usage: node check.js /absolute/path/to/backbones/index.html      (takes a few minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const fs = require('fs');
// ---------------------------------------------------------------------------------------------------------------
// harness: pieces of the interactives' own code, cut out of the page source by name
// ---------------------------------------------------------------------------------------------------------------
const H = {};
H.load = file => { const html = fs.readFileSync(file, 'utf8');
  const wsrc = id => { const m = new RegExp('<div class="wg[^"]*" id="' + id + '"').exec(html); if (!m) throw new Error('no interactive ' + id); const j = html.indexOf('<script>', m.index), k = html.indexOf('</script>', j); return html.slice(j + 8, k); };
  return { html, wsrc }; };
const between = H.between = (src, a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error('no "' + a + '"'); const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error('no "' + b + '" after "' + a + '"'); return src.slice(i, j); };
const fnsrc = (src, name) => { const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src); if (!m) throw new Error('no function ' + name);
  let k = src.indexOf('{', m.index), d = 0, q = null;
  for (; k < src.length; k++) { const c = src[k]; if (q) { if (c === '\\') k++; else if (c === q) q = null; } else if (c === "'" || c === '"' || c === '`') q = c; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; } }
  return src.slice(m.index, k + 1); };
// the timeline of the opening interactive: its list of networks (when each one runs) and its own cnt(N, t), the number of calls up to time t
H.kit = P => { const s = P.wsrc('kit'); return new Function(between(s, 'const NW=[', 'let bi=') + fnsrc(s, 'cnt') + ';return {NW, cnt};')(); };
// the number formatting of the recurrent interactive (step ⑥): fLeft(v) writes "what is left" on the bars
H.rnnFmt = P => { const s = P.wsrc('rnn'); return new Function('X', 'st', between(s, "const NB=", 'const fB=') + ';return {fLeft, AQ: r3(sg(-2*2+8))};')({ lang: 'zh' }, { gate: false }); };
// the main operation (the first one listed) of every operation block of a network's chain in the building-block interactive (step ⑭)
H.chain = (P, firstBlockZh, n) => { const s = P.wsrc('build'); const i = s.indexOf("'" + firstBlockZh + "'"); if (i < 0) throw new Error('no block ' + firstBlockZh);
  const seg = s.slice(s.lastIndexOf('O([', i)); const out = []; const re = /\bO\(\[([^\]]*)\],'([^']*)'/g; let m; while (out.length < n && (m = re.exec(seg))) out.push({ ops: m[1].replace(/'/g, '').split(','), zh: m[2] }); return out; };

const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/backbones/index.html'); process.exit(2); }
  const P = H.load(file);
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(600);
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined && !cond ? '   [' + String(got).slice(0, 600) + ']' : '')); };
  // readouts and text are compared with thousands separators removed (11,689,512 -> 11689512) and the minus sign as a hyphen
  const norm = s => s.replace(/[\u2060\u200b]/g, '').replace(/\s+/g, ' ').replace(/\u2212/g, '-').replace(/(\d),(?=\d{3}(?!\d))/g, '$1').trim();
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(500); },
    // click a control by its label; nth picks the n-th control with exactly that label
    click: async (label, wait, nth) => { const r = await p.evaluate(([i, l, nth]) => { const nm = s => s.replace(/\s+/g, ' ').trim();
        const els = [...document.getElementById(i).querySelectorAll('button,[role=button],label')].filter(e => e.getClientRects().length > 0);
        let e; if (nth !== null) e = els.filter(x => nm(x.innerText) === l)[nth];
        else e = els.find(x => nm(x.innerText) === l) || els.find(x => nm(x.innerText).startsWith(l)) || els.find(x => nm(x.innerText).includes(l));
        if (!e) return 'no control "' + l + '"'; e.click(); return 'ok' }, [id, label, nth === undefined ? null : nth]);
      if (r !== 'ok') { bad++; log.push('FAIL ' + id + ': ' + r); } await p.waitForTimeout(wait || 250); },
    set: async (inp, v, wait) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(wait || 250); },
    // the row of a slider: its label and the value it shows
    row: (inp) => p.evaluate(i => { const e = document.getElementById(i); return (e.closest('.row') || e.parentElement).innerText; }, inp).then(norm),
    // move a slider until its row shows the wanted text; returns false if no position does
    seek: async function (inp, want) { const [lo, hi] = await p.evaluate(i => { const e = document.getElementById(i); return [+e.min, +e.max]; }, inp); for (let v = lo; v <= hi; v++) { await this.set(inp, v, 40); if ((await this.row(inp)).includes(want)) { await p.waitForTimeout(250); return true; } } return false; },
    // the readouts (class "met": label and value pairs; some interactives have two groups) and the status lines
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .met')].map(m => m.innerText).join(' ## '), id).then(norm),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    text: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll(s ? '#' + i + ' ' + s : '#' + i)].filter(e => e.getClientRects().length > 0).map(m => m.innerText).join(' ## '), [id, sel || '']).then(norm),
    // press "下一步" until the status stops changing; returns every status on the way
    walk: async function (max, wait) { const out = []; let last = null; for (let k = 0; k < (max || 40); k++) { const s = await this.status(); if (s === last) break; out.push(s); last = s; await this.click('下一步', wait || 250); } return out; },
  });
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const lack = (s, ...res) => res.filter(re => !(re instanceof RegExp ? re.test(s) : s.includes(re))).join(' ¦ ');
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const sec = t => log.push('-- ' + t);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/,/g, '').replace('−', '-')) : NaN; };
  // the visible Chinese text of a section, folds opened; the "你会看到" line of a section
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);
  const IDS = ['k-open', 'k-units', 'k-neuron', 'k-layer', 'k-mlp', 'k-conv', 'k-cnn', 'k-rnn', 'k-attn', 'k-xfmr', 'k-vit', 'k-audio', 'k-unet', 'k-point', 'k-multi', 'k-combo', 'k-size', 'k-sum'];
  const SEE = {}; for (const id of IDS.slice(0, 17)) SEE[id] = await p.evaluate(i => document.querySelector('#' + i + ' p.see').innerText, id).then(norm);
  // every string must be in the "你会看到" line of that step; returns the missing ones
  const see = (id, ...strs) => strs.every(s => SEE[id].includes(s));
  const seeMiss = (id, ...strs) => strs.filter(s => !SEE[id].includes(s)).join(' ¦ ');
  // one check: the strings are in the see line AND the readout contains what it should
  const both = (name, id, strs, readout, ...res) => ok(name, see(id, ...strs) && has(readout, ...res), 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ readout lacks: ' + lack(readout, ...res) + ' ¦¦ readout: ' + readout.slice(0, 300));

  // =============================================================================================================
  // Part A: the interactives, operated along their prompts
  // =============================================================================================================
  let w, m, s, t;
  sec('step 0 · the ten seconds (kit)');
  w = W('kit'); await w.show();
  m = await w.met(); s = await w.status();
  both('kit: the wake-word network decides every 0.1 s, 3.8 million operations a time', 'k-open', ['每 0.1 秒判断一次', '每次约 380 万次运算'], m + s, '每 0.1 s', '3.8 M 次运算', /每秒几次 10 /);
  // the count of every lane is drawn on the timeline (a canvas); the interactive's own cnt() gives the same numbers
  const KT = H.kit(P), kn = k => KT.NW.find(x => x.k === k), kc = (k, tt) => KT.cnt(kn(k), tt);
  ok('kit: the readout of the wake-word network at t = 1.20 s (13 calls) equals the interactive\'s own count cnt()', has(m, '到 t 已跑 13 次') && kc('kws', 1.2) === 13, m.slice(-40));
  ok('kit: over the ten seconds the wake-word network decides 100 times; the transcriber and the planner run once each', see('k-open', '一共 100 次', '听写和规划各只算一次') && kc('kws', 10) === 100 && kc('asr', 10) === 1 && kc('llm', 10) === 1, [kc('kws', 10), kc('asr', 10), kc('llm', 10)]);
  ok('kit: the action model starts at second 3 (0 calls at 2.99 s, 1 at 3.00 s, 70 by 10 s) and so does the hand policy (0, 1, 350)', kc('vla', 2.99) === 0 && kc('vla', 3) === 1 && kc('vla', 10) === 70 && kc('mlp', 2.99) === 0 && kc('mlp', 3) === 1 && kc('mlp', 10) === 350, [kc('vla', 2.99), kc('vla', 3), kc('vla', 10), kc('mlp', 2.99), kc('mlp', 10)]);
  ok('kit: the let-go neuron starts at second 8 (0 calls at 7.99 s) and makes its 66th and last call at 9.30 s', kc('neu', 7.99) === 0 && kc('neu', 8) === 1 && kc('neu', 9.28) === 65 && kc('neu', 9.3) === 66 && kc('neu', 10) === 66, [kc('neu', 7.99), kc('neu', 9.28), kc('neu', 9.3), kc('neu', 10)]);
  await w.click('重来', 400); await w.click('下一步', 500); m = await w.met();
  ok('kit: the transcriber runs once', see('k-open', '听写和规划各只算一次') && has(m, '说完跑一次'), m);
  await w.click('下一步', 500); m = await w.met(); s = await w.status();
  ok('kit: the planner runs once in these 10 s', has(m + s, '只跑一次', '这 10 s 里它只跑这一次'), m);
  await w.click('下一步', 500); m = await w.met(); s = await w.status();
  both('kit: the action model takes 4.3 TFLOP a call, 10 calls a second', 'k-open', ['动作模型从第 3 秒起每秒算 10 次', '4.3 万亿次运算（4.3 TFLOP）'], m + s, '运算 F（每次） 4.3 TFLOP', /每秒几次 10 /, '每 0.1 s 算一次');
  const Fact = num(m, /运算 F（每次） ([\d.]+) TFLOP/) * 1e12;
  await w.click('重来', 400); for (let k = 0; k < 4; k++) await w.click('下一步', 500); m = await w.met(); s = await w.status();
  both('kit: the hand policy takes 0.42 MFLOP a call, 50 calls a second, 21 MFLOP/s', 'k-open', ['手的小策略从第 3 秒起每秒 50 次', '一次约 42 万次', '约 2100 万次'], m + s, '运算 F（每次） 0.42 MFLOP', /每秒几次 50 /, '每秒运算 21 MFLOP/s');
  const Rhand = num(m, /每秒运算 ([\d.]+) MFLOP\/s/) * 1e6;
  ok('kit: one second of the hand policy is less than one two-hundred-thousandth of one call of the action model (4.3 TFLOP ÷ 21 MFLOP ≈ 205,000)', see('k-open', '二十万分之一') && Fact / Rhand > 2.0e5 && Fact / Rhand < 2.1e5, Fact / Rhand);
  await w.click('重来', 400); for (let k = 0; k < 5; k++) await w.click('下一步', 500); m = await w.met(); s = await w.status();
  both('kit: the let-go neuron takes 6 operations, 50 calls a second in phase ④; smallest and largest call are about 7 × 10¹¹ apart', 'k-open', ['算一次只要 6 次', '约 7 × 1011 倍', '从第 8 秒起每秒 50 次'], m + s, '运算 F（每次） 6 ', '每秒几次 50（只在 ④ 里）', '差了约 7 × 10¹¹ 倍');
  ok('kit: 4.3 TFLOP ÷ 6 ≈ 7 × 10¹¹', near(Fact / 6 / 1e11, 7.2, .1), Fact / 6);
  await w.set('kit-t', 930, 400); m = await w.met(); s = await w.status();
  both('kit: dragged to 9.30 s, the readout shows the neuron on its 66th call, letting go', 'k-open', ['算到第 66 次（9.3 秒）才松手'], m + s, /到 t 已跑 66 次/, '松手');
  await w.click('重来', 300);

  sec('step 0 · units (units)');
  w = W('units'); await w.show();
  await w.click('−10', 300); await w.click('FP4', 300); s = (await w.status()).split(' ## ')[0];
  both('units: −10 stored in FP4 becomes −6, 40% off; the largest FP4 value is 6', 'k-units', ['-10 存进 FP4 变成 -6', '差了 40%', '最大只能存到 6'], s, '存成 -6', '-40%', '最大只能存 6');
  await w.click('0.8808', 300); await w.click('BF16', 300); s = (await w.status()).split(' ## ')[0];
  both('units: 0.8808 stored in BF16 becomes 0.87890625, −0.21%', 'k-units', ['0.8808 存进 BF16 变成 0.87890625', '相对误差 -0.21%'], s, '存成 0.87890625', '相对误差 -0.21%');
  await w.click('FP8', 300); s = (await w.status()).split(' ## ')[0]; await w.click('FP4', 300); t = (await w.status()).split(' ## ')[0];
  both('units: in FP8 it is 0.875, in FP4 it can only be 1', 'k-units', ['存进 FP8 是 0.875', '存进 FP4 只能是 1'], s + ' ¦ ' + t, '存成 0.875', /存成 1[，,（ ]/);
  await w.click('Llama 3.1 8B', 300); const GB = {};
  for (const q of ['FP32', 'FP4', 'BF16']) { await w.click(q + ' ', 300); s = (await w.status()).split(' ## ')[1]; GB[q] = num(s, /一共 ([\d.]+) GB/); if (q === 'BF16') t = s; }
  both('units: Llama 3.1 8B has 8,030,261,248 parameters: 32.1 GB in FP32, 4.02 GB in FP4, 16.1 GB in BF16 = 12.5% of 128 GB', 'k-units', ['8030261248 个参数', '用 FP32 存要 32.1 GB', '用 FP4 是 4.02 GB', '用 BF16 是 16.1 GB', '128 GB 内存的 12.5%'], t, '8030261248 个参数', '一共 16.1 GB', '128 GB 内存的 12.5%', 'FP32 32.1 GB', 'FP4 4.02 GB');
  ok('units: FP32 → FP4 is an eighth of the bytes', see('k-units', '少到八分之一') && GB.FP32 === 32.1 && GB.FP4 === 4.02 && near(GB.FP32 / GB.FP4, 8, .02), JSON.stringify(GB));
  await w.click('Llama 3.1 8B 一个词元', 300); s = (await w.status()).split(' ## ')[2];
  both('units: one token takes 7.50 billion multiply–adds = 15.0 billion operations = 15.0 GFLOP', 'k-units', ['75.0 亿次乘加', '150 亿次运算', '15.0 GFLOP'], s, '一个词元：75.0 亿次乘加 = 150 亿次运算（15.0 GFLOP）');

  sec('step ① · one neuron (neuron)');
  w = W('neuron'); await w.show(); await w.click('你已经握住杯子了', 300);
  const ny = {}; for (const f of [0, 2, 2.5, 6, 10]) { await w.set('neuron-f', f, 200); m = await w.met(); ny[f] = [num(m, / z (-?[\d.]+) /), num(m, /输出 y（S 形） (-?[\d.]+)/)]; if (f === 2) s = await w.status(); }
  both('neuron: with the hand seen and the arm stopped the score is 0 at 2 N and the output one half; the threshold is F* = 2 N', 'k-neuron', ['拉到 2 N，分数正好是 0，输出 0.5', '过了 2 N 才超过一半'], s, 'z = 0，正好在门槛上', 'S 形给 0.5', 'F* = 2 N');
  ok('neuron: output 0.27 at 0 N, 0.56 at 2.5 N, 0.88 at 6 N, 0.98 at 10 N', see('k-neuron', '拉力 0 N 时输出 0.27', '6 N 是 0.88', '10 N 是 0.98') && ny[0][1] === .27 && ny[2][1] === .5 && ny[2.5][1] === .56 && ny[6][1] === .88 && ny[10][1] === .98 && ny[2][0] === 0, JSON.stringify(ny));
  await w.click('ReLU', 300); const nr = {}; for (const f of [0, 1.5, 2, 4, 6, 10]) { await w.set('neuron-f', f, 200); nr[f] = num(await w.met(), /输出 y（ReLU） (-?[\d.]+)/); }
  ok('neuron: with ReLU the output is 0 up to 2 N, then a straight line (1 at 4 N, 2 at 6 N, 4 at 10 N)', see('k-neuron', '分数是负的时候输出一直是 0', '6 N 时输出 2', '没有上限') && nr[0] === 0 && nr[1.5] === 0 && nr[2] === 0 && nr[4] === 1 && nr[6] === 2 && nr[10] === 4, JSON.stringify(nr));
  await w.click('不弯', 300); const nn = {}; for (const f of [0, 6, 10]) { await w.set('neuron-f', f, 200); nn[f] = num(await w.met(), /输出 y（不弯） (-?[\d.]+)/); if (f === 6) s = await w.status(); }
  both('neuron: with no bend the output is the score itself (−1, 2, 4), with no limit either way', 'k-neuron', ['输出就等于分数', '没有上下限', '读不成"是"或"否"'], s, '输出就是 z = 2', '没有上下限', '读不成「是 / 否」');
  ok('neuron: no bend gives −1 at 0 N, 2 at 6 N, 4 at 10 N', nn[0] === -1 && nn[6] === 2 && nn[10] === 4, JSON.stringify(nn));
  await w.click('S 形', 200); await w.set('neuron-f', 6, 200);

  sec('step ② · a dense layer (layer)');
  w = W('layer'); await w.show(); t = await w.text('');
  both('layer: the "squeeze" row is 3 + (−3) + 0 + (−1) = −1, and ReLU makes it 0', 'k-layer', ['3 + (-3) + 0 + (-1) = -1', 'ReLU 把它变成 0'], t, '握紧 z = 3 + (-3) + 0 + (-1) = -1 → h = 0', 'z = (2, -1, 1, -2)，弯一下后 h = (2, 0, 1, 0)');
  await w.click('一次喂三个', 400); m = (await w.met()).split(' ## ')[0]; s = (await w.status()).split(' ## ')[0];
  both('layer: three inputs at once: 36 multiply–adds instead of 12 (72 FLOP), the 16 numbers read once, each weight used 3 times', 'k-layer', ['乘加从 12 次变成 36 次', '72 FLOP', '还是那 16 个数，只读一遍', '每个权重用了 3 次'], m + s, '3 × 2 × 12 = 72 FLOP', '3 × 12 = 36', '每个权重用几次 3', '16 个数只读了一遍', '每个权重用了 3 次');
  await w.click('Llama 投影 4096 → 4096', 400); m = (await w.met()).split(' ## ')[1]; t = await w.text('');
  both('layer: Llama projection 4096 → 4096: 16,777,216 parameters, 33.6 MB in BF16, 33.6 MFLOP', 'k-layer', ['16777216 个参数', '用 BF16 存 33.6 MB', '33.6 MFLOP'], m + t, 'P = 4096 × 4096 = 16777216', '字节 M（BF16） 33.6 MB', '运算 F（每个输入） 33.6 MFLOP');
  const pj = num(t, /M = P × 2 B = (\d+) B/);
  await w.click('Llama MLP 4096 → 14336', 400); m = (await w.met()).split(' ## ')[1]; t = await w.text('');
  both('layer: Llama MLP 4096 → 14336: about 58.7 million parameters, 117 MB', 'k-layer', ['约 5870 万个参数', '117 MB'], m + t, 'P = 4096 × 14336 = 58720256', '字节 M（BF16） 117 MB');
  ok('layer: 117,440,512 B is 3.5 times 33,554,432 B', see('k-layer', '是前一层的 3.5 倍') && num(t, /M = P × 2 B = (\d+) B/) / pj === 3.5, [num(t, /M = P × 2 B = (\d+) B/), pj]);
  await w.click('玩具 3 → 4', 300); await w.click('画成网络', 300);

  sec('step ③ · the MLP (mlp)');
  w = W('mlp'); await w.show();
  await w.click('▶ 播放', 600); for (let k = 0; k < 60; k++) { await p.waitForTimeout(500); if (has(await w.status(), '该松手。一共 26 个参数')) break; }
  t = await w.text(''); s = (await w.status()).split(' ## ')[0];
  both('mlp: the "squeeze" circle is ReLU(3 + (−3) + 0 + (−1)) = ReLU(−1) = 0, and its lines into layer 2 multiply 0', 'k-mlp', ['3 + (-3) + 0 + (-1) = -1', 'ReLU 把它弯成 0', '乘的都是 0'], t, 'h₂ ReLU(3 + (-3) + 0 + (-1)) = ReLU(-1) = 0', '松手 1×2 + 0×0 + 0.5×1 + 0×0 + 0 = 2.5', '握着 -1×2 + 1×0 + 0×1 + 1×0 + 1 = -1');
  ok('mlp: after the walk-through the scores are (2.5, −1) and the probabilities 0.971 and 0.029', has(s, 'z₂ = (2.5, -1)', '松手 0.971', '握着 0.029'), s);
  await w.click('去掉弯一下', 500); t = await w.text('');
  both('mlp: without the bend layer 1 passes on (2, −1, 1, −2), "keep holding" scores −4, and one 2 × 3 layer with 8 parameters gives the same (2.5, −4)', 'k-mlp', ['(2, -1, 1, -2)', '从 -1 变成 -4', '只要 8 个参数', '(2.5, -4)'], t, '握着 -1×2 + 1×(-1) + 0×1 + 1×(-2) + 1 = -4', 'W₂W₁ = 0.5 4 -7.5 -0.5 -6 10', '和两层算的 (2.5, -4) 一模一样', '3 × 2 + 2 = 8 个参数');
  await w.click('去掉弯一下', 400);
  m = (await w.met()).split(' ## ')[1]; const P1 = num(m, /参数 P (\d+)/);
  ok('mlp: width ×2 is on the slider', await w.seek('mlp-w', '×2'), await w.row('mlp-w')); m = (await w.met()).split(' ## ')[1]; const P2 = num(m, /参数 P (\d+)/);
  both('mlp: width ×2: 209,429 → 746,517 parameters, 0.42 → 1.5 MFLOP', 'k-mlp', ['参数从 209429 变成 746517', '运算从 0.42 MFLOP 变成 1.5 MFLOP'], m, '参数 P 746517', '运算 F（每次） 1.5 MFLOP');
  t = await w.text(''); const M1 = 208512, M2 = num(t, /合计 \d+ (\d+)/);
  ok('mlp: both grow about 3.6 times (746,517 ÷ 209,429 = 3.56; multiply–adds 745,472 ÷ 208,512 = 3.58)', see('k-mlp', '约 3.6 倍', '也约 3.6 倍') && P1 === 209429 && near(P2 / P1, 3.56, .01) && near(M2 / M1, 3.58, .01), [P1, P2, M2]);
  ok('mlp: 6 hidden layers are on the slider', await w.seek('mlp-d', '6 层'), await w.row('mlp-d')); m = (await w.met()).split(' ## ')[1]; t = await w.text(''); const P3 = num(m, /参数 P (\d+)/);
  both('mlp: then 6 hidden layers: 785,045 parameters, 5% more; the added layers narrow down (128 → 64 → 32)', 'k-mlp', ['785045 个', '只多了 5%', '新加的三层一层比一层窄'], m + t, '参数 P 785045', '4 256 → 128', '5 128 → 64', '6 64 → 32', '7 32 → 21');
  ok('mlp: 785,045 ÷ 746,517 = 1.05', near(P3 / P2, 1.052, .002), P3 / P2);
  await w.seek('mlp-d', '3 层'); await w.seek('mlp-w', '×1');

  sec('step ④ · convolution (conv)');
  w = W('conv'); await w.show();
  s = ''; for (let k = 0; k < 16; k++) { await w.click('下一步', 150); s = (await w.status()).split(' ## ')[0]; if (s.includes('第 3 行、第 3 列')) break; }
  both('conv: with the window at row 3, column 3 the nine products add up to (8 − 2) + (8 − 2) + (8 − 2) = 18', 'k-conv', ['第 3 行第 3 列', '(8 - 2) + (8 - 2) + (8 - 2) = 18'], s, '第 3 行、第 3 列', '(8 - 2) + (8 - 2) + (8 - 2) = 18');
  await w.click('水平的边', 300); await w.click('算完', 400); s = (await w.status()).split(' ## ')[0];
  both('conv: the horizontal-edge kernel gives 0 6 12 18 in the top two rows and 0 below', 'k-conv', ['只有最上面两行不是 0', '0、6、12、18'], s, '输出是 0 6 12 18 / 0 6 12 18 / 0 0 0 0 / 0 0 0 0');
  await w.click('竖直的边', 300); await w.click('重来', 300); t = await w.text('');
  both('conv: no padding, stride 1: n′ = ⌊(6 − 3) / 1⌋ + 1 = 4', 'k-conv', ['⌊(6 - 3) / 1⌋ + 1 = 4'], t, '⌊(6 + 2 × 0 - 3) / 1⌋ + 1 = 4');
  await w.click('补一圈零', 300); t = await w.text('');
  both('conv: one ring of zeros: n′ = 6, as large as the input', 'k-conv', ['⌊(6 + 2 - 3) / 1⌋ + 1 = 6', '输出和输入一样大'], t, '⌊(6 + 2 × 1 - 3) / 1⌋ + 1 = 6');
  await w.click('步长 2', 300); t = await w.text('');
  both('conv: with stride 2 as well: n′ = ⌊2.5⌋ + 1 = 3', 'k-conv', ['⌊5 / 2⌋ + 1 = 3'], t, '⌊(6 + 2 × 1 - 3) / 2⌋ + 1 = ⌊2.5⌋ + 1 = 3');
  m = (await w.met()).split(' ## ')[1]; const c0 = [num(m, /参数 = [^ ]+ (\d+)/), num(m, /乘加 (\d+) M/)];
  ok('conv: the real layer starts as ResNet-18’s first layer: 9,408 parameters, 118 million multiply–adds', see('k-conv', '第一层（9408 个）', '1.18 亿次') && c0[0] === 9408 && c0[1] === 118 && has(m, '输出 112×112×64'), m);
  ok('conv: C_out 128 is on the slider', await w.seek('conv-co', '128'), await w.row('conv-co')); m = (await w.met()).split(' ## ')[1]; const c1 = [num(m, /参数 = [^ ]+ (\d+)/), num(m, /乘加 (\d+) M/)];
  ok('conv: C_out 64 → 128 doubles the parameters (18,816) and the multiply–adds (236 million)', see('k-conv', 'Cout 从 64 到 128，参数和运算都翻倍') && c1[0] === 2 * c0[0] && c1[1] === 2 * c0[1], [c0, c1]);
  ok('conv: input side 448 is on the slider', await w.seek('conv-n', '448'), await w.row('conv-n')); m = (await w.met()).split(' ## ')[1]; const c2 = [num(m, /参数 = [^ ]+ (\d+)/), num(m, /乘加 (\d+) M/)];
  ok('conv: input side 224 → 448 leaves the parameters and makes the multiply–adds 4 times as many (944 million)', see('k-conv', '输入边长从 224 到 448，参数不变，运算变成 4 倍') && c2[0] === c1[0] && c2[1] === 4 * c1[1], [c1, c2]);
  await w.click('ResNet-18 layer3 里的一层', 400); m = (await w.met()).split(' ## ')[1]; s = (await w.status()).split(' ## ')[1];
  both('conv: the layer inside layer3: 589,824 parameters (63 times the first layer), 116 million multiply–adds, each weight used 196 times', 'k-conv', ['589824 个参数', '约 63 倍', '乘加 1.16 亿次', '每个权重只用 196 次'], m + s, '589824', '乘加 116 M', '每个权重用 196 次', '参数多了 63 倍', '116 M 对 118 M');
  ok('conv: 589,824 ÷ 9,408 = 62.7', near(589824 / 9408, 62.7, .05) && has(m, '输出 14×14×256'));
  await w.click('ResNet-18 的第一层', 400); s = (await w.status()).split(' ## ')[1];
  both('conv: each weight of the first layer is used 12,544 times', 'k-conv', ['第一层的每个权重要用 12544 次'], s, '每个权重用 12544 次', '112×112 = 12544 个位置');

  sec('step ⑤ · ResNet-18 (cnn)');
  w = W('cnn'); await w.show();
  { const st = await w.walk(12, 250); const outs = []; const shares = {};
    await w.click('重来', 300);
    for (let k = 0; k < 9; k++) { m = await w.met(); s = await w.status(); outs.push((m.match(/这一段的输出 (\S+)/) || [])[1]); const q = s.match(/(layer\d)：[^]*参数 (\d+)（全网的 ([\d.]+)%），乘加 (\d+) M（([\d.]+)%）/); if (q) shares[q[1]] = [+q[2], +q[3], +q[4], +q[5]]; if (k === 6) t = m + s; await w.click('下一步', 250); }
    const sides = outs.map(o => parseInt(o)), halv = sides.slice(0, 7).filter((v, i) => i > 0 && v * 2 === sides[i - 1]).length;
    ok('cnn: the walk-through has 9 sections', st.length === 9, st.length);
    ok('cnn: the side is halved 5 times: 224 → 112 → 56 → (56) → 28 → 14 → 7, then average pooling leaves one position', see('k-cnn', '边长减半了 5 次', '224 → 112（第一层）→ 56（池化）→ 28 → 14 → 7', '最后平均池化把 7 × 7 个位置并成一个') && outs.slice(0, 8).join(' ') === '224×224×3 112×112×64 56×56×64 56×56×64 28×28×128 14×14×256 7×7×512 1×1×512' && halv === 5, outs.join(' '));
    ok('cnn: parameters: layer4 71.8%, layer3 18.0%; multiply–adds: 25.5%, 22.7%, 22.7%, 22.7%', see('k-cnn', '占 71.8%', '第三阶段占 18.0%', '25.5%、22.7%、22.7%、22.7%') && shares.layer4 && shares.layer4[1] === 71.8 && shares.layer3[1] === 18 && shares.layer1[3] === 25.5 && shares.layer2[3] === 22.7 && shares.layer3[3] === 22.7 && shares.layer4[3] === 22.7, JSON.stringify(shares));
    both('cnn: one number of stage 4 (layer4) sees 435 × 435 pixels, more than the whole picture', 'k-cnn', ['图上写着 layer4', '435 × 435 个像素', '比 224 × 224 的整张图还大'], t, '感受野 435×435', '435×435 像素，比整张图还大');
    m = await w.met(); const mac224 = num(m, /乘加（这张图） ([\d.]+) G/);
    await w.click('1280×720', 500); m = await w.met(); s = await w.status();
    both('cnn: at 1280 × 720 the parameters stay at 11,689,512 and the multiply–adds go from 1.81 to 33.5 billion, 18.45 times', 'k-cnn', ['还是 11689512 个', '从 18.1 亿次涨到 335 亿次', '约 18.5 倍'], m + s, '参数 P（不随输入变） 11689512', '乘加（这张图） 33.5 G', '18.45 倍', '参数还是 11689512 个');
    ok('cnn: 1.81 billion multiply–adds at 224 × 224', mac224 === 1.81, mac224);
    await w.click('224×224', 400); }

  sec('step ⑥ · a recurrent network (rnn)');
  w = W('rnn'); await w.show();
  { const R = H.rnnFmt(P);
    const hs = []; for (let k = 0; k < 5; k++) { await w.click('下一步', 200); hs.push(num((await w.met()).split(' ## ')[0], /记忆 h (-?[\d.]+)/)); }
    ok('rnn: with a = 0.5 the memory over the five steps is 0, 1, 3.5, 4.75, 3.375', hs.join(' ') === '0 1 3.5 4.75 3.375', hs.join(' '));
    ok('rnn: the bars are labelled by the interactive’s own fLeft(): 0.5¹⁰ → 0.001 and 0.9¹⁰ → 0.35', see('k-rnn', '过 10 步只剩 0.001', '过 10 步还剩 0.35') && R.fLeft(Math.pow(.5, 10)) === '0.001' && R.fLeft(Math.pow(.9, 10)) === '0.35', [R.fLeft(Math.pow(.5, 10)), R.fLeft(Math.pow(.9, 10))]);
    ok('rnn: the legend says the row under the slider is "what is left of the first input after t steps"', has(await secText('k-rnn'), '下面一行是第一个输入过 t 步还剩多少'));
    await w.click('重来', 200); await w.set('rnn-a', 90, 300);
    ok('rnn: the slider reads a = 0.9', has(await w.row('rnn-a'), '0.9'), await w.row('rnn-a'));
    await w.click('加一个门', 400); const hg = [], ag = []; let last = '';
    for (let k = 0; k < 5; k++) { await w.click('下一步', 250); hg.push(num((await w.met()).split(' ## ')[0], /记忆 h (-?[\d.]+)/)); last = (await w.status()).split(' ## ')[0]; ag.push(num(last, /门让 a = ([\d.]+)/)); }
    ok('rnn: with the gate the memory is 0, 0.036, 5.893, 5.998, 5.926 whatever the slider says', see('k-rnn', '0、0.036、5.893、5.998、5.926') && hg.join(' ') === '0 0.036 5.893 5.998 5.926', hg.join(' '));
    ok('rnn: the gate sets a = 0.018 at 6 N and a = 0.982 at 2 N', see('k-rnn', '读数是 6 N 时门算出 a = 0.018', '读数掉回 2 N 时 a = 0.982') && ag[2] === .018 && ag[3] === .018 && ag[4] === .982 && ag[1] === .982, ag.join(' '));
    both('rnn: the status line: after 20 more quiet steps 0.7 is left, 10⁻⁶ without the gate', 'k-rnn', ['再安静 20 步还剩 0.7', '没有门只剩 10-6'], last, '再安静 20 步也还剩 0.7（没有门只剩 10⁻⁶）');
    ok('rnn: 0.982²⁰ = 0.70 and 0.5²⁰ ≈ 10⁻⁶ by the same formatter', R.AQ === .982 && R.fLeft(Math.pow(R.AQ, 20)) === '0.7' && R.fLeft(Math.pow(.5, 20)) === '10⁻⁶', [R.AQ, R.fLeft(Math.pow(R.AQ, 20)), R.fLeft(Math.pow(.5, 20))]);
    await w.click('加一个门', 300);
    await w.click('普通循环', 300); m = (await w.met()).split(' ## ')[1]; const p1 = num(m, /参数 P (\d+)/);
    await w.click('GRU', 300); m = (await w.met()).split(' ## ')[1]; const p3 = num(m, /参数 P (\d+)/); t = await w.text('');
    ok('rnn: 80 → 512: Plain RNN 303,616 parameters, GRU 910,848 = exactly 3 times (three sets of weights)', see('k-rnn', '普通循环 303616 个参数', '910848 个，正好 3 倍', '每步 80 个数进，记忆 512 个数') && p1 === 303616 && p3 === 910848 && p3 === 3 * p1 && has(await w.row('rnn-ni'), '80') && has(await w.row('rnn-nh'), '512'), [p1, p3]);
    await w.click('普通循环', 300);
    ok('rnn: T = 100,000 is on the slider', await w.seek('rnn-T', '100000'), await w.row('rnn-T')); s = (await w.status()).split(' ## ').slice(-1)[0];
    both('rnn: at T = 100,000 the recurrent network takes 100,000 steps with a memory of 512 numbers; attention scores 100,000 × 100,000 = 10¹⁰ pairs', 'k-rnn', ['100000 步', '记忆始终是 512 个数', '100000 × 100000 = 1010 个数'], s, '循环网络要走 100000 步', '记忆始终是 512 个数', '100000 × 100000 = 10¹⁰ 对打分');
    await w.set('rnn-T', 6, 200); await w.set('rnn-a', 50, 200); await w.click('重来', 200); }

  sec('step ⑦ · attention (attn)');
  w = W('attn'); await w.show();
  { const TOK = ['把', '那杯水', '递', '给我'];
    const row = async (q) => { await w.click(q, 250, 0); await w.click('重来', 150); let a = null, h2 = null, y = ''; for (let k = 0; k < 12; k++) { await w.click('下一步', 60); if (k === 9) { const x = await w.text('#attn-x'); a = (x.match(/权重 a = \(([^)]*)\)/) || [])[1]; h2 = (x.match(/头 2：和 = [\d.]+ → \(([^)]*)\)/) || [])[1]; } if (k === 11) y = await w.text('#attn-x'); } return { a: a && a.split(', ').map(Number), h2: h2 && h2.split(', ').map(Number), y }; };
    const top = a => a.map((v, i) => [v, i]).filter(x => x[0] === Math.max(...a)).map(x => TOK[x[1]]).join('+');
    const A = {}; for (const q of TOK) A[q] = await row(q);
    ok('attn: "ba" looks most at "that glass of water" (0.475), "that glass of water" at "pass" (0.475), "pass" at "that glass of water" and "to me" (0.366 each), "to me" at "pass" (0.475)', see('k-attn', '"把"最看重"那杯水"（权重 0.475）', '"那杯水"最看重"递"（0.475）', '（各 0.366）', '"给我"最看重"递"（0.475）') && top(A['把'].a) === '那杯水' && A['把'].a[1] === .475 && top(A['那杯水'].a) === '递' && A['那杯水'].a[2] === .475 && top(A['递'].a) === '那杯水+给我' && A['递'].a[1] === .366 && top(A['给我'].a) === '递' && A['给我'].a[2] === .475, JSON.stringify(TOK.map(q => A[q].a)));
    ok('attn: the weights of "pass" are (0.134, 0.366, 0.134, 0.366) and its output (0.366, 0.366, 0.134, 0.134)', A['递'].a.join(' ') === '0.134 0.366 0.134 0.366' && has(A['递'].y, 'y(递) = (0.366, 0.366, 0.134, 0.134)'), A['递'].y.slice(0, 120));
    await w.click('把', 250, 0); await w.click('重来', 150); await w.click('下一步', 150); await w.click('下一步', 200); t = await w.text('#attn-x');
    both('attn: the query of "ba" is (2, 0, 0, 0): it looks only for a thing', 'k-attn', ['"把"的查询是 (2, 0, 0, 0)'], t, /q\(把\) = [^=]*= \(2, 0, 0, 0\)/);
    await w.click('只看前面', 300); const Mk = {}; for (const q of TOK) Mk[q] = await row(q);
    ok('attn: with the causal mask the first three rows change: (1, 0, 0, 0), (0.5, 0.5, 0, 0), (0.212, 0.576, 0.212, 0); the last row does not', see('k-attn', '前三行变了', '权重 (1, 0, 0, 0)', '"那杯水"是 (0.5, 0.5, 0, 0)', '"递"是 (0.212, 0.576, 0.212, 0)', '最后一行"给我"没变') && Mk['把'].a.join(' ') === '1 0 0 0' && Mk['那杯水'].a.join(' ') === '0.5 0.5 0 0' && Mk['递'].a.join(' ') === '0.212 0.576 0.212 0' && Mk['给我'].a.join(' ') === A['给我'].a.join(' '), JSON.stringify(TOK.map(q => Mk[q].a)));
    await w.click('只看前面', 300); await w.click('两个头', 300); const T2 = await row('递');
    ok('attn: in the second head "pass" looks most at "to me" (0.475)', see('k-attn', '第二个头里"递"最看重"给我"（0.475）') && T2.h2 && top(T2.h2) === '给我' && T2.h2[3] === .475, JSON.stringify(T2.h2));
    await w.click('两个头', 300);
    await w.click('Llama 3.1 8B · 2048', 400); m = (await w.met()).split(' ## ').slice(-1)[0]; const c2k = [num(m, /投影 F ([\d.]+) GFLOP/), num(m, /打分 \+ 加权 F ([\d.]+) GFLOP/)];
    await w.click('Llama 3.1 8B · 131', 400); m = (await w.met()).split(' ## ').slice(-1)[0]; const c131 = [num(m, /投影 F ([\d.]+) TFLOP/) * 1000, num(m, /打分 \+ 加权 F ([\d.]+) TFLOP/) * 1000];
    both('attn: at 131,072 tokens: projections 17.6 TFLOP, scoring and mixing 281 TFLOP = 94% of the layer', 'k-attn', ['涨到 17.6 TFLOP', '涨到 281 TFLOP', '占到这一层的 94%'], m, '投影 F 17.6 TFLOP', '打分 + 加权 F 281 TFLOP', '打分 + 加权占 94%');
    ok('attn: from 2,048 to 131,072 tokens (64 times): projections 275 GFLOP → 17.6 TFLOP = 64 times; scoring 68.7 GFLOP → 281 TFLOP ≈ 4,100 times = 64²', see('k-attn', '词元多了 64 倍', '从 275 GFLOP', '也是 64 倍', '从 68.7 GFLOP', '约 4100 倍（64 的平方）') && 131072 / 2048 === 64 && c2k[0] === 275 && c2k[1] === 68.7 && near(c131[0] / c2k[0], 64, .1) && near(c131[1] / c2k[1], 4096, 10), [c2k, c131]);
    await w.click('玩具：4 个词元', 300); await w.click('递', 250, 0); }

  sec('step ⑧ · the Transformer (xfmr)');
  w = W('xfmr'); await w.show();
  { await w.click('玩具', 400); const st = await w.walk(16, 250); const all = st.join(' ¦ ');
    ok('xfmr toy: 11 steps', st.length === 12 && has(st[11], '11/11'), st.length);
    both('xfmr toy: the lookup gives (0, 0, 1, 0); attention weighs "that glass of water" 0.58; after the residual (0.58, 0, 1.21, 0.21)', 'k-xfmr', ['(0, 0, 1, 0)', '权重 0.58', '(0.58, 0, 1.21, 0.21)'], all, '「递」变成 (0, 0, 1, 0)', 'softmax 得 (0.21, 0.58, 0.21)', '「递」最看重「那杯水」', '= (0.58, 0, 1.21, 0.21)');
    both('xfmr toy: only one hidden number of the MLP is not 0; it writes 1.51 into the "person" slot', 'k-xfmr', ['只有一个隐藏数不是 0', '写了 1.51'], all, '只有第 1 个隐藏数不是 0', '东西和动作都在，它才有输出', '(-0.38, 1.51, -0.38, 0)');
    both('xfmr toy: "to me" scores 3.46 and gets probability 0.76', 'k-xfmr', ['"给我"最高（3.46）', '概率 0.76'], all, '给我 3.46', '给我 0.76：挑「给我」', '「人」成了最大的数');
    await w.click('Llama 3.1 8B', 400); t = await w.text(''); m = await w.met();
    both('xfmr Llama 3.1 8B: MLP 70.2% of the parameters, attention 16.7%, lookup and output head 6.5% each', 'k-xfmr', ['占 70.2%', '注意力 16.7%', '各 6.5%'], t, 'MLP 32 × 176 M = 5.64 B（70.2%）', '注意力 32 × 41.9 M = 1.34 B（16.7%）', '查表 525 M（6.5%）', '输出头 525 M（6.5%）');
    both('xfmr Llama 3.1 8B: 15.0 GFLOP per token from the weights (2 × the weights used), 8,030,261,248 parameters', 'k-xfmr', ['每个词元 15.0 GFLOP', '约是参数个数的 2 倍'], m, '参数 8030261248', '不含查表 7504924672', /15\.0 \+ [\d.]+ = [\d.]+ GFLOP/);
    ok('xfmr: 2 × 7,504,924,672 = 15.0 GFLOP, 1.87 times the 8.03 billion parameters', near(2 * 7504924672 / 1e9, 15.0, .05) && near(2 * 7504924672 / 8030261248, 1.87, .01));
    ok('xfmr: context 131,072 is on the slider', await w.seek('xfmr-t', '131072'), await w.row('xfmr-t')); m = await w.met(); s = await w.status();
    both('xfmr Llama 3.1 8B at 131,072 tokens of context: the KV cache is 17.2 GB, more than the 16.1 GB of weights in BF16; 131 kB per token', 'k-xfmr', ['键值缓存 17.2 GB', '（16.1 GB）还大', 'Llama 是 131 kB', '18 对 32', '256 个数对 1024 个'], m + s, '键值缓存（131072 个词元 × 131 kB） 17.2 GB', '存储 BF16 · FP8 · FP4 16.1 · 8.0 · 4.0 GB', '32 层 × 2 × 1024 个数 × 2 字节 = 131072 字节');
    await w.click('Gemma 2B', 400); await w.set('xfmr-t', 16, 400); m = await w.met(); s = await w.status();
    both('xfmr Gemma 2B dragged to the end (limit 8,192): the cache is 151 MB, 18.4 kB per token', 'k-xfmr', ['它最长 8192', '缓存只有 151 MB', '每个词元只存 18.4 kB'], (await w.row('xfmr-t')) + m + s, '8192（上限）', '键值缓存（8192 个词元 × 18.4 kB） 151 MB', '18 层 × 2 × 256 个数 × 2 字节 = 18432 字节');
    await w.click('Llama 3.1 8B', 300); await w.seek('xfmr-t', ' 2000'); }

  sec('step ⑨ · the vision Transformer (vit)');
  w = W('vit'); await w.show();
  { let st = await w.walk(12, 250);
    ok('vit: 7 steps; in step 4 the 588 numbers of a patch are multiplied by a 588 × 1152 table and become 1,152 numbers', see('k-vit', '同样 7 步', '摊平成 588 个数', '第 4 步乘一张 588 × 1152 的表，变成 1152 个数', '排进 256 个词元的一行', '进 27 层的块') && st.length === 8 && has(st[3], '3/7 摊平：14 × 14 × 3 = 588 个数') && has(st[4], '4/7 乘一个 588 × 1152 的矩阵', '得到 1152 个数') && has(st[5], '5/7 加上') && has(st[6], '6/7 排进一行：256 个词元') && has(st[7], '7/7 进 27 层'), st.map(x => x.slice(0, 26)).join(' ¦ '));
    const b0 = (st[1].match(/第 (\d+) 块/) || [])[1];
    // tap another patch of the picture: the walk-through is the same, only the patch number changes
    await w.click('重来', 300); const cv = await p.evaluate(() => { const c = document.querySelector('#vit canvas'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); await p.waitForTimeout(300);
    const cv2 = await p.evaluate(() => { const r = document.querySelector('#vit canvas').getBoundingClientRect(); return [r.left, r.top]; }); await p.mouse.click(cv2[0] + 40, cv2[1] + 60); await p.waitForTimeout(400);
    await w.click('上一步', 300); const b1 = ((await w.status()).match(/第 (\d+) 块/) || [])[1]; st = await w.walk(12, 250);
    ok('vit: tapping another patch changes the patch (' + b0 + ' → ' + b1 + ') but not the 7 steps', b0 && b1 && b0 !== b1 && has(st.join(' ¦ '), '4/7 乘一个 588 × 1152 的矩阵', '得到 1152 个数'), [b0, b1, st.length]);
    await w.click('224 px', 300); m = await w.met(); const v224 = [num(m, /词元 (\d+) =/), num(m, /27 层的运算（每张图） ([\d.]+) GFLOP/), num(m, /其中打分和加权 ([\d.]+) GFLOP/)];
    await w.click('896 px', 400); m = await w.met(); const v896 = [num(m, /词元 (\d+) =/), num(m, /27 层的运算（每张图） ([\d.]+) GFLOP/), num(m, /其中打分和加权 ([\d.]+) GFLOP/)];
    both('vit: at 896 px there are 4,096 tokens and 5,457 GFLOP, of which scoring and mixing 2,087 GFLOP (38.3%)', 'k-vit', ['变成 4096 个', '变成 5457 GFLOP', '涨到 2087 GFLOP（占 38.3%）'], m, '词元 4096 = 64 × 64', '27 层的运算（每张图） 5457 GFLOP', '其中打分和加权 2087 GFLOP（38.3%）');
    ok('vit: 16 times the tokens, about 25 times the operations, 256 times the scoring part (from 8.15 GFLOP, 3.7%)', see('k-vit', '16 倍', '从 219 GFLOP', '约 25 倍', '从 8.15 GFLOP（占 3.7%）', '256 倍') && v224.join(' ') === '256 219 8.15' && v896[0] / v224[0] === 16 && near(v896[1] / v224[1], 24.9, .05) && near(v896[2] / v224[2], 256, .2), [v224, v896]);
    await w.click('224 px', 400); ok('vit: patch side 8 px is on the slider', await w.seek('vit-p', '8 px'), await w.row('vit-p')); m = await w.met();
    both('vit: back at 224 px, a patch side of 8 gives 28 × 28 = 784 tokens and 721 GFLOP', 'k-vit', ['28 × 28 = 784 个词元', '721 GFLOP'], m, '词元 784 = 28 × 28', '27 层的运算（每张图） 721 GFLOP');
    await w.seek('vit-p', '14 px'); await w.click('重来', 200); }

  sec('step ⑩ · Whisper (whisper)');
  w = W('whisper'); await w.show();
  { const st = await w.walk(20, 300); const i = st.findIndex(x => x.includes('写第 3 个字「杯」'));
    ok('whisper: 14 steps; writing the third character is step 9, where cross-attention looks most at 0.60–0.83 s', see('k-audio', '第 3 个字"杯"', '（第 9 步）', '0.60–0.83 秒') && has(await secText('k-audio'), '一共 14 步') && st.length === 14 && i === 8 && has(st[8], '9 / 14', '看得最多的落在 0.60–0.83 s', '线是示意'), [st.length, i]);
    ok('whisper: padded to 30 s, 2,800 of the 3,000 frames are blank: 93%', see('k-audio', '3000 帧里有 2800 帧是空白', '93%') && has(st[2], '3000 帧里只有 200 帧是话，2800 帧是补的空白，占 93%') && Math.round(2800 / 3000 * 100) === 93, st[2]);
    ok('whisper: by the same sum, 15 s of speech would leave 1,500 of 3,000 frames blank: one half', see('k-audio', '说 15 秒的话，空白占 1500 帧，浪费一半') && 15 * 100 === 1500 && (3000 - 1500) / 3000 === .5);
    await w.click('small', 300); m = await w.met(); const es = num(m, /编码器 F（每 30 s 窗） ([\d.]+) GFLOP/);
    await w.click('large', 300); m = await w.met(); const el = num(m, /编码器 F（每 30 s 窗） ([\d.]+) TFLOP/) * 1000;
    ok('whisper: small → large: the encoder goes from 338 GFLOP to 2.26 TFLOP, about 6.7 times (12 → 32 layers, width 768 → 1,280)', see('k-audio', '从 338 GFLOP 变成 2.26 TFLOP', '约 6.7 倍', '层数从 12 到 32，宽度从 768 到 1280') && es === 338 && el === 2260 && near(el / es, 6.69, .01) && has(await w.text(''), 'small L 12 · d 768', 'large L 32 · d 1280'), [es, el]);
    await w.click('small', 300); await w.click('重来', 200); }

  sec('step ⑪ · U-Net (unet)');
  w = W('unet'); await w.show();
  { const st = await w.walk(16, 300); const all = st.join(' ¦ ');
    const down = st.filter(x => /往下第 \d 级：先取最大缩小一半/.test(x)).length + (st.some(x => x.includes('最底下：16²×512')) ? 1 : 0), up = st.filter(x => /往上第 \d 级：先放大一倍/.test(x)).length;
    ok('unet: 11 steps; the picture shrinks 4 times (256 → 128 → 64 → 32 → 16) and is scaled up 4 times', see('k-unet', '往下缩了 4 次', '256 → 128 → 64 → 32 → 16', '往上放大 4 次') && st.length === 11 && down === 4 && up === 4 && has(all, '得到 256²×32', '得到 128²×64', '得到 64²×128', '得到 32²×256', '最底下：16²×512'), [st.length, down, up]);
    const ups = st.filter(x => /往上第 \d 级/.test(x)).map(x => num(x, /([\d.]+) G 次乘加/)), downs = st.filter(x => /往下第 \d 级/.test(x)).map(x => num(x, /(\d+) M 次乘加/));
    both('unet: each level on the way up takes 2.35 billion multiply–adds, 69% together; the levels on the way down 0.66 to 0.91 billion', 'k-unet', ['每级约 23.5 亿次乘加', '占 69%', '6.6 亿到 9.1 亿次'], st[10], '往上走的四级占了 69%', '7765985 个参数');
    ok('unet: up levels 2.35 G each, down levels 661, 906, 906, 906 M', ups.join(' ') === '2.35 2.35 2.35 2.35' && downs.join(' ') === '661 906 906 906', [ups, downs]);
    m = await w.met(); const u0 = [num(m, /参数 P (\d+)/), num(m, /运算（乘加） ([\d.]+) G/)];
    await w.click('去掉跳连', 600); s = await w.status(); m = await w.met(); const u1 = [num(m, /参数 P (\d+)/), num(m, /运算（乘加） ([\d.]+) G/)];
    both('unet: without the skip connections 540 pixels are classed wrongly, all on the edge, and 9,838 are undecided against 308 with them', 'k-unet', ['变糊的是掩码的边缘', '有 540 个像素分错，都在边上', '有 9838 个', '有跳连时只有边上的 308 个'], s, '540 个像素分错了', '都在边上', '9838 个像素拿不准（在 0.1 和 0.9 之间），有跳连时只有边上 308 个');
    ok('unet: input side 512 is on the slider', await w.seek('unet-n', '512 × 512'), await w.row('unet-n')); m = await w.met(); const u2 = [num(m, /参数 P (\d+)/), num(m, /运算（乘加） ([\d.]+) G/)];
    ok('unet: input side 256 → 512: not one parameter more, 4 times the operations (11.3 → 45.1 billion multiply–adds without the skips)', see('k-unet', '参数一个不多，运算变成 4 倍') && u2[0] === u1[0] && near(u2[1] / u1[1], 4, .02), [u0, u1, u2]);
    await w.click('去掉跳连', 400); m = await w.met(); const u3 = num(m, /运算（乘加） ([\d.]+) G/);
    ok('unet: the same with the skip connections: 13.7 → 54.7 billion', u0[0] === 7765985 && u0[1] === 13.7 && near(u3 / u0[1], 4, .02), [u0, u3]);
    await w.seek('unet-n', '256 × 256'); await w.click('重来', 200); }

  sec('step ⑫ · PointNet (point)');
  w = W('point'); await w.show();
  { const st = await w.walk(12, 300);
    ok('point: 8 steps; step 7 says where the deciding points are: 311 points (30%): 271 of 814 on the wall, 31 of 93 on the base, 9 of 117 on the water surface', see('k-point', '说了算的点只有 311 个，占 30%', '杯壁 814 个点里有 271 个', '杯底 93 个里有 31 个', '水面 117 个里只有 9 个') && st.length === 8 && has(st[6], '7 / 8', '只有 311 个点（30%）', '杯壁 814 个点里有 271 个，杯底 93 个里有 31 个，水面 117 个里只有 9 个', '很少是「最靠外」的那个'), st[6]);
    ok('point: 311 of 1,024 is 30%, and 814 + 93 + 117 = 1,024, 271 + 31 + 9 = 311', Math.round(311 / 1024 * 100) === 30 && 814 + 93 + 117 === 1024 && 271 + 31 + 9 === 311);
    await w.click('上一步', 200); for (let k = 0; k < 5; k++) await w.click('上一步', 150); const a = await w.status(); await w.click('换一个点', 400); const c = await w.status();
    const pa = (a.match(/挑一个点：#(\d+)，[^(]*\(x, y, z\) = \(([^)]*)\)/) || []), pc = (c.match(/挑一个点：#(\d+)，[^(]*\(x, y, z\) = \(([^)]*)\)/) || []);
    ok('point: "Another point" picks a different point with different coordinates (#' + pa[1] + ' → #' + pc[1] + '), and its features are computed from those coordinates alone', see('k-point', '每个点的特征只由它自己的三个坐标算出来') && pa[1] && pc[1] && pa[1] !== pc[1] && pa[2] !== pc[2] && has(st[2], '整个 MLP 只看这一个点，不知道别的点在哪儿'), [a.slice(0, 80), c.slice(0, 80)]);
    for (let k = 0; k < 6; k++) await w.click('下一步', 150);
    await w.click('打乱点的顺序', 600); s = await w.status();
    both('point: after shuffling, the global feature adds up to 742.25 before and after: not one number differs', 'k-point', ['全局特征一个数都不差', '打乱前后都是 742.25'], s, 'Σ 打乱前 742.25，打乱后 742.25，一个数都不差', '清单的顺序全变了');
    await w.click('哪些点说了算', 600); t = await w.text('button'); await w.click('上一步', 400); s = await w.status();
    ok('point: "Which points decide" switches the marking on; the count, 311 points (30%), is in the status line of step 7', has(t, '✓ 哪些点说了算') && has(s, '7 / 8', '只有 311 个点（30%）'), [t, s.slice(0, 60)]); await w.click('下一步', 300);
    m = await w.met(); const n1 = num(m, /N 个点的乘加 (\d+) M/);
    ok('point: 4,096 points are on the slider', await w.seek('point-n', '4096'), await w.row('point-n')); m = await w.met(); const n4 = num(m, /N 个点的乘加 (\d+) M/);
    both('point: 1,024 → 4,096 points: still 147,648 multiply–adds per point, 151 → 605 million in all, 4 times', 'k-point', ['每个点还是 147648 次乘加', '从 1.51 亿次变成 6.05 亿次', '4 倍'], m, '每个点的乘加 147648', 'N 个点的乘加 605 M');
    ok('point: 605 ÷ 151 = 4.0 and 147,648 × 4,096 = 604.8 million', n1 === 151 && near(n4 / n1, 4, .02) && near(147648 * 4096 / 1e6, 604.8, .1), [n1, n4]);
    await w.seek('point-n', '1024'); await w.click('哪些点说了算', 300); await w.click('重来', 200); }

  sec('step ⑬ · the action model (vla)');
  w = W('vla'); await w.show();
  { const st = await w.walk(12, 300); const all = st.join(' ¦ '); m = await w.met();
    both('vla: the backbone has the most operations: 800 tokens through 18 layers, 3.27 TFLOP, 76% of the call', 'k-multi', ['800 个词元走过 Gemma 2B 的 18 层', '3.27 TFLOP', '占一次调用的 76%'], all, '800 个词元一共 3.27 TFLOP，占一次的 76%', '骨干 18 层：Gemma 2B');
    both('vla: seeing 0.66 TFLOP, action expert 0.37 TFLOP, 4.30 TFLOP in all', 'k-multi', ['看图 0.66 TFLOP', '动作专家 0.37 TFLOP', '合起来 4.30 TFLOP'], all + m, '3 × 219 GFLOP = 0.66 TFLOP', '10 步加上状态一共 0.37 TFLOP', '约 4.30 TFLOP：看 0.66 + 骨干 3.27 + 动作专家 0.37', '运算 F（π0 一次） 4.30 TFLOP');
    ok('vla: 7 steps; 0.66 + 3.27 + 0.37 = 4.30 and 3.27 ÷ 4.30 = 76%', st.length === 8 && near(.66 + 3.27 + .37, 4.30, 1e-9) && Math.round(3.27 / 4.30 * 100) === 76, st.length);
    const t1 = num(m, /打分表（每头每层） (\d+)/);
    await w.click('交叉注意力', 500); m = await w.met(); t = await w.text(''); const t2 = num(m, /打分表（每头每层） (\d+)/);
    both('vla: with cross-attention only the 32 text tokens enter the backbone, and the score table is 32 × 800 = 25,600 cells', 'k-multi', ['进骨干的只剩 32 个文字词元', '800 × 800 = 640000 格', '32 × 800 = 25600 格', '照片那一路不知道这句话问的是什么'], m + t, '进骨干的词元 32（768 个在旁边）', '打分表 32 × 800 = 25600 格', '图像那边不知道这句话问的是什么');
    ok('vla: 640,000 ÷ 25,600 = 25', see('k-multi', '小了 25 倍') && t1 === 640000 && t2 === 25600 && t1 / t2 === 25, [t1, t2]);
    await w.click('调制', 500); m = await w.met(); t = await w.text('');
    both('vla: with modulation there is no score table; each picture is averaged into one vector and details such as "which patch is the glass in" are easily lost', 'k-multi', ['没有打分表了', '照片被压成一个向量（一串数）', '"杯子在哪一块"这样的细节容易丢'], m + t, '打分表（每头每层） 0', '没有打分表', '图被压成一个向量，「杯子在哪一块」这样的细节容易丢');
    await w.click('排成一行', 400); await w.click('重来', 200);
    // the 10 refinement passes are drawn on a canvas: grid cell = k/10 × trajectory + (1 − k/10) × noise (gGrid in the interactive's code).
    // The interactive's own data (cut out of the page source, run in the page with its random generator) gives the correlation between
    // the picture at pass k and the finished chunk.
    const src = P.wsrc('vla'); const data = H.between(src, 'const RN=K.rng(5)', 'const JA=');
    ok('vla: the grid is drawn as lam × trajectory + (1 − lam) × noise with lam = pass ÷ 10', src.includes('v=lam*CH.S[q]+(1-lam)*CH.N[q]') && src.includes('lam=si<0||d5>=1?1:kk/10'));
    const corr = await p.evaluate(code => { const K = window.TB, TAU = K.TAU; const CH = new Function('K', 'TAU', code + ';return CH;')(K, TAU); const S = CH.S, N = CH.N, n = S.length; const mean = a => a.reduce((x, y) => x + y, 0) / n; const ms = mean(S);
      const out = []; for (let k = 1; k <= 10; k++) { const lam = k / 10, v = S.map((s, i) => lam * s + (1 - lam) * N[i]), mv = mean(v); let a = 0, b2 = 0, c = 0; for (let i = 0; i < n; i++) { a += (v[i] - mv) * (S[i] - ms); b2 += (v[i] - mv) ** 2; c += (S[i] - ms) ** 2; } out.push(Math.round(a / Math.sqrt(b2 * c) * 1000) / 1000); } return [n, out]; }, data);
    log.push('     correlation of the picture at passes 1…10 with the finished chunk: ' + corr[1].join(' '));
    ok('vla: 50 × 21 = 1,050 cells; for the first 5 passes the picture is mostly noise (correlation with the finished chunk below 0.6), around passes 6 and 7 the bands show (0.6 to 0.9), from pass 8 on they are clear (above 0.9)', see('k-multi', '前 5 遍看上去还是一片噪点', '第 6、7 遍前后', '第 8 遍以后已经很清楚') && corr[0] === 1050 && corr[1].slice(0, 5).every(c => c < .6) && corr[1][5] >= .6 && corr[1][6] < .9 && corr[1].slice(7).every(c => c > .9), corr[1].join(' ')); }

  sec('step ⑭ · the building blocks (build)');
  w = W('build'); await w.show();
  { await w.click('π0', 400); await p.evaluate(() => { const c = document.getElementById('build-t'); c.scrollIntoView({ block: 'center' }); c.focus(); }); await p.waitForTimeout(300);
    const OPN = ['全连接', '卷积', '循环', '注意力', '池化', '上采样', '归一化', '残差、跳连', '门和路由', '查表、切块'], use = {}, inPi = {};
    for (let i = 0; i < 10; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200); s = await w.status(); const o = OPN.find(x => s.startsWith(x + '：')); const u = (s.match(/用到它的：([^。]*)。/) || [])[1]; use[o] = u ? u.split('、') : []; inPi[o] = /在 π0 里是第/.test(s); if (o === '循环') t = s; }
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok('build: the table has the ten kinds of block named in the lead', has(await secText('k-combo'), '十种积木是：全连接、卷积、循环、注意力、池化、上采样、归一化、残差和跳连、门和路由、查表和切块') && Object.keys(use).length === 10 && OPN.every(o => o in use), Object.keys(use).join(' '));
    ok('build: all nine networks use normalisation; dense layers are used by eight (not U-Net), residuals and skips by eight (not PointNet)', see('k-combo', '归一化九个网络都用', '各有八个用', 'U-Net 里没有全连接，PointNet 里没有残差') && use['归一化'].length === 9 && use['全连接'].length === 8 && !use['全连接'].includes('U-Net') && use['残差、跳连'].length === 8 && !use['残差、跳连'].includes('PointNet'), JSON.stringify([use['归一化'].length, use['全连接'], use['残差、跳连']]));
    ok('build: upsampling is used by only two, U-Net and Diffusion Policy; no other block is used by fewer', see('k-combo', '只有两个网络用的是上采样：U-Net 和扩散策略') && use['上采样'].join('、') === 'U-Net、扩散策略' && OPN.filter(o => o !== '循环').every(o => use[o].length >= 2) && OPN.filter(o => use[o].length === 2).join() === '上采样', JSON.stringify(OPN.map(o => o + ' ' + use[o].length)));
    both('build: the recurrence row is empty: none of the nine uses it; on this page only the wake-word GRU is recurrent', 'k-combo', ['"循环"那一行是空的', '这九个网络都不用它', '只有一直听着的唤醒词网络'], t, '这 9 个网络都没用它', '注意力能一次看完整段，好并行', '唤醒词 GRU');
    const ch = H.chain(P, 'SigLIP ×3', 6), main = {}; ch.forEach(c => main[c.ops[0]] = (main[c.ops[0]] || 0) + 1); const kinds = new Set(); ch.forEach(c => c.ops.forEach(o => kinds.add(o)));
    ok('build: the chain of π0 has 6 operation blocks; their main operations (the stripes) are attention ×4, lookup ×1, dense ×1; in all they use six kinds of block', see('k-combo', '有 6 个运算块', '色条只有三种颜色', '注意力 4 块，查表 1 块，全连接 1 块（Gemma 的 MLP）', '十种积木里的六种') && ch.map(c => c.zh).join('|') === 'SigLIP ×3|查表|Gemma · 注意力|Gemma · MLP|动作专家 · 状态|动作专家' && main.attn === 4 && main.embed === 1 && main.dense === 1 && ch[3].ops[0] === 'dense' && kinds.size === 6 && OPN.filter(o => inPi[o]).length === 6, JSON.stringify([ch.map(c => c.zh + ':' + c.ops[0]), [...kinds], OPN.filter(o => inPi[o])]));
    await w.click('Mixtral', 500); m = await w.met(); s = await w.status();
    both('build Mixtral: 47B parameters stored, 13B used per token; one token is 26 GFLOP', 'k-combo', ['存着 47B（470 亿）个参数', '只用到 13B（130 亿）个', '一个词元是 26 GFLOP', '占内存像 470 亿的模型，算起来像 130 亿的'], m + s, '参数 P 47B', '每个词元 26 GFLOP 2 × 13B（论文）', '每个词元只用 12.9B（论文 13B）', '占内存像 47B 的模型，算起来像 13B 的', '每层 8 个专家', '挑 2 个');
    ok('build Mixtral: 47 ÷ 13 = 3.6 and 2 × 47 billion = 94 GFLOP', see('k-combo', '差了约 3.6 倍', '不是 94 GFLOP') && near(47 / 13, 3.6, .02) && 2 * 47 === 94);
    await w.click('ResNet-18', 300); }

  sec('step ⑮ · sizes and chips (size)');
  w = W('size'); await w.show();
  { const R = {}; for (let k = 0; k < 11; k++) { s = (await w.status()).split(' ## ')[0]; const q = s.match(/^([^：]+)：[^]*?所以每个参数平均用 ([\d.]+) 次/); if (q) R[q[1]] = +q[2]; if (s.startsWith('小 U-Net')) t = s; await w.click('下一步', 250); }
    const names = Object.keys(R);
    ok('size: the walk-through visits 11 networks', names.length === 11, names.join(' ¦ '));
    ok('size: on the "used once" line: the neuron (0.75), the hand policy (1), Llama 3.1 8B (0.93), Mixtral (1 per parameter used)', see('k-size', '松手的神经元（每个参数用 0.75 次）', '手的小策略（1 次）', 'Llama 3.1 8B（0.93 次）', 'Mixtral（按用到的参数算 1 次）') && R['松手的神经元'] === .75 && R['手的小策略 MLP'] === 1 && R['Llama 3.1 8B'] === .93 && R['Mixtral 8x7B'] === 1, JSON.stringify(R));
    const far = names.slice().sort((a, c) => R[c] - R[a]);
    ok('size: furthest from the line: the small U-Net (1,762), then Whisper (715) and π0 (651)', see('k-size', '离得最远的是小 U-Net，每个参数用 1762 次', 'Whisper（715 次）', 'π0（651 次）') && far[0].startsWith('小 U-Net') && R[far[0]] === 1762 && far[1].startsWith('Whisper') && R[far[1]] === 715 && far[2].startsWith('π0') && R[far[2]] === 651 && names.filter(x => R[x] <= 1).length === 4, far.map(x => x + ' ' + R[x]).join(' ¦ '));
    const pick = async (name) => { const r = await p.evaluate(nm => { const row = [...document.querySelectorAll('#size table tr')].find(r => r.cells[0] && r.cells[0].innerText.includes(nm)); if (!row) return 'no row ' + nm; row.click(); return 'ok'; }, name); if (r !== 'ok') { bad++; log.push('FAIL size: ' + r); } await p.waitForTimeout(300); return [await w.met(), (await w.status()).split(' ## ')[0]]; };
    await w.click('Thor', 300); await w.click('BF16', 300);
    const [mu, su] = await pick('U-Net'), [mr, sr] = await pick('ResNet-18');
    both('size: U-Net has 7.77M parameters and 27.4 GFLOP, ResNet-18 11.7M and 3.63 GFLOP', 'k-size', ['U-Net 的参数（7.77M）比 ResNet-18（11.7M）少', '27.4 GFLOP 对 3.63 GFLOP'], mu + ' ¦ ' + mr, '参数 P 7.77M', '每次的运算 F 27.4 GFLOP', '参数 P 11.7M', '每次的运算 F 3.63 GFLOP');
    both('size: the top-level kernels of U-Net are used 256 × 256 = 65,536 times; no kernel of ResNet-18 more than 56 × 56 times', 'k-size', ['256 × 256 = 65536 个位置', '最多也只用 56 × 56 次'], su + ' ¦ ' + sr, '顶层的卷积核用 256 × 256 = 65536 次', '第一组有 56 × 56 个位置');
    const [ml, sl] = await pick('Llama 8B');
    both('size Thor · BF16: Llama 3.1 8B takes 16.1 GB and fits (13% of 128 GB); 58.8 ms per token, at most 17 a second, not keeping up with 20', 'k-size', ['参数 16.1 GB，装得下（128 GB 的 13%）', '58.8 毫秒', '最多每秒 17 个', '跟不上每秒 20 个的节拍'], ml + sl, '参数 16.1 GB，放得下（128 GB 的 13%）', '= 58.8 ms，卡在读参数', '每秒 20 个词元就要忙 118% 的时间：跟不上，最多每秒 17 个');
    await w.click('FP4', 400); const [m4, s4] = await pick('Llama 8B');
    both('size Thor · FP4: 4.02 GB, 14.7 ms per read: it keeps up', 'k-size', ['4.02 GB', '读一遍 14.7 毫秒', '跟得上'], m4 + s4, '参数 4.02 GB，放得下', '= 14.7 ms，卡在读参数', '跟得上');
    ok('size: 1 ÷ 14.7 ms ≈ 68 tokens a second and 1 ÷ 58.8 ms ≈ 17', see('k-size', '每秒约 68 个') && Math.round(1000 / 14.7) === 68 && Math.floor(1000 / 58.8) === 17);
    await w.click('BF16', 300); await pick('ResNet-18'); }

  // =============================================================================================================
  // Part B: the numbers of the text, the tables, the quiz and the figures, recomputed here
  // =============================================================================================================
  const TX = {}; for (const id of IDS) TX[id] = await secText(id);
  const HDR = await p.evaluate(() => { const h = document.querySelector('header'); h.querySelectorAll('details').forEach(d => d.open = true); return h.innerText; }).then(norm);
  const T = (id, ...strs) => strs.every(s => (id === 'hdr' ? HDR : TX[id]).includes(s));
  const miss = (id, ...strs) => strs.filter(s => !(id === 'hdr' ? HDR : TX[id]).includes(s)).join(' ¦ ');
  // one check: every quoted string is in that step's text AND the recomputed values agree
  const tx = (name, id, strs, cond, got) => ok(name, T(id, ...strs) && !!cond, 'text lacks: ' + miss(id, ...strs) + (got !== undefined ? ' ¦¦ computed: ' + JSON.stringify(got) : ''));
  const sg = z => 1 / (1 + Math.exp(-z)), relu = v => Math.max(0, v), r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const softmax = a => { const e = a.map(Math.exp), s0 = e.reduce((x, y) => x + y, 0); return e.map(v => v / s0); };
  const dot = (a, c) => a.reduce((s0, v, i) => s0 + v * c[i], 0);
  // the page's running numbers
  const LL = { voc: 128256, d: 4096, ff: 14336, L: 32, kv: 1024 };
  LL.block = 2 * LL.d * LL.d + 2 * LL.d * LL.kv + 3 * LL.d * LL.ff + 2 * LL.d; LL.P = LL.L * LL.block + 2 * LL.voc * LL.d + LL.d; LL.F = 2 * (LL.P - LL.voc * LL.d);

  sec('text · the header and step 0');
  tx('hdr: the unit conventions: FP32 4 bytes, BF16 2, FP8 1, FP4 half; a multiply–add counts as 2 operations; a GB is 10⁹ bytes', 'hdr', ['FP32 是 4 字节，BF16 是 2，FP8 是 1，FP4 是半个', '算 2 次运算', '本篇的 GB 都是 109 字节'], true);
  tx('step 0: the robot has 2 + 1 + 14 + 2 + 2 = 21 joints; the head camera takes 30 pictures of 1280 × 720 a second; 128 GB of memory', 'k-open', ['2 + 1 + 14 + 2 + 2，一共 21 个关节', '每秒拍 30 张 1280 × 720 的照片', '128 GB 内存'], 2 + 1 + 14 + 2 + 2 === 21);
  tx('step 0: the smallest network has 4 parameters and takes 6 operations, the largest 8 billion parameters; one call of the action model takes 4.3 trillion operations: 9 and nearly 12 orders of magnitude apart', 'k-open', ['只有 4 个参数、算一次 6 次运算', '80 亿个参数', '4.3 万亿次运算', '参数差了 9 个数量级，运算差了将近 12 个数量级'], near(Math.log10(8.03e9 / 4), 9.3, .05) && near(Math.log10(4.3e12 / 6), 11.86, .05), [Math.log10(8.03e9 / 4), Math.log10(4.3e12 / 6)]);
  tx('step 0: the list of networks quotes the numbers worked out in the later steps (79 kB, 3.8 million; 340 billion; 15 billion per token; 220 billion per image; 4.3 trillion; 3.6 billion; 210,000 parameters and 420,000 operations)', 'k-open', ['约 79 kB', '约 380 万次运算', '约 3400 亿次运算', '约 150 亿次运算', '一张图约 2200 亿次运算', '一次约 4.3 万亿次运算', '一张图约 36 亿次运算', '约 21 万个参数，一次约 42 万次运算'], Math.round(344.16) === 344 && Math.round(LL.F / 1e9) === 15 && Math.round(3.63) === 4 - 0 && Math.round(209429 / 1e4) === 21 && Math.round(417024 / 1e4) === 42);

  sec('text · step 0, units');
  { const s2 = sg(2), q = (v, bits, lo) => Math.round(v / Math.pow(2, lo - bits)) * Math.pow(2, lo - bits);   // round to `bits` mantissa bits for a value in [2^lo, 2^(lo+1))
    const bf16 = q(s2, 7, -1), fp16 = q(s2, 10, -1), fp8 = q(s2, 3, -1), fp4vals = [0, .5, 1, 1.5, 2, 3, 4, 6], fp4 = fp4vals.reduce((a, c) => Math.abs(c - s2) < Math.abs(a - s2) ? c : a);
    tx('units table: σ(2) = 0.880797… is stored as 0.88079709 in FP32, 0.87890625 in BF16, 0.88085938 in FP16, 0.875 in FP8 and 1 in FP4', 'k-units', ['σ(2) = 0.880797', '0.88079709', '0.87890625', '0.88085938', '0.875'], Math.fround(s2).toFixed(8) === '0.88079709' && bf16 === .87890625 && fp16.toFixed(8) === '0.88085938' && fp8 === .875 && fp4 === 1, [Math.fround(s2), bf16, fp16, fp8, fp4]);
    tx('units table: the bits add up (1 + 8 + 23 = 32, 1 + 8 + 7 = 16, 1 + 5 + 10 = 16); the largest FP16 value is 65,504 and the largest FP32 and BF16 values about 3.4 × 10³⁸', 'k-units', ['1 + 8 + 23 = 32', '1 + 8 + 7 = 16', '1 + 5 + 10 = 16', '65504', '约 3.4 × 1038'], (2 - Math.pow(2, -10)) * Math.pow(2, 15) === 65504 && near((2 - Math.pow(2, -23)) * Math.pow(2, 127) / 1e38, 3.4, .01) && near((2 - Math.pow(2, -7)) * Math.pow(2, 127) / 1e38, 3.39, .01));
    tx('units: FP4 has 15 different values (0, ±0.5, ±1, ±1.5, ±2, ±3, ±4, ±6); −10 can only be stored as −6; with one 8-bit scale per 16 numbers FP4 really takes 4.5 bits per number', 'k-units', ['一共只有 15 个不同的值（0、±0.5、±1、±1.5、±2、±3、±4、±6）', '只能存成 -6', '约 4.5 比特', '-128 到 127'], 1 + 2 * 7 === 15 && Math.max(...fp4vals) === 6 && 4 + 8 / 16 === 4.5);
    tx('units card: the neuron: P = 4, M = 16 B in FP32, 3 multiply–adds, F = 6 FLOP, R = 300 FLOP/s at 50 calls a second', 'k-units', ['P = 4，用 FP32 存，q = 4，M = 16 B', 'NMAC = 3，F = 6 FLOP', 'f = 50 Hz，R = 300 FLOP/s'], 4 * 4 === 16 && 2 * 3 === 6 && 6 * 50 === 300);
    tx('units card: Llama 3.1 8B: P ≈ 8.03 × 10⁹, 16.1 GB in BF16, 15 GFLOP per token, 59 ms to read the weights at 273 GB/s', 'k-units', ['P ≈ 8.03 × 109', 'M ≈ 1.61 × 1010 B = 16.1 GB', 'F ≈ 1.5 × 1010 FLOP = 15 GFLOP', 't ≈ 16.1 / 273 ≈ 0.059 秒', '59 毫秒'], near(LL.P / 1e9, 8.03, .005) && near(LL.P * 2 / 1e9, 16.06, .01) && near(LL.F / 1e9, 15.0, .05) && near(16.1 / 273, .059, .0005), [LL.P, LL.F]);
    tx('units card: the "1.8 GFLOPs" of ResNet-18 are 1.8 billion multiply–adds, 3.6 billion operations as counted here', 'k-units', ['"1.8 GFLOPs"是 18 亿次乘加', '36 亿次运算'], true);
    tx('units: the prefix table and the 1024-based units: 0.42 MFLOP = 420,000; 3.63 GFLOP = 3.63 billion; 4.3 TFLOP = 4.3 trillion; 1 GiB = 2³⁰ ≈ 1.074 × 10⁹ bytes, so 16.1 GB shows as 15.0 GiB', 'k-units', ['0.42 MFLOP = 42 万次运算', '3.63 GFLOP = 36.3 亿次运算', '4.3 TFLOP = 4.3 万亿次', '1 GiB = 230 ≈ 1.074 × 109 字节', '15.0 GiB'], near(Math.pow(2, 30) / 1e9, 1.074, .0005) && (LL.P * 2 / Math.pow(2, 30)).toFixed(1) === '15.0', LL.P * 2 / Math.pow(2, 30)); }

  sec('text · step ① the neuron');
  { const wn = [.5, 3, -10], bn = -4, z = x => dot(wn, x) + bn;
    tx('step ①: lead and card: 6 × 0.5 = 3, 1 × 3 = 3, 0 × (−10) = 0; 6 + (−4) = 2; e⁻² ≈ 0.135, y = 1 / 1.135 ≈ 0.88', 'k-neuron', ['6 × 0.5 + 1 × 3 + 0 × (-10) - 4 = 2 分', '2 分弯成 0.88', '6 × 0.5 = 3，1 × 3 = 3，0 × (-10) = 0', '6 + (-4) = 2', 'e-2 ≈ 0.135', 'y = 1 / 1.135 ≈ 0.88'], z([6, 1, 0]) === 2 && r3(Math.exp(-2)) === .135 && r2(sg(2)) === .88, [z([6, 1, 0]), sg(2)]);
    tx('step ①: the two other moments: (2, 0, 0) gives z = −3 and y ≈ 0.05; (6, 1, 0.5) gives z = 3 + 3 − 5 − 4 = −3', 'k-neuron', ['z = 2 × 0.5 + 0 + 0 - 4 = -3', 'y = 1 / (1 + e3) ≈ 0.05', 'z = 3 + 3 - 5 - 4 = -3'], z([2, 0, 0]) === -3 && r2(sg(-3)) === .05 && z([6, 1, .5]) === -3, [z([2, 0, 0]), sg(-3), z([6, 1, .5])]);
    tx('step ①: without the bend, a pull of 600 N would raise z from 2 to 299, nearly 150 times', 'k-neuron', ['从 6 N 涨到 600 N，z 就从 2 涨到 299', '涨了快 150 倍'], z([600, 1, 0]) === 299 && near(299 / 2, 149.5, 1e-9));
    tx('step ①: 4 parameters, 16 bytes in FP32 and 8 in BF16, 3 multiplications and 3 additions = 6 operations; the dividing line is 0.5 x₁ + 3 x₂ − 4 = 0', 'k-neuron', ['一共只有 4 个可以学的数', '一共 16 字节', '8 字节', '3 次乘法和 3 次加法', '一共 6 次运算', '0.5 x1 + 3 x2 - 4 = 0'], 3 + 1 === 4 && 4 * 4 === 16 && 4 * 2 === 8 && .5 * 2 + 3 * 1 - 4 === 0); }

  sec('text · step ② the dense layer');
  const W1 = [[.5, 3, -10], [.5, -3, 0], [0, 2, 5], [-.5, 0, 0]], B1 = [-4, -1, -1, 1], lay1 = x => W1.map((r, i) => dot(r, x) + B1[i]);
  { const z = lay1([6, 1, 0]), h = z.map(relu);
    tx('step ②: the four neurons give z = (2, −1, 1, −2) and, after ReLU, h = (2, 0, 1, 0); 12 weights + 4 biases = 16 parameters, 64 bytes in FP32, 12 multiply–adds, 24 operations', 'k-layer', ['得到四个分数 (2, -1, 1, -2)', '输出 (2, 0, 1, 0)', '松手 0.5 × 6 + 3 × 1 + (-10) × 0 - 4 = 2', '握紧 0.5 × 6 + (-3) × 1 + 0 - 1 = -1', 'z = (2, -1, 1, -2)', 'h = (2, 0, 1, 0)', '一共 16 个，FP32 是 64 字节', '12 次乘加，24 次运算'], z.join() === '2,-1,1,-2' && h.join() === '2,0,1,0' && 4 * 3 + 4 === 16 && 16 * 4 === 64, [z, h]);
    const zb = lay1([2, 0, 0]).map(relu), zc = lay1([6, 1, .5]).map(relu);
    ok('step ②: the batch of three in the interactive: the wobble gives all zeros, the moving arm gives only "stop" = 3.5', zb.join() === '0,0,0,0' && zc.join() === '0,0,3.5,0', [zb, zc]);
    tx('step ②: Llama’s 4096 → 4096 layer: 16,777,216 parameters (about 16.78 million), 33,554,432 bytes ≈ 33.6 MB in BF16, about 33.55 million operations = 33.6 MFLOP', 'k-layer', ['4096 × 4096 = 16777216 个参数', '约 1678 万个', '一共 33554432 字节，约 33.6 MB', '约 1678 万次乘加', '约 3355 万次运算', '33.6 MFLOP'], 4096 * 4096 === 16777216 && 2 * 16777216 === 33554432); }

  sec('text · step ③ the MLP');
  { const W2 = [[1, 0, .5, 0], [-1, 1, 0, 1]], B2 = [0, 1], h = lay1([6, 1, 0]).map(relu), z2 = W2.map((r, i) => dot(r, h) + B2[i]), pr = softmax(z2);
    tx('step ③: the second layer gives 2.5 and −1; e^2.5 ≈ 12.18, e^−1 ≈ 0.37; softmax 12.18 / 12.55 ≈ 0.971 and 0.029', 'k-mlp', ['松手 1 × 2 + 0 × 0 + 0.5 × 1 + 0 × 0 + 0 = 2.5', '握着 -1 × 2 + 1 × 0 + 0 × 1 + 1 × 0 + 1 = -1', 'e2.5 ≈ 12.18', 'e-1 ≈ 0.37', '12.18 / 12.55 ≈ 0.971', '握着是 0.029'], z2.join() === '2.5,-1' && r2(Math.exp(2.5)) === 12.18 && r2(Math.exp(-1)) === .37 && r3(pr[0]) === .971 && r3(pr[1]) === .029, [z2, pr]);
    tx('step ③ card: 26 parameters (16 + 10), 12 + 8 = 20 multiply–adds, 40 operations', 'k-mlp', ['第一层 16 个，第二层 4 × 2 + 2 = 10 个，一共 26 个', '12 + 8 = 20 次，40 次运算'], 16 + 4 * 2 + 2 === 26 && 2 * (12 + 8) === 40);
    const WW = W2.map(r => [0, 1, 2].map(j => r.reduce((s0, v, k) => s0 + v * W1[k][j], 0))), bb = W2.map((r, i) => dot(r, B1) + B2[i]), zl = lay1([6, 1, 0]), z2l = W2.map((r, i) => dot(r, zl) + B2[i]), one = WW.map((r, i) => dot(r, [6, 1, 0]) + bb[i]);
    tx('step ③ card: without the bend the layers merge: W₂W₁ has the rows (0.5, 4, −7.5) and (−0.5, −6, 10), the bias is (−4.5, 5), and one layer gives the same 2.5 and −4', 'k-mlp', ['(2, -1, 1, -2)，第二层得到 (2.5, -4)', '= (0.5, 4, -7.5)', '第二行是 (-0.5, -6, 10)', '合并后的偏置是 (-4.5, 5)', '0.5 × 6 + 4 × 1 - 4.5 = 2.5', '-0.5 × 6 - 6 × 1 + 5 = -4'], WW[0].join() === '0.5,4,-7.5' && WW[1].join() === '-0.5,-6,10' && bb.join() === '-4.5,5' && z2l.join() === '2.5,-4' && one.join() === '2.5,-4', [WW, bb, z2l, one]);
    const mlp = ws => { let Pn = 0, Mn = 0; const rows = []; for (let i = 1; i < ws.length; i++) { rows.push([ws[i - 1] * ws[i] + ws[i], ws[i - 1] * ws[i]]); Pn += ws[i - 1] * ws[i] + ws[i]; Mn += ws[i - 1] * ws[i]; } return { P: Pn, M: Mn, rows }; };
    const hp = mlp([82, 512, 256, 128, 21]), wide = mlp([82, 1024, 512, 256, 21]);
    tx('step ③: the hand policy takes in 82 numbers = 21 + 21 + 12 + 7 + 21; layer by layer 42,496, 131,328, 32,896 and 2,709 parameters, 209,429 in all, 837,716 bytes ≈ 0.84 MB in FP32', 'k-mlp', ['它吃进 82 个数', '82 × 512 + 512 = 42496', '131328', '32896', '2709', 'P = 209429 个参数', 'FP32 是 837716 字节，约 0.84 MB'], 21 + 21 + 12 + 7 + 21 === 82 && hp.rows.map(r => r[0]).join() === '42496,131328,32896,2709' && hp.P === 209429 && hp.P * 4 === 837716, hp);
    tx('step ③: 41,984 + 131,072 + 32,768 + 2,688 = 208,512 multiply–adds, 417,024 operations ≈ 0.42 MFLOP; at 50 calls a second about 20.85 million operations ≈ 21 MFLOP/s', 'k-mlp', ['41984 + 131072 + 32768 + 2688 = 208512 次', '417024 次', 'F ≈ 0.42 MFLOP', '约 2085 万次运算', '约 21 MFLOP/s'], hp.rows.map(r => r[1]).join() === '41984,131072,32768,2688' && hp.M === 208512 && 2 * hp.M === 417024 && 50 * 417024 === 20851200);
    tx('step ③: the 512 → 256 layer holds over six tenths of the parameters; doubling the hidden widths gives 746,517 parameters, 3.6 times as many', 'k-mlp', ['一层占了六成多', '参数变成 746517 个，是原来的 3.6 倍'], near(131328 / hp.P, .627, .001) && wide.P === 746517 && near(wide.P / hp.P, 3.56, .01), [131328 / hp.P, wide.P]);
    tx('step ③: training takes about 6P operations per example, 3 times inference, and about 16 bytes per parameter (2 + 2 + 12): 3.4 MB for the hand, about 128 GB for an 8-billion-parameter model', 'k-mlp', ['约 6P 次运算，是推理的 3 倍', '（共 12 字节）', '每个参数约 16 字节', '209429 × 16 字节 ≈ 3.4 MB', '约 128 GB'], 2 + 2 + 12 === 16 && near(hp.P * 16 / 1e6, 3.35, .01) && near(LL.P * 16 / 1e9, 128.5, .1), [hp.P * 16, LL.P * 16]); }

  sec('text · step ④ convolution');
  const img = [0, 1, 2, 3, 4, 5].map(r => [0, 1, 2, 3, 4, 5].map(c => (r >= 2 && c >= 3) ? 2 : 8));
  const conv2 = (x, k, pad, st0) => { const n = x.length, q = n + 2 * pad, g = (r, c) => (r < pad || c < pad || r >= n + pad || c >= n + pad) ? 0 : x[r - pad][c - pad], no = Math.floor((q - 3) / st0) + 1, o = []; for (let i = 0; i < no; i++) { o.push([]); for (let j = 0; j < no; j++) { let a = 0; for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) a += k[u][v] * g(i * st0 + u, j * st0 + v); o[i].push(Math.round(a * 100) / 100); } } return o; };
  { const kv = [[1, 0, -1], [1, 0, -1], [1, 0, -1]], kh = [[1, 1, 1], [0, 0, 0], [-1, -1, -1]], o = conv2(img, kv, 0, 1), oh = conv2(img, kh, 0, 1);
    tx('step ④: a 1280 × 720 photo is 2,764,800 numbers; a dense layer from 224 × 224 × 3 = 150,528 inputs to 112 × 112 × 64 = 802,816 outputs would need about 1.2 × 10¹¹ weights, about 483 GB in FP32, nearly 4 times the 128 GB', 'k-conv', ['一共 2764800 个数', '（150528 个数）', '（802816 个数）', '150528 × 802816 ≈ 1.2 × 1011 个权重', '约 483 GB', '将近 4 倍'], 1280 * 720 * 3 === 2764800 && 224 * 224 * 3 === 150528 && 112 * 112 * 64 === 802816 && near(150528 * 802816 / 1e11, 1.2085, .001) && near(150528 * 802816 * 4 / 1e9, 483.4, .1) && near(483.4 / 128, 3.78, .01));
    tx('step ④: the hand-worked example: 24 − 24 = 0, 24 − 18 = 6, 24 − 6 = 18; the 4 × 4 output has 6, 12, 18, 18 down its two middle columns and 0 on both sides; 16 positions × 9 = 144 multiply–adds with 9 weights', 'k-conv', ['24 - 24 = 0', '24 - 18 = 6', '24 - 6 = 18', '4 × 4 = 16 个位置', '中间两列从上到下是 6、12、18、18，两边全是 0', '16 个位置 × 9 = 144 次'], o.map(r => r.join(' ')).join(' / ') === '0 6 6 0 / 0 12 12 0 / 0 18 18 0 / 0 18 18 0' && 16 * 9 === 144, o);
    ok('step ④: the same picture with the horizontal-edge kernel gives 0 6 12 18 in the top two rows and 0 below, as the interactive shows', oh.map(r => r.join(' ')).join(' / ') === '0 6 12 18 / 0 6 12 18 / 0 0 0 0 / 0 0 0 0', oh);
    ok('step ④: output sides by the formula: 4 (no padding), 6 (one ring of zeros), 3 (one ring and stride 2), 2 (stride 2 alone)', conv2(img, kv, 0, 1).length === 4 && conv2(img, kv, 1, 1).length === 6 && conv2(img, kv, 1, 2).length === 3 && conv2(img, kv, 0, 2).length === 2);
    const n1 = Math.floor((224 + 6 - 7) / 2) + 1;
    tx('step ④ card: ResNet-18’s first layer: n′ = ⌊(224 + 6 − 7) / 2⌋ + 1 = 112; 7 × 7 × 3 × 64 = 9,408 weights; 9,408 × 112 × 112 = 118,013,952 multiply–adds ≈ 0.24 GFLOP; a dense layer would need about 12.8 million times as many weights; each weight is used 12,544 times', 'k-conv', ['n′ = ⌊(224 + 6 - 7) / 2⌋ + 1 = 112', '7 × 7 × 3 × 64 = 9408 个', '9408 × 112 × 112 = 118013952 次', '约 0.24 GFLOP', '约 1280 万倍', '112 × 112 = 12544 次', '约 47 MB'], n1 === 112 && 7 * 7 * 3 * 64 === 9408 && 9408 * 112 * 112 === 118013952 && near(2 * 118013952 / 1e9, .236, .001) && near(150528 * 802816 / 9408 / 1e4, 1284.5, .5) && 112 * 112 === 12544);
    tx('step ④: a 3 × 3 × 3 kernel has 27 weights; L stacked 3 × 3 layers see (1 + 2L) × (1 + 2L) pixels: 5 × 5 for two; halving the picture cuts the operations by three quarters', 'k-conv', ['3 × 3 × 3 = 27 个权重', '合起来是 5 × 5', '(1 + 2L) × (1 + 2L) 个像素', '少了四分之三'], 3 * 3 * 3 === 27 && 1 + 2 * 2 === 5 && 1 - 1 / 4 === .75); }

  sec('text · step ⑤ ResNet-18');
  // an independent count of ResNet-18 (torchvision layout): convolutions without bias, 2 normalisation parameters per channel
  const resnet18 = (hh, ww) => { const o = (n, k, s0, pd) => Math.floor((n + 2 * pd - k) / s0) + 1; const seg = []; let h = o(hh, 7, 2, 3), w0 = o(ww, 7, 2, 3);
    seg.push({ P: 7 * 7 * 3 * 64 + 128, M: 7 * 7 * 3 * 64 * h * w0, h, w: w0 }); h = o(h, 3, 2, 1); w0 = o(w0, 3, 2, 1); let ci = 64, rf = 11, jump = 4; rf = 7 + 2 * 2;
    [64, 128, 256, 512].forEach((c, si) => { let Pn = 0, Mn = 0; for (let b0 = 0; b0 < 2; b0++) { const s0 = (b0 === 0 && si > 0) ? 2 : 1, hi = h, wi = w0; h = o(h, 3, s0, 1); w0 = o(w0, 3, s0, 1);
        Pn += 9 * ci * c + 2 * c + 9 * c * c + 2 * c; Mn += 9 * ci * c * h * w0 + 9 * c * c * h * w0; rf += 2 * jump; jump *= s0; rf += 2 * jump;
        if (s0 === 2) { Pn += ci * c + 2 * c; Mn += ci * c * h * w0; } ci = c; } seg.push({ P: Pn, M: Mn, h, w: w0, rf }); });
    seg.push({ P: 512 * 1000 + 1000, M: 512 * 1000 }); return { seg, P: seg.reduce((a, c) => a + c.P, 0), M: seg.reduce((a, c) => a + c.M, 0) }; };
  { const R = resnet18(224, 224), S5 = R.seg, big = resnet18(720, 1280);
    tx('step ⑤ table: first layer 9,536 parameters and 118.0 M multiply–adds; the four stages 147,968 / 525,568 / 2,099,712 / 8,393,728 parameters and 462.4 / 411.0 / 411.0 / 411.0 M multiply–adds; one number sees 11, 43, 99, 211, 435 pixels', 'k-cnn', ['9536', '118.0 M', '147968', '462.4 M', '525568', '411.0 M', '2099712', '8393728', '11 像素', '43 像素', '99 像素', '211 像素', '435 像素'], S5.map(x => x.P).join() === '9536,147968,525568,2099712,8393728,513000' && S5.slice(0, 5).map(x => (x.M / 1e6).toFixed(1)).join() === '118.0,462.4,411.0,411.0,411.0' && S5.slice(1, 5).map(x => x.rf).join() === '43,99,211,435', S5);
    tx('step ⑤: 11,689,512 parameters, about 46.8 MB in FP32 and 23.4 MB in BF16; 1.81 billion multiply–adds, about 3.63 GFLOP', 'k-cnn', ['一共 11689512 个参数', 'FP32 约 46.8 MB', 'BF16 约 23.4 MB', '1.81 G 次（18.1 亿次）乘加', '约 3.63 GFLOP（36.3 亿次运算）'], R.P === 11689512 && near(R.P * 4 / 1e6, 46.76, .01) && near(R.P * 2 / 1e6, 23.38, .01) && R.M === 1814073344 && near(2 * R.M / 1e9, 3.628, .001), [R.P, R.M]);
    tx('step ⑤: stage 4 holds 72% of the parameters and 23% of the operations; its kernels are used 49 times each, those of stage 1 3,136 times; the last three stages take 411 million multiply–adds each', 'k-cnn', ['72% 的参数', '运算却只占 23%', '每个核只用 49 次', '每个核用 3136 次', '后面三个阶段的乘加都是 4.11 亿次'], Math.round(S5[4].P / R.P * 100) === 72 && Math.round(S5[4].M / R.M * 100) === 23 && 7 * 7 === 49 && 56 * 56 === 3136 && S5[2].M === S5[3].M && S5[3].M === S5[4].M && S5[4].M === 411041792, [S5[4].P / R.P, S5[4].M / R.M]);
    tx('step ⑤: at 1280 × 720 the multiply–adds are 33.5 billion, 18.5 times those at 224 × 224, about the ratio of the areas; the parameters do not change', 'k-cnn', ['乘加变成 33.5 G 次', '18.5 倍', '面积之比'], big.P === R.P && near(big.M / 1e9, 33.48, .01) && near(big.M / R.M, 18.45, .01) && near(1280 * 720 / (224 * 224), 18.37, .01), [big.M, big.M / R.M]);
    tx('step ⑤ card: a block of stage 1: two layers of 3 × 3 × 64 × 64 = 36,864 weights plus 128 for normalisation = 36,992 each; 36,864 multiply–adds at each of 56 × 56 positions ≈ 116 million; the 1 × 1 convolution on the shortcut of stage 2 has 8,448 parameters', 'k-cnn', ['3 × 3 × 64 × 64 = 36864 个权重', '64 × 2 = 128 个', '各 36992 个参数', '约 1.16 亿次', '8448 个参数'], 3 * 3 * 64 * 64 === 36864 && 36864 + 128 === 36992 && near(36864 * 56 * 56 / 1e8, 1.156, .001) && 64 * 128 + 2 * 128 === 8448);
    tx('step ⑤: "18" counts the layers with weights: 1 + 16 + 1', 'k-cnn', ['第一层 1 个，四个阶段 16 个，最后的全连接层 1 个'], 1 + 4 * 2 * 2 + 1 === 18); }

  sec('text · step ⑥ the recurrent network');
  { const xs = [0, 2, 6, 6, 2]; let h = 0; const hs = xs.map(x => (h = .5 * h + .5 * x));
    tx('step ⑥: with a = 0.5 the memory is 0, 1, 3.5, 4.75, 3.375 (lead and card)', 'k-rnn', ['0、1、3.5、4.75、3.375', 'h2 = 0 + 0.5 × 2 = 1', 'h3 = 0.5 × 1 + 0.5 × 6 = 3.5', 'h4 = 1.75 + 3 = 4.75', 'h5 = 2.375 + 1 = 3.375'], hs.join() === '0,1,3.5,4.75,3.375', hs);
    tx('step ⑥ card: what is left after t steps is aᵗ: with a = 0.5 a half, a quarter, 3%, a thousandth, a millionth after 1, 2, 5, 10, 20 steps; with a = 0.9, 35% after 10 steps and 0.5% after 50', 'k-rnn', ['过 1 步剩一半，2 步剩 1/4，5 步剩 3%，10 步剩千分之一，20 步只剩百万分之一', '10 步后还剩 35%', '50 步后也只剩 0.5%'], Math.round(Math.pow(.5, 5) * 100) === 3 && near(Math.pow(.5, 10) * 1000, .98, .01) && near(Math.pow(.5, 20) * 1e6, .95, .01) && Math.round(Math.pow(.9, 10) * 100) === 35 && near(Math.pow(.9, 50) * 100, .52, .01));
    const pr = 512 * (80 + 512 + 1), mac = 512 * (80 + 512);
    tx('step ⑥ card: 80 → 512: 512 × (80 + 512 + 1) = 303,616 parameters, 303,104 multiply–adds a step, about 60.6 million operations a second at 100 steps ≈ 61 MFLOP/s; GRU 910,848 and LSTM 1,214,464 (3 and 4 times); with PyTorch’s two bias sets 912,384 and 1,216,512', 'k-rnn', ['512 × (80 + 512 + 1) = 303616 个', '每一步 303104 次乘加', '约 6060 万次运算', '约 61 MFLOP/s', 'GRU 有 910848 个参数，LSTM 有 1214464 个', '912384 和 1216512'], pr === 303616 && mac === 303104 && 2 * mac * 100 === 60620800 && 3 * pr === 910848 && 4 * pr === 1214464 && 3 * (pr + 512) === 912384 && 4 * (pr + 512) === 1216512);
    tx('step ⑥: the wake-word figures quoted from the Hello Edge paper (78.8 kB, 3.8 million operations, 93.5%; LSTM 92.9%; DS-CNN 38.6 kB, 5.4 million, 94.4%) and 25 steps of 40 ms in 1 s', 'k-rnn', ['78.8 kB', '380 万次运算', '93.5%', '92.9%', '38.6 kB、540 万次运算，认对 94.4%', '每 40 毫秒一步，一共 25 步'], 1000 / 40 === 25); }

  sec('text · step ⑦ attention');
  { const X4 = { '把': [0, 0, 0, 1], '那杯水': [1, 0, 0, 0], '递': [0, 0, 1, 0], '给我': [0, 1, 0, 0] }, ord = ['把', '那杯水', '递', '给我'], q = [2, 2, 0, 0];
    const sc = ord.map(k => dot(q, X4[k]) / 2), a = softmax(sc), y = [0, 1, 2, 3].map(j => ord.reduce((s0, k, i) => s0 + a[i] * X4[k][j], 0)), am = softmax(sc.slice(0, 3));
    tx('step ⑦: the scores of "pass" are (0, 1, 0, 1), the weights (0.134, 0.366, 0.134, 0.366) and the output (0.366, 0.366, 0.134, 0.134); e¹ ≈ 2.72 and the sum is 7.44', 'k-attn', ['把 0，那杯水 1，递 0，给我 1', '(0.134, 0.366, 0.134, 0.366)', '(0.366, 0.366, 0.134, 0.134)', '把 0，那杯水 2，递 0，给我 2', '除以 √4 = 2，得 (0, 1, 0, 1)', 'e1 ≈ 2.72', '加起来 7.44'], sc.join() === '0,1,0,1' && a.map(r3).join() === '0.134,0.366,0.134,0.366' && y.map(r3).join() === '0.366,0.366,0.134,0.134' && r2(Math.E) === 2.72 && r2(2 + 2 * Math.E) === 7.44, [sc, a, y]);
    tx('step ⑦: with the mask the three scores (0, 1, 0) give the weights (0.212, 0.576, 0.212, 0); the four tokens take 320 multiply–adds', 'k-attn', ['剩下三个分数 (0, 1, 0)', '(0.212, 0.576, 0.212, 0)', '一共 320 次乘加'], am.map(r3).join() === '0.212,0.576,0.212' && 3 * 64 + 64 + 64 === 320, am);
    const d = 4096, f8 = T0 => 8 * T0 * d * d, f4 = T0 => 4 * T0 * T0 * d;
    tx('step ⑦ card: d = 4096, 2d = 8192: for 2,000 tokens the table multiplications take about 2.7 × 10¹¹ and the scoring and mixing about 6.6 × 10¹⁰; at 131,072 tokens the scoring takes about 2.8 × 10¹⁴, 16 times the table multiplications; Llama 3.1 8B has 32 query heads of 128 numbers', 'k-attn', ['2d = 8192', '乘表约 2.7 × 1011 次', '打分和混合约 6.6 × 1010 次', '约 2.8 × 1014 次，是乘表的 16 倍', '32 个查询头，每头 128 个数'], near(f8(2000) / 1e11, 2.68, .01) && near(f4(2000) / 1e10, 6.55, .01) && near(f4(131072) / 1e14, 2.815, .001) && f4(131072) / f8(131072) === 16 && 32 * 128 === d, [f8(2000), f4(2000), f4(131072)]); }

  sec('text · step ⑧ the Transformer');
  { const d = LL.d, att = 2 * d * d + 2 * d * LL.kv, ml = 3 * d * LL.ff;
    tx('step ⑧ card: one block of Llama 3.1 8B: attention 41,943,040 parameters, MLP 176,160,768, two normalisations 8,192: 218,112,000 in all', 'k-xfmr', ['一共 41943040 个参数', '一共 176160768 个', '两个归一化 8192 个', '一个块 218112000 个参数'], att === 41943040 && ml === 176160768 && LL.block === 218112000, [att, ml, LL.block]);
    tx('step ⑧ card: P = 32 × 218,112,000 + 2 × 128,256 × 4096 + 4096 = 8,030,261,248; MLP 70.2% (5.64 billion), attention 16.7% (1.34 billion), the two vocabulary tables 13.1% (525 million each)', 'k-xfmr', ['P = 32 × 218112000 + 2 × 128256 × 4096 + 4096 = 8030261248', 'MLP 占 70.2%（56.4 亿）', '注意力占 16.7%（13.4 亿）', '占 13.1%（各 5.25 亿）'], LL.P === 8030261248 && (32 * ml / LL.P * 100).toFixed(1) === '70.2' && near(32 * ml / 1e8, 56.4, .05) && (32 * att / LL.P * 100).toFixed(1) === '16.7' && near(32 * att / 1e8, 13.4, .05) && (2 * LL.voc * d / LL.P * 100).toFixed(1) === '13.1' && near(LL.voc * d / 1e8, 5.25, .005), [LL.P, 32 * ml, 32 * att]);
    tx('step ⑧ card: 16.1 GB in BF16, 8.0 in FP8, 4.0 in FP4; one token 2 × (8,030,261,248 − 525,336,576) ≈ 15 GFLOP; with 2,000 tokens before it another 4 × 32 × 2000 × 4096 ≈ 1.05 GFLOP', 'k-xfmr', ['BF16 存是 16.1 GB，FP8 是 8.0 GB，FP4 是 4.0 GB', '2 × (8030261248 - 525336576) ≈ 150 亿次', '约 15 GFLOP', '4 × 32 × 2000 × 4096 ≈ 1.05 GFLOP'], near(LL.P * 2 / 1e9, 16.06, .01) && LL.voc * d === 525336576 && LL.F === 15009849344 && near(4 * 32 * 2000 * 4096 / 1e9, 1.049, .001), [LL.F]);
    tx('step ⑧ card: the KV cache: d_kv = 8 × 128 = 1024; 2 × 32 × 1024 × 2 bytes = 131,072 bytes ≈ 131 kB per token; 262 MB for 2,000 tokens, 17 GB for 131,072; reading 2,000 tokens in parallel takes about 30 TFLOP', 'k-xfmr', ['dkv = 8 × 128 = 1024', '2 × 32 × 1024 × 2 字节 = 131072 字节', '约 131 kB', '2000 个词元是 262 MB', '13 万个词元是 17 GB', '2000 × 15 GFLOP = 30 TFLOP'], 2 * 32 * 1024 * 2 === 131072 && near(131072 * 2000 / 1e6, 262.1, .1) && near(131072 * 131072 / 1e9, 17.18, .01));
    const g = { d: 2048, L: 18, h: 8, hd: 256, ff: 16384, voc: 256128 }; g.at = g.d * g.h * g.hd + 2 * g.d * g.hd + g.h * g.hd * g.d; g.non = g.L * (g.at + 3 * g.d * g.ff + 2 * g.d) + g.d; g.emb = g.voc * g.d;
    tx('step ⑧: Gemma 2B: cache 2 × 18 × 256 × 2 = 18,432 bytes per token; 1.98 billion parameters without the lookup table and 520 million in it; about 2 × 2.5 billion ≈ 5 GFLOP per token; 16,384 × 2 = 32,768; grouped keys and values make the cache a quarter of what 32 sets would need', 'k-xfmr', ['2 × 18 层 × 256 × 2 字节 = 18432 字节', '除查表以外 19.8 亿个参数', '查表 5.2 亿', '约 2 × 25 亿 ≈ 5 GFLOP', '32768', '四分之一'], 2 * 18 * 256 * 2 === 18432 && g.non === 1981884416 && near(g.emb / 1e8, 5.25, .01) && near((2 * g.non + 2 * g.emb) / 1e9, 5.01, .005) && near((g.non + g.emb) / 1e9, 2.506, .001) && 2 * 16384 === 32768 && 8 / 32 === .25, [g.non, g.emb]);
    const b70 = 2 * 8192 * 8192 + 2 * 8192 * 1024 + 3 * 8192 * 28672 + 2 * 8192, P70 = 80 * b70 + 2 * LL.voc * 8192 + 8192, F70 = 2 * (P70 - LL.voc * 8192);
    tx('step ⑧: Llama 3.1 70B: about 70.6 billion parameters, about 139 GFLOP per token, 141 GB in BF16, 71 GB in FP8: fewer than 4 tokens a second at 273 GB/s, against about 34 for the 8B in FP8', 'k-xfmr', ['约 706 亿个参数', '每个词元约 139 GFLOP', 'BF16 存要 141 GB', 'FP8（71 GB）', '每秒写不到 4 个词元（8B 用 FP8 约 34 个）'], P70 === 70553706496 && near(F70 / 1e9, 139.0, .05) && near(P70 * 2 / 1e9, 141.1, .05) && Math.round(P70 / 1e9) === 71 && 273 / (P70 / 1e9) < 4 && 273 / (P70 / 1e9) > 3.5 && Math.round(273 / (LL.P / 1e9)) === 34, [P70, F70]);
    tx('step ⑧: the list: a vocabulary of 128,256 tokens, a 128,256 × 4096 lookup table, 32 blocks, a 4096 × 128,256 output table', 'k-xfmr', ['词表有 128256 个词元', '一张 128256 行、4096 列的表', '32 个块', '4096 × 128256 的表'], true); }

  sec('text · step ⑨ the vision Transformer');
  { const d = 1152, L = 27, ff = 4304, at = 4 * (d * d + d), ml = d * ff + ff + ff * d + d, ln = 2 * d, layer = at + ml + 2 * ln, pe = 14 * 14 * 3 * d + d, pos = 256 * d, Pv = pe + pos + L * layer + ln;
    const F = T0 => ({ pe: 2 * T0 * 588 * d, tab: L * (2 * T0 * at + 2 * T0 * ml), sc: L * 4 * T0 * T0 * d }), f224 = F(256), f448 = F(1024), f896 = F(4096), tot = f => f.tab + f.sc;
    tx('step ⑨: 224 / 14 = 16 patches a side, 16 × 16 = 256 patches of 14 × 14 × 3 = 588 numbers each, turned into 1,152 numbers; 27 blocks, MLP width 4304, 16 heads', 'k-vit', ['224 / 14 = 16 块', '16 × 16 = 256 块', '拉成一串 588 个数', '588 → 1152', '27 个块', 'MLP 中间 4304，16 个头'], 224 / 14 === 16 && 14 * 14 * 3 === 588);
    tx('step ⑨ card: per layer the table multiplications take about 7.8 GFLOP and the scoring and mixing about 0.30; with the patch step an image takes about 219 GFLOP, of which scoring and mixing 8.2', 'k-vit', ['每层乘表约 7.8 GFLOP', '打分和混合约 0.30 GFLOP', '一张图约 219 GFLOP', '只有 8.2 GFLOP'], near(f224.tab / L / 1e9, 7.80, .005) && near(f224.sc / L / 1e9, .302, .001) && near((tot(f224) + f224.pe) / 1e9, 219.1, .05) && near(f224.sc / 1e9, 8.15, .01), [f224, tot(f224) + f224.pe]);
    tx('step ⑨ card: about 412 million parameters: 15.24 million per layer × 27; the patch table 588 × 1152 plus bias 678,528; the position encoding 256 × 1152 = 294,912; about 0.82 GB in BF16', 'k-vit', ['参数约 4.12 亿', '每层 1524 万', '678528 个', '256 × 1152 = 294912 个', 'BF16 约 0.82 GB'], near(layer / 1e4, 1524, .5) && pe === 678528 && pos === 294912 && Pv === 412442352 && near(Pv * 2 / 1e9, .825, .001), [layer, Pv]);
    tx('step ⑨ card: 219 GFLOP is 27 times ResNet-50 (8.2 GFLOP); 412 million parameters are 16 times its 25.56 million; ResNet-50 uses each parameter about 160 times', 'k-vit', ['是 ResNet-50（8.2 GFLOP）的 27 倍', '是 ResNet-50（2556 万）的 16 倍', '约 160 次'], Math.round(219.1 / 8.18) === 27 && Math.round(Pv / 25.56e6) === 16 && Math.round(4.09e9 / 25.56e6) === 160);
    tx('step ⑨: at 448 px about 973 GFLOP and at 896 px about 5.46 TFLOP: 16 times the tokens and the table multiplications, 256 times the scoring, whose share goes from under 4% to 38%', 'k-vit', ['448 时约 973 GFLOP', '896 时约 5.46 TFLOP', '词元变成 16 倍，乘表也是 16 倍，打分是 256 倍', '从不到 4% 涨到 38%'], near(tot(f448) / 1e9, 972.9, .1) && near(tot(f896) / 1e12, 5.457, .001) && f896.tab / f224.tab === 16 && f896.sc / f224.sc === 256 && f224.sc / tot(f224) < .04 && Math.round(f896.sc / tot(f896) * 100) === 38, [tot(f448), tot(f896), f224.sc / tot(f224), f896.sc / tot(f896)]);
    const bl = 4 * (768 * 768 + 768) + 2 * 768 * 3072 + 3072 + 768 + 2 * 2 * 768, PB = 12 * bl + 16 * 16 * 3 * 768 + 768 + 197 * 768 + 2 * 768, FB = 12 * (2 * 196 * 4 * (768 * 768 + 768) + 4 * 196 * 196 * 768 + 2 * 196 * (2 * 768 * 3072 + 3072 + 768)) + 2 * 196 * 768 * 768;
    tx('step ⑨: patch sides 16, 8 and 32 give 196, 784 and 49 tokens at 224 px; ViT-B/16 (patch 16, 12 layers, width 768) has 86 million parameters and takes about 35 GFLOP an image, a little over 4 times ResNet-50', 'k-vit', ['方块边长 16 是 196 个词元，8 是 784 个，32 只有 49 个', '8600 万个参数，一张图约 35 GFLOP', '4 倍多'], (224 / 16) ** 2 === 196 && (224 / 8) ** 2 === 784 && (224 / 32) ** 2 === 49 && Math.round(PB / 1e6) === 86 && Math.round(FB / 1e9) === 35 && 35 / 8.18 > 4 && 35 / 8.18 < 4.5, [PB, FB]); }

  sec('text · step ⑩ Whisper');
  { const d = 768, L = 12, ff = 3072, Tn = 1500, stem = 2 * (3 * 80 * d * 3000 + 3 * d * d * Tn), enc = L * (2 * Tn * 4 * d * d + 4 * Tn * Tn * d) + L * 2 * Tn * 2 * d * ff, kv = L * 2 * 2 * Tn * d * d, dec = L * 2 * 4 * d * d + L * (2 * 2 * d * d + 2 * 2 * Tn * d) + L * 2 * 2 * d * ff + 2 * d * 51865, all = stem + enc + kv + 12 * dec;
    tx('step ⑩: 2 s of sound are 32,000 numbers; an 80 × 200 picture, padded to 80 × 3000; two convolutions leave 1,500 positions of 768 numbers', 'k-audio', ['2 秒是 32000 个', '80 × 200 的一张图', '80 × 3000 的图', '3000 个时刻变成 1500 个位置'], 16000 * 2 === 32000 && 2000 / 10 === 200 && 30000 / 10 === 3000);
    tx('step ⑩ card: the cross-attention keys and values, once per window: 12 × 2 × 1500 × 768 × 768 ≈ 21.2 billion multiply–adds ≈ 42 GFLOP; afterwards each layer needs 2 × 1500 × 768 ≈ 2.3 million multiply–adds per character; √64 = 8', 'k-audio', ['12 层 × 2 张表 × 1500 × 768 × 768 ≈ 212 亿次乘加', '约 42 GFLOP', '2 × 1500 × 768 ≈ 230 万次乘加', '√64 = 8'], near(12 * 2 * 1500 * 768 * 768 / 1e8, 212.3, .1) && near(kv / 1e9, 42.5, .05) && 2 * 1500 * 768 === 2304000);
    tx('step ⑩: the stem about 6.4 GFLOP, the encoder about 338 GFLOP per window, the keys and values about 42 GFLOP, the decoder about 0.33 GFLOP per token; about 0.39 trillion operations for this sentence, over eight tenths of them in the encoder', 'k-audio', ['约 6.4 GFLOP', '一段约 338 GFLOP', '一段约 42 GFLOP', '每写一个词元约 0.33 GFLOP', '约 0.39 万亿次运算，八成多在编码器'], near(stem / 1e9, 6.41, .005) && near(enc / 1e9, 337.7, .05) && near(dec / 1e9, .333, .0005) && near(all / 1e12, .391, .001) && enc / all > .8 && enc / all < .9, [stem, enc, kv, dec, all]);
    tx('step ⑩: 2 s is 1/15 of 30 s, so 93% of the encoder’s operations go on the padding; the five sizes of the paper', 'k-audio', ['只占 30 秒的 1/15', '93% 的运算花在了补上的静音上', 'tiny 3900 万个参数，base 7400 万，small 2.44 亿，medium 7.69 亿，large 15.5 亿', '约 2.41 亿'], Math.round((1 - 2 / 30) * 100) === 93); }

  sec('text · step ⑪ U-Net');
  // an independent count of the small U-Net as the text describes it: two 3 × 3 convolutions per level (each with a bias and 2 normalisation
  // parameters per channel), max pooling on the way down; on the way up a 2 × 2 convolution after upsampling (with bias), the skip
  // concatenated, two 3 × 3 convolutions; a 1 × 1 output convolution
  const unet = (ch, n, skip) => { let Pn = 0, Mn = 0, s0 = n, a = 3; const rows = [], c3 = (i, o, sz) => { Pn += 9 * i * o + 3 * o; Mn += 9 * i * o * sz * sz; return [9 * i * o + 3 * o, 9 * i * o * sz * sz]; };
    for (let i = 0; i < ch.length; i++) { const c = ch[i], A = c3(a, c, s0), B = c3(c, c, s0); rows.push({ s: s0, P: A[0] + B[0], M: A[1] + B[1] }); a = c; if (i < ch.length - 1) s0 /= 2; }
    for (let i = ch.length - 2; i >= 0; i--) { const c = ch[i]; s0 *= 2; const up = [4 * a * c + c, 4 * a * c * s0 * s0]; Pn += up[0]; Mn += up[1]; const A = c3(skip ? 2 * c : c, c, s0), B = c3(c, c, s0); rows.push({ s: s0, P: up[0] + A[0] + B[0], M: up[1] + A[1] + B[1] }); a = c; }
    Pn += a + 1; Mn += a * s0 * s0; return { P: Pn, M: Mn, rows }; };
  { const U = unet([32, 64, 128, 256, 512], 256, true), U0 = unet([32, 64, 128, 256, 512], 256, false), U512 = unet([32, 64, 128, 256, 512], 512, true), Ubig = unet([64, 128, 256, 512, 1024], 256, true), R = resnet18(224, 224);
    tx('step ⑪: 7,765,985 parameters (about 31.1 MB in FP32), 13.68 billion multiply–adds ≈ 27.4 GFLOP for a 256 × 256 image, 7.5 times ResNet-18 on a 224 × 224 one', 'k-unet', ['7765985 个参数（FP32 约 31.1 MB）', '136.8 亿次乘加', '约 27.4 GFLOP', '7.5 倍'], U.P === 7765985 && near(U.P * 4 / 1e6, 31.06, .01) && near(U.M / 1e8, 136.8, .05) && near(2 * U.M / 1e9, 27.36, .01) && near(2 * U.M / (2 * R.M), 7.54, .01), [U.P, U.M]);
    tx('step ⑪: the most parameters at the bottom (3.54 million) and the level next to it (2.30 million); each level on the way up about 2.35 billion multiply–adds, nearly seven tenths together; the levels on the way down 0.66 to 0.91 billion', 'k-unet', ['谷底（354 万）', '那一级（230 万）', '约 2.35 G 次乘加', '近七成', '0.66 到 0.91 G'], near(U.rows[4].P / 1e4, 354.2, .05) && near(U.rows[5].P / 1e4, 229.6, .05) && U.rows.slice(5).every(r => near(r.M / 1e9, 2.35, .005)) && near(U.rows.slice(5).reduce((a, r) => a + r.M, 0) / U.M, .687, .001) && near(U.rows[0].M / 1e9, .661, .001) && U.rows.slice(1, 4).every(r => near(r.M / 1e9, .906, .001)), U.rows);
    tx('step ⑪ card: level 3 on the way up: 4 × 512 × 256 × 32 × 32 ≈ 0.54 G, 9 × 512 × 256 × 32 × 32 ≈ 1.21 G and 0.60 G, about 2.35 G in all', 'k-unet', ['4 × 512 × 256 × 32 × 32 ≈ 0.54 G', '9 × 512 × 256 × 32 × 32 ≈ 1.21 G', '第二层 0.60 G', '一共约 2.35 G'], near(4 * 512 * 256 * 1024 / 1e9, .537, .001) && near(9 * 512 * 256 * 1024 / 1e9, 1.208, .001) && near(9 * 256 * 256 * 1024 / 1e9, .604, .001) && near(U.rows[5].M / 1e9, 2.349, .001));
    tx('step ⑪ card: the skips add about 780,000 parameters and 2.4 billion multiply–adds (about 18% of the operations) and keep about 3.93 million numbers waiting', 'k-unet', ['约 78 万个参数', '24 亿次乘加', '18%', '约 393 万个数'], U.P - U0.P === 783360 && near((U.M - U0.M) / 1e9, 2.416, .001) && Math.round((U.M - U0.M) / U.M * 100) === 18 && 256 * 256 * 32 + 128 * 128 * 64 + 64 * 64 * 128 + 32 * 32 * 256 === 3932160 && U0.P === 6982625, [U.P - U0.P, U.M - U0.M]);
    tx('step ⑪: 512 × 512 takes 4 times and 1024 × 1024 16 times the operations; with twice the channels (64 to 1024), as in the original paper, about 31 million parameters; the output has 65,536 numbers', 'k-unet', ['512 × 512 是 4 倍，1024 × 1024 是 16 倍', '参数约 3100 万', '65536 个数'], near(U512.M / U.M, 4, 1e-9) && U512.P === U.P && Ubig.P === 31043521 && 256 * 256 === 65536, [U512.M / U.M, Ubig.P]); }

  sec('text · step ⑫ PointNet');
  { const pts = { A: [-4, 0, 0], B: [4, 0, 0], C: [0, 0, 12], D: [0, 3, 6] }, feat = q => [relu(q[0]), relu(-q[0]), relu(q[2])], F4 = Object.keys(pts).map(k => feat(pts[k])), g = [0, 1, 2].map(j => Math.max(...F4.map(f => f[j]))), g3 = [0, 1, 2].map(j => Math.max(...F4.slice(0, 3).map(f => f[j])));
    tx('step ⑫: the four points have the features A (0, 4, 0), B (4, 0, 0), C (0, 0, 12), D (0, 0, 6); the global feature is (4, 4, 12) and stays the same without D', 'k-point', ['A (0, 4, 0)、B (4, 0, 0)、C (0, 0, 12)、D (0, 0, 6)', '(4, 4, 12)', '把它删掉，g 也不变'], F4.map(f => f.join(' ')).join('|') === '0 4 0|4 0 0|0 0 12|0 0 6' && g.join() === '4,4,12' && g3.join() === '4,4,12', [F4, g]);
    const per = 3 * 64 + 64 * 64 + 64 * 64 + 64 * 128 + 128 * 1024;
    tx('step ⑫: 848 × 480 = 407,040 depths; 1,024 × 3 = 3,072 numbers; the shared MLP takes 147,648 multiply–adds per point, about 150 million for 1,024 points; the paper’s 3.5 million parameters and 440 million multiply–adds = 0.88 GFLOP (0.8 million and 148 million without the T-Nets)', 'k-point', ['848 × 480 个像素就是 407040 个深度', '1024 × 3 = 3072 个数', '147648 次乘加', '约 1.5 亿次', '约 350 万个参数', '约 4.4 亿次乘加，即 0.88 GFLOP', '80 万个参数、1.48 亿次乘加'], 848 * 480 === 407040 && 1024 * 3 === 3072 && per === 147648 && near(per * 1024 / 1e8, 1.512, .001) && 2 * 440e6 === 880e6, per); }

  sec('text · step ⑬ the action model');
  { const sig = 219107745792, g = { d: 2048, L: 18, h: 8, hd: 256, ff: 16384 }; g.at = g.d * g.h * g.hd + 2 * g.d * g.hd + g.h * g.hd * g.d; g.non = g.L * (g.at + 3 * g.d * g.ff + 2 * g.d) + g.d;
    const Tp = 3 * 256 + 32, vis = 3 * sig, back = 2 * g.non * Tp + g.L * 4 * Tp * Tp * g.h * g.hd, de = 1024, fe = 4096, Pe = g.L * (de * g.h * g.hd + 2 * de * g.hd + g.h * g.hd * de + 3 * de * fe + 2 * de) + de, stt = 2 * Pe + g.L * 4 * (Tp + 1) * g.h * g.hd, stp = 2 * Pe * 50 + g.L * 4 * 50 * (Tp + 1 + 50) * g.h * g.hd, ex = stt + 10 * stp, all = vis + back + ex;
    tx('step ⑬: 3 × 256 = 768 image tokens, about 0.66 TFLOP for the three pictures; about 800 tokens through the backbone, about 3.3 TFLOP; the action expert (about 300 million parameters) about 0.37 TFLOP for its 10 passes', 'k-multi', ['一共 768 个', '三张约 0.66 TFLOP', '约 800 个词元', '约 3.3 TFLOP', '约 3 亿参数', '10 遍约 0.37 TFLOP'], Tp === 800 && near(vis / 1e12, .657, .001) && near(back / 1e12, 3.265, .001) && Pe === 311464960 && near(ex / 1e12, .375, .001), [vis, back, Pe, ex]);
    tx('step ⑬: about 4.3 trillion operations a call, 43 trillion a second at 10 calls; on an RTX 4090 the paper measured 14 + 32 + 27 = 73 ms; about 3.3 billion parameters, 6.6 GB in BF16', 'k-multi', ['约 4.3 万亿次运算', '每秒 43 万亿次', '14 毫秒', '32 毫秒', '27 毫秒，一共 73 毫秒', '参数一共约 33 亿', 'BF16 约 6.6 GB'], near(all / 1e12, 4.298, .001) && 14 + 32 + 27 === 73 && 3.3 * 2 === 6.6 && all === 4297658673152, all);
    tx('step ⑬: the expert’s operations are a little over a tenth of the backbone’s, yet it takes about as long (27 ms against 32 ms)', 'k-multi', ['只有骨干的十分之一出头', '27 毫秒对 32 毫秒'], ex / back > .1 && ex / back < .13, ex / back);
    tx('step ⑬ card: the score tables: about 800 × 800 = 640,000 cells; 50 × 800 = 40,000 for the action tokens, plus 50 × 51', 'k-multi', ['约 800 × 800 = 64 万格', '50 × 800 = 4 万格', '50 × 51 格'], 800 * 800 === 640000 && 50 * 800 === 40000);
    ok('step ⑬: the numbers the interactive shows follow from the same formulas: one pass 37.4 GFLOP, the state token 0.741 GFLOP, table 50 × 851 = 42,550', near(stp / 1e9, 37.42, .005) && near(stt / 1e9, .741, .0005) && 50 * 851 === 42550, [stp, stt]); }

  sec('text · step ⑭ the building blocks');
  tx('step ⑭ card: Mixtral 8x7B: 47 billion parameters stored, 13 billion used per token: about 94 GB in BF16, about 26 GFLOP per token, over seven tenths less than a dense 47-billion model', 'k-combo', ['470 亿个参数', '130 亿个', 'BF16 约 94 GB', '每个词元约 26 GFLOP', '少七成多'], 47 * 2 === 94 && 13 * 2 === 26 && 1 - 13 / 47 > .7 && 1 - 13 / 47 < .75);
  tx('step ⑭ card: in FP8 about 47 GB, about 13 GB read per token: about 21 tokens a second at 273 GB/s, fewer than 6 for a dense model of the same size', 'k-combo', ['FP8 约 47 GB', '每个词元读约 13 GB', '一秒约 21 个词元', '不到 6 个'], Math.round(273 / 13) === 21 && 273 / 47 < 6 && 273 / 47 > 5.5);

  sec('text · step ⑮ sizes and chips');
  { const R = resnet18(224, 224), U = unet([32, 64, 128, 256, 512], 256, true);
    const wsm = { stem: 3 * 80 * 768 + 768 + 3 * 768 * 768 + 768, at: 4 * (768 * 768 + 768), ml: 2 * 768 * 3072 + 3072 + 768, ln: 2 * 768 }; wsm.enc = wsm.stem + 12 * (wsm.at + wsm.ln) + 12 * (wsm.ml + wsm.ln) + wsm.ln;
    const wF = 2 * (3 * 80 * 768 * 3000 + 3 * 768 * 768 * 1500) + 12 * (2 * 1500 * 4 * 768 * 768 + 4 * 1500 * 1500 * 768) + 12 * 2 * 1500 * 2 * 768 * 3072;
    tx('step ⑮ table: operations ÷ parameters: 1.5 for the neuron, 2 for the MLP, 1.9 for Llama, 0.55 for Mixtral (stored parameters), 251 for PointNet, 310 for ResNet-18, 531 for SigLIP, about 1300 for the π0-like model, 1430 for Whisper (about 3960 on the encoder’s 87 million parameters), 3524 for the small U-Net', 'k-size', ['6 1.5', '0.42 MFLOP 2', '15 GFLOP 1.9', '26 GFLOP 0.55（按用到的算是 2）', '0.88 GFLOP 251', '3.63 GFLOP 310', '219 GFLOP 531', '4.3 TFLOP 约 1300', '1430（只按编码器的参数算约 3960）', '编码器 8700 万', '27.4 GFLOP 3524'], 6 / 4 === 1.5 && Math.round(417024 / 209429) === 2 && (LL.F / LL.P).toFixed(1) === '1.9' && (26 / 47).toFixed(2) === '0.55' && 26 / 13 === 2 && Math.round(.88e9 / 3.5e6) === 251 && Math.round(2 * R.M / R.P) === 310 && Math.round(219107745792 / 412442352) === 531 && Math.round(4.3e12 / 3.3e9 / 100) === 13 && Math.round(wF / 240610560) === 1430 && Math.round(wsm.enc / 1e6) === 87 && near(wF / wsm.enc, 3955, 5) && Math.round(2 * U.M / U.P) === 3524, [2 * R.M / R.P, 2 * U.M / U.P, wF, wsm.enc]);
    ok('summary table: the same ratios (small U-Net 3524, ResNet-18 310, Llama 1.9)', TX['k-sum'].includes('小 U-Net 3524，ResNet-18 310，Llama 1.9'));
    tx('step ⑮: Llama has nearly 700 times the parameters of ResNet-18 but only 4 times the operations; ResNet-18 uses each weight about 155 times on a 224 × 224 image', 'k-size', ['近 700 倍参数', '4 倍', 'r ≈ 155'], Math.round(LL.P / R.P) === 687 && Math.round(LL.F / (2 * R.M)) === 4 && Math.round(R.M / R.P) === 155);
    tx('step ⑮ card: ridge points: a B200 in FP8 with about 4.5 PFLOPS dense and about 8 TB/s: about 560; Thor with 517.5 TFLOPS and 273 GB/s: about 1900; a language model writing for one person uses about 0.4% of a B200’s peak', 'k-size', ['稠密峰值约 4.5 PFLOPS、带宽约 8 TB/s，拐点约 560', '（FP8 稠密 517.5 TFLOPS，带宽 273 GB/s）约 1900', 'B200 上约 0.4%', '7.7 TB/s'], near(4.5e15 / 8e12, 562.5, 1e-9) && near(517.5e12 / 273e9, 1896, 1) && (2 / 562.5 * 100).toFixed(1) === '0.4' && 2070 / 2 / 2 === 517.5, [4.5e15 / 8e12, 517.5e12 / 273e9]);
    tx('step ⑮: Llama 3.1 8B: 16 GB ÷ 273 GB/s ≈ 59 ms per token in BF16, about 17 tokens a second; about 34 in FP8 and 68 in FP4; the 70B in FP8 fewer than 4', 'k-size', ['16 GB / 273 GB/s ≈ 59 毫秒', '一秒约 17 个词元', 'FP8 约 34 个，FP4 约 68 个', '一秒不到 4 个'], near(LL.P * 2 / 273e9 * 1000, 58.8, .05) && Math.round(273e9 / (LL.P * 2)) === 17 && Math.round(273e9 / LL.P) === 34 && Math.round(273e9 / (LL.P / 2)) === 68 && 273 / 70.55 < 4);
    tx('step ⑮: what fits in 128 GB: Llama 3.1 8B 16 GB in BF16, the π0-like model about 6.6 GB, Whisper small about 0.5 GB; the 70B needs 141 GB in BF16 and 71 GB in FP8; Thor’s quoted peak is 2070 TFLOPS (FP4, sparse)', 'k-size', ['用 BF16 要 16 GB', '约 6.6 GB', '约 0.5 GB', '用 BF16 要 141 GB', '用 FP8 要 71 GB', '2070 TFLOPS'], true);
    await W('size').show(); await W('size').click('Thor', 300); await W('size').click('BF16', 300); t = await W('size').text('table');
    tx('step ⑮: "about 55 ms for one call of the π0-like model on Thor in BF16" is the interactive’s estimate (55.4 ms, 55% busy at 10 calls a second)', 'k-size', ['算一次约 55 毫秒', '一秒里有一半多的时间在算它'], has(t, '55.4 ms') && /π0[^%]*55%/.test(t), t.slice(0, 200)); }

  sec('text · the summary and the quiz');
  { const R = resnet18(224, 224), big = resnet18(720, 1280);
    tx('summary: the hand policy about 0.84 MB in FP32, ResNet-18 about 47 MB, Llama 3.1 8B about 16 GB in BF16; ResNet-18 takes 3.63 GFLOP at 224 × 224 and about 67 GFLOP at 1280 × 720', 'k-sum', ['手的策略 FP32 约 0.84 MB', 'ResNet-18 FP32 约 47 MB', 'Llama 3.1 8B 用 BF16 约 16 GB', '224 × 224 时 3.63 GFLOP，1280 × 720 时约 67 GFLOP'], near(209429 * 4 / 1e6, .838, .001) && Math.round(R.P * 4 / 1e6) === 47 && Math.round(2 * big.M / 1e9) === 67, 2 * big.M);
    tx('quiz 1: z = 0.5 × 4 + 3 × 1 + 0 − 4 = 1 and σ(1) ≈ 0.73', 'k-sum', ['z = 0.5 × 4 + 3 × 1 + 0 - 4 = 1', '≈ 0.73'], .5 * 4 + 3 - 4 === 1 && r2(sg(1)) === .73);
    tx('quiz 2: 1024 × 4096 + 4096 = 4,198,400 parameters, about 8.4 MB in BF16, 2 × 1024 × 4096 ≈ 8.4 MFLOP', 'k-sum', ['1024 × 4096 + 4096 = 4198400 个参数，约 8.4 MB', '2 × 1024 × 4096 ≈ 8.4 MFLOP'], 1024 * 4096 + 4096 === 4198400 && near(4198400 * 2 / 1e6, 8.4, .01) && near(2 * 1024 * 4096 / 1e6, 8.39, .01));
    tx('quiz 3: a 3 → 4 → 2 network without the bend equals one 3 → 2 layer with 3 × 2 + 2 = 8 parameters instead of 26', 'k-sum', ['3 × 2 + 2 = 8 个参数', '原来的 26 个参数'], 3 * 2 + 2 === 8 && 16 + 10 === 26);
    tx('quiz 4: n′ = ⌊(56 + 2 − 3) / 2⌋ + 1 = 28; 3 × 3 × 64 × 128 = 73,728 weights; 73,728 × 28 × 28 ≈ 57.8 million multiply–adds', 'k-sum', ['n′ = ⌊(56 + 2 - 3) / 2⌋ + 1 = 28', '3 × 3 × 64 × 128 = 73728 个', '73728 × 28 × 28 ≈ 5780 万次'], Math.floor((56 + 2 - 3) / 2) + 1 === 28 && 9 * 64 * 128 === 73728 && Math.round(73728 * 784 / 1e4) === 5780);
    tx('quiz 5: 128 × (40 + 128 + 1) = 21,632 parameters; an LSTM has 4 times as many, 86,528', 'k-sum', ['128 × (40 + 128 + 1) = 21632 个', '86528 个'], 128 * 169 === 21632 && 4 * 21632 === 86528);
    tx('quiz 6 and 7: T > 2d = 8192 tokens; (448 / 16)² = 784 tokens against 196: 4 times the tokens and 16 times the score table', 'k-sum', ['T > 2d = 8192 个词元', '(448 / 16)² = 784 个', '是 196 个，词元是 4 倍，打分表是 16 倍'], 2 * 4096 === 8192 && (448 / 16) ** 2 === 784 && 784 / 196 === 4 && (784 / 196) ** 2 === 16);
    tx('quiz 8, 9, 11 and 12: 24 / 30 = 80%; 4 times the operations; 47 billion × 2 bytes ≈ 94 GB and about 26 GFLOP per token; 273 / 8.03 ≈ 34 tokens a second', 'k-sum', ['24 / 30 = 80%', '变成 4 倍', '470 亿 × 2 字节 ≈ 94 GB', '约 26 GFLOP', '273 / 8.03 ≈ 34 个'], 24 / 30 === .8 && 47 * 2 === 94 && Math.round(273 / 8.03) === 34); }

  sec('the figures');
  { const FIG = await p.evaluate(() => [...document.querySelectorAll('figure.fig')].map(f => [...f.querySelectorAll('text')].map(t0 => [...t0.childNodes].map(n0 => n0.nodeName === 'es' || (n0.classList && n0.classList.contains('en')) ? '' : n0.textContent).join('')).join(' ¦ ') + ' ¦¦ ' + f.querySelector('figcaption').innerText)).then(a => a.map(norm));
    ok('there are 7 figures', FIG.length === 7, FIG.length);
    const zb = F0 => relu(F0 - 3) - 2 * relu(F0 - 5.5), pos = []; for (let F0 = 0; F0 <= 10.001; F0 += .25) if (zb(F0) > 1e-9) pos.push(F0);
    ok('fig 1: z = ReLU(F − 3) − 2 ReLU(F − 5.5) is above 0 exactly between 3 N and 8 N (peak 2.5 at 5.5 N); without the bends the same weights give z = 8 − F, above 0 for everything below 8 N', has(FIG[0], '3 N', '8 N', 'z = 8 - F', 'z = ReLU(F - 3) - 2 ReLU(F - 5.5)', '只在 3 N 到 8 N 之间大于 0') && Math.min(...pos) === 3.25 && Math.max(...pos) === 7.75 && zb(5.5) === 2.5 && zb(3) === 0 && zb(8) === 0 && [0, 1, 4, 9].every(F0 => (F0 - 3) - 2 * (F0 - 5.5) === 8 - F0), FIG[0].slice(0, 200));
    ok('fig 2: two stacked 3 × 3 layers see 5 × 5 pixels: each layer adds 2 to the side', has(FIG[1], '5 × 5 个像素', '3 × 3 个数', '感受野的边长加 2') && 3 + 2 === 5, FIG[1].slice(0, 200));
    ok('fig 3: the residual block is drawn as y = σ(x + f(x))', has(FIG[2], 'y = σ(x + f(x))', '直路'), FIG[2].slice(0, 200));
    ok('fig 4: every token adds 2 × L × d_kv numbers to the cache', has(FIG[3], '2 × L × dkv 个数', 'K, V'), FIG[3].slice(-200));
    ok('fig 5: the seven stretches of the sentence are those the Whisper interactive reports; "bēi" is spoken from 0.60 to 0.83 s', has(FIG[4], '0.60–0.83 秒', '示意'), FIG[4].slice(-200));
    ok('fig 6: modulation is drawn as y = γ(c) ⊙ x + β(c)', has(FIG[5], 'y = γ(c) ⊙ x + β(c)', '没有打分表'), FIG[5].slice(-200));
    ok('fig 7: r = 1 for a dense layer, n′² for a convolution, T for a Transformer; F ≈ 2 r P', has(FIG[6], 'r = 1', 'r = T', 'F ≈ 2 r P'), FIG[6].slice(0, 200)); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
