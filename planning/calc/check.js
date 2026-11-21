// Check the numbers quoted in the "你会看到 / What you will see" lines of "Planning and Decision-Making"
// (planning/index.html) against the page itself. It opens the page in a headless browser, operates each
// interactive the way a reader would, and compares the readouts with the numbers the text quotes.
//   usage: node check.js /absolute/path/to/planning/index.html
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/planning/index.html'); process.exit(2); }
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
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/[\s,>]/g, '')) : NaN; };
  const N = '([-+]?[\\d.,]+)';
  const R = (s) => new RegExp(s.replace(/N/g, N));

  const txt = (id, sel) => p.evaluate(([i, s]) => [...document.querySelectorAll('#' + i + ' ' + s)].map(e => e.innerText).join(' ¦ ').replace(/\s+/g, ' ').replace(/−/g, '-'), [id, sel]);

  // ---- step 0: the whole task on a timeline
  { const w = W('robot17'); await w.show(); const bt = await txt('robot17', 'button'); const m = await w.met();
    ok('timeline: 52.8 s in all', /共 52\.8 s/.test(m), m.slice(0, 40));
    ok('timeline: drive 23.5, carry 7.4, turns 3.1 each, plan path 0.1, plan arm 0.5, look again 3.0 s', /开到灶台前 ?23\.5 s/.test(bt) && /端过去 ?7\.4 s/.test(bt) && (bt.match(/转身 ?3\.1 s/g) || []).length === 2 && /算路 ?0\.1 s/.test(bt) && /规划手臂 ?0\.5 s/.test(bt) && /再看一眼 ?3\.0 s/.test(bt), bt.slice(0, 160));
    await w.click('再看一眼3.0'); let st = await w.status(); ok('timeline, at "look again": 2σ = 12.6 mm > 10 mm, so move 0.25 m closer', /2σ = 12\.6 mm/.test(st) && /靠近 0\.25 m/.test(st), st.slice(0, 70));
    await w.click('端过去'); st = await w.status(); ok('timeline, carrying: DWB every 50 ms, acceleration ≤ 0.5 m/s², path recomputed every second', /每 50 ms/.test(await w.met()) && /不超过 0\.5 m\/s²/.test(st) && /每秒重算一次路径/.test(st), st.slice(0, 60));
    await w.click('重来'); }

  // ---- step 1: greedy potential field against planning
  { const w = W('greedy'); await w.show();
    const rd = async () => { const m = await w.met(); return { walked: num(m, R('贪心走了 N m')), left: num(m, R('贪心离目标 N m')), plan: num(m, R('规划的路长 N m')), m }; };
    let r = await rd(); ok('greedy, default: stuck after 0.09 m at (2.50, 1.29), 2.01 m from the goal; planned path 3.60 m', near(r.walked, 0.09) && near(r.left, 2.01) && near(r.plan, 3.60) && /\(2\.50, 1\.29\)/.test(r.m) && /卡住了/.test(r.m), [r.walked, r.left, r.plan].join(' '));
    await w.click('东边过道', 6000); r = await rd(); ok('greedy, from the east aisle: arrives after 4.25 m', near(r.walked, 4.25) && /贪心的结局 到了/.test(r.m), r.m.slice(0, 70));
    await w.click('充电座'); await w.click('抓杯子的位置', 8000); r = await rd(); ok('greedy, dock to grasp pose: stops at (4.50, 3.18), 0.12 m short', near(r.left, 0.12) && /\(4\.50, 3\.18\)/.test(r.m) && /卡住了/.test(r.m), r.m.slice(0, 70));
    await w.click('岛台南边'); await w.click('放杯子的位置', 300); }

  // ---- step 2: the costmap
  { const w = W('costmap'); await w.show();
    const rd = async () => { const m = await w.met(), st = await w.status(); return { len: num(m, R('路长 N m')), other: num(m, R('另一边最便宜：N m')), aisle: num(st, R('最中间离两边 0\\.50 m，代价 N')), nav: num(st, /avFn 一格 ([\d.]+)/), pct: num(st, R('贵 N %')), m, st }; };
    let r = await rd(); ok('costmap, defaults: 1.0 m aisle centre costs 138 (NavFn 160.4), 1.2 m aisle 0; path east 5.16 m; the other way 5.05 m but 48 % dearer', near(r.aisle, 138) && near(r.nav, 160.4) && /0\.60 m，代价 0/.test(r.st) && near(r.len, 5.16) && /东边/.test(r.m) && near(r.other, 5.05) && near(r.pct, 48), [r.aisle, r.nav, r.len, r.other, r.pct].join(' '));
    await w.set('costmap-r', 0.22); r = await rd(); ok('costmap, radius 0.22 m: aisle centre 108, path still east', near(r.aisle, 108) && /东边/.test(r.m), r.aisle + ' ' + r.m.slice(-40));
    await w.set('costmap-r', 0.30); await w.set('costmap-i', 0.49); r = await rd(); ok('costmap, inflation_radius 0.49 m: aisle centre 0, path switches west, 4.95 m', near(r.aisle, 0) && /西边/.test(r.m) && near(r.len, 4.95), r.aisle + ' ' + r.len);
    await w.click('恢复默认'); }

  // ---- step 3: grid search
  { const w = W('astar'); await w.show();
    const rd = async () => { const m = await w.met(); return { n: num(m, R('展开的格子 N')), len: num(m, R('路长 N m')), cost: num(m, R('路的代价 N')), pct: num(m, R('比最优贵 N %')), clr: num(m, R('离障碍 ≥ N m')), m }; };
    const run = async (alg, e) => { await w.click(alg); if (e !== undefined) await w.set('astar-e', e); await w.click('直接出结果', 700); return rd(); };
    let r = await run('Dijkstra'); ok('search, Dijkstra: 3853 cells, 5.16 m, cost 5157', r.n === 3853 && near(r.len, 5.16) && r.cost === 5157, [r.n, r.len, r.cost].join(' '));
    r = await run('A*'); ok('search, A*: 1493 cells, the same 5.16 m and 5157', r.n === 1493 && near(r.len, 5.16) && r.cost === 5157, [r.n, r.len, r.cost].join(' '));
    r = await run('加权 A*', 2); ok('search, weighted A* ε 2: 171 cells, 5.36 m, 4.0 % dearer', r.n === 171 && near(r.len, 5.36) && near(r.pct, 4.0), [r.n, r.len, r.pct].join(' '));
    r = await run('加权 A*', 5); ok('search, weighted A* ε 5: 4.88 m, 159.3 % dearer', near(r.len, 4.88) && near(r.pct, 159.3), [r.n, r.len, r.pct].join(' '));
    r = await run('贪心'); ok('search, greedy best-first: 88 cells, 4.81 m, 180.7 % dearer, 0.30 m from obstacles', r.n === 88 && near(r.len, 4.81) && near(r.pct, 180.7) && near(r.clr, 0.30), [r.n, r.len, r.pct, r.clr].join(' '));
    await w.set('astar-e', 2); await w.click('A*'); await w.click('重来'); }

  // ---- step 4: sampling planners (the widget's seed sequence is deterministic from page load)
  { const w = W('rrt'); await w.show();
    const rd = async () => { const m = await w.met(); return { pts: num(m, R('撒的点 N')), chk: num(m, R('碰撞检测 N')), len: num(m, R('路长 N rad')), before: num(m, R('抄近路前 N rad')), fail: /路长 —/.test(m), m }; };
    const many = async (h) => { await w.set('rrt-h', h); const out = []; for (let k = 0; k < 14; k++) { if (k) await w.click('换一组随机数', 150); await w.click('跑完', 700); out.push(await rd()); } await w.click('重来', 200); return out; };
    const a = await many(0.50), pa = a.map(x => x.pts);
    ok('sampling, RRTConnect, opening seed: 432 points, 2,231 checks, 2.11 rad', a[0].pts === 432 && a[0].chk === 2231 && near(a[0].len, 2.11), [a[0].pts, a[0].chk, a[0].len].join(' '));
    ok('sampling, cabinet 0.50 m, 14 seeds: 60 to 1,416 points', Math.min(...pa) === 60 && Math.max(...pa) === 1416 && a.every(x => !x.fail), pa.join(' '));
    const c = await many(0.48), pc = c.map(x => x.pts); ok('sampling, cabinet 0.48 m, 14 seeds: 141 to 2,925 points', Math.min(...pc) === 141 && Math.max(...pc) === 2925 && c.every(x => !x.fail), pc.join(' '));
    const d = await many(0.47); ok('sampling, cabinet 0.47 m: 10 of 14 seeds fail within 5,000 points', d.filter(x => x.fail).length === 10 && d.filter(x => x.fail).every(x => x.pts === 5000), d.map(x => x.pts + (x.fail ? 'F' : '')).join(' ')); }
  { // a fresh page for the opening seed with the other planners
    await p.reload(); await p.waitForTimeout(600); const w = W('rrt'); await w.show();
    const rd = async () => { const m = await w.met(); return { pts: num(m, R('撒的点 N')), chk: num(m, R('碰撞检测 N')), len: num(m, R('路长 N rad')), before: num(m, R('抄近路前 N rad')), fail: /路长 —/.test(m), m }; };
    await w.click('RRT'); await w.click('跑完', 1500); let r = await rd(); ok('sampling, RRT: 1,535 points, 3.32 rad', r.pts === 1535 && near(r.len, 3.32), [r.pts, r.chk, r.len].join(' '));
    await w.click('RRT*'); await w.click('跑完', 3000); r = await rd(); ok('sampling, RRT*: 2.07 rad after 84,729 collision checks (38 times RRTConnect’s 2,231)', near(r.len, 2.07) && r.chk === 84729 && Math.round(84729 / 2231) === 38, [r.pts, r.chk, r.len].join(' '));
    await w.click('RRTConnect'); await w.set('rrt-h', 0.46); await w.click('跑完', 3000); r = await rd(); ok('sampling, cabinet 0.46 m: no path, gives up at 5,000 points', r.fail && r.pts === 5000, r.m.slice(0, 40));
    await w.set('rrt-h', 0.50); await w.click('跑完', 1500); await w.click('抄近路', 900); r = await rd(); ok('sampling, shortcut: 2.11 rad becomes 2.04 rad', near(r.len, 2.04) && near(r.before, 2.11), [r.len, r.before].join(' '));
    await w.click('抄近路', 300); }

  // ---- step 5: trajectory optimisation
  { const w = W('trajopt'); await w.show();
    const rd = async () => { const m = await w.met(), st = await w.status(); return { it: num(m, R('迭代 N')), len: num(m, R('路长 N m')), clr: num(m, R('最近离障碍 N m')), J: num(st, R('J = N m²')), m, st }; };
    const run = async (init, lam) => { await w.click(init); if (lam !== undefined) await w.set('trajopt-l', lam); await w.click('▶ 优化', 9000); return rd(); };
    let r = await run('直线，稍偏左'); ok('trajopt, nudged west: converges at iteration 71, west end, 3.32 m, 0.24 m clear, collision-free from iteration 9', r.it === 71 && /西头/.test(r.st) && near(r.len, 3.32) && near(r.clr, 0.24) && /第 9 次迭代起就不撞了/.test(r.st), [r.it, r.len, r.clr].join(' ')); const Jw = r.J;
    r = await run('直线，稍偏右'); ok('trajopt, nudged east: still round the west end, 3.32 m', /西头/.test(r.st) && near(r.len, 3.32), r.len);
    r = await run('从东边绕'); ok('trajopt, from the east: stays east, 5.31 m, 2.7 times the cost', /东头/.test(r.st) && near(r.len, 5.31) && /贵 2\.7 倍/.test(r.st) && near(r.J / Jw, 2.7, .05), [r.len, r.J, Jw].join(' '));
    r = await run('直线，稍偏左', 1); ok('trajopt, λ 1: closer to the island, 0.18 m, and 3.18 m long', near(r.clr, 0.18) && near(r.len, 3.18), [r.clr, r.len].join(' '));
    await w.set('trajopt-l', 10); r = await run('从 A* 的路开始'); ok('trajopt, from the A* path: starts 8 % above the final J, never collides, ends at 3.32 m', /只比最终值高 8 %/.test(r.st) && /一直不撞/.test(r.st) && near(r.len, 3.32), r.st.slice(-110));
    await w.click('直线，稍偏左'); }

  // ---- step 6: carrying a cup of water
  { const w = W('timing'); await w.show();
    const rd = async () => { const m = await w.met(); return { T: num(m, R('用时 N s')), tilt: num(m, R('水面最大倾角 N°')), rise: num(m, R('杯壁处升高 N mm')), spilled: /洒没洒 洒了/.test(m), over: num(m, R('多出 N mm')), m }; };
    await w.click('Nav2 默认'); let r = await rd(); ok('timing, Nav2 default: spills; tilt 25.6°, rise 14.4 mm (4.4 mm over), 7.80 s', r.spilled && near(r.tilt, 25.6) && near(r.rise, 14.4) && near(r.over, 4.4) && near(r.T, 7.80), [r.tilt, r.rise, r.T].join(' '));
    await w.click('我们的设定'); r = await rd(); ok('timing, ours: no spill; tilt 5.7°, rise 3.0 mm, 7.27 s (0.53 s faster)', !r.spilled && near(r.tilt, 5.7) && near(r.rise, 3.0) && near(r.T, 7.27) && near(7.80 - r.T, 0.53), [r.tilt, r.rise, r.T].join(' '));
    await w.set('timing-dh', 2); r = await rd(); ok('timing, water 2 mm below the rim: ours spills (rise 3.0 mm)', r.spilled && near(r.rise, 3.0), r.m.slice(-30));
    await w.click('S 形'); await w.set('timing-dh', 2); r = await rd(); ok('timing, S-curve at 2 mm: rise 1.6 mm, no spill, 7.77 s (0.50 s more)', !r.spilled && near(r.rise, 1.6) && near(r.T, 7.77), [r.rise, r.T].join(' '));
    await w.click('我们的设定'); await w.set('timing-dh', 10); }

  // ---- step 7: local planning around a person
  { const w = W('local'); await w.show();
    const rd = async () => { const m = await w.met(), st = await w.status(); return { near: num(m, R('离人最近 N m')), T: num(m, R('到达用时 N s')), T0: num(m, R('没人时 N s')), stop: num(m, R('被挡停 N s')), slow: num(st, R('最慢减到 N m/s')), m, st }; };
    await w.click('▶ 播放', 14000); let r = await rd(); ok('local, person at 0.8 m/s: no stop, slows to 0.15 m/s, closest 0.30 m, 8.40 s against 8.00 s', near(r.stop, 0) && near(r.slow, 0.15) && near(r.near, 0.30) && near(r.T, 8.40) && near(r.T0, 8.00), [r.near, r.T, r.T0, r.slow].join(' '));
    ok('local: the status explains that the person is left out of the global costmap here', /这个交互没把人放进全局代价地图/.test(r.st), r.st.slice(60, 120));
    await w.click('重来'); await w.click('局部规划'); await w.click('▶ 播放', 14000); r = await rd(); ok('local planner off: held for 0.7 s, 7.65 s against 6.85 s (0.80 s late)', near(r.stop, 0.7) && near(r.T, 7.65) && near(r.T0, 6.85), [r.stop, r.T, r.T0].join(' '));
    await w.click('重来'); await w.click('局部规划'); await w.click('Nav2 默认'); await w.click('下一步'); let st = await w.status(); ok('local, Nav2 default generator: the first pick is already 0.30 m/s', /现在 v = 0\.30 m\/s/.test(st), st.slice(0, 60));
    await w.click('重来'); await w.click('经典动态窗口'); await w.set('local-vp', 1.2); await w.click('▶ 播放', 14000); r = await rd(); ok('local, person at 1.2 m/s: 8.00 s, closest 0.42 m', near(r.T, 8.00) && near(r.near, 0.42), [r.T, r.near].join(' '));
    await w.click('重来'); await w.set('local-vp', 0.5); await w.click('▶ 播放', 16000); r = await rd(); ok('local, person at 0.5 m/s: closest 0.10 m, 9.25 s (1.25 s late)', near(r.near, 0.10) && near(r.T, 9.25) && near(r.T - r.T0, 1.25), [r.T, r.near].join(' '));
    await w.click('重来'); await w.set('local-vp', 0.8); }

  // ---- step 8: grasp now or look again
  { const w = W('decide'); await w.show();
    const rd = async () => { const m = await w.met(); return { p1: num(m, /现在抓 (>? ?[\d.]+)/), p2: num(m, /P\(成功\) 再看一眼 (?:> )?([\d.]+)/), e1: num(m, R('期望代价 · 现在抓 N s')), e2: num(m, R('期望代价 · 再看一眼 N s')), pick: (m.match(/选哪个 (现在抓|再看一眼)/) || [])[1], save: num(m, R('省 N s')), Cs: num(m, R('临界代价 C\\* N s')), m }; };
    let r = await rd(); ok('decide, default: 0.8887 / 0.9741, expected 2.23 s / 3.52 s, grasp now (saves 1.29 s), C* 35.1 s', near(r.p1, 0.8887) && near(r.p2, 0.9741) && near(r.e1, 2.23) && near(r.e2, 3.52) && r.pick === '现在抓' && near(r.save, 1.29) && near(r.Cs, 35.1), [r.p1, r.p2, r.e1, r.e2, r.pick, r.Cs].join(' '));
    await w.click('碰倒杯子'); r = await rd(); ok('decide, failure costs 120 s: 13.36 s / 6.11 s, look again (saves 7.25 s)', near(r.e1, 13.36) && near(r.e2, 6.11) && r.pick === '再看一眼' && near(r.save, 7.25), [r.e1, r.e2, r.pick].join(' '));
    await w.click('重抓一次'); await w.set('decide-tl', 8); r = await rd(); ok('decide, a look takes 8 s: C* 93.7 s', near(r.Cs, 93.7), r.Cs);
    await w.click('重来'); await w.set('decide-s1', 3); await w.set('decide-s2', 2); r = await rd(); ok('decide, σ 3 mm and 2 mm: grasping now is 0.9991 sure, C* 3,498 s', near(r.p1, 0.9991) && near(r.Cs, 3498) && r.pick === '现在抓', [r.p1, r.Cs].join(' '));
    await w.click('重来'); }

  // ---- step 9: the behaviour tree
  { const w = W('bt'); await w.show();
    const finish = async () => { let last = '', log = ''; for (let k = 0; k < 80; k++) { await w.click('到下一个变化', 90); const t = (await w.met()) + ' ## ' + (await w.status()); if (t === last) break; last = t; log += ' || ' + t; } return { last, log }; };
    let r = await finish(); ok('tree, default: 529 ticks, 52.8 s; ReachStove and SeeCupA take their second child (2σ = 12.6 mm ≥ 10 mm)', /一共 529 拍、52\.8 s/.test(r.last) && /AtStove\? 返回 FAILURE/.test(r.log) && /UncertaintyOK\? 返回 FAILURE（2σ = 12\.6 mm ≥ 10 mm）/.test(r.log), r.last.slice(0, 50));
    await w.click('重来'); await w.click('第一次抓空'); r = await finish(); ok('tree, first grasp misses: 594 ticks, 59.3 s (6.5 s more), retried by RetryUntilSuccessful', /一共 594 拍、59\.3 s/.test(r.last) && near(59.3 - 52.8, 6.5) && /Retry/.test(r.log), r.last.slice(0, 50));
    await w.click('重来'); await w.click('第一次抓空'); await w.click('杯子 A 不见了'); r = await finish(); ok('tree, cup A gone: AskForHelp catches it at 29.6 s; the root returns SUCCESS without the cup', /一共 297 拍、29\.6 s/.test(r.last) && /AskForHelp 返回 SUCCESS/.test(r.last) && /杯子并没有拿到/.test(r.last), r.last.slice(0, 60));
    await w.click('重来'); await w.click('杯子 A 不见了'); await w.click('换成状态机', 400); let c = await txt('bt', '.cap, p, small'); ok('tree as a state machine: 11 states, 20 transitions; the tree has 18 nodes', /状态机：11 个状态/.test(c) && /20 条转移；行为树：18 个节点/.test(c), (c.match(/状态机：11[^；]*；/) || [''])[0]);
    await w.click('加一个故障', 400); c = await txt('bt', '.cap, p, small'); ok('one more failure: +8 transitions (28) against +1 node (19)', /28 条转移；行为树：19 个节点/.test(c) && /\+8 条/.test(c) && /\+1 个/.test(c), (c.match(/28 条转移[^。]*。/) || [''])[0]);
    await w.click('加一个故障'); await w.click('换成状态机'); }

  // ---- step 10: symbolic planning
  { const w = W('pddl'); await w.show();
    const rd = async () => { const m = await w.met(); return { len: num(m, R('计划长度 N')), exp: num(m, R('展开的状态 N')), m }; };
    const plan = async (search) => { if (search) await w.click(search); await w.click('规划', 6500); return rd(); };
    let r = await plan(); ok('pddl, B blocks A, breadth-first: 6 steps, 24 states expanded', r.len === 6 && r.exp === 24, [r.len, r.exp].join(' '));
    r = await plan('A*：目标计数'); ok('pddl, A* goal count: still 24 states', r.len === 6 && r.exp === 24, [r.len, r.exp].join(' '));
    r = await plan('A*：h_max'); let st = await w.status(); ok('pddl, A* h_max: 7 states; h_max(s0) = 4 against a true 6', r.len === 6 && r.exp === 7 && /h_max\(s₀\) = 4/.test(st) && /真实 6/.test(st), [r.len, r.exp].join(' '));
    await w.click('宽度优先'); await w.click('B 挡着 A'); r = await plan(); ok('pddl, B not blocking: 4 steps, 7 states', r.len === 4 && r.exp === 7, [r.len, r.exp].join(' '));
    await w.click('B 挡着 A'); await w.click('符号层事先不知道'); r = await plan(); ok('pddl, symbolic layer unaware: an optimistic 4-step plan', r.len === 4, r.len);
    await w.click('▶ 执行', 15000); const m = await w.met(); st = await w.status(); ok('pddl, executing it: replans once into 5 steps; 6 actions in all, 7 + 24 = 31 states', /重新规划后 5 步，整件事一共 6 步/.test(m) && /7 \+ 24 = 31/.test(m) && /重新规划 1/.test(m) && /已执行 6 个动作/.test(m), m.slice(0, 90));
    await w.click('重来'); await w.click('符号层事先不知道'); }

  // ---- step 11: SayCan
  { const w = W('saycan'); await w.show();
    const run = async () => { let log = '', last = ''; for (let k = 0; k < 16; k++) { const t = (await w.met()) + ' ## ' + (await w.status()); if (t !== last) log += ' || ' + t; last = t; await w.click('下一步', 700); } return { log, last: (await w.met()) + ' ## ' + (await w.status()) }; };
    let r = await run(); ok('saycan, default: step 1 picks "go to the sink" (0.30 × 0.95 = 0.285) over "pick up the sponge" (0.36 × 0.05 = 0.018); done in 6 steps', /「拿起海绵」（0\.36），可价值函数说现在只有 0\.05 做得到，乘起来 0\.018/.test(r.log) && /0\.30 × 做得到 0\.95 = 0\.285/.test(r.log) && /成功：6 步/.test(r.last), r.last.slice(0, 60));
    await w.click('重来'); await w.click('只听语言模型'); r = await run(); ok('saycan, language model only: starts with "pick up the sponge", 3 of 5 steps fail, says done, island still wet', /选它觉得最有用的「拿起海绵」（0\.36）/.test(r.log) && /5 步里有 3 步失败/.test(r.last) && /岛台还是湿的/.test(r.last), r.last.slice(0, 70));
    await w.click('重来'); await w.click('只听语言模型'); await w.click('海绵被拿走了'); r = await run(); ok('saycan, sponge gone: sponge pushed down to 0.02, the cloth wins with 0.18 × 0.90 = 0.162, clean after 5 steps', /只有 0\.02 做得到/.test(r.log) && /0\.18 × 做得到 0\.90 = 0\.16/.test(r.log) && /成功：5 步，用抹布/.test(r.last), r.last.slice(0, 70));
    await w.click('重来'); await w.click('海绵被拿走了'); }

  // ---- step 12: planner against learned policy (a designed toy)
  { const w = W('policy'); await w.show(); const t = (await p.evaluate(() => document.getElementById('policy').innerText)).replace(/\s+/g, ' ');
    ok('policy table: planner ✓✓✓✗✓, policy ✓✗✗✓✓', /1 和示范时一样 ✓ 成功 ✓ 成功 2 杯子 A 往左挪了 15 cm ✓ 成功 ✗ 抓空 3 中间多了一瓶酱油 ✓ 绕开了 ✗ 碰倒了酱油 4 杯子贴着墙，要先拖出来 ✗ 找不到抓法 ✓ 先拖出来 5 有两种拿法 ✓ 总选左边 ✓ 抽到右边/.test(t), t.slice(20, 90));
    await w.click('✗ 找不到抓法', 400); let m = await w.met(); ok('policy, row 4, planner: 7 grasp poses all hit the wall', /试了 7 个抓取位姿，都碰墙/.test(m), m.slice(0, 60));
    await w.click('✗ 抓空', 400); m = await w.met(); ok('policy, row 2, policy: closes its hand 9 cm beside the cup', /在 A 旁边 9 cm 合上了手/.test(m), m.slice(-50));
    await w.click('✗ 碰倒了酱油', 400); m = await w.met(); ok('policy, row 3, policy: never saw a bottle, knocks it over', /示范里从来没有瓶子/.test(m) && /碰倒了/.test(m), m.slice(-60)); }

  // ---- step 13: who catches which failure
  { const w = W('ladder'); await w.show();
    const run = async (...clicks) => { for (const c of clicks) await w.click(c, 300); for (let i = 0; i < 12; i++) await w.click('下一步', 120); const m = await w.met(); return { who: (m.match(/谁接住了 (\d)/) || [])[1], t: (m.match(/用了多久（示意） ≈ ([\d.]+ m?s)/) || [])[1], m }; };
    let r = await run('有人把手伸到手臂前'); ok('ladder, a hand: layer 1, about 2 ms', r.who === '1' && r.t === '2 ms', r.m.slice(0, 50));
    r = await run('一把椅子挡在过道'); ok('ladder, a chair: layer 4, about 1.3 s', r.who === '4' && r.t === '1.3 s', r.m.slice(0, 50));
    r = await run('第一次抓空'); ok('ladder, a missed grasp: layer 6, about 6.5 s', r.who === '6' && r.t === '6.5 s', r.m.slice(0, 50));
    r = await run('杯子 A 不见了'); ok('ladder, cup gone: layer 8, about 34 s', r.who === '8' && r.t === '34 s', r.m.slice(0, 50));
    r = await run('地图上的位置跳了'); ok('ladder, localisation jumped: layer 8, about 29 s', r.who === '8' && r.t === '29 s', r.m.slice(0, 50));
    r = await run('门关了'); ok('ladder, a door shut: layer 4, about 1.0 s', r.who === '4' && r.t === '1.0 s', r.m.slice(0, 50));
    r = await run('门关了', '没有别的路'); ok('ladder, a door shut and no other way: layer 8, about 20 s, after 6 rounds of recovery', r.who === '8' && r.t === '20 s' && /轮了 6 轮/.test(await w.status()), r.m.slice(0, 50));
    await w.click('没有别的路'); }

  // ---- step 14: the method map
  { const w = W('landscape'); await w.show(); const st = await w.status(); const t = (await p.evaluate(() => document.getElementById('landscape').innerText)).replace(/\s+/g, ' ');
    ok('map: 29 methods, 10 task, 13 motion, 6 reactive and skills', /全部 29 种方法：任务层 10 种，运动规划 13 种，反应和技能 6 种/.test(st), st.slice(0, 40));
    const cells = t.split('反应和技能').pop(); const grid = t.split('ROS 2 Humble 里')[0]; const stars = (grid.match(/★/g) || []);
    ok('map: five methods are starred (in use on the kitchen robot)', ['行为树★', 'Dijkstra★', 'RRT-Connect★', 'TOTG★', 'DWB★'].every(x => grid.includes(x)) && stars.length === 5, stars.length);
    ok('map, motion row: graph search, sampling and optimisation hold four each; only Diffuser is learned', /Dijkstra★ A\* Hybrid A\* Smac/.test(t) && /PRM RRT RRT-Connect★ RRT\*/.test(t) && /CHOMP TrajOpt TOTG★ Ruckig/.test(t) && /Diffuser/.test(t), cells.slice(0, 60)); }

  // ---- step 15: the time budget
  { const w = W('build'); await w.show();
    const rd = async () => { const m = await w.met(); return { T: num(m, R('总用时 N s')), drive: num(m, R('走路 N s')), look: num(m, /看 ([\d.]+) s/), arm: num(m, R('手臂 N s')), wait: num(m, R('等和恢复 N s')), p: num(m, R('抓成功的概率 N')), spill: /可是洒了/.test(m), m }; };
    let r = await rd(); const st = await w.status(); ok('budget, default: 52.8 s = driving 37.3 + looking 4.0 + arm 11.5; planning 0.1 s and 0.5 s', near(r.T, 52.8) && near(r.drive, 37.3) && near(r.look, 4.0) && near(r.arm, 11.5) && /NavFn 0\.1 s，规划手臂 0\.5 s/.test(st), [r.T, r.drive, r.look, r.arm].join(' '));
    await w.click('再看一眼'); r = await rd(); ok('budget, no second look: 49.8 s, success 0.889 instead of 0.974', near(r.T, 49.8) && near(r.p, 0.889), [r.T, r.p].join(' '));
    await w.click('再看一眼'); await w.click('第一次抓空'); r = await rd(); ok('budget, first grasp misses: 59.3 s (6.5 s of retry)', near(r.T, 59.3) && near(r.wait, 6.5), [r.T, r.wait].join(' '));
    await w.click('第一次抓空'); await w.click('有人挡路'); r = await rd(); ok('budget, someone in the way: 55.8 s (3.0 s of waiting)', near(r.T, 55.8) && near(r.wait, 3.0), [r.T, r.wait].join(' '));
    await w.click('有人挡路'); await w.click('用 Nav2 默认加速度'); r = await rd(); ok('budget, Nav2 default acceleration: 52.3 s (0.5 s faster) but it spills', near(r.T, 52.3) && r.spill, [r.T, r.spill].join(' '));
    await w.click('用 Nav2 默认加速度'); }

  ok('no page errors', perr.length === 0, perr.join(' | ').slice(0, 200));
  console.log(log.join('\n')); console.log('\n' + (n - bad) + ' / ' + n + ' checks pass' + (bad ? '   <<< ' + bad + ' FAILED' : ''));
  await b.close(); process.exit(bad ? 1 : 0);
})();
