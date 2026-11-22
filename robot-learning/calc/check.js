// Check the numbers of "Imitation and Reinforcement Learning" (robot-learning/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt literally: pressing buttons, moving sliders, walking the mouse through the grid) and compares
// the readouts with the numbers quoted in the "你会看到 / What you will see" lines; every check first requires the quoted
// string to be in that line. Wherever an interactive uses chance it draws from a seeded generator, so the readouts are
// the same on every run as long as the buttons are pressed in the order of the prompt. Statements that no readout shows
// (where the student leaves the track, how straight the averaged drone flies, how soon optimistic Q-learning finds the
// big cheese after different histories) are recomputed inside the page with the interactive's own code, cut out of the
// page source and run unchanged (see "harness"), and tied to a readout that the page does show.
// Part B recomputes, with arithmetic written out in this file, the numbers quoted in the formula cards, the paragraphs
// and the figures, and requires each quoted string to be in the page.
//   usage: node check.js /absolute/path/to/robot-learning/index.html      (takes a few minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/robot-learning/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(700);
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
    // click the element with this id / this data attribute (buttons whose label changes with their state)
    tap: async (sel, w) => { await p.evaluate(s => document.querySelector(s).click(), sel); await p.waitForTimeout(w || 250); },
    set: async (inp, v, w) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(w || 300); },
    // the readouts: class "sum" or "rd" (numbers), class "status" (the sentence under them), or any other part of the interactive
    sum: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .sum, #' + i + ' .rd')].map(m => m.innerText).join(' ## '), id).then(norm),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    text: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll('#' + i + ' ' + s)].filter(e => e.getClientRects().length > 0).map(m => m.innerText).join(' ## '), [id, sel]).then(norm),
  });
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const lack = (s, ...res) => res.filter(re => !(re instanceof RegExp ? re.test(s) : s.includes(re))).join(' ¦ ');
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const sec = t => log.push('-- ' + t);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/\u2212/g, '-')) : NaN; };
  // the visible Chinese text of a section with its folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);
  // the "你会看到" line that follows each interactive
  const WIDS = ['sp', 'kn', 'mdp', 'bc', 'mm', 'vi', 'pg', 'rw', 'dr', 'sys'];
  const SEE = {}; for (const id of WIDS) SEE[id] = await p.evaluate(i => { let e = document.getElementById(i).nextElementSibling; while (e && (e.tagName === 'SCRIPT' || e.tagName === 'STYLE')) e = e.nextElementSibling; return e && e.classList.contains('see') ? e.innerText : ''; }, id).then(norm);
  ok('every interactive is followed by a "你会看到" line', WIDS.every(id => SEE[id].startsWith('你会看到：')), WIDS.filter(id => !SEE[id].startsWith('你会看到：')).join(' '));
  const see = (id, ...strs) => strs.every(s => SEE[id].includes(s));
  const seeMiss = (id, ...strs) => strs.filter(s => !SEE[id].includes(s)).join(' ¦ ');
  // one check: the strings are in the see line AND the readout contains what it should
  const both = (name, id, strs, readout, ...res) => ok(name, see(id, ...strs) && has(readout, ...res), 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ readout lacks: ' + lack(readout, ...res) + ' ¦¦ readout: ' + readout.slice(0, 300));
  // one check: the strings are in the see line AND a condition computed elsewhere holds
  const seeAnd = (name, id, strs, cond, got) => ok(name, see(id, ...strs) && cond, 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ got: ' + String(got).slice(0, 400));

  // ---------------------------------------------------------------------------------------------------------------
  // harness: pieces of the interactives' own code, cut out of the page source by name and run unchanged inside the page
  // (the page's shared grid-world engine window.GW is used as it is)
  // ---------------------------------------------------------------------------------------------------------------
  await p.evaluate(() => {
    const srcOf = key => { const t = [...document.scripts].map(s => s.textContent).find(t => t.includes(key)); if (!t) throw new Error('no script with ' + key); return t; };
    const between = (src, a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error('no "' + a + '"'); const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error('no "' + b + '"'); return src.slice(i, j); };
    const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('no function ' + name); let k = src.indexOf('{', i), d = 0; for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) break; } } return src.slice(i, k + 1); };
    const H = window.__H = {};
    // Q-learning of step 4: the interactive's own state, qlReset() and episode(), with its generator seeded as on page load
    H.ql = () => { const s = srcOf("$('vi-cv')");
      return new Function('GW', 'const W=GW;' + between(s, 'let mode=0', 'function qlReset') + fn(s, 'qlReset') + 'qlReset();' + between(s, 'const qs=', 'function episode') + fn(s, 'episode') +
        ';return{run:n=>{for(let i=0;i<n;i++)episode()},eps:v=>{eps=v},opt:v=>{optm=v;qlReset()},st:()=>({ep,steps,found,hits,q0:qs(W.start).map(v=>+v.toFixed(2))}),greedy:()=>W.follow(i=>W.argmax(qs(i)),60).end}')(GW); };
    // the race track of step 2: track, expert, nearest-5 student, roll-outs, DAgger (everything before the drawing code)
    H.bc = () => { const s = srcOf("$('bc-cv')");
      return new Function('GW', 'const ui=()=>{};' + between(s, 'const rng=GW.rng', 'const St=X.astage') +
        ';return{collect,dagger,runs:()=>runs,nok,M,nearAll,pairs:()=>Xs.length,sig:v=>{sig=v},student:()=>runsOf(knn(Xs,Ys)),expert:()=>runsOf(expertPol)}')(GW); };
    // the drone of step 2: demonstrations, the three ways of producing an action, the flights
    H.mm = () => { const s = srcOf("$('mm-cv')");
      return new Function('GW', 'const ui=()=>{};const ' + between(s, 'rng=GW.rng,gauss=', 'const St=X.astage') +
        ';return{makeDemos,runAll,mode:v=>{mode=v},ratio:v=>{ratio=v;makeDemos()},runs:()=>runs,wts,mean,F:()=>F,TR,DR}')(GW); };
  });

  // ===================================================== Part A =====================================================
  sec('Part A · the interactives, operated along their "先玩" prompts');
  // ---- step 0 · the spectrum (sp): tap each of the five stops
  let w = W('sp'); await w.show();
  const sp = []; for (let i = 0; i < 5; i++) { await w.tap('#sp [data-i="' + i + '"]', 250); sp.push({ tag: await w.text('.sphd'), fr: await w.text('.frames'), judge: await w.text('.frj'), bars: await p.evaluate(() => ['sp-b0', 'sp-b1'].map(id => document.getElementById(id).getAttribute('aria-label'))), max: await p.evaluate(() => +document.getElementById('sp-t').max) }); }
  const cnt = (s, re) => (s.match(re) || []).length;
  both('sp demos: 6 frames, each with the teacher\'s action', 'sp', ['6 帧画面，每一帧都配着老师的动作', '"不动"，"抬起、翻腕"，"放平、收回"'], sp[0].fr, '画面 6', '老师的动作：不动', '老师的动作：抬起、翻腕', '老师的动作：放平、收回');
  ok('sp demos: exactly 6 frames carry a teacher\'s action', cnt(sp[0].fr, /老师的动作/g) === 6, sp[0].fr);
  seeAnd('sp video: the actions of all 6 frames are question marks; a human hand', 'sp', ['6 帧的动作全是问号', '人手'], cnt(sp[1].fr, /动作：？/g) === 6 && sp[1].tag.includes('人手'), sp[1].fr + ' / ' + sp[1].tag);
  seeAnd('sp prefs: two clips, one lands in the pan and one flies out; one sentence "A 比 B 好"', 'sp', ['两段录像 A 和 B', '一段落回锅里，一段飞了出去', '"A 比 B 好"'], has(sp[2].fr, 'A · 结束 翻面了，落回锅里', 'B · 结束 飞出去，掉在灶台上') && sp[2].judge.includes('"A 比 B 好。"') && sp[2].max === 6000, sp[2].fr + ' / ' + sp[2].judge);
  seeAnd('sp reward: 3 tries; the frames shown are 0 five times and 1 once, at the last frame of try 3', 'sp', ['一共试了 3 次', '前两次每一帧的奖励都是 0', '只有第 3 次的最后一帧是 1'], sp[3].max === 9000 && sp[3].tag.includes('/ 3 次尝试') && cnt(sp[3].fr, /奖励：0/g) === 5 && sp[3].fr.includes('第 3 次 · 画面 6 奖励：1') && has(sp[3].judge, '前两次尝试', '每一帧的奖励都是 0', '只有第 3 次'), sp[3].fr + ' / ' + sp[3].judge);
  seeAnd('sp no labels: the answer for each frame is the next frame', 'sp', ['机器人自己晃锅', '每一帧的"答案"就是下一帧'], has(sp[4].fr, '画面 1 答案：画面 2', '画面 5 答案：画面 6', '画面 6 答案：下一帧') && sp[4].tag.includes('自己随便晃锅'), sp[4].fr);
  seeAnd('sp bars: information 5, 3, 2, 1, 0 of 5; cheapness 1, 4, 3, 3, 5 of 5', 'sp', ['"关于该怎么做的信息"是 5、3、2、1、0 格', '"数据有多便宜"是 1、4、3、3、5 格'], sp.map(x => x.bars[0]).join(' ') === '5/5 3/5 2/5 1/5 0/5' && sp.map(x => x.bars[1]).join(' ') === '1/5 4/5 3/5 3/5 5/5', JSON.stringify(sp.map(x => x.bars)));

  // ---- step 0 · the knob (kn): each scoring from θ = 1.5, "拧一步" several times
  w = W('kn'); await w.show();
  const knRun = async (label, k) => { await w.click(label); const start = await w.sum(); const a = [num(start, /θ = ([\d.]+)/)]; let last = ''; for (let i = 0; i < k; i++) { await w.click('拧一步', 90); last = await w.sum(); a.push(num(last, /θ = ([\d.]+)/)); } return { a, start, last, st: await w.status() }; };
  const LO = 150 / 36, HI = 210 / 36, inWin = t => t >= LO && t <= HI;
  const k0 = await knRun('示范：和老师差多少', 10), k1 = await knRun('奖励：只看成没成', 10), k2 = await knRun('奖励：看差多少', 14);
  seeAnd('kn demo: 1.50 → 3.84 → 4.78, inside the window at step 2 (not at step 1)', 'kn', ['1.50 → 3.84 → 4.78', '第 2 步就进了绿色窗口'], k0.a[0] === 1.5 && k0.a[1] === 3.84 && k0.a[2] === 4.78 && !inWin(k0.a[1]) && inWin(k0.a[2]), k0.a.join(' '));
  seeAnd('kn demo: then 5.15, 5.30, 5.36; at 5.40 from step 8 on, the teacher\'s force', 'kn', ['5.15、5.30、5.36', '第 8 步停在 5.40', '那是老师的力度，不是最好的 5.0'], k0.a.slice(3, 6).join(' ') === '5.15 5.3 5.36' && k0.a[7] === 5.39 && k0.a[8] === 5.4 && k0.a[9] === 5.4 && k0.a[10] === 5.4 && k0.st.includes('停在老师的 5.4'), k0.a.join(' ') + ' / ' + k0.st);
  seeAnd('kn success only: never moves from 1.50; "上一步：没动"; the 12 tries all failed', 'kn', ['点多少次都停在 1.50', '"上一步：没动"', '试的 12 次全都没翻成，损失都是 1'], k1.a.every(v => v === 1.5) && has(k1.last, '上一步：没动', '损失 = 1.00') && has(k1.st, '试了 12 次', '全都没翻成，损失都是 1'), k1.a.join(' ') + ' / ' + k1.last);
  seeAnd('kn how far off: 4.00 after one step, then 4.52, 4.88, 4.65, 4.81, 4.92', 'kn', ['第 1 步就到 4.00', '4.52、4.88、4.65、4.81、4.92'], k2.a[1] === 4 && k2.a.slice(2, 7).join(' ') === '4.52 4.88 4.65 4.81 4.92', k2.a.join(' '));
  seeAnd('kn how far off: from step 6 on it stays within 0.15 of 5.0, always closer than the teacher\'s 5.4', 'kn', ['一直在 5.0 附近小幅晃动', '比老师的 5.4 更准', '试 12 次估出来的'], k2.a.slice(6).every(v => Math.abs(v - 5) <= 0.15) && k2.a.slice(6).some((v, i, A) => i > 0 && v < A[i - 1]) && k2.a.slice(6).some((v, i, A) => i > 0 && v > A[i - 1]) && k2.st.includes('比老师的 5.4 还准'), k2.a.join(' '));

  // ---- step 1 · the grid world (mdp)
  w = W('mdp'); await w.show();
  const go = async seq => { for (const a of seq) await w.tap('#mdp [data-a="' + a + '"]', 240); };   // 0 up, 1 down, 2 left, 3 right
  await go([3, 3]); let t = await w.sum(), s = await w.status();
  both('mdp: two steps right take the small cheese: 2 steps, plain sum 1.90, return 1.70', 'mdp', ['往右走两步拿小奶酪', '走了 2 步，奖励直接相加 1.90，回报 G = 1.70'], t + ' ' + s, '走了 2 步', 'Σ r = 1.90', '= 1.70', '拿到小奶酪');
  await w.click('再来一局'); await go([0, 0, 3, 3, 3, 3, 3, 3, 3, 0]); t = await w.sum(); s = await w.status();
  both('mdp: across the bridge to the big cheese: 10 steps, plain sum 9.10, return 3.26', 'mdp', ['过桥去拿大奶酪：10 步，直接相加 9.10，回报 3.26'], t + ' ' + s, '走了 10 步', 'Σ r = 9.10', '= 3.26', '拿到大奶酪');
  await w.click('再来一局'); await w.set('mdp-g', 0.8); await w.click('显示最优策略'); s = await w.status();
  const gw = await p.evaluate(() => { const route = (g, sl) => { const S = GW.solve(g, sl), f = GW.follow(i => GW.argmax([0, 1, 2, 3].map(a => GW.q(S.V, i, a, g, sl))), 60); return { end: f.end, n: f.P.length - 1, bridge: f.P.some(i => i === 27 || i === 28), top: f.P.some(i => i < 8), V0: S.V[GW.start] }; };
    const o = {}; for (const [g, sl] of [[.8, 0], [.83, 0], [.84, 0], [.9, 0], [.9, .2], [.92, .2], [.93, .2], [.95, .2], [.97, .2], [.99, .2]]) o[g + '/' + sl] = route(g, sl); return o; });
  const big08 = -0.1 * (1 - Math.pow(0.8, 9)) / 0.2 + 10 * Math.pow(0.8, 9);
  both('mdp ①: γ = 0.8, the optimal policy goes to the small cheese (big cheese worth 0.91, small 1.50)', 'mdp', ['① γ = 0.8', '起点的箭头指向小奶酪', '只剩 0.91', '小奶酪的 1.50'], s, 'γ = 0.80：最优策略去近处的小奶酪');
  ok('mdp ①: the engine agrees: route ends at the small cheese, V*(start) = 1.50, and 10 discounted steps to the big cheese give 0.91', gw['0.8/0'].end === 2 && gw['0.8/0'].V0.toFixed(2) === '1.50' && big08.toFixed(2) === '0.91', JSON.stringify(gw['0.8/0']) + ' ' + big08);
  await w.set('mdp-g', 0.9); await w.tap('#mdp-slip'); s = await w.status(); t = await w.text('.btns');
  both('mdp ②: γ = 0.9 with the slippery floor (20%): no longer across the bridge, back to the small cheese', 'mdp', ['② γ = 0.9，打开地板打滑', '箭头不再过桥，起点又指回小奶酪', '每一步有 20% 的可能滑向两侧'], t + ' ' + s, '地板打滑：开（20%）', '最优策略干脆去拿近处的小奶酪');
  ok('mdp ②: the engine agrees: with slip at γ = 0.9 the route ends at the small cheese and does not touch the bridge', gw['0.9/0.2'].end === 2 && !gw['0.9/0.2'].bridge && gw['0.9/0'].end === 10 && gw['0.9/0'].bridge && gw['0.9/0'].n === 10, JSON.stringify([gw['0.9/0.2'], gw['0.9/0']]));
  const slipSt = {}; for (const g of [0.92, 0.93, 0.95, 0.96, 0.99]) { await w.set('mdp-g', g, 200); slipSt[g] = await w.status(); }
  seeAnd('mdp ③: with slip and γ above 0.95 the arrows take the top row, 14 steps', 'mdp', ['③ 打滑时把 γ 调到 0.95 以上', '最上面那一行的远路，14 步'], [0.95, 0.96, 0.99].every(g => slipSt[g].includes('最优策略改走上面那条远路（14 步）')) && gw['0.95/0.2'].top && gw['0.95/0.2'].n === 14 && gw['0.99/0.2'].n === 14 && gw['0.95/0.2'].end === 10, slipSt[0.95]);
  seeAnd('mdp ③: the route already changes at γ = 0.93 (not yet at 0.92)', 'mdp', ['从 γ = 0.93 起就改道了'], slipSt[0.93].includes('远路（14 步）') && slipSt[0.92].includes('小奶酪') && gw['0.93/0.2'].end === 10 && gw['0.92/0.2'].end === 2, slipSt[0.92] + ' / ' + slipSt[0.93]);
  await w.tap('#mdp-slip'); await w.set('mdp-g', 0.9); await w.click('隐藏最优策略');

  // ---- step 2 · the race track (bc)
  w = W('bc'); await w.show(); await wait(500);
  t = await w.sum();
  const bcE = await p.evaluate(() => { const E = __H.bc(); E.collect(); const R = E.runs(); const at = R.filter(r => !r.ok).map(r => E.nearAll(r.S[r.S.length - 1]) / E.M); return { ok: E.nok(R), pairs: E.pairs(), q: [0, 1, 2, 3].map(k => at.filter(x => Math.floor(4 * x) === k).length) }; });
  both('bc: at σ = 0.30 the student finishes 5 of 20 laps (25%), from 1235 pairs', 'bc', ['σ = 0.30 时，学生 20 次里只跑完 5 次（25%）'], t, '学生跑完 5/20', '训练数据 1235 对', 'BC 25%');
  seeAnd('bc: the 15 crashes are spread over all four quarters of the lap (own code: same 5/20 and 1235 pairs)', 'bc', ['红 × 散在整圈赛道上'], bcE.ok === 5 && bcE.pairs === 1235 && bcE.q.reduce((a, c) => a + c, 0) === 15 && bcE.q.every(v => v >= 2), JSON.stringify(bcE));
  await w.click('专家亲自开', 500); t = await w.sum();
  both('bc: the expert finishes all 20 under the same noise', 'bc', ['专家在同样的噪声下 20 次全跑完'], t, '专家跑完 20/20');
  await w.click('回到学生', 500); await w.set('bc-s', 0, 500); const b0 = await w.sum(); await w.set('bc-s', 0.5, 500); const b5 = await w.sum();
  seeAnd('bc: back to the student: σ = 0 gives 20/20, σ = 0.5 gives 0/20', 'bc', ['回到学生，σ = 0：20 次全跑完', 'σ = 0.5：一次也跑不完（0/20）'], b0.includes('学生跑完 20/20') && b5.includes('学生跑完 0/20'), b0 + ' / ' + b5);
  await w.click('专家亲自开', 500); t = await w.sum();
  both('bc: at σ = 0.5 the expert still finishes 17', 'bc', ['专家这时还能跑完 17 次'], t, '专家跑完 17/20');
  await w.click('回到学生', 500); await w.set('bc-s', 0.3, 500); await w.click('DAgger：专家补标一轮', 800); t = await w.sum();
  both('bc: one round of DAgger at σ = 0.30: 1235 → 2368 pairs, 20/20', 'bc', ['σ 调回 0.30', '训练数据从 1235 对变成 2368 对，学生 20 次全跑完'], t, '学生跑完 20/20', '训练数据 2368 对', '第1轮 100%');
  await w.tap('#bc-dart', 800); t = await w.sum(); s = await w.text('.btns');
  both('bc: noisy demonstrations instead: 1298 pairs, 14 laps finished', 'bc', ['"示范时故意加噪声"：1298 对，跑完 14 次'], t + ' ' + s, '学生跑完 14/20', '训练数据 1298 对', '示范时故意加噪声（DART）：开');
  await w.tap('#bc-dart', 800);

  // ---- step 2 · the drone and the tree (mm)
  w = W('mm'); await w.show(); await wait(400);
  const m0 = await w.sum(), ms0 = await w.status(); await w.click('每一步抽一个动作', 400); const m1 = await w.sum(); await w.click('一次抽一整段（动作块）', 400); const m2 = await w.sum();
  seeAnd('mm at 50%: averaging 0/8, sampling every step 2/8, sampling a whole chunk 8/8', 'mm', ['上绕 50% 时，取平均：8 次全撞树（0/8）', '每一步抽一个动作：8 次里过去 2 次', '一次抽一整段：8 次全过'], m0.includes('成功绕过 0/8') && m1.includes('成功绕过 2/8') && m2.includes('成功绕过 8/8'), [m0, m1, m2].join(' / '));
  const mmE = await p.evaluate(() => { const E = __H.mm(); E.makeDemos(); const o = { first: [], many: {} };
    const src = [...document.scripts].map(s => s.textContent).find(t => t.includes("$('mm-cv')"));
    // the same code once more, with the seed open to this script (the interactive raises it by one on every "再飞 8 次")
    const i = src.indexOf('rng=GW.rng,gauss='), j = src.indexOf('const St=X.astage', i);
    const E2 = new Function('GW', 'const ui=()=>{};const ' + src.slice(i, j) + ';return{makeDemos,runAll,mode:v=>{mode=v},ratio:v=>{ratio=v;makeDemos()},seed:v=>{seed=v},runs:()=>runs,wts,mean,F:()=>F}')(GW);
    E2.makeDemos();
    for (const m of [0, 1, 2]) { E2.mode(m); E2.seed(1); E2.runAll(); o.first.push(E2.runs().filter(x => x.ok).length); const a = []; for (let sd = 1; sd <= 40; sd++) { E2.seed(sd); E2.runAll(); a.push(E2.runs().filter(x => x.ok).length); } o.many[m] = a; }
    E2.mode(0); E2.seed(1); E2.runAll(); o.maxY = Math.max(...E2.runs().map(x => Math.max(...x.P.map(q => Math.abs(q[1]))))); o.allHit = E2.runs().every(x => !x.ok && Math.hypot(...x.P[x.P.length - 1]) < E.TR + E.DR + .01);
    const q = E2.wts([-.7, 0]), F = E2.F(); let up = 0, dn = 0, mid = 0; for (let k = 0; k < q.w.length; k++) { const a = F.As[k]; if (a > .15) up += q.w[k]; else if (a < -.15) dn += q.w[k]; if (Math.abs(a) < .1) mid += q.w[k]; }
    o.probe = { mean: E2.mean(q.w), up: up / q.s, dn: dn / q.s, mid: mid / q.s };
    o.uni = []; for (const rt of [0, 1]) { E2.ratio(rt); E2.mode(0); for (let sd = 1; sd <= 12; sd++) { E2.seed(sd); E2.runAll(); o.uni.push(E2.runs().filter(x => x.ok).length); } }
    return o; });
  seeAnd('mm: own code gives the same first batches (0, 2, 8); averaged flights all end at the tree, never more than 0.3 off the straight line', 'mm', ['紫线几乎笔直地朝树飞过去'], mmE.first.join(' ') === '0 2 8' && mmE.allHit && mmE.maxY < 0.3, JSON.stringify([mmE.first, mmE.allHit, mmE.maxY]));
  seeAnd('mm: at the small circle the demonstrated directions split about half up, half down, almost none straight ahead; their average points straight ahead', 'mm', ['平均值正好落在两个峰中间的低谷'], Math.abs(mmE.probe.mean) < 0.06 && mmE.probe.up > 0.4 && mmE.probe.dn > 0.4 && mmE.probe.mid < 0.01 && ms0.includes('平均值落在两个峰中间的低谷里'), JSON.stringify(mmE.probe));
  const zeros = mmE.many[0].filter(v => v === 0).length, hi78 = mmE.many[2].filter(v => v >= 7).length;
  seeAnd('mm, 40 batches each: averaging mostly 0 and at most 2; every step 1 to 6; whole chunk 5 to 8, usually 7 or 8', 'mm', ['取平均多半一次也过不去，最多过去 2 次', '每一步抽过去 1 到 6 次', '抽一整段过去 5 到 8 次，多数是 7 或 8 次'], Math.max(...mmE.many[0]) === 2 && zeros > 20 && Math.min(...mmE.many[1]) === 1 && Math.max(...mmE.many[1]) === 6 && Math.min(...mmE.many[2]) === 5 && Math.max(...mmE.many[2]) === 8 && hi78 > 20, JSON.stringify(mmE.many) + ' zeros ' + zeros + ' 7or8 ' + hi78);
  await w.click('取平均（均方误差）', 300); await w.set('mm-r', 0, 400); const u0 = (await w.sum()) + ' ' + (await w.status()); await w.set('mm-r', 100, 400); const u1 = await w.sum();
  seeAnd('mm: with 0% or 100% going over, averaging gets all 8 past (12 batches each with the own code too)', 'mm', ['把上绕的比例拉到 0% 或 100%：取平均也是 8 次全过', '示范只剩一种绕法'], u0.includes('成功绕过 8/8') && u1.includes('成功绕过 8/8') && u0.includes('示范只有一种绕法时，取平均也没问题') && mmE.uni.every(v => v === 8), u0 + ' / ' + u1);
  await w.set('mm-r', 50, 400);

  // ---- step 4 · value iteration and Q-learning (vi)
  w = W('vi'); await w.show(); await wait(300);
  const vi = [null]; for (let k = 1; k <= 13; k++) { await w.click('迭代 1 次', 120); vi.push({ rd: await w.sum(), st: await w.status() }); }
  seeAnd('vi: for sweeps 1 to 8 the news has spread k cells and the arrow at the start leads to the small cheese', 'vi', ['每迭代 1 次，奶酪和夹子的消息往外多传 1 格', '前 8 次，起点的箭头一直指向 2 步外的小奶酪'], [1, 2, 3, 4, 5, 6, 7, 8].every(k => has(vi[k].st, '价值从奶酪和夹子往外传了 ' + k + ' 格', '现在照箭头走会去小奶酪')), vi[8].st);
  seeAnd('vi: at sweep 9 the arrow turns up towards the big cheese while the start still reads 1.70; 3.26 at sweep 10', 'vi', ['第 9 次，箭头转向上方', '这时起点自己的数还是 1.70，第 10 次才变成 3.26'], has(vi[9].st, '起点的箭头已经转向大奶酪了', '还是 1.70') && has(vi[9].rd, '第 9 次迭代', '起点 V = 1.70', '上 -0.1 + 0.90 × 3.74 = 3.26（最大）') && has(vi[10].rd, '起点 V = 3.26'), vi[9].rd + ' / ' + vi[10].rd);
  seeAnd('vi: converged at sweep 12 (not yet at 11); the engine also needs 12 sweeps', 'vi', ['第 12 次以后数字不再变'], vi[12].rd.includes('第 12 次迭代（已收敛）') && !vi[11].rd.includes('已收敛') && vi[13].rd.includes('已收敛') && vi[12].st.includes('去大奶酪') && await p.evaluate(() => GW.solve(.9, 0).k === 12), vi[11].rd.slice(0, 40) + ' / ' + vi[12].rd.slice(0, 40));
  await w.click('清零', 200);
  await w.click('Q 学习：只能自己试', 300); for (let k = 0; k < 8; k++) await w.click('跑 50 回合', 200);
  t = await w.sum(); s = await w.status();
  both('vi Q-learning (ε = 0.1, Q from 0): after 400 episodes still the small cheese; right = 1.70 is the largest; big cheese never touched', 'vi', ['跑上 400 个回合，老鼠还是只去小奶酪', '最大的是往右的 1.70', '右上角一直是斜线，大奶酪一次都没碰到'], t + ' ' + s, '回合 400', 'ε = 0.10', '初值 Q₀ = 0', '右 1.70（最大）', '会去小奶酪', '大奶酪一次都没碰到过（右上角还是斜线）');
  await w.tap('#vi-opt', 300); const optBtn = await w.text('.btns'); for (let k = 0; k < 2; k++) await w.click('跑 50 回合', 250);
  t = await w.sum(); s = await w.status(); const firstHit = num(s, /第 (\d+) 回合第一次碰到它/);
  both('vi optimistic init: after 100 episodes the greedy path goes to the big cheese, first reached between episode 7 and 14', 'vi', ['十来个回合就第一次碰到大奶酪', '落在第 7 到 14 回合之间', '跑满 100 个回合', '"现在会去大奶酪"'], optBtn + ' ' + t + ' ' + s, '乐观初值：开', '回合 100', '初值 Q₀ = 10', '照 Q 值贪心地走，现在会去大奶酪');
  ok('vi optimistic init: the first hit shown is within 7 to 14', firstHit >= 7 && firstHit <= 14, firstHit);
  const ql = await p.evaluate(() => { const o = { hist: [] };
    for (const n0 of [0, 1, 7, 23, 50, 100, 150, 200, 250, 300, 350, 400, 401, 450, 500, 600, 800, 1000]) { const E = __H.ql(); E.run(n0); const plain = E.st(); E.opt(true); E.run(100); const a = E.st(); o.hist.push([n0, a.found + 1, E.greedy(), plain.hits]); }
    let E = __H.ql(); E.run(400); o.plain400 = E.st(); o.plain400g = E.greedy(); E.run(4600); o.plain5000 = E.st();
    o.eps = {}; for (const e of [0.2, 0.3, 0.4]) { E = __H.ql(); E.eps(e); E.run(1000); const a = E.st().hits; E.run(4000); o.eps[e] = [a, E.st().hits]; }
    return o; });
  ok('vi: own code, same history as the page (400 plain episodes, then optimistic): same first hit; plain run: same values at the start', ql.hist.find(x => x[0] === 400)[1] === firstHit && ql.plain400.ep === 400 && ql.plain400.q0[3] === 1.7 && ql.plain400g === 2 && ql.plain400.hits === 0, JSON.stringify([ql.hist.find(x => x[0] === 400), ql.plain400]));
  seeAnd('vi: for 18 different histories the first hit with optimistic init is at episode 7 to 14, and after 100 episodes the greedy path ends at the big cheese', 'vi', ['点法不同，落在第 7 到 14 回合之间'], ql.hist.every(x => x[1] >= 7 && x[1] <= 14 && x[2] === 10 && x[3] === 0) && Math.min(...ql.hist.map(x => x[1])) === 7 && Math.max(...ql.hist.map(x => x[1])) === 14, JSON.stringify(ql.hist));
  await w.tap('#vi-opt', 200); await w.click('价值迭代：知道地图', 200);

  // ---- step 4 · darts (pg): rounds without the baseline, then "重来" and rounds with it
  w = W('pg'); await w.show(); await wait(300);
  const pgRun = async k => { const a = []; for (let i = 0; i < k; i++) { await w.click('扔一轮', 50); a.push(num(await w.sum(), /μ 离靶心 ([\d.]+)/)); } return a; };
  const pgStart = await w.sum(); const a0 = await pgRun(40); const pst0 = await w.status();
  await w.click('重来', 250); await w.tap('#pg-base', 250); const pgBtn = await w.text('.btns'); const a1 = await pgRun(40); const pst1 = await w.status();
  seeAnd('pg without baseline: 1.22, 1.07, 0.83, 0.67, 0.46; 0.15 at round 9', 'pg', ['（1.22、1.07、0.83、0.67、0.46）', '第 9 轮到过 0.15'], a0.slice(0, 5).join(' ') === '1.22 1.07 0.83 0.67 0.46' && a0[8] === 0.15 && pgStart.includes('μ 离靶心 1.37'), a0.join(' '));
  seeAnd('pg without baseline: 0.06 at round 14, 0.76 at round 15; rounds 11 to 40 between 0.06 and 0.76; all lines green', 'pg', ['第 14 轮 0.06，第 15 轮又被甩到 0.76', '第 11 到 40 轮都在 0.06 和 0.76 之间', '全是绿的'], a0[13] === 0.06 && a0[14] === 0.76 && Math.min(...a0.slice(10)) === 0.06 && Math.max(...a0.slice(10)) === 0.76 && pst0.includes('全是绿线'), a0.join(' '));
  seeAnd('pg with baseline: 1.26, 1.19, 1.07; 0.17 at round 10; rounds 11 to 40 within 0.21; darts below average have red lines', 'pg', ['点"重来"、打开基线：1.26、1.19、1.07', '第 10 轮到 0.17', '第 11 到 40 轮都在 0.21 以内', '红线'], pgBtn.includes('基线（减去平均分）：开') && a1.slice(0, 3).join(' ') === '1.26 1.19 1.07' && a1[9] === 0.17 && Math.max(...a1.slice(10)) === 0.21 && has(pst1, '比平均差的（红）', '往反方向推'), a1.join(' '));
  await w.click('重来', 200); await w.tap('#pg-base', 200);

  // ---- step 5 · the corridor (rw)
  w = W('rw'); await w.show(); await wait(300);
  const rwR = async () => { const x = await w.sum(); return { a: num(x, /直奔门口 G = (-?[\d.]+)/), b: num(x, /走到门前踱步 G = (-?[\d.]+)/), x, st: await w.status() }; };
  const until = async (re, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const x = await w.sum(); if (re.test(x)) return x; await wait(150); } return await w.sum(); };
  await w.click('只在门口给 +10', 300); let r = await rwR(); const walked = await until(/这一趟走了 9 步/, 9000);
  seeAnd('rw door only (γ = 0.99): straight 9.23, pacing 0; the dog enters after 9 steps with G = 9.23', 'rw', ['只在门口给 +10（γ = 0.99）：直奔门口 G = 9.23，踱步是 0，狗走 9 步进门'], r.a === 9.23 && r.b === 0 && r.x.includes('γ = 0.99') && has(walked, '这一趟走了 9 步，G = 9.23') && r.st.includes('最优策略是直奔门口'), r.x + ' / ' + walked);
  await w.click('再加：每靠近一步 +1', 300); r = await rwR(); const paced = await until(/这一趟走了 (1[3-9]|[2-9]\d) 步/, 12000);
  seeAnd('rw +1 per step closer: straight 17.88, pacing 53.63; the dog paces (more than 12 steps without entering)', 'rw', ['直奔门口 17.88，走到门前踱步 53.63', '再也不进门'], r.a === 17.88 && r.b === 53.63 && has(r.st, '在门口来回踱步，永远不进门') && /这一趟走了 (1[3-9]|[2-9]\d) 步/.test(paced), r.x + ' / ' + paced);
  const rg = {}; for (const g of [0.95, 0.96, 0.97]) { await w.set('rw-g', g, 300); rg[g] = await rwR(); }
  seeAnd('rw +1: γ = 0.95: 14.03 vs 13.20 (enters); 0.96: 14.90 vs 15.80 (paces); 0.97: 15.83 vs 20.07', 'rw', ['把 γ 拖到 0.95：14.03 对 13.20，进门更划算', '0.96：14.90 对 15.80，又开始踱步', '0.97：15.83 对 20.07'], rg[0.95].a === 14.03 && rg[0.95].b === 13.2 && rg[0.95].st.includes('狗老老实实进门了') && rg[0.96].a === 14.9 && rg[0.96].b === 15.8 && rg[0.96].st.includes('来回踱步') && rg[0.97].a === 15.83 && rg[0.97].b === 20.07, JSON.stringify([rg[0.95].x, rg[0.96].x, rg[0.97].x]));
  await w.set('rw-g', 0.99, 300); await w.click('换成势能塑形', 300); r = await rwR();
  const shp = []; for (const g of [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.97, 0.99]) { await w.set('rw-g', g, 200); const x = await rwR(); shp.push(x.a > x.b && x.st.includes('直奔门口')); }
  seeAnd('rw shaping: straight 18.23, pacing 9.00; straight wins at every γ tried from 0.5 to 0.99', 'rw', ['换成势能塑形：直奔门口 18.23，踱步 9.00', 'γ 拖到哪里狗都直奔门口'], r.a === 18.23 && r.b === 9 && shp.every(Boolean), r.x + ' ' + shp.join(','));
  await w.set('rw-g', 0.99, 200); await w.click('再加：每靠近一步 +1', 200);

  // ---- step 6 · curling (dr): every position of the "real ice" slider for each way of training
  w = W('dr'); await w.show(); await wait(300);
  const MU = []; for (let k = 0; k <= 20; k++) MU.push(+(0.006 + k * 0.0005).toFixed(4));
  const sweep = async () => { const o = {}; for (const m of MU) { await w.set('dr-m', m, 70); o[m] = await w.status(); } return o; };
  const inHouse = st => /这一壶进了|众多情况之一|补得回来/.test(st), inSet = o => MU.filter(m => inHouse(o[m]));
  const d0 = await w.status(); const one = await sweep();
  both('dr one simulator: real ice 0.0115 stops at 24.3 m, 3.7 m short', 'dr', ['真实冰面 μ = 0.0115 时冰壶停在 24.3 m，短了 3.7 m'], d0, '真实冰面 μ = 0.0115', '冰壶停在 24.3 m，短了 3.7 m');
  seeAnd('dr one simulator: in the house only from 0.0095 to 0.0105; 2.5 m short at 0.011', 'dr', ['只有 0.0095 到 0.0105 这一小段进营垒', '0.011 就已经短了 2.5 m'], inSet(one).join(' ') === '0.0095 0.01 0.0105' && one[0.011].includes('短了 2.5 m'), inSet(one).join(' ') + ' / ' + one[0.011]);
  await w.set('dr-m', 0.0115, 150); await w.click('每局随机换摩擦来练', 300); const wRow = await w.text('.row'); const r20 = await sweep();
  seeAnd('dr random ±20%: in the house for exactly 0.008 to 0.012; 2.7 m short at 0.0125, 3.5 m too far at 0.0075', 'dr', ['范围 ±20%，也就是 0.008 到 0.012', '这一整段都进', '0.0125 短 2.7 m，0.0075 冲过 3.5 m'], wRow.includes('±20%') && inSet(r20).join(' ') === '0.008 0.0085 0.009 0.0095 0.01 0.0105 0.011 0.0115 0.012' && r20[0.0125].includes('短了 2.7 m') && r20[0.0075].includes('冲过了 3.5 m') && near(0.010 * 0.8, 0.008, 1e-12) && near(0.010 * 1.2, 0.012, 1e-12), inSet(r20).join(' ') + ' / ' + r20[0.0125] + ' / ' + r20[0.0075]);
  await w.set('dr-w', 0, 300); const r0 = await sweep(); await w.set('dr-m', 0.0115, 150); const r0st = await w.status();
  seeAnd('dr ±0%: the same as one simulator at every slider position', 'dr', ['±0%：和只在一个仿真里练一样'], inSet(r0).join(' ') === inSet(one).join(' ') && r0st.includes('和只在一个仿真里练一样') && r0st.includes('冰壶停在 24.3 m，短了 3.7 m'), r0st);
  await w.set('dr-w', 40, 300); const r40 = await sweep();
  seeAnd('dr ±40% (0.006 to 0.014): in the house only from 0.0085 to 0.0125; both ends of the range miss', 'dr', ['±40%（0.006 到 0.014）', '只有 0.0085 到 0.0125 还进', '范围两头都失手'], inSet(r40).join(' ') === '0.0085 0.009 0.0095 0.01 0.0105 0.011 0.0115 0.012 0.0125' && [0.006, 0.007, 0.008, 0.013, 0.014].every(m => r40[m].includes('随机化范围太宽')) && near(0.010 * 0.6, 0.006, 1e-12) && near(0.010 * 1.4, 0.014, 1e-12), inSet(r40).join(' ') + ' / ' + r40[0.008]);
  await w.set('dr-w', 20, 200); await w.set('dr-m', 0.0115, 200); await w.click('只在一个仿真里练', 200);

  // ---- step 8 · the seven real systems (sys)
  w = W('sys'); await w.show();
  const NAME = ['翻煎饼', '插电池、开杯盖', '四足机器人走野路', '下围棋', '一小时学会走路', '听懂没教过的指令', '聊天模型'];
  const sysBtn = await w.text('.btns'); const SY = [];
  for (let i = 0; i < 7; i++) { await w.tap('#sys [data-i="' + i + '"]', 200); const x = await w.text('.spec'); const o = {}; for (const st of ['示范', '视频', '偏好', '奖励', '无标签']) { const m = x.match(new RegExp(st + ' (\\d|—)')); o[st] = m && m[1] !== '—' ? +m[1] : 0; } const ord = Object.keys(o).filter(k => o[k]).sort((a, b) => o[a] - o[b]).join('→'); SY.push(ord); }
  ok('sys: the seven buttons are the seven systems named in the text', NAME.every(nm => sysBtn.includes(nm)), sysBtn);
  seeAnd('sys: only "插电池、开杯盖" uses one stop (demos); the others use two or three', 'sys', ['7 个系统里只有"插电池、开杯盖"只用了一站（示范）', '其余都是两站或三站'], SY[1] === '示范' && SY.filter(x => !x.includes('→')).length === 1 && SY.every((x, i) => i === 1 || [2, 3].includes(x.split('→').length)), SY.join(' | '));
  seeAnd('sys: the orders named in the see line', 'sys', ['翻煎饼和下围棋是先示范、后奖励', '四足机器人走野路反过来，先奖励', '后示范（学生模仿老师）', '一小时学会走路是先无标签（学世界模型）、后奖励', '听懂没教过的指令是先无标签（网络上的图文）、后示范', '聊天模型用了三站：无标签、示范、偏好'], SY[0] === '示范→奖励' && SY[3] === '示范→奖励' && SY[2] === '奖励→示范' && SY[4] === '无标签→奖励' && SY[5] === '无标签→示范' && SY[6] === '无标签→示范→偏好', SY.join(' | '));
  seeAnd('sys: none of the seven uses the video stop', 'sys', ['"视频"那一站，这 7 个系统都没用上'], SY.every(x => !x.includes('视频')), SY.join(' | '));

  // ===================================================== Part B =====================================================
  sec('Part B · numbers in the text, recomputed here');
  const TX = {}; for (const id of ['s-map', 's-mdp', 's-il', 's-var', 's-rl', 's-rw', 's-sim', 's-wm', 's-mix', 's-sum']) TX[id] = await secText(id);
  TX.hdr = await p.evaluate(() => { const h = document.querySelector('header'); h.querySelectorAll('details').forEach(d => d.open = true); return h.innerText; }).then(norm);
  const miss = (id, strs) => strs.filter(x => !TX[id].includes(x)).join(' ¦ ');
  // one check: every string is in that section's text AND the recomputed condition holds
  const tx = (name, id, strs, cond, got) => ok(name, !miss(id, strs) && cond, 'text lacks: ' + miss(id, strs) + ' ¦¦ got: ' + String(got).slice(0, 400));
  const r2 = v => (Math.round(v * 100) / 100).toFixed(2), r1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const SRC = await p.evaluate(() => { const o = {}; for (const id of ['sp', 'kn', 'mdp', 'bc', 'mm', 'vi', 'pg', 'rw', 'dr', 'sys']) { const t = [...document.scripts].map(s => s.textContent).find(t => t.includes("$('" + id + "-cv')") || (id === 'sys' && t.includes("#sys [data-i]"))); o[id] = t || ''; } return o; });
  const cst = (id, re) => { const m = SRC[id].match(re); return m ? +m[1] : NaN; };

  // ---- header: which interactives use the browser's own random numbers
  const rnd = Object.fromEntries(Object.keys(SRC).map(k => [k, (SRC[k].match(/Math\.random/g) || []).length]));
  tx('header: only the slippery floor (grid world) and "随机换一个 θ" (knob) use unseeded random numbers', 'hdr', ['用的都是固定的随机数序列', '只有两处例外：格子世界里的"地板打滑"，和旋钮实验里的"随机换一个 θ"'], rnd.mdp > 0 && rnd.kn === 1 && ['sp', 'bc', 'mm', 'vi', 'pg', 'rw', 'dr', 'sys'].every(k => rnd[k] === 0) && SRC.mdp.includes('slip&&Math.random()<slip') && /kn-rand[^;]*Math\.random/.test(SRC.kn), JSON.stringify(rnd));

  // ---- step 0: the knob experiment
  tx('knob: 36° per unit of force, half a turn at θ = 5, success from 150° to 210° = θ 4.2 to 5.8, teacher at 5.4', 's-map', ['力度每加 1，煎饼在空中多转 36°', 'θ = 5 正好转半圈（180°）', '转了 150° 到 210°（θ 在 4.2 到 5.8 之间', '老师用的是 5.4'], 5 * 36 === 180 && r1(150 / 36) === '4.2' && r1(210 / 36) === '5.8' && cst('kn', /TT=([\d.]+)/) === 5.4 && SRC.kn.includes('LO=150/36,HI=210/36') && SRC.kn.includes('36*th'), [150 / 36, 210 / 36]);
  tx('knob: from θ = 1.5 the pancake turns 54° and the demonstration loss is (1.5 − 5.4)² = 15.21 (also the readout)', 's-map', ['旋钮从 1.5 起步：煎饼只转了 54°，示范给的损失是 (1.5 - 5.4)² = 15.21'], 1.5 * 36 === 54 && r2((1.5 - 5.4) ** 2) === '15.21' && has(k0.start, '转了 54°', '损失 = 15.21'), k0.start);
  tx('knob: with a reward the direction is estimated from 12 tries', 's-map', ['先在附近试 12 次'], cst('kn', /K=(\d+),SG/) === 12, cst('kn', /K=(\d+),SG/));

  // ---- step 1: the grid world
  const g9 = Math.pow(0.9, 9), sum9 = (1 - g9) / 0.1, big9 = -0.1 * sum9 + 10 * g9;
  tx('grid: rewards −0.1 per step, +2, +10, −10 (the engine\'s own table)', 's-mdp', ['老鼠每走一步得 -0.1 分', '走进小奶酪 +2，大奶酪 +10，老鼠夹 -10'], await p.evaluate(() => GW.rw(GW.start) === -0.1 && GW.rw(42) === 2 && GW.rw(23) === 10 && [19, 20, 35, 36].every(i => GW.rw(i) === -10)), '');
  tx('grid: 2 steps to the small cheese give −0.1 + 0.9 × 2 = 1.70; the big cheese: 10 × 0.9⁹ = 3.87, total 3.26', 's-mdp', ['2 步拿小奶酪是 -0.1 + 0.9 × 2 = 1.70', '最后的 +10 要乘 9 次 0.9，只剩 3.87，合起来是 3.26'], r2(-0.1 + 0.9 * 2) === '1.70' && r2(10 * g9) === '3.87' && r2(big9) === '3.26', [10 * g9, big9]);
  tx('grid: shortest ways are 2 and 10 steps; two cells of the long one lie between traps (engine)', 's-mdp', ['小奶酪离起点只有 2 步', '大奶酪最近的路要走 10 步', '有两格夹在上下两排老鼠夹之间'], gw['0.9/0'].n === 10 && gw['0.8/0'].n === 2 && await p.evaluate(() => [27, 28].every(i => GW.isTerm(i - 8) && GW.isTerm(i + 8) && GW.rw(i - 8) === -10 && GW.rw(i + 8) === -10) && ![26, 29].some(i => GW.isTerm(i - 8) || GW.isTerm(i + 8))), JSON.stringify(gw['0.9/0']));
  tx('grid legend: the +10 at step 10 counts 10 × 0.9⁹ ≈ 3.9', 's-mdp', ['≈ 3.9'], r1(10 * g9) === '3.9', 10 * g9);
  tx('grid card: slipping on the bridge: 0.8 ahead, 0.1 to each side, so 20% for a trap', 's-mdp', ['= 0.8', '= 0.1', '这一步有 20% 的可能拿到 -10'], await p.evaluate(() => { const V = new Float64Array(GW.N); return Math.abs(GW.q(V, 27, 3, .9, .2) - (0.8 * -0.1 + 0.2 * -10)) < 1e-12 && Math.abs(GW.q(V, 27, 3, .9, 0) - (-0.1)) < 1e-12; }), '');
  tx('grid card: γ = 0.9: −0.1 × 6.13 + 10 × 0.387 ≈ 3.26 against 1.70; γ = 0.8: 1.50 against 0.91', 's-mdp', ['大奶酪是 -0.1 × 6.13 + 10 × 0.387 ≈ 3.26，小奶酪是 -0.1 + 1.8 = 1.70', 'γ = 0.8 时，小奶酪 1.50，大奶酪 0.91'], r2(sum9) === '6.13' && (Math.round(g9 * 1000) / 1000).toFixed(3) === '0.387' && r2(big9) === '3.26' && r2(-0.1 + 0.8 * 2) === '1.50' && r2(big08) === '0.91' && r2(gw['0.9/0'].V0) === '3.26', [sum9, g9, big9, big08]);
  tx('grid card: 1 + γ + γ² + … = 1 ∕ (1 − γ) = 10 at γ = 0.9', 's-mdp', ['1 ∕ (1 - γ)，γ = 0.9 时是 10'], Math.abs(1 / (1 - 0.9) - 10) < 1e-9, 1 / (1 - 0.9));

  // ---- step 2: imitation
  tx('BC card: squared errors (6 − 10)² = 16 and (9 − 10)² = 1', 's-il', ['(6 - 10)² = 16', '输出 9° 就只有 1'], (6 - 10) ** 2 === 16 && (9 - 10) ** 2 === 1, '');
  let tri = 0; for (let k = 1; k <= 100; k++) tri += k;
  tx('distribution shift: T = 100, ε = 1%: about 1 extra mistake against about 50 (ε × (T + … + 1) = 50.5 ≈ εT² ∕ 2 = 50)', 's-il', ['ε × (T + (T - 1) + … + 1) ≈ εT² ∕ 2', '比如 T = 100、ε = 1%', '预计多错 1 次左右', '多错 50 次左右'], Math.abs(100 * 0.01 - 1) < 1e-9 && Math.abs(0.01 * tri - 50.5) < 1e-9 && Math.abs(0.01 * 100 * 100 / 2 - 50) < 1e-9, [0.01 * tri]);
  tx('race track: 0.3 rad is about 17°; 5 nearest demonstrated positions; 5 laps of demonstrations; 20 test drives', 's-il', ['0.3 约等于 17°', '最近的 5 个示范位置', '开 5 圈当示范', '试开 20 次'], Math.round(0.3 * 180 / Math.PI) === 17 && SRC.bc.includes('const K=5,') && SRC.bc.includes('let nd=5,sig=.3') && SRC.bc.includes('k<20;k++)R.push(roll('), 0.3 * 180 / Math.PI);
  let best = 1e9, bestC = null; for (let c = -40; c <= 40; c += 0.5) { const e = (c - 30) ** 2 + (c + 30) ** 2; if (e < best) { best = e; bestC = c; } }
  tx('multimodality: (c − 30)² + (c + 30)² is smallest at c = 0', 's-il', ['(c - 30)² + (c + 30)²，c = 0 时最小'], bestC === 0, bestC);
  const mmN = await p.evaluate(() => { const E = __H.mm(); E.makeDemos(); E.runAll(); return { demos: Math.max(...E.F().ref.map(x => x[0])) + 1, flights: E.runs().length }; });
  tx('drone: 10 demonstrations, chunks of 30 steps, 8 test flights', 's-il', ['10 条示范（绿线）', '接下来的 30 步', '每种办法试飞 8 次'], mmN.demos === 10 && mmN.flights === 8 && cst('mm', /KC=(\d+)/) === 30, JSON.stringify(mmN));

  // ---- step 3: the sigmoid of the preference card
  const sg = x => 1 / (1 + Math.exp(-x));
  tx('preference card: σ(0) = 0.5, σ(1) ≈ 0.73, σ(3) ≈ 0.95, σ(−1) ≈ 0.27', 's-var', ['σ(0) = 0.5，σ(1) ≈ 0.73，σ(3) ≈ 0.95，σ(-1) ≈ 0.27'], sg(0) === 0.5 && r2(sg(1)) === '0.73' && r2(sg(3)) === '0.95' && r2(sg(-1)) === '0.27', [sg(1), sg(3), sg(-1)]);
  tx('preference card: e⁻¹ ≈ 0.37, 1 ∕ (1 + 0.37) ≈ 0.73, 1 − 0.73 = 0.27, −log 0.73 ≈ 0.31, −log 0.27 ≈ 1.31', 's-var', ['≈ 0.37', '1 ∕ (1 + 0.37) ≈ 0.73', '1 - 0.73 = 0.27', '-log 0.73 ≈ 0.31', '-log 0.27 ≈ 1.31'], r2(Math.exp(-1)) === '0.37' && r2(1 / 1.37) === '0.73' && r2(1 - 0.73) === '0.27' && r2(-Math.log(0.73)) === '0.31' && r2(-Math.log(0.27)) === '1.31', [Math.exp(-1), -Math.log(0.73), -Math.log(0.27)]);
  tx('maximum-entropy IRL: one more point of reward makes a trajectory e ≈ 2.7 times as likely', 's-var', ['e ≈ 2.7 倍'], r1(Math.E) === '2.7', Math.E);

  // ---- step 4: values, Q-learning, policy gradient
  const V9 = await p.evaluate(() => { const S = GW.solve(.9, 0); return { v31: S.V[31], v30: S.V[30], v29: S.V[29], qUp: GW.q(S.V, 31, 0, .9, 0), qLeft: GW.q(S.V, 31, 2, .9, 0), above31: GW.isTerm(23) && GW.rw(23) === 10 }; });
  tx('values (lead): under the big cheese 10; one cell left −0.1 + 0.9 × 10 = 8.9; one more −0.1 + 0.9 × 8.9 = 7.91 (engine: the same)', 's-rl', ['大奶酪正下方那一格，往上一步就拿到 +10，价值是 10', '-0.1 + 0.9 × 10 = 8.9', '-0.1 + 0.9 × 8.9 = 7.91'], V9.above31 && r2(V9.v31) === '10.00' && r2(V9.v30) === '8.90' && r2(V9.v29) === '7.91' && r2(-0.1 + 0.9 * 10) === '8.90' && r2(-0.1 + 0.9 * 8.9) === '7.91', JSON.stringify(V9));
  tx('value card: Q*(s, up) = 10 and Q*(s, left) = −0.1 − 0.09 + 0.81 × 10 = 7.91', 's-rl', ['Q*(s, 上) = 10', 'Q*(s, 左) = -0.1 - 0.09 + 0.81 × 10 = 7.91'], r2(V9.qUp) === '10.00' && r2(V9.qLeft) === '7.91' && r2(-0.1 - 0.09 + 0.81 * 10) === '7.91', JSON.stringify(V9));
  tx('Bellman card: slipping on the bridge costs 0.1 × 10 + 0.1 × 10 = 2 points at once; what the optimal policy then does', 's-rl', ['0.8 × [-0.1 + 0.9 V*(右边那格)] + 0.1 × (-10) + 0.1 × (-10)', '一下子就扣掉 2 分', 'γ = 0.9 时改拿小奶酪，γ 调到 0.93 以上才值得绕远路去拿大奶酪'], Math.abs(0.1 * 10 + 0.1 * 10 - 2) < 1e-12 && gw['0.9/0.2'].end === 2 && gw['0.92/0.2'].end === 2 && gw['0.93/0.2'].end === 10 && gw['0.93/0.2'].top && !gw['0.93/0.2'].bridge, JSON.stringify([gw['0.92/0.2'], gw['0.93/0.2']]));
  tx('Q-learning card: target −0.1 + 0.9 × 8 = 7.1; new Q = 5 + 0.5 × (7.1 − 5) = 6.05; α = 0.5 in the interactive', 's-rl', ['目标 = -0.1 + 0.9 × 8 = 7.1，新的 Q = 5 + 0.5 × (7.1 - 5) = 6.05'], r1(-0.1 + 0.9 * 8) === '7.1' && r2(5 + 0.5 * (7.1 - 5)) === '6.05' && SRC.vi.includes('Q[s*4+a]+=.5*(tg-Q[s*4+a])'), '');
  tx('grid of step 4 (legend): an episode ends after at most 200 steps; optimistic init sets every Q to 10', 's-rl', ['最多走 200 步', '一开始把所有 Q 都设成 10，而不是 0'], SRC.vi.includes('for(let t=0;t<200;t++)') && SRC.vi.includes('const q0=optm?10:0'), '');
  tx('Q-learning card: ε = 0.1 from 0 never reaches the big cheese (5000 episodes); ε = 0.2, 0.3, 0.4: none in 1000 or 5000; optimistic: within ten or so', 's-rl', ['大奶酪一次都没碰到', '把 ε 调到 0.3、跑上千回合也基本碰不到', '十来个回合就能找到大奶酪', '大奶酪在 10 步之外'], ql.plain5000.hits === 0 && ql.plain5000.ep === 5000 && [0.2, 0.3, 0.4].every(e => ql.eps[e][0] === 0 && ql.eps[e][1] === 0) && ql.hist.every(x => x[1] <= 14), JSON.stringify([ql.plain5000, ql.eps]));
  tx('darts (lead): μ starts 1.37 from the bull\'s-eye; σ = 0.3; 8 darts a round; 10 points dead centre', 's-rl', ['离靶心 1.37', 'σ = 0.3', '扔一轮（8 支）', '正中 10 分'], r2(Math.hypot(1.15, 0.75)) === '1.37' && SRC.pg.includes('MU0=[-1.15,-.75]') && cst('pg', /SIG=([\d.]+)/) === 0.3 && SRC.pg.includes('let N=8,') && SRC.pg.includes('score=a=>10*Math.exp('), Math.hypot(1.15, 0.75));
  const SW = cst('pg', /SW=([\d.]+)/), sc = (x, y) => 10 * Math.exp(-(x * x + y * y) / (2 * SW * SW));
  tx('policy-gradient card: a dart at (−0.7, 0) scores about 5 (μ itself about 2.5); (5 − 2.5) × 0.3 ∕ 0.09 ≈ 8.3; η = 0.03', 's-rl', ['落在 (-0.7, 0)', '得 5 分', '这一轮平均 2.5 分', '(5 - 2.5) × (0.3, 0) ∕ 0.09 ≈ (8.3, 0)', 'η = 0.03'], Math.round(sc(-0.7, 0)) === 5 && r1(sc(-1, 0)) === '2.5' && r1((5 - 2.5) * 0.3 / 0.09) === '8.3' && cst('pg', /ETA=([\d.]+)/) === 0.03, [sc(-0.7, 0), sc(-1, 0)]);

  // ---- step 5: the corridor, in closed form
  const G = 0.99, geo = n => (1 - Math.pow(G, n)) / (1 - G);
  const door = 10 * Math.pow(G, 8), plusStraight = geo(9) + door, plusPace = geo(8) + Math.pow(G, 9) / (1 - G * G), shapeStraight = 9 + door;
  tx('shaping card: door +10 discounted 9.23; with shaping 9 + 9.23 = 18.23 against 9 for pacing', 's-rw', ['× 0 - (-9) = 9', '打折后是 9.23，合计 18.23', '踱步永远进不了门，只有 9'], r2(door) === '9.23' && r2(shapeStraight) === '18.23' && r2(Math.pow(G, 9) * 0 - (-9)) === '9.00', [door, shapeStraight]);
  tx('shaping card: "+1 per step closer": 17.88 straight, 53.63 pacing for ever', 's-rw', ['打折后合计 17.88', '一辈子加起来是 53.63'], r2(plusStraight) === '17.88' && r2(plusPace) === '53.63', [plusStraight, plusPace]);
  tx('corridor (lead): 10 cells, +10 at the door; Φ = minus the cells still to go', 's-rw', ['一条 10 格的走廊', '进门 +10', '离门还有几格的负数'], SRC.rw.includes('NC=10,DOOR=9') && SRC.rw.includes('const Phi=s=>-(DOOR-s)') && SRC.rw.includes('s2===DOOR?10:0'), '');

  // ---- step 6: curling
  const dOne = 28 * 0.010 / 0.0115;
  tx('curling (lead): 28 × 0.010 ÷ 0.0115 ≈ 24.3 m, 3.7 m short; house radius 1.83 m; sweeping from 4 m, at most −30%', 's-sim', ['28 × 0.010 ÷ 0.0115 ≈ 24.3 m，短了 3.7 m', '离圆心 1.83 m 以内', '滑过 4 m 以后', '摩擦减小 30%', '28 m 处的营垒'], r1(dOne) === '24.3' && r1(28 - dOne) === '3.7' && SRC.dr.includes('D=28,RH=1.83,OBS=4,CAP=.3,MU0=.010'), dOne);
  tx('curling: the distance is inversely proportional to μ (the interactive\'s formula v² ∕ (2 g μ) with the speed tuned for 0.010)', 's-sim', ['冰面越涩（摩擦系数 μ 越大），冰壶滑得越短'], SRC.dr.includes('const full=v*v/(2*g0*m)') && SRC.dr.includes('v:Math.sqrt(2*g0*MU0*D)') && r1(28 * 0.010 / 0.011) === '25.5' && one[0.011].includes('冰壶停在 25.5 m'), one[0.011]);

  // ---- step 7 and step 8
  tx('world-model card: 2 cm per second, target 10 cm away: push for 5 seconds', 's-wm', ['推 1 秒，方块走 2 厘米', '目标在 10 厘米外', '推 5 秒'], 10 / 2 === 5, '');
  // E[max of n standard normal guesses] = ∫ x n φ(x) Φ(x)^(n−1) dx, by the trapezoid rule
  const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); let Em = 0, cdf = 0; const dx = 1e-4;
  for (let x = -8; x < 8; x += dx) { cdf += phi(x) * dx; Em += x * 5 * phi(x) * Math.pow(cdf, 4) * dx; }
  tx('offline RL: the largest of 5 guesses with errors of typical size 1 averages 1.16 too high', 's-mix', ['5 个数据里没见过的动作', '误差大约 ±1', '平均下来要高估约 1.16'], r2(Em) === '1.16', Em);

  // ===================================================== figures =====================================================
  sec('Figures');
  const FIG = await p.evaluate(() => [...document.querySelectorAll('figure.fig')].map(f => ({ sec: f.closest('section').id, svg: [...f.querySelectorAll('svg text')].map(t => { const z = t.querySelector('.zh'); return (z ? z.textContent : t.querySelector('.en') ? '' : t.textContent).replace(/\s+/g, ' ').trim(); }).filter(Boolean), cap: f.querySelector('figcaption').innerText.replace(/\s+/g, ' ') })));
  for (const f of FIG) { f.cap = norm(f.cap); f.svg = f.svg.map(norm); }
  ok('8 figures, in steps 3, 3, 3, 4, 5, 6, 7, 8', FIG.length === 8 && FIG.map(f => f.sec).join(' ') === 's-var s-var s-var s-rl s-rw s-sim s-wm s-mix', FIG.map(f => f.sec).join(' '));
  ok('fig 1: three numbered steps: train, guess the actions, behaviour cloning', has(FIG[0].svg.join(' | '), '① 训练', '② 猜动作', '③ 行为克隆', '逆动力学模型') && has(FIG[0].cap, '分三步', '猜出来的动作 â'), FIG[0].svg.join(' | '));
  ok('fig 2: inner loop (reinforcement learning) and outer loop (adjust the reward)', has(FIG[1].svg.join(' | '), '内层：跑一遍强化学习', '（外层）') && has(FIG[1].cap, '两层循环', '所以它很贵'), FIG[1].svg.join(' | '));
  ok('fig 3: the marked points are σ(−1) = 0.27, σ(0) = 0.5, σ(1) = 0.73, σ(3) = 0.95', ['0.27', '0.5', '0.73', '0.95'].every(v => FIG[2].svg.includes(v)) && has(FIG[2].cap, '0.73', '0.95', '0.27', '一半一半') && r2(sg(-1)) === '0.27' && r2(sg(1)) === '0.73' && r2(sg(3)) === '0.95', FIG[2].svg.join(' | '));
  ok('fig 4: old 5, target 7.1, new 6.05; difference 2.1, half of it 1.05', ['5', '7.1', '6.05'].every(v => FIG[3].svg.includes(v)) && has(FIG[3].svg.join(' | '), '目标 - 旧的 = 2.1', '+1.05') && has(FIG[3].cap, '-0.1 + 0.9 × 8 = 7.1', '5 + 0.5 × 2.1 = 6.05') && r1(7.1 - 5) === '2.1' && r2(0.5 * 2.1) === '1.05', FIG[3].svg.join(' | '));
  ok('fig 5: three steps whose shaping rewards cancel in pairs', has(FIG[4].svg.join(' | '), '第 1 步', '第 3 步', '一正一负，抵消', '只剩两头：') && has(FIG[4].cap, '两两抵消', '兜圈子刷不到分'), FIG[4].svg.join(' | '));
  ok('fig 6: teacher (privileged information, reinforcement learning), student (sensor history), real robot', has(FIG[5].svg.join(' | '), '特权信息', '老师', '学生', '传感器的历史', '③ 真机') && has(FIG[5].cap, '搬上真机的只有学生'), FIG[5].svg.join(' | '));
  ok('fig 7: three imagined sequences of four states each; the lowest cost is marked; said to be illustrative', has(FIG[6].svg.join(' | '), '代价 3：最小', '代价 8', '代价 9') && has(FIG[6].cap, '示意：3 串动作，每串往前想 4 步', '模型预测控制') && await p.evaluate(() => { const f = document.querySelectorAll('figure.fig')[6]; return f.querySelectorAll('svg circle').length === 3 * 4 + 3; }), FIG[6].svg.join(' | '));
  const f8 = FIG[7].svg.filter(v => /^[+-]\d\.\d$/.test(v)).map(Number);
  ok('fig 8: five guesses (−0.9, +1.3, +0.4, −0.3, +0.7); the largest, +1.3, is the one picked; the line is at +1.16', f8.length === 5 && Math.max(...f8) === 1.3 && has(FIG[7].svg.join(' | '), '被挑中', '平均是 +1.16') && has(FIG[7].cap, '这里是 +1.3', '平均是 +1.16', '随手画的') && r2(Em) === '1.16', FIG[7].svg.join(' | '));

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
