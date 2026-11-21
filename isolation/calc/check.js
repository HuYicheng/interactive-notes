// Check the numbers quoted in the "你会看到 / What you will see" lines and figure captions of "Virtualisation and
// Isolation" (isolation/index.html) against the page itself. It opens the page in a headless browser, operates each
// interactive the way a reader would (following the "先玩 / Try first" prompt literally), and compares the readouts with
// the numbers the text quotes. A few lines of arithmetic that the text does itself are checked at the end.
//   usage: node check.js /absolute/path/to/isolation/index.html      (takes about 3 minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/isolation/index.html'); process.exit(2); }
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
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .met')].map(m => m.innerText).join(' ## '), id).then(norm),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    text: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll(s ? '#' + i + ' ' + s : '#' + i)].filter(e => e.getClientRects().length > 0).map(m => m.innerText).join(' ## '), [id, sel || '']).then(norm),
    texts: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll('#' + i + ' ' + s)].filter(e => e.getClientRects().length > 0).map(m => m.innerText.replace(/\s+/g, ' ').trim()), [id, sel]),
    // wait until the status line has stopped changing (an animation has finished)
    settle: async function () { let last = '', same = 0; for (let k = 0; k < 80; k++) { await p.waitForTimeout(300); const s = await this.status() + (await this.met()); if (s === last) { if (++same >= 5) break; } else { same = 0; last = s; } } },
  });
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const steps = async (w, k, wait) => { for (let i = 0; i < k; i++) await w.click('下一步', wait || 150); };

  // ---- step 0: seven requests on one workstation
  { const w = W('clash'); await w.show(); const m = [], s = [];
    for (let k = 1; k <= 8; k++) { await w.click('下一步', 300); m.push(await w.met()); s.push(await w.status()); }
    ok('clash: 8 frames; A is stuck at "packages" only (it installs in a venv)', has(m[0], '帧 1 / 8', '要求 A', '包（在 venv 里装成了）') && has(s[0], '只动了「包」这一层'), m[0]);
    ok('clash: B is stuck at packages + runtime (it also needs Python 3.8)', has(m[1], '要求 B', '包 + 运行时') && has(s[1], 'Python 3.8'), m[1]);
    ok('clash: C at system libraries and distribution; D another operating system (system libraries + kernel); E at the kernel', has(m[2], '要求 C', '系统库和发行版') && has(m[3], '要求 D', '系统库 + 内核（另一种操作系统）') && has(m[4], '要求 E', '卡在哪一层 内核'), m[2] + ' | ' + m[3] + ' | ' + m[4]);
    ok('clash: F is not a layer: there is no wall, one cat prints the SSH private key', has(m[5], '要求 F', '没有墙（不是哪一层的事）') && has(s[5], 'cat ~/.ssh/id_ed25519 就把私钥打了出来', '没有哪一层出错，是根本没有墙'), s[5]);
    ok('clash: G is stuck lowest: hardware (CPU architecture), plus permissions on the cluster', has(m[6], '要求 G', '硬件（CPU 架构）+ 权限') && has(s[6], 'x86-64 程序到了 Thor（ARM64）上跑不了', '没有 root'), s[6]);
    ok('clash: last frame: seven requests, stuck in six places; A and B in the same place', has(s[7], '七个要求，卡在六处', 'A、B 都在包和运行时') && has(m[7], '帧 8 / 8'), s[7]); }

  // ---- step 1: one command through the layers
  { const w = W('stack'); await w.show(); const m = [], s = [];
    for (let k = 1; k <= 10; k++) { await w.click('下一步', 250); m.push(await w.met()); s.push(await w.status()); }
    const layer = k => (m[k - 1].match(/这一层 (.*?) 名字/) || [])[1] || '';
    ok('stack: steps 1, 3, 4, 5 look things up in user mode (PATH, ld.so.cache, sys.path, RPATH)', !/内核/.test(layer(1) + layer(3) + layer(4) + layer(5)) && has(s[0], '按 PATH 的顺序找') && has(s[2], '动态链接器', '/etc/ld.so.cache', 'libc.so.6') && has(s[3], '按 sys.path 的顺序找', 'site-packages') && has(s[4], 'RPATH', 'CUDA 运行时 12.4'), [1, 3, 4, 5].map(layer).join(' | '));
    ok('stack: steps 2, 6, 7, 8, 9 go into the kernel', [2, 6, 7, 8, 9].every(k => /内核/.test(layer(k))), [2, 6, 7, 8, 9].map(layer).join(' | '));
    ok('stack: step 6 is the system call openat, number 257', has(m[5], '257 → openat') && has(s[5], 'openat', '257 号'), m[5]);
    ok('stack: a system call ≈ 123 ns, a function call ≈ 1.6 ns, about 80×', has(s[5], '一次系统调用约 123 ns', '普通函数调用约 1.6 ns', '差约 80 倍'), s[5]);
    ok('stack: step 10: venv swaps sys.path, conda PATH and library paths, containers the mount table, a VM everything below the kernel, dual boot the kernel', has(s[9], 'venv 换 sys.path', 'conda 换 PATH 和库路径', '容器换挂载表', '虚拟机换掉内核以下的整台机器', '双系统换开机时选的内核'), s[9]);
    const t = await w.text(''); ok('stack: step 10: a container can also have its own process-ID, network and hostname tables', has(t, '容器换掉的不止挂载表：进程号、网络、主机名也可以各有一份'), t.slice(0, 200)); }

  // ---- step 2: the page table
  { const w = W('paging'); await w.show();
    await w.click('进程 1', 200); await w.click('0x2abc', 200); await w.click('用户态', 200); await w.settle(); let m = await w.met();
    ok('paging: process 1, 0x2abc: page 2, offset 0xabc → physical page 7 → 0x7abc', has(m, '2 · 0xabc', '7 → 0x7abc', '结果 允许'), m);
    await w.click('进程 2', 200); await w.settle(); m = await w.met();
    ok('paging: process 2, the same 0x2abc → physical page 9 → 0x9abc', has(m, '9 → 0x9abc', '结果 允许'), m);
    await w.click('0xf010', 200); await w.settle(); m = await w.met(); let s = await w.status();
    ok('paging: user mode, 0xf010: the page is present but kernel-only → protection fault → Segmentation fault', has(m, '结果 保护错误') && has(s, 'P = 1', 'U = 0', 'Segmentation fault'), s);
    await w.click('内核态', 200); await w.settle(); m = await w.met();
    ok('paging: kernel mode, 0xf010 → 0x0010, allowed', has(m, '0 → 0x0010', '结果 允许'), m);
    await w.click('▶ 播放', 300); await w.settle(); s = await w.status();
    ok('paging: the same address a second time: the TLB hits, not one page-table read', has(s, '这次快表命中，一次页表都没读'), s);
    await w.click('真实大小', 300); await w.click('▶ 播放', 300); await w.settle(); m = await w.met();
    ok('paging: real size: 0x00007f3a12c45678 → indices 254·232·150·69, offset 0x678, 4 page-table reads + 1 data read', has(m, '0x00007f3a12c45678', '254·232·150·69', '0x678', '4 + 1'), m); }

  // ---- step 3: the map of methods
  { const w = W('spectrum'); await w.show();
    const bt = await w.texts('button'); const i0 = bt.indexOf('分开的机器'), i1 = bt.indexOf('对比');
    ok('spectrum: 25 methods on the map', i1 - i0 === 25, i1 - i0);
    const st = {}; for (const mth of ['venv / uv', 'conda / pixi', '应用容器', '双系统', '完整虚拟机']) { await w.click(mth, 300); st[mth] = await w.status(); }
    ok('spectrum: venv: own copies from "packages" up; the runtime and everything below shared', has(st['venv / uv'], '内核、系统库和运行时三个世界共用一份', '从包往上每个世界各一份'), st['venv / uv']);
    ok('spectrum: conda: own copies from part of the system libraries up', has(st['conda / pixi'], '从系统库和发行版（一部分）往上每个世界各一份'), st['conda / pixi']);
    ok('spectrum: app containers: own copies from system libraries and distribution up, kernel shared', has(st['应用容器'], '固件和内核三个世界共用一份', '从系统库和发行版往上每个世界各一份'), st['应用容器']);
    ok('spectrum: dual boot: own copies from the kernel up, but in turns', has(st['双系统'], '轮流用', '从内核往上每个世界各一份'), st['双系统']);
    ok('spectrum: full VMs: own copies from the (virtual) hardware up', has(st['完整虚拟机'], '从硬件（虚拟出来的）往上每个世界各一份'), st['完整虚拟机']);
    await w.click('应用容器', 300); await w.click('对比', 300); await w.click('gVisor', 300); await w.click('一次读文件', 400); let s = await w.status();
    ok('spectrum: one file read: container 5 steps and 1 boundary; gVisor 7 steps and 2 boundaries, 1 step is a translation', has(s, 'A 应用容器读一次文件走 5 步：跨 1 次边界', 'B gVisor 读一次文件走 7 步：跨 2 次边界', '1 步是翻译'), s);
    await w.click('代价', 400); s = await w.status();
    ok('spectrum: costs: container CPU and memory overhead ≈ 0 (Linpack 290.9 vs 290.8 GFLOPS); gVisor: every system call costs more', has(s, 'CPU 和内存几乎为 0（Linpack 290.9 对 290.8 GFLOPS）', 'B gVisor', '每次系统调用更贵'), s); }

  // ---- step 4: dual boot
  { const w = W('boot'); await w.show();
    const run = async () => { await w.click('重来', 200); const all = []; for (let k = 0; k < 12; k++) { await w.click('下一步', 150); const s = await w.status(); if (s === all[all.length - 1]) break; all.push(s); } return all; };
    await w.click('选 Ubuntu', 200); let a = await run();
    ok('boot: Ubuntu with Secure Boot on: 8 steps', a.length === 8 && has(a[7], '第 8 / 8 步', 'Ubuntu 24.04'), a.length);
    ok('boot: check 1: the firmware checks shim with the Microsoft certificate', has(a[2], '固件先拿 NVRAM 里存的微软证书查 shim 的签名'), a[2]);
    ok('boot: check 2: shim checks GRUB with its own Canonical certificate', has(a[3], '用自带的 Canonical 证书查它的签名', 'GRUB'), a[3]);
    ok('boot: check 3: GRUB asks shim to check the kernel; the initrd is not checked', has(a[5], '请 shim 用 Canonical 的证书查：内核验过签名；initrd 不验'), a[5]);
    ok('boot: three checks on the way; afterwards the kernel checks every module it loads', a.filter(x => /查.{0,12}签名|验过签名/.test(x)).length === 4 && has(a[6], '内核每装一个模块都先查签名'), a.filter(x => /查.{0,12}签名|验过签名/.test(x)).length);
    await w.click('Windows 改了启动顺序', 200); a = await run();
    ok('boot: Windows changed the boot order: 5 steps to the Windows sign-in screen, GRUB never appears; fix with efibootmgr -o 0001,0000', a.length === 5 && has(a[4], '第 5 / 5 步', 'Windows 的登录界面', 'GRUB 却根本没出现', 'sudo efibootmgr -o 0001,0000'), a.length + ' ' + a[a.length - 1]);
    await w.click('Windows 改了启动顺序', 200); await w.click('Windows 快速启动没关', 200); a = await run();
    ok('boot: Fast Startup left on, into Ubuntu: still 8 steps; C: is hibernated and marked in use, mount it read-only', a.length === 8 && has(a[7], '其实是休眠', '还在用', '只该只读挂载它', '文件就可能丢'), a.length + ' ' + a[a.length - 1]);
    await w.click('选 Windows', 200); const on = await run();
    await w.click('关', 200); a = await run();
    ok('boot: Secure Boot off + Windows: 9 steps instead of 8', on.length === 8 && a.length === 9, on.length + ' → ' + a.length);
    ok('boot: the extra step: the TPM will not release the key, the screen asks for the BitLocker recovery key', has(a[6], '第 7 / 9 步', 'BitLocker', '钥匙封在 TPM 芯片里', '测量值就变了', '恢复密钥') && !on.some(x => x.includes('恢复密钥')), a[6]);
    await w.click('Windows 快速启动没关', 200); a = await run();
    ok('boot: every step of the Windows path has a description (the winload step used to be empty)', a.length === 9 && a.every(x => x.replace(/^第 \d+ \/ \d+ 步[：:]?/, '').trim().length > 20) && has(a[7], 'winload.efi'), a.map(x => x.length).join(',')); }

  // ---- step 5: virtual machines
  { const w = W('trap'); await w.show();
    const run = async () => { await w.click('重来', 200); const all = []; for (let k = 0; k < 9; k++) { await w.click('下一步', 150); all.push(await w.status()); } return { m: await w.met(), s: all }; };
    await w.click('理想机器', 300); let r = await run();
    ok('trap: ideal machine: 3 run directly, 6 trap, 0 fail silently', has(r.m, '直接跑 3', '陷入 6', '悄悄失败 0'), r.m);
    await w.click('x86 直接跑', 300); r = await run();
    ok('trap: x86 run directly: 3 direct, 4 trap, 2 fail silently', has(r.m, '直接跑 3', '陷入 4', '悄悄失败 2'), r.m);
    ok('trap: popf: at low privilege it neither changes the interrupt flag nor faults', has(r.s[4], 'popf', '没有陷入', '不改中断标志，也不报错'), r.s[4]);
    ok('trap: sgdt: not privileged, returns the host’s real GDT address', has(r.s[5], 'sgdt', '不是特权指令', '读到的是主机真实的 GDT 地址'), r.s[5]);
    ok('trap: x86 has 17 such instructions', has(r.s[8], 'x86 有 17 条这样的指令'), r.s[8]);
    await w.click('二进制翻译', 300); r = await run(); const bt = r.m;
    await w.click('半虚拟化', 300); r = await run();
    ok('trap: binary translation and paravirtualisation: nothing fails silently', has(bt, '悄悄失败 0', '照抄 3', '就地改写，不陷入 2', '调用监控器 4') && has(r.m, '悄悄失败 0', '超级调用 2'), bt + ' | ' + r.m);
    await w.click('硬件虚拟化', 300); r = await run();
    ok('trap: hardware virtualisation: 5 direct, 4 VM exits ≈ 17360 cycles ≈ 4.6 µs', has(r.m.replace(/,/g, ''), '直接跑 5', 'VM 退出 4', '≈ 17360 个周期 ≈ 4.6 µs'), r.m);
    ok('trap: the 4 exits are mov cr3, out, cpuid, hlt', [3, 6, 7, 8].every(k => /VM 退出/.test(r.s[k])) && [0, 1, 2, 4, 5].every(k => !/^第 \d 条[^：]*：VM 退出/.test(r.s[k])) && has(r.s[3], 'mov cr3') && has(r.s[6], 'out') && has(r.s[7], 'cpuid') && has(r.s[8], 'hlt'), r.s.map(x => x.slice(0, 26)).join(' | '));
    ok('trap: one exit plus entry ≈ 4340 cycles ≈ 1.1 µs on a 3.8 GHz Pentium 4', has(r.s[8], '约 4340 个周期（约 1.1 µs）', '3.8 GHz'), r.s[8]);
    await w.click('有（AMD 2007', 300); r = await run();
    ok('trap: with nested paging: mov cr3 no longer exits; 3 exits ≈ 13020 cycles ≈ 3.4 µs', has(r.m.replace(/,/g, ''), '直接跑 6', 'VM 退出 3', '≈ 13020 个周期 ≈ 3.4 µs') && !/VM 退出/.test(r.s[3].slice(0, 40)), r.m + ' | ' + r.s[3].slice(0, 60));
    ok('arithmetic: 4 × 4340 = 17360, 3 × 4340 = 13020; at 3.8 GHz: 1.1, 4.6 and 3.4 µs; 1931 + 2409 = 4340', 4 * 4340 === 17360 && 3 * 4340 === 13020 && near(4340 / 3.8e3, 1.1, 0.05) && near(17360 / 3.8e3, 4.6, 0.05) && near(13020 / 3.8e3, 3.4, 0.05) && 1931 + 2409 === 4340); }
  { const w = W('nested'); await w.show(); let m = await w.met();
    ok('nested: nested paging with 4 levels each: R = (4 + 1)(4 + 1) − 1 = 24; native needs 4', has(m, 'R = (4 + 1)(4 + 1) - 1 = 24', '原生只要 4 次'), m);
    await w.click('▶ 播放', 500); for (let k = 0; k < 120; k++) { await p.waitForTimeout(300); m = await w.met(); if (/已读页表 24 \/ 24/.test(m)) break; }
    ok('nested: playing counts 24 page-table reads before the data read', has(m, '已读页表 24 / 24'), m);
    await w.click('大页 2 MiB', 400); m = await w.met();
    ok('nested: 2 MiB pages: one level less on each side: (3 + 1)(3 + 1) − 1 = 15', has(m, 'R = (3 + 1)(3 + 1) - 1 = 15'), m);
    await w.click('影子页表', 400); m = await w.met();
    ok('nested: shadow page tables: back to 4 reads', has(m, 'R = n = 4', '客户机改页表 → 陷入 0'), m);
    await w.click('客户机改一次页表', 1500); m = await w.met();
    ok('nested: every guest page-table edit traps into the hypervisor once', has(m, '客户机改页表 → 陷入 1'), m);
    await w.click('快表命中', 400); m = await w.met();
    ok('nested: TLB hit: 0 reads', has(m, 'R = 0'), m);
    await w.click('嵌套页表', 400); await w.set('nested-n', 5, 400); const m5 = await w.met(); await w.set('nested-n', 2, 400); const m2 = await w.met();
    ok('nested: levels 5 → 35 reads, levels 2 → 8 reads', has(m5, '= 35') && has(m2, '= 8'), m5 + ' | ' + m2);
    ok('arithmetic: (n + 1)² − 1 = 8, 15, 24, 35 for n = 2, 3, 4, 5', [2, 3, 4, 5].map(k => (k + 1) * (k + 1) - 1).join() === '8,15,24,35'); }

  // ---- step 6: lighter VMs and translation layers
  { const w = W('syscall'); await w.show();
    const bt = await w.texts('button'); ok('syscall: 9 ways of running', bt.indexOf('▶ 播放') === 9, bt.indexOf('▶ 播放'));
    const run = async (mth) => { await w.click(mth, 300); const seen = []; for (let k = 0; k < 14; k++) { await w.click('下一步', 120); const s = await w.status(); if (seen[seen.length - 1] !== s) seen.push(s); } return { m: await w.met(), n: seen.length, s: seen }; };
    let r = await run('原生');
    ok('syscall: native: 6 steps, 2 user↔kernel switches, 0 walls', r.n === 6 && has(r.m, '用户态↔内核态切换 2 / 2', '要攻破的墙 0'), r.n + ' ' + r.m);
    r = await run('容器');
    ok('syscall: container: the same 6 steps and 2 switches, 1 wall to break', r.n === 6 && has(r.m, '用户态↔内核态切换 2 / 2', '翻译 0 / 0', '要攻破的墙 1') && has(r.s[5], '和原生一样'), r.n + ' ' + r.m);
    r = await run('gVisor');
    ok('syscall: gVisor: 10 steps, 6 switches, 1 translation (Sentry), 2 walls', r.n === 10 && has(r.m, '用户态↔内核态切换 6 / 6', 'VM 退出 0 / 0', '翻译 1 / 1', '要攻破的墙 2') && has(r.s[2], 'Sentry', '翻译 1'), r.n + ' ' + r.m);
    r = await run('微虚拟机');
    ok('syscall: microVM: 12 steps, 6 switches, 1 VM exit, 2 walls (plus the guest kernel)', r.n === 12 && has(r.m, '用户态↔内核态切换 6 / 6', 'VM 退出 1 / 1', '翻译 0 / 0', '要攻破的墙 2（另加客户机内核）') && has(r.s[1], '客户机内核') && has(r.s[2], '一次 VM 退出') && has(r.s[3], 'Firecracker') && has(r.s[4], '主机内核'), r.n + ' ' + r.m);
    r = await run('WSL 2 Linux 文件');
    ok('syscall: WSL 2, a Linux file: 8 steps, 2 switches, 1 VM exit', r.n === 8 && has(r.m, '用户态↔内核态切换 2 / 2', 'VM 退出 1 / 1', '翻译 0 / 0'), r.n + ' ' + r.m);
    r = await run('WSL 2 /mnt/c 上的文件');
    ok('syscall: WSL 2, a file on /mnt/c: 12 steps, 6 switches, 1 VM exit, 2 translations (9P message, then a Windows file read)', r.n === 12 && has(r.m, '用户态↔内核态切换 6 / 6', 'VM 退出 1 / 1', '翻译 2 / 2') && has(r.s[1], '9P', '翻译 1') && has(r.s[3], '换成 Windows 的读文件调用（翻译 2）'), r.n + ' ' + r.m); }

  // ---- step 7: containers
  { const w = W('ns'); await w.show();
    const pre = () => w.texts('pre');
    await w.click('ps -e', 500); let t = await pre(); let tab = await w.text('');
    ok('ns: Docker default: 6 of 8 namespaces on', has(tab, '开着 6 / 8 个'), tab.slice(0, 80));
    ok('ns: default: ps -e in the container shows its own 5 processes, ros2 is PID 1; on the host it is 5224', (t[1].match(/\d\d:\d\d:\d\d/g) || []).length === 5 && /PID TTY TIME CMD 1 \S+ \d\d:\d\d:\d\d ros2/.test(t[1]) && /5224 \S+ \d\d:\d\d:\d\d ros2/.test(t[0]), t[1]);
    await w.click('✓ PID', 400); await w.click('ps -e', 500); t = await pre();
    ok('ns: PID namespace off: the container lists the host’s processes with host numbers, python (4127) included', /4127 \S+ \d\d:\d\d:\d\d python/.test(t[1]) && /5224 \S+ \d\d:\d\d:\d\d ros2/.test(t[1]) && /1 \S+ \d\d:\d\d:\d\d systemd/.test(t[1]), t[1]);
    ok('ns: python train.py is PID 4127 on the host', has(tab, 'python train.py（PID 4127）'), tab.slice(0, 120));
    await w.click('cat /etc/os-release | head -1', 500); t = await pre();
    ok('ns: mount namespace on: the container’s os-release says 22.04.5 LTS', has(t[1], 'Ubuntu 22.04.5 LTS') && has(t[0], 'Ubuntu 24.04.5 LTS'), t[1]);
    await w.click('✓ mount', 400); await w.click('cat /etc/os-release | head -1', 500); t = await pre();
    ok('ns: mount namespace off: it becomes the host’s Ubuntu 24.04.5 LTS', has(t[1], 'Ubuntu 24.04.5 LTS'), t[1]);
    const un = []; await w.click('uname -r', 500); un.push((await pre())[1]); await w.click('全关：普通进程', 400); await w.click('uname -r', 500); un.push((await pre())[1]); await w.click('8 个全开', 400); await w.click('uname -r', 500); un.push((await pre())[1]); await w.click('Docker 默认', 400); await w.click('uname -r', 500); un.push((await pre())[1]);
    ok('ns: uname -r prints 6.8.0-146-generic however the switches are set', un.every(x => x.includes('6.8.0-146-generic')), un.join(' | '));
    let m = await w.met();
    ok('ns: memory limit 128 MiB (default, measured): last line allocated 112 MiB, exit code 137 = 128 + 9', has(m, 'memory.max 134217728', '最后一行 allocated 112 MiB', '退出码 137 = 128 + 9', '来源 我们测的'), m);
    await w.set('ns-m', 256, 600); m = await w.met(); let s = await w.status();
    ok('ns: memory limit 256 MiB: last line allocated 240 MiB, then killed, exit code 137', has(m, '最后一行 allocated 240 MiB', '退出码 137 = 128 + 9') && has(s, '再要 16 MiB 就超过上限'), m);
    await w.set('ns-cu', 0.5, 600); m = await w.met(); s = await w.status();
    ok('ns: CPU limit 0.5: cpu.max 50000 100000; 1.17 s predicted to become 2.34 s, measured 2.27 s', has(m, 'cpu.max 50000 100000', '2.34 s', '2.27 s', '1.17 s') && has(s, '1.17 ÷ 0.5 = 2.34 s；我们实测 2.27 s'), m);
    const out = []; for (const c of ['date -s 12:00', 'mount /dev/sda1 /mnt', 'insmod x.ko']) { await w.click(c, 500); out.push((await pre()).join(' ## ') + ' @@ ' + (await w.status())); }
    ok('ns: setting the clock, mounting a disk and loading a module are all refused', has(out[0], 'Operation not permitted') && /permission denied|Operation not permitted/i.test(out[1]) && /not permitted|denied/i.test(out[2]), out.map(x => x.slice(-0)).join(' | ').slice(0, 300));
    ok('ns: root in the container has 14 of the 41 capabilities', has(out[2], '容器里的 root 只有 14 种能力（共 41 种）'), out[2].slice(-200));
    ok('arithmetic: 128 + 9 = 137; 256 − 16 = 240, 128 − 16 = 112; 1.17 ÷ 0.5 = 2.34; 50000 ÷ 100000 = 0.5', 128 + 9 === 137 && 256 - 16 === 240 && 128 - 16 === 112 && near(1.17 / 0.5, 2.34, 1e-9) && 50000 / 100000 === 0.5); }

  // ---- step 8: images and layers
  { const w = W('overlay'); await w.show(); const r = {};
    for (const c of ['读 setup.bash', '改 /etc/bash.bashrc', '往 200 MB 的 big.bin 末尾加 1 个字节', '往 200 MB 的 big.bin 末尾加 1 个字节', '往 200 MB 的 big.bin 末尾加 1 个字节', '删掉 big.bin']) { await w.click(c, 300); await w.settle(); (r[c] = r[c] || []).push({ m: (await w.met()).split(' ## ')[0], s: await w.status() }); }
    let x = r['读 setup.bash'][0];
    ok('overlay: reading setup.bash: found in the read-only L2, nothing copied, the writable layer stays empty', has(x.m, '在哪一层找到 L2（只读）', '复制上来 0 B', '可写层 U 里现在 空'), x.m);
    x = r['改 /etc/bash.bashrc'][0];
    ok('overlay: editing /etc/bash.bashrc: found in L1, the whole file (a few kB) copied up, then changed there', has(x.m, '在哪一层找到 L1（只读）', '复制上来 几 kB', '可写层 U 里现在 1 个文件') && has(x.s, '先把整个文件复制到 U'), x.m);
    x = r['往 200 MB 的 big.bin 末尾加 1 个字节'];
    ok('overlay: appending 1 byte to big.bin: first time 353 ms (the whole 200 MB copied up)', has(x[0].m, 'L3（只读）', '复制上来 200 MB', '353 ms'), x[0].m);
    ok('overlay: second and third time: already in the writable layer, about 0.01 ms each', has(x[1].m, 'U（可写）', '复制上来 0 B', '约 0.01 ms') && has(x[2].m, 'U（可写）', '约 0.01 ms'), x[1].m + ' | ' + x[2].m);
    x = r['删掉 big.bin'][0];
    ok('overlay: deleting big.bin: a whiteout in the writable layer hides it; the 200 MB in L3 are still there', has(x.m, '1 个删除标记') && has(x.s, '删除标记', 'L3 里那 200 MB 还在：镜像一点没变小'), x.s);
    await w.click('镜像和层', 500); let s = await w.status(), m = await w.met();
    ok('overlay: 5 containers from one image: 251.93 MB + 5 × 5 MB = 276.93 MB shared, against 1.28 GB for full copies', has(s, '251.93 MB + 5 × 5 MB（估）= 276.93 MB', '1.28 GB') && has(m, '276.93 MB', '1.28 GB'), s);
    ok('arithmetic: 251.93 + 5 × 5 = 276.93; 5 × (251.93 + 5) = 1284.65 MB ≈ 1.28 GB; 3 × 251.93 = 755.79', near(251.93 + 25, 276.93, 1e-9) && near(5 * 256.93 / 1000, 1.28, 0.005) && near(3 * 251.93, 755.79, 1e-9));
    await w.click('改代码重建', 500); await w.click('改 src/ 里的代码', 300); await w.settle(); m = (await w.met()).split(' ## ').pop();
    ok('overlay: dependencies first, change only the code: 1 of 4 steps re-run, 3 from the cache, pip install not re-run', has(m, '4 步里重新执行 1', '直接用缓存 3', 'pip install 重跑了吗 没有'), m);
    await w.click('代码在前（差）', 500); await w.click('改 src/ 里的代码', 300); await w.settle(); m = (await w.met()).split(' ## ').pop(); s = await w.status();
    ok('overlay: code first, change only the code: 3 steps re-run, 1 from the cache, pip install re-run', has(m, '4 步里重新执行 3', '直接用缓存 1', 'pip install 重跑了吗 重跑了') && has(s, '只因为它排在 COPY src/ 后面'), m); }

  // ---- step 10: sandboxes
  { const w = W('seccomp'); await w.show(); const cnt = {};
    for (const mth of ['直接跑', 'Docker 默认', 'Docker 加固', 'gVisor', '微虚拟机']) { await w.click(mth, 400); cnt[mth] = await w.met(); }
    ok('seccomp: bad deeds that succeed: run directly 6 / 8, Docker default 4 / 8, Docker hardened 1 / 8, gVisor 0 / 8, microVM 0 / 8', has(cnt['直接跑'], '坏事得逞 6 / 8') && has(cnt['Docker 默认'], '坏事得逞 4 / 8') && has(cnt['Docker 加固'], '坏事得逞 1 / 8') && has(cnt['gVisor'], '坏事得逞 0 / 8') && has(cnt['微虚拟机'], '坏事得逞 0 / 8'), Object.values(cnt).map(x => x.slice(0, 12)).join(' | '));
    ok('seccomp: the two legitimate jobs work under all five', Object.values(cnt).every(x => x.includes('该做的两件 都能做')));
    const cells = (await w.texts('button,[role=button],td')).filter(x => /^[●⊘✓◐] /.test(x)); const col = k => cells.filter((_, i) => i % 5 === k);
    ok('seccomp: a table of 10 deeds × 5 ways', cells.length === 50, cells.length);
    const bads = k => col(k).filter(x => x.startsWith('●')).map(x => x.slice(2));
    ok('seccomp: run directly: key read, internet, data changed, fork bomb, memory, kernel exploit succeed; mount and clock refused', bads(0).join('|') === '读得到|连得上|改得了|拖垮机器|耗尽内存|本来就是你' && col(0).filter(x => x === '⊘ 拒绝').length === 2, col(0).join('|'));
    ok('seccomp: Docker default: internet, fork bomb (hurts the host), memory (no limit) and the kernel exploit still succeed', bads(1).join('|') === '连得上|伤到主机|不限内存|直达主机内核', col(1).join('|'));
    ok('seccomp: Docker hardened: only the kernel exploit is left; fork stops at 100 processes, memory is killed at 2 GiB', bads(2).join('|') === '直达主机内核' && col(2).includes('◐ 100 个就停') && col(2).includes('◐ 2 GiB 被杀'), col(2).join('|'));
    ok('seccomp: the kernel exploit: gVisor: Sentry has to fall first; microVM: two more layers to break', col(3)[9] === '◐ 先得攻破 Sentry' && col(4)[9] === '◐ 还要连破两层', col(3)[9] + ' | ' + col(4)[9]); }

  // ---- step 11: environment managers
  { const w = W('path'); await w.show(); const r = {};
    for (const mth of ['不用环境', 'venv', 'conda', 'uv']) { await w.click(mth, 500); for (const c of ['which python', 'import torch']) { await w.click(c, 300); await w.settle(); } r[mth] = { m: await w.met(), s: await w.status(), sh: await w.text('#path-sh') };
      if (mth === 'conda') { await w.click('ldd … cudart', 300); await w.settle(); r.ldd = { s: await w.status(), t: await w.text('') }; } }
    ok('path: no environment: both get the system Python 3.12 without torch; pip into the system is refused (externally-managed-environment)', has(r['不用环境'].m, '项目 A 得到 Python 3.12 · 没有 torch', '项目 B 得到 Python 3.12 · 没有 torch') && has(r['不用环境'].s, 'PEP 668', 'externally-managed-environment', 'torch 1.13.1 根本没有给 Python 3.12 的安装包'), r['不用环境'].m);
    ok('path: venv: A gets Python 3.12, torch 2.5.1 and CUDA 12.4; B has no Python 3.8 and no torch', has(r.venv.m, '项目 A 得到 Python 3.12 · torch 2.5.1+cu124 · CUDA 12.4', '项目 B 得到 没有 Python 3.8，也没有 torch'), r.venv.m);
    ok('path: conda: B gets its own Python 3.8.20, torch 1.13.1 and CUDA 11.7', has(r.conda.m, '项目 A 得到 Python 3.12 · torch 2.5.1 · CUDA 12.4', '项目 B 得到 Python 3.8.20 · torch 1.13.1 · CUDA 11.7'), r.conda.m);
    ok('path: conda, ldd: libcudart is found at step 1 of the five-step search, the RPATH: envs/b/lib (libcudart.so.11.0) for B, envs/a/lib (libcudart.so.12) for A', has(r.ldd.s, '五步顺序', '第 1 步', 'RPATH', 'envs/a/lib；B 是 envs/b/lib', 'A 找到 libcudart.so.12，B 找到 libcudart.so.11.0'), r.ldd.s);
    ok('path: uv: B gets a standalone Python 3.8.20 with torch 1.13.1', has(r.uv.m, '项目 B 得到 Python 3.8.20 · torch 1.13.1+cu117 · CUDA 11.7') && has(r.uv.s, 'uv 下载的那份 Python'), r.uv.m);
    ok('path: the shared rows of the bottom panel are the same under all four methods: glibc 2.39, libcuda.so.1 (driver 550), Linux 6.8 with nvidia.ko 550, /home/team, the network, the same user team', ['不用环境', 'venv', 'conda', 'uv'].every(k => has(r[k].sh, '系统库 glibc 2.39', 'libcuda.so.1（驱动 550', '内核 Linux 6.8 · nvidia.ko 550', '其他 /home/team · 网络 · 同一个用户 team')), ['不用环境', 'venv', 'conda', 'uv'].map(k => r[k].sh.slice(-150)).join(' | ')); }

  // ---- step 12: Nix
  { const w = W('nix'); await w.show(); let m = await w.met();
    ok('nix: start: 6 store paths, generation 41', has(m, 'store 里的包路径 6', '当前这一代 41'), m);
    await w.click('给 openssl 打补丁', 300); await w.settle(); m = await w.met(); let s = await w.status();
    ok('nix: patch openssl: 4 new paths (openssl, python3, numpy, grasp-app); glibc and gcc unchanged; 10 paths; generation 42', has(m, 'store 里的包路径 10', '4 条新路径', '当前这一代 42') && has(s, 'python3', 'numpy 和 grasp-app 跟着变：4 条新路径', 'glibc 和 gcc 的输入没变，哈希不变'), m + ' | ' + s);
    await w.click('换编译器', 300); await w.settle(); m = await w.met(); s = await w.status();
    ok('nix: change the compiler (gcc 13.2 → 14.1): all 6 hashes change, glibc included; 16 paths; generation 43', has(m, 'store 里的包路径 16', '6 条新路径', '当前这一代 43') && has(s, 'gcc-13.2 → gcc-14.1', '全部 6 个哈希都变了，连 glibc 也变了'), m + ' | ' + s);
    await w.click('回滚', 300); await w.settle(); m = await w.met(); s = await w.status();
    ok('nix: roll back: the link goes from generation 43 back to 42, nothing is rebuilt; generations 41 and 43 are still there', has(m, 'store 里的包路径 16', '当前这一代 42') && has(s, '从第 43 代换到第 42 代', '不重新构建', '第 41、43 代还在'), m + ' | ' + s);
    await w.click('回收', 300); await w.settle(); m = await w.met(); s = await w.status();
    ok('nix: garbage-collect: generations 41 and 43 go, then 11 unused paths; 5 remain, gcc is deleted too; no more rollback', has(m, 'store 里的包路径 5', '删掉 11 条', '当前这一代 42') && has(s, '第 41、43 代', '删了 11 条，剩 5 条', 'gcc 也删了', '现在回滚不了了'), m + ' | ' + s);
    ok('arithmetic: 6 + 4 = 10, 10 + 6 = 16, 16 − 11 = 5; 160 ÷ 5 = 32', 6 + 4 === 10 && 10 + 6 === 16 && 16 - 11 === 5 && 160 / 5 === 32); }

  // ---- step 13: the GPU
  { const w = W('gpu'); await w.show(); let m = await w.met(), s = await w.status();
    ok('gpu: Docker container: the image brings PyTorch, cuDNN and the CUDA runtime; libcuda.so.1, nvidia.ko and the card are the host’s', has(m, '每个世界自己带 PyTorch、cuDNN、CUDA 运行时（都在镜像里）', '主机给的（共用） libcuda.so.1、nvidia.ko、GPU'), m);
    ok('gpu: the host needs the driver and the NVIDIA Container Toolkit, not the CUDA toolkit', has(m, '驱动 + NVIDIA Container Toolkit（不用 CUDA 工具包）') && has(s, 'NVIDIA Container Toolkit 在容器启动前把主机的驱动库和 /dev/nvidia* 挂进去'), m);
    const t = await w.text(''); ok('gpu: the two containers bring CUDA 12.4 and CUDA 11.7; the host driver is 550', has(t, 'CUDA 12.4 运行时', 'CUDA 11.7 运行时', 'nvidia.ko 550', 'libcuda.so.1（主机的 550）'), t.slice(0, 300));
    ok('gpu: driver 550 runs CUDA 11.7, 12.1, 12.4, 12.8 but not 13.2, which needs ≥ 580', has(m, '驱动 550', '能跑的 CUDA 11.7 · 12.1 · 12.4 · 12.8', '跑不了 13.2') && has(s, '13.x 要 ≥ 580', '11.x（≥ 450）和 12.x（≥ 525）'), m);
    await w.click('虚拟机（直通）', 500); m = await w.met(); s = await w.status();
    ok('gpu: VM (passthrough): the guest brings everything, its own driver included; the whole card goes to that one VM', has(m, '每个世界自己带 全部，连驱动', '只把整块卡划过去') && has(s, '客户机装它自己的驱动', '主机和别的虚拟机都用不了'), m);
    await w.click('580', 400); m = await w.met();
    ok('gpu: driver 580 runs all five, 13.2 included', has(m, '驱动 580', '11.7 · 12.1 · 12.4 · 12.8 · 13.2', '跑不了 —'), m);
    await w.click('470', 400); m = await w.met(); s = await w.status();
    ok('gpu: the 470 row is unusable: the RTX 4090 itself needs driver 520 or later', has(m, '这块卡用不了 470') && has(s, 'RTX 4090 用不了 470（至少要 520'), s.slice(0, 200));
    ok('rule v ≥ vmin(k): 550 ≥ 450 and 550 ≥ 525 but 550 < 580', 550 >= 450 && 550 >= 525 && 550 < 580); }

  // ---- step 15: choosing and nesting
  { const w = W('choose'); await w.show();
    const card = async () => { const t = await w.text(''); const i = t.indexOf('最低的切口'); return t.slice(i, i + 900); };
    const c = {}; for (const k of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) { await w.click(k, 400); c[k] = await card(); }
    ok('choose: A cuts at packages (.venv + lock file); B at the runtime (conda)', has(c.A, '最低的切口 包（', '推荐 venv / virtualenv / uv', 'uv.lock') && has(c.B, '最低的切口 运行时（', '推荐 conda'), c.A.slice(0, 80) + ' | ' + c.B.slice(0, 80));
    ok('choose: C cuts at system libraries and distribution (a container); D at the kernel (a VM with the USB device handed in)', has(c.C, '最低的切口 系统库和发行版（', '推荐 应用容器', 'docker run ros:humble') && has(c.D, '最低的切口 内核（', '推荐 完整虚拟机', 'USB'), c.C.slice(0, 80) + ' | ' + c.D.slice(0, 80));
    ok('choose: E is also at the kernel, but the recommendation is a separate real-time controller', has(c.E, '最低的切口 内核（', '推荐 单独的实时控制器（分开的机器）'), c.E.slice(0, 120));
    ok('choose: F: the cut is at the system-call interface: a wall is missing, not another version (gVisor)', has(c.F, '最低的切口 系统调用接口', '要的是一堵墙，不是别的版本', '推荐 gVisor'), c.F.slice(0, 120));
    ok('choose: G lands on the hardware: one image per kind of CPU, Apptainer on the cluster', has(c.G, '最低的切口 硬件（', 'linux/amd64,linux/arm64', 'Apptainer'), c.G.slice(0, 160));
    await w.click('清空', 300); await w.click('3 还要别的发行版', 400); let x = await card();
    ok('choose: only "another distribution": an app container, docker run ros:humble', has(x, '最低的切口 系统库和发行版（', '推荐 应用容器（Docker、Podman） docker run ros:humble'), x.slice(0, 160));
    await w.click('6 要跑不可信的代码', 400); x = await card();
    ok('choose: plus "untrusted code": gVisor plus an app container (docker run --runtime=runsc); what is needed is a wall, not another version', has(x, '最低的切口 系统调用接口', '要的是一堵墙，不是别的版本', '推荐 gVisor', '应用容器（Docker、Podman）', 'docker run --runtime=runsc'), x.slice(0, 260));
    const m = await w.met();
    ok('choose: nesting, Docker Desktop on a Mac: 2 levels (VM → container), 2 kernels (XNU, Linux), system calls land on the Linux kernel in the VM', has(m, '套了几层 2 层：虚拟机 → 容器', '程序的系统调用到 虚拟机里的 Linux 内核', '几个内核 2 个：XNU、Linux'), m.slice(-160));
    const lab = await w.texts('label'); ok('choose: 7 presets and 11 kinds of need', lab.length === 11 && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].every(k => c[k].length > 100), lab.length); }

  // ---- the text itself
  { const txt = await p.evaluate(() => { const o = {}; for (const id of ['k-open', 'k-vm', 'k-family', 'k-hw']) o[id] = document.getElementById(id).innerText; o.see = document.querySelectorAll('p.see').length; o.fig = document.querySelectorAll('figure.fig').length; o.try = document.querySelectorAll('p.try').length; o.wg = document.querySelectorAll('.wg').length; return o; });
    ok('page: 15 interactives, each followed by a "你会看到" line; 15 "先玩" prompts; 3 figures', txt.wg === 15 && txt.see === 15 && txt.try === 15 && txt.fig === 3, JSON.stringify([txt.wg, txt.see, txt.try, txt.fig]));
    ok('figure (set picture) and card: x86 had 17 sensitive instructions that do not trap', has(txt['k-vm'], '17 条敏感指令落在 P 外面', '有 17 条敏感却不陷入'), ''); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
