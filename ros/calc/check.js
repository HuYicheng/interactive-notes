// Check the numbers quoted in the "你会看到 / What you will see" lines and figure captions of "Robot Software and ROS"
// (ros/index.html) against the page itself. It opens the page in a headless browser, operates each interactive the
// way a reader would (following the "先玩 / Try it" prompt literally), and compares the readouts with the numbers the
// text quotes. A few lines of arithmetic that the text does itself are checked at the end.
//   usage: node check.js /absolute/path/to/ros/index.html      (takes about 4 minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/ros/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(600);
  let n = 0, bad = 0; const log = [];
  const ok = (name, cond, got) => { n++; if (!cond) bad++; log.push((cond ? 'ok   ' : 'FAIL ') + name + (got !== undefined && !cond ? '   [' + got + ']' : '')); };
  const norm = s => s.replace(/[\u2060\u200b]/g, '').replace(/\s+/g, ' ').replace(/\u2212/g, '-').trim();
  const W = id => ({
    show: async () => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(600); },
    // click a control by its label; n picks the n-th control with exactly that label (for two columns of identical buttons)
    click: async (label, wait, nth) => { const r = await p.evaluate(([i, l, nth]) => { const nm = s => s.replace(/\s+/g, ' ').trim();
        const els = [...document.getElementById(i).querySelectorAll('button,[role=button]')].filter(e => e.getClientRects().length > 0);
        let e; if (nth !== null) e = els.filter(x => nm(x.innerText) === l)[nth];
        else e = els.find(x => nm(x.innerText) === l) || els.find(x => nm(x.innerText).startsWith(l)) || els.find(x => nm(x.innerText).includes(l));
        if (!e) return 'no control "' + l + '"'; e.click(); return 'ok' }, [id, label, nth === undefined ? null : nth]);
      if (r !== 'ok') { bad++; log.push('FAIL ' + id + ': ' + r); } await p.waitForTimeout(wait || 250); },
    set: async (inp, v, wait) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(wait || 250); },
    sel: async (selId, label, wait) => { await p.evaluate(([i, l]) => { const s = document.getElementById(i); const o = [...s.options].find(o => o.textContent.trim().startsWith(l)); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); s.dispatchEvent(new Event('input', { bubbles: true })) }, [selId, label]); await p.waitForTimeout(wait || 400); },
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .met')].map(m => m.innerText).join(' ## '), id).then(norm),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    text: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll(s ? '#' + i + ' ' + s : '#' + i)].filter(e => e.getClientRects().length > 0).map(m => m.innerText).join(' ## '), [id, sel || '']).then(norm),
    // true while the widget is not animating: its play button shows "▶ …" again
    idle: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll('#' + i + ' ' + (s || '') + ' button')].some(e => e.getClientRects().length > 0 && /^▶/.test(e.innerText.trim())), [id, sel || '']),
    // scroll an element of the widget to the middle of the viewport and return its box (repeated: widgets above are laid out lazily)
    view: async (sel) => { let r; for (let k = 0; k < 8; k++) { r = await p.evaluate(([i, s]) => { const e = document.querySelector('#' + i + ' ' + s); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, [id, sel]); await p.waitForTimeout(350);
        const r2 = await p.evaluate(([i, s]) => { const q = document.querySelector('#' + i + ' ' + s).getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, [id, sel]); if (Math.abs(r2.y - r.y) < 1 && r2.y > 0 && r2.y + r2.h < 900) return r2; r = r2; } return r; },
  });
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const waitIdle = async (w, maxS, sel) => { await p.waitForTimeout(700); for (let k = 0; k < (maxS || 40) * 4; k++) { if (await w.idle(sel)) return true; await p.waitForTimeout(250); } return false; };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  // ---- step 0: the robot's one second
  { const w = W('robot'); await w.show(); let st = await w.status(), m = await w.met();
    ok('robot: 11 streams, 2,490 messages, about 141.4 MB a second; camera 138.2, FCI 2.74, lidar 0.35, other 6 about 0.08 MB', has(st, '11 路消息', '2,490 条', '约 141.4 MB', '相机就占 138.2 MB', 'FCI 约 2.74 MB', '雷达 0.35 MB', '其余 6 路加起来约 0.08 MB'), st.slice(0, 120));
    ok('robot: the camera is 97.7 % of the data', near(138.2 / 141.4 * 100, 97.7, 0.05));
    ok('robot: 27 programs in the readout', has(m, '程序 27'), m);
    await w.click('3 频率', 500); st = await w.status();
    ok('robot step 3: on the 100 ms ruler the arm makes 100 exchanges, each image stream 3 frames; fastest/slowest = 100×', has(st, '尺子是 100 ms', 'FCI 每 1 ms 一来一回：100 个刻度', '彩色图、深度图各 30 Hz：各 3 个', '差 100 倍'), st.slice(0, 120));
    ok('robot: 33 exchanges between two camera frames (1000 Hz ÷ 30 Hz)', Math.floor(1000 / 30) === 33);
    await w.click('1/100', 300);
    // click over the canvas until the card describes the lidar and its cable
    const r = await w.view('#robot-c'); let dev = '', wire = '';
    for (let fy = 0.30; fy <= 0.98 && !(dev && wire); fy += 0.02) for (let fx = 0.30; fx <= 0.995 && !(dev && wire); fx += 0.015) {
      await p.mouse.click(r.x + fx * r.w, r.y + fy * r.h); const c = await w.text('#robot-cd');
      if (!dev && has(c, 'UST-10LX', 'urg_node', '/scan')) dev = c; if (!wire && has(c, '100BASE-TX', /雷达每秒 0\.35 MB/)) wire = c; }
    ok('robot: the lidar feeds urg_node on the Thor, which publishes /scan', !!dev, 'card not found');
    ok('robot: the lidar cable is 100BASE-TX and the lidar uses about 3 % of it', has(wire, '只占这根线约 3%'), wire.slice(0, 120));
    await w.click('5 程序', 500); st = await w.status();
    ok('robot step 5: 27 programs = Thor 23 + RT PC 2 + MCU 1 + workstation 1', has(st, '一共 27 个程序，Thor 上就有 23 个，实时电脑上 2 个，单片机和工作站各 1 个'), st.slice(0, 80));
    const names = await p.evaluate(() => { const d = document.getElementById('robot-d'); if (d) d.open = true; return d ? d.innerText : ''; });
    ok('robot: its list of 27 names includes slam_toolbox and rmw_zenohd, but no train.py and no Zenoh bridge', has(names, 'slam_toolbox', 'rmw_zenohd') && !/train\.py|zenoh-bridge/.test(names), names.slice(0, 80)); }

  // ---- step 1: a message on a bus
  { const w = W('bus'); await w.show(); await w.click('CAN（经典）'); await w.click('7 关节指令'); let m = await w.met(), st = await w.status();
    ok('bus: classic CAN + 7-joint command: 7 + 7 frames, 151.2 % busy, does not fit', has(m, '帧数（每周期） 7 + 7', '线忙 151.2%', '结论 放不下'), m);
    const all = await w.text();
    ok('bus: 14 × 108 bit = 1,512 bit = 1.512 ms on 1 Mbit/s', has(all, /14 × 108 (bit|µs)/, /1[,.]512/) && 14 * 108 === 1512, all.slice(0, 80));
    await w.click('千兆以太网'); await w.click('彩色 + 深度'); m = await w.met(); const a2 = await w.text();
    ok('bus: Gigabit Ethernet + colour + depth: 3,132 frames per 33.3 ms, busy 38.5 ms = 115.6 %, does not fit', has(a2, '3,132', /38\.5\d? ms/, '115.6%') && has(m, '结论 放不下'), m);
    await w.click('一帧彩色图'); m = await w.met(); const a3 = await w.text();
    ok('bus: colour only: 1,879 frames, 23.11 ms, 69.3 %, fits', has(a3, '1,879', '23.11 ms', '69.3%') && has(m, '结论 放得下'), m);
    await w.click('百兆以太网'); await w.click('雷达一圈'); m = await w.met(); const a4 = await w.text();
    ok('bus: 100BASE-TX + one lidar scan: 8,648 B in 6 frames, 0.72 ms of every 25 ms = 2.89 %', has(a4, '8,648', /0\.72\d? ms/, '2.89%') && Math.ceil(8648 / 1472) === 6, m); }

  // ---- step 2: handing a message to another process
  { const w = W('ipc'); await w.show(); let m = await w.met(); const a = await w.text();
    ok('ipc: pipe + one image: 2 copies, about 86 wake-ups, median round trip 2,069 µs', has(m, /拷贝次数 \d \/ 2/, /叫醒 \d+ \/ ≈ 86/, '2,069 µs'), m);
    ok('ipc: the 64 KiB pipe needs 43 rounds for 2,764,800 bytes', has(a, '43 轮', '64 KiB') && Math.ceil(2764800 / 65536) === 43, a.slice(0, 80));
    const METH = ['管道', 'Unix 套接字', 'TCP 回环', '共享内存 拷进去', '共享内存 原地交出'];
    const med = async () => { const out = []; for (const k of METH) { await w.click(k, 350); const mm = (await w.met()).match(/往返中位数（我们测的） ([\d,.]+) µs/); out.push(mm ? parseFloat(mm[1].replace(/,/g, '')) : NaN); } return out; };
    const big = await med();
    ok('ipc (one image): pipe 2,069, Unix socket 526, TCP loopback 1,085, shm copy-in 501, shm in place 107 µs', big.join() === '2069,526,1085,501,107', big.join());
    ok('ipc: slowest ÷ fastest is about 19', Math.round(2069 / 107) === 19);
    await w.click('64 B', 500); const small = await med();
    ok('ipc (64 B): all five between 21.7 and 31.1 µs', Math.min(...small) === 21.7 && Math.max(...small) === 31.1, small.join()); }

  // ---- step 3: pairwise or a shared bus
  { const w = W('wires'); await w.show(); let m = await w.met();
    ok('wires: N = 8: 28 connections pairwise, 7 programs to change; shared bus 8 connections, 1 change', has(m, /连接数 28/, '8×7/2', /要改的程序 7/, '另一种接法 8 根，改 1 个'), m);
    await w.click('换掉一个相机', 500); m = await w.met(); ok('wires: after "swap the camera" still 7 against 1', has(m, /要改的程序 7/), m);
    await w.click('MIT 2007', 600); m = await w.met();
    ok('wires: MIT 2007, 70 modules: 2,415 connections and 69 programs pairwise; 70 and 1 on a shared bus', has(m, '连接数 2,415', /要改的程序 69/, '另一种接法 70 根，改 1 个') && 70 * 69 / 2 === 2415, m); }

  // ---- step 4: ROS 1
  { const w = W('ros1'); await w.show(); let never = true; const sts = [];
    for (let k = 1; k <= 7; k++) { await w.click('下一步', 500); sts.push(await w.status()); if (!has(await w.met(), '图像经过主节点吗 从不')) never = false; }
    ok('ros1 steps 1–5: master on port 11311, register publisher, register subscriber, agree a port, TCP + md5', has(sts[0], '11311') && has(sts[1], '/camera') && has(sts[2], '/detector') && has(sts[4], 'TCP', 'md5sum'), sts[0].slice(0, 60));
    ok('ros1 step 6: 4 + 2,764,867 bytes per message, 30 a second, about 82.9 MB/s', has(sts[5], '4 字节长度 + 2,764,867 字节', '每秒 30 条', '约 82.9 MB/s'), sts[5].slice(0, 80));
    let m = await w.met();
    ok('ros1 step 7: 2 TCP connections, /camera sends 2 × 82.9 = 165.9 MB/s', has(m, '数据连接（TCPROS） 2', '2 × 82.9 = 165.9 MB/s') && near(2 * 82.9, 165.9, 0.11), m);
    ok('ros1: "do images pass through the master?" says never at every step', never);
    await w.click('关掉主节点', 800); m = await w.met(); let st = await w.status();
    ok('ros1: master killed: the /camera → /detector stream keeps flowing, 1 connection instead of 2', has(m, '主节点 已停止', '数据连接（TCPROS） 1', '82.9 MB/s') && has(st, '已经连上的 /camera → /detector 照常传图像'), m);
    await w.click('关掉主节点', 600);
    await w.click('加一行注释', 500); let res = await w.text('#ros1-res');
    ok('ros1: a comment leaves the fingerprint at 0600…4743 and the connection is accepted', has(res, 'md5 = 060021388200f6f0f447d0fcd9c64743', '✓'), res.slice(0, 80));
    await w.click('加一个字段', 500); res = await w.text('#ros1-res');
    ok('ros1: one more field gives 5be3…6790 and /camera refuses /detector', has(res, 'md5 = 5be3ae8a474191e2040e465b6fac6790', '✗', '/camera 会拒绝'), res.slice(0, 80)); }
  // ---- step 5: ROS 2 on DDS: discovery and QoS
  { const w = W('dds'); await w.show(); const sts = [], ms = []; let noMaster = true;
    for (let k = 1; k <= 5; k++) { await w.click('下一步', 500); sts.push(await w.status()); const mk = (await w.met()).split(' ## ')[0]; ms.push(mk); if (!has(mk, '主节点 没有')) noMaster = false; }
    let m = ms[4];
    ok('dds discovery: 4 participants multicast to 239.255.0.1:7400; then N(N−1) = 12 endpoint exchanges; then 2 matched connections', has(sts[0], '4 个参与者各往 239.255.0.1:7400 组播') && has(sts[1], '共 N(N-1) = 12 份') && has(ms[2], '已匹配的连接 2'), ms[2]);
    ok('dds discovery: rviz2 joins: 5 participants, 4 connections; "master: none" at every step', has(m, '参与者（进程） 5', '已匹配的连接 4', '主节点 没有') && has(sts[4], 'rviz2') && noMaster, m);
    await w.click('② QoS', 500);
    await w.click('传感器数据', 400, 0); m = await w.met();
    ok('dds QoS: sensor-data publisher + default subscriber: incompatible, 0 of 300 arrive', has(m, /兼容 否/, '收到 0 / 300'), m.slice(-160));
    await w.click('默认', 400, 0); await w.set('dds-l', 20, 500); m = await w.met(); let st = await w.status();
    ok('dds QoS: both default, loss 20 %: 300 / 300, 63 resent, mean 24.8 ms, longest 156 ms', has(m, '收到 300 / 300', /重传 63/, '24.8 ms') && has(m + st, '156 ms'), m.slice(-160));
    await w.click('传感器数据', 400, 0); await w.click('传感器数据', 400, 1); m = await w.met();
    ok('dds QoS: both sensor data, loss 20 %: 249 received, 51 lost, nothing resent, mean 8.0 ms', has(m, '收到 249 / 300', /丢[了失]? ?51/, '8.0 ms'), m.slice(-160)); }

  // ---- step 6: callbacks, executors, threads
  { const w = W('exec'); await w.show(); let m = await w.met();
    ok('exec single-threaded: U = 0.37, control timer up to 39.5 ms late, 320 / 1000 deadlines missed', has(m, '0.37', '39.5 ms', '320 / 1000', '线程数 1'), m);
    ok('exec: the three callbacks use 0.05 + 0.24 + 0.08 = 0.37 of the thread', near(1000 * 0.05e-3 + 30 * 8e-3 + 2 * 40e-3, 0.37, 1e-9));
    await w.set('exec-cp', 100, 500); m = await w.met(); ok('exec: planner callback 100 ms: up to 99.5 ms late, 440 / 1000', has(m, '99.5 ms', '440 / 1000'), m);
    await w.click('多线程执行器 + 一个互斥回调组', 500); m = await w.met(); ok('exec: multi-threaded, one mutually exclusive group: 2 threads, still 99.5 ms and 440', has(m, '99.5 ms', '440 / 1000', '线程数 2'), m);
    await w.click('多线程 + 分开的回调组', 500); m = await w.met(); ok('exec: separate callback groups: 0 ms late, 0 / 1000', has(m, '最大迟到 0 ms', '截止时间 0 / 1000'), m);
    await w.click('用 Python 写（rclpy）', 500); m = await w.met(); const st = await w.status();
    ok('exec: + written in Python: up to 21.3 ms late, 465 / 1000; one GC pause 21.6 ms', has(m, '21.3 ms', '465 / 1000') && has(st, '垃圾回收那 21.6 ms', 'GIL'), m); }

  // ---- step 7: which layer is ROS
  { const w = W('stack'); await w.show(); let m = await w.met();
    ok('stack: 11 layers: Linux owns 2, third-party middleware 1, ROS 5', has(m, '层数 11', 'Linux（Ubuntu）管的 2 层', '第三方 1 层', 'ROS 管的 5 层'), m);
    await w.click('Cyclone DDS', 400); let st = await w.status(); ok('stack: Cyclone DDS: middleware layer, from Eclipse, not used on this robot', has(st, '中间件层', 'Eclipse', '厨房机器人没用'), st);
    await w.click('rclcpp', 400); st = await w.status(); m = await w.met(); ok('stack: rclcpp: client-library layer, 100 % C++ (counted)', has(st, '客户端库层') && has(m, 'C++ 100%（我们数的）'), m);
    const sts = []; for (let k = 1; k <= 9; k++) { await w.click('下一步', 450); sts.push(await w.status()); }
    ok('stack: "pick up the cup" takes 8 steps; ROS communication only in ①, ③, ④', has(sts[0], '第 ① 步') && has(sts[7], '第 ⑧ 步') && has(sts[8], '8 步里，ROS 的通信只出现在 ①、③、④'), sts[8].slice(0, 80));
    ok('stack: steps ③ and ④ cross the kernel (UDP between the computers)', has(sts[2], 'UDPv4', 'Linux 网络栈') && has(sts[3], '包从网卡进内核'), sts[2].slice(0, 80));
    ok('stack: step ⑤ repeats every 1 ms with no topics and no DDS', has(sts[4], '每 1 ms 一圈', '这一圈里没有话题、没有 DDS'), sts[4].slice(0, 80));
    ok('stack: steps ⑥ and ⑦: libfranka sends UDP packets through the Linux network stack to the control cabinet', has(sts[5], 'libfranka', 'UDP 包', 'Linux 网络栈') && has(sts[6], '网卡'), sts[5].slice(0, 80)); }

  // ---- step 8: the 1 ms loop
  { const w = W('rtloop'); await w.show();
    await w.click('C 有负载', 500); let m = await w.met();
    ok('rtloop C under load: median 69.4 µs, p99 138.0 µs; 315 commands dropped a minute; longest run 7', has(m, '中位数 69.4 µs', 'p99 138.0 µs', '每分钟被丢的指令 315', '最长连续被丢 7'), m);
    await w.click('C 有负载 + SCHED_FIFO', 500); m = await w.met();
    ok('rtloop C under load + SCHED_FIFO: median 18.3 µs, p99 50.1 µs; limit 700 µs; 90 a minute; longest run 8', has(m, '中位数 18.3 µs', 'p99 50.1 µs', '迟醒上限 700 µs', '每分钟被丢的指令 90', '最长连续被丢 8'), m);
    ok('rtloop: p99 improves about 2.8 times (138.0 ÷ 50.1)', near(138.0 / 50.1, 2.8, 0.05));
    await w.click('C 空闲', 500); m = await w.met(); let st = await w.status();
    ok('rtloop C idle: longest run 24 → the robot would stop; worst wake-up 23,550 µs: the host paused the VM for 23.5 ms', has(m, '最长连续被丢 24', '有：机器人会停下', '最大 23,550 µs') && has(st, '主机把整台云虚拟机停了 23.5 ms'), m);
    await w.click('最慢的那一刻', 500); await w.click('▶ 播放', 300); await waitIdle(w, 90); st = await w.status();
    ok('rtloop: playing the slowest moment ends with the robot stopped after 20 drops in a row', has(st, /连续被丢 2\d 个|连丢 20|停/), st.slice(0, 160)); }

  // ---- step 9: MoveIt: sampling, shortcutting, timing, executing
  { const w = W('plan'); await w.show(); const sts = []; for (let k = 1; k <= 6; k++) { await w.click('下一步', 300); sts.push(await w.status()); }
    ok('plan: sample 1: the start tree steps 0.15 rad, the goal tree is stopped by the cup; sample 2 adds nothing; 31 checks after sample 6', has(sts[0], '第 1 次采样', '0.15 rad', '撞到杯子') && has(sts[1], '这次什么也没加') && has(sts[5], '到现在一共 31 次碰撞检测'), sts[0].slice(0, 90));
    for (let k = 7; k <= 96; k++) await w.click('下一步', 60); let st = await w.status(), m = await w.met();
    ok('plan (seed 14): the trees connect at sample 96 (41 · 19 nodes) after 294 collision checks; 18 waypoints, 2.48 rad', has(st, '第 96 次采样时两棵树连上了', '18 个路点', '2.48 rad', '294 次碰撞检测') && has(m, '41 · 19'), m);
    await w.click('▶ 播放', 300); await waitIdle(w, 120); m = await w.met();
    ok('plan (seed 14) to the end: 511 checks, 18 → 3 waypoints, 2.48 → 1.90 rad, 2.75 s, 2,752 controller points', has(m, '随机种子 14', '碰撞检测次数 511', '路点 18 → 3', '2.48 → 1.90 rad', '轨迹时长 2.75 s', '2,752'), m);
    ok('plan: shortcutting cost 511 − 294 = 217 checks', 511 - 294 === 217);
    await w.click('换一个随机种子', 500); await w.click('▶ 播放', 300); await waitIdle(w, 120); m = await w.met();
    ok('plan: the next seed (6): 20 → 3 waypoints, 2.79 → 2.15 rad, 2.87 s', has(m, '随机种子 6', '路点 20 → 3', '2.79 → 2.15 rad', '轨迹时长 2.87 s'), m); }

  // ---- step 10: tf2 (five edges; time stamps; odom drifts, map jumps)
  { const w = W('tf'); await w.show(); const sts = []; for (let k = 1; k <= 5; k++) { await w.click('下一步', 500); sts.push((await w.status()).split(' ## ')[0]); }
    ok('tf: the cup through five edges: (0.80, −0.05, −0.10) → (0.80, −0.03, −0.10) → (0.79, −0.03, 0.95) → (1.77, 2.42, 0.95) → (2.32, 3.20, 0.95) in map', has(sts[0], '(0.80, -0.05, -0.10)') && has(sts[1], '1.5 cm', '(0.80, -0.03, -0.10)') && has(sts[2], '30°', '(0.79, -0.03, 0.95)') && has(sts[3], '(1.77, 2.42, 0.95)') && has(sts[4], '(2.32, 3.20, 0.95)', '重合'), sts.map(x => x.slice(0, 50)).join(' // '));
    await w.set('tf-w', 1, 400); let m = (await w.met()).split(' ## ')[0];
    ok('tf: 1 rad/s, looked up at the image stamp: still (2.32, 3.20, 0.95)', has(m, '杯子在 map 里 (2.32, 3.20, 0.95) m'), m);
    await w.click('用「现在」查', 500); let st = (await w.status()).split(' ## ')[0];
    ok('tf: looked up at "now": newest sample 8 ms old, image 80 ms old, 72 ms apart, 4.13°, 0.79 m from the axis → 5.7 cm off', has(st, '偏了 5.7 cm', '8 ms 前', '80 ms 前', '差 72 ms', '4.13°', '0.79 m'), st.slice(0, 160));
    await w.set('tf-w', 0.5, 400); st = (await w.status()).split(' ## ')[0]; ok('tf: at 0.5 rad/s the same mistake costs 2.9 cm', has(st, '偏了 2.9 cm'), st.slice(0, 80));
    const play2 = async () => { await w.view('#tf-d'); await p.evaluate(() => document.querySelector('#tf-db button').click()); await waitIdle(w, 90, '#tf-db'); return (await w.met()).split(' ## ')[1]; };
    m = await play2();
    ok('tf: odometry alone: 22.5 m driven, odom drift 54.2 cm, error in map 54.2 cm, map→odom never rewritten', has(m, '走过的路 22.5 m', 'odom 的漂移 54.2 cm', 'map 里的误差 54.2 cm', 'map→odom 跳了 0 次'), m);
    await w.click('AMCL 校正', 400); await p.evaluate(() => document.querySelectorAll('#tf-db button')[1].click()); await p.waitForTimeout(300); m = await play2();
    ok('tf: with AMCL: odom still drifts to 54.2 cm, error in map 2.4 cm, map→odom rewritten 149 times', has(m, '走过的路 22.5 m', 'odom 的漂移 54.2 cm', 'map 里的误差 2.4 cm', 'map→odom 跳了 149 次'), m); }

  // ---- step 11: distributions
  { const w = W('distro'); await w.show(); let st = await w.status(), dl = await w.text('#distro-dl');
    ok('distro Humble → Jazzy: 8 of 9 things change; 396 of 2,401 packages (16.5 %) missing; the robot loses franka_ros2 and gazebo_ros_pkgs', has(st, 'Humble → Jazzy：9 样东西里变了 8 样', '2,401 个包里 396 个（16.5%）', '丢了 2 个（franka_ros2、gazebo_ros_pkgs）'), st.slice(0, 160));
    ok('distro: Ubuntu 22.04 → 24.04, Python 3.10.4 → 3.12.3, default middleware unchanged, ours 26 / 27 → 24 / 27', has(dl, /22\.04 Jammy ?→ ?24\.04 Noble/, /3\.10\.4 ?→ ?3\.12\.3/, 'rmw_fastrtps_cpp 不变', /26 \/ 27 ?→ ?24 \/ 27/), dl.slice(0, 200));
    await w.sel('distro-to', 'Lyrical'); st = await w.status(); dl = await w.text('#distro-dl');
    ok('distro Humble → Lyrical: 8 of 9; 844 packages (35.2 %) missing; Qt 5 → 6, C++20; the same 2 lost', has(st, 'Humble → Lyrical：9 样东西里变了 8 样', '844 个（35.2%）', '丢了 2 个（franka_ros2、gazebo_ros_pkgs）') && has(dl, '5 → 6', 'C++20'), st.slice(0, 160));
    const P = async k => { await w.set('distro-k', k, 350); return await w.text('#distro-pf'); };
    let a = [await P(5), await P(10), await P(20), await P(40)];
    ok('distro Humble → Lyrical: p = 1,557 / 2,401 = 0.648; P = 11 %, 1.3 %, 0.017 %, 0.000003 % for k = 5, 10, 20, 40', has(a[0], 'p = 1,557 / 2,401 = 0.648', '= 11%') && has(a[1], '= 1.3%') && has(a[2], '= 0.017%') && has(a[3], '= 0.000003%'), a.map(x => x.slice(0, 50)).join(' // '));
    await w.sel('distro-to', 'Jazzy'); a = [await P(5), await P(10), await P(20)];
    ok('distro Humble → Jazzy: p = 2,005 / 2,401 = 0.835; P = 41 %, 16 %, 2.7 % for k = 5, 10, 20', has(a[0], 'p = 2,005 / 2,401 = 0.835', '= 41%') && has(a[1], '= 16%') && has(a[2], '= 2.7%'), a.map(x => x.slice(0, 50)).join(' // ')); }

  // ---- step 12: C++ and Python
  { const w = W('lang'); await w.show(); let m = await w.met(), st = await w.status();
    ok('lang: 30 Hz image → Python list: 18.7 ms a frame, 561 ms a second, 56 % of a core, 84× C++ (224 µs, 0.67 %)', has(m, '18.7 ms', '占一个核 s 56%', '每秒忙 561 ms', '84×') && has(st, '224 µs（0.67%）'), m);
    ok('lang: one GC with 100,000 live objects pauses 21.6 ms = 21–22 deadlines at 1 kHz; the Franka stops at 20', has(m, '一次垃圾回收 21.6 ms', '21–22 个', '连丢 ≥ 20 个包：停下'), m);
    await w.click('30 Hz 图像转成 numpy 视图', 400); m = await w.met(); ok('lang: numpy view: 0.46 µs, 0.0014 % of a core', has(m, '0.46 µs', '0.0014%'), m);
    await w.click('1 kHz 关节状态', 400); m = await w.met(); st = await w.status();
    ok('lang: 1 kHz joint states: Python 2,523 ns (257× C++’s 9.8 ns), still only 0.25 % of a core', has(m, '2,523 ns', '0.25%', '257×') && has(st, '9.8 ns'), m); }

  // ---- step 13: the alternatives
  { const w = W('landscape'); await w.show();
    const cnt = await p.evaluate(() => { const t = document.getElementById('landscape-t'); const rows = [...t.querySelectorAll('tr')]; const head = [...rows[0].children].slice(1).map(c => c.innerText.trim()); const res = head.map(h => ({ h, full: 0, part: 0, none: 0 }));
      rows.slice(1).forEach(r => [...r.children].slice(1).forEach((c, i) => { const a = (c.getAttribute('aria-label') || c.title || c.innerText || '').trim(); if (/· 有$/.test(a)) res[i].full++; else if (/部分$/.test(a)) res[i].part++; else if (/没有$/.test(a)) res[i].none++; })); return res; });
    await w.click('对比', 500); let st = await w.status();
    ok('landscape ROS 2 vs LeRobot: 6 rows only ROS 2 covers fully, 1 row only LeRobot, 1 row neither', has(st, 'A ROS 2 对 B LeRobot', '只有 A 全有的：通信传输、发现、消息格式和代码生成、构建和打包、录制回放和可视化、算法库（规划、导航）', '只有 B 全有的：学习和数据集', '两个都没有的：认证和功能安全'), st);
    await w.click('硬实时控制', 500); st = await w.status();
    ok('landscape hard real-time row: full = vendor controllers, PLC, OROCOS, micro-ROS, AUTOSAR; ROS 2 only partial', has(st, '全有的是厂家控制器、PLC、OROCOS、micro-ROS、AUTOSAR', /部分的是[^；。]*ROS 2/), st.slice(-160));
    const r2 = cnt.find(c => c.h === 'ROS 2'), mx = Math.max(...cnt.map(c => c.full));
    ok('landscape: 18 approaches × 10 rows; ROS 2 fills most: 7 full, 2 partial, 1 none; nobody fills all 10', cnt.length === 18 && cnt.every(c => c.full + c.part + c.none === 10) && r2 && r2.full === 7 && r2.part === 2 && r2.none === 1 && mx === 7, JSON.stringify(cnt).slice(0, 200)); }

  // ---- step 14: the whole robot, and breaking it
  { const w = W('arch'); await w.show(); let m = await w.met();
    ok('arch: 28 / 28 programs: MCU 1, RT PC 2, Thor 22, workstation 3', has(m, '还在跑的 28 / 28', '单片机 1/1 · RT PC 2/2 · Thor 22/22 · 工作站 3/3'), m);
    await w.click('Wi-Fi 断了', 600); await w.click('下一步', 600); m = await w.met(); let st = await w.status();
    ok('arch Wi-Fi down: 27 / 28, only rviz2 stops, the 25 programs on the robot carry on', has(m, '还在跑的 27 / 28', '停下的 1 个程序 rviz2') && has(st, '机器人上的 25 个程序照常跑'), m);
    await w.click('下一步', 500); await w.click('下一步', 500); st = await w.status(); ok('arch Wi-Fi back: nothing needs restarting', has(st, '什么都不用重启'), st.slice(0, 80));
    await w.click('实时电脑负载太高', 600); await w.click('下一步', 500); await w.click('下一步', 500); m = await w.met(); st = await w.status();
    ok('arch RT PC overloaded: 20 packets in a row (20 ms): ros2_control_node and the arm stop first; task_manager and move_group wait', has(st, '连续丢了 20 个包（20 ms）') && has(m, '停下的 1 个程序 ros2_control_node；Franka 手臂', '在等：task_manager、move_group'), m);
    await w.click('换一条手臂', 600); await w.click('下一步', 500); m = await w.met();
    ok('arch swap the arm: 4 programs + 1 item to change', has(m, '要改的 4 个程序 + 1 项', 'ros2_control_node、franka_gripper_node、robot_state_publisher、move_group'), m);
    await w.click('下一步', 500); await w.click('下一步', 500); m = await w.met(); st = await w.status();
    ok('arch swap the arm, last step: the policy has to be retrained: 5 programs + 2 items', has(m, '要改的 5 个程序 + 2 项', 'vla_policy') && has(st, 'vla_policy 是用 FR3 的数据训练的'), m); }

  // ---- arithmetic the text and the figure captions do themselves
  ok('sum of the 11 message rates is 2,490 a second', 1000 + 1000 + 30 + 30 + 200 + 40 + 50 + 20 + 100 + 10 + 10 === 2490);
  ok('8 × 7 ÷ 2 = 28', 8 * 7 / 2 === 28);
  ok('4 participants exchange 4 × 3 = 12 endpoint sets; 5 would exchange 20', 4 * 3 === 12 && 5 * 4 === 20);
  ok('budget: 1 ms − 0.10 ms − 0.20 ms leaves 700 µs; 105 and 30 drops in 20 s are 315 and 90 a minute', near(1000 - 100 - 200, 700, 1e-9) && 105 * 3 === 315 && 30 * 3 === 90);
  { const v = 1.0, a = 2.0; const T = d => d >= v * v / a ? d / v + v / a : 2 * Math.sqrt(d / a);
    ok('velocity figure: d = 1.5 rad: 0.5 s up, 1.0 s flat, 0.5 s down, 2.0 s in all', near(v / a, 0.5, 1e-12) && near((1.5 - v * v / a) / v, 1.0, 1e-12) && near(T(1.5), 2.0, 1e-12));
    ok('velocity figure: d = 0.2 rad: 0.63 s in all, peak 0.63 rad/s', near(T(0.2), 0.63, 0.005) && near(a * T(0.2) / 2, 0.63, 0.005)); }
  ok('list figure: 2,764,800 pointers × 8 B ≈ 22 MB; 18.7 ms ÷ 0.46 µs ≈ 40,000; 30 × 18.7 ms = 561 ms', near(2764800 * 8 / 1e6, 22, 0.2) && near(18.7e-3 / 0.46e-6, 40000, 1000) && near(30 * 18.7, 561, 1e-9));
  ok('distributions: 396 / 2,401 = 16.5 %, 844 / 2,401 = 35.2 %, 2,005 / 2,401 = 0.835, 1,557 / 2,401 = 0.648', near(396 / 2401, 0.165, 0.0005) && near(844 / 2401, 0.352, 0.0005) && near(2005 / 2401, 0.835, 0.0005) && near(1557 / 2401, 0.648, 0.0005) && 2401 - 396 === 2005 && 2401 - 844 === 1557);
  { const pc = (q, k) => 100 * Math.pow(q, k);
    ok('P = p^k: 0.835 → 41 %, 16 %, 2.7 % (k = 5, 10, 20); 0.648 → 11 %, 1.3 %, 0.017 %, 0.000003 % (k = 5, 10, 20, 40)', near(pc(2005 / 2401, 5), 41, 0.5) && near(pc(2005 / 2401, 10), 16, 0.5) && near(pc(2005 / 2401, 20), 2.7, 0.05) && near(pc(1557 / 2401, 5), 11, 0.5) && near(pc(1557 / 2401, 10), 1.3, 0.05) && near(pc(1557 / 2401, 20), 0.017, 0.0005) && near(pc(1557 / 2401, 40), 0.000003, 0.0000005)); }
  ok('programs: 27 names − slam_toolbox + the workstation’s Zenoh bridge and train.py = 28 running', 27 - 1 + 2 === 28);

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
