// Check the numbers of "Loops Within Loops" (loops/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt: pressing buttons, moving sliders, tapping the scenes) and compares the readouts with the
// numbers quoted in the "你会看到 / What you will see" lines. Several interactives are real-time simulations, so what a
// readout shows depends a little on the moment a button is pressed: such numbers are quoted with "约 / about" and
// checked with a tolerance. Numbers that no readout shows (how far a speed dips, how long a swing lasts, at which
// setting a stick falls or a drone flips, how many times each program has run after one lap) are recomputed with the
// interactives' own simulation code: each interactive is a self-contained script, so the functions that advance its
// simulation are cut out of the page's HTML by name, together with the declarations in front of them, and run here
// unchanged (see "harness" below); wherever a readout exists, the copy is first compared with it.
// Part B recomputes the numbers quoted in the formula cards, the paragraphs, the quiz and the figures.
//   usage: node check.js /absolute/path/to/loops/index.html      (takes several minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const fs = require('fs');
// ---------------------------------------------------------------------------------------------------------------
// harness: runnable copies of the interactives' own simulation code, cut out of the page source.
// H.lp(P), H.pd(P), … return E, a function that evaluates a snippet inside the scope of that interactive's code:
// E('carpet=true') sets a variable, E('v') reads one, E('(function(n){for(let i=0;i<n;i++)step()})') returns a
// function that advances the simulation without leaving the scope.
// ---------------------------------------------------------------------------------------------------------------
const HX = {};
const wrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
HX.load = file => { const html = fs.readFileSync(file, 'utf8');
  const wsrc = id => { const m = new RegExp('<div class="wg[^"]*" id="' + id + '"').exec(html); if (!m) throw new Error('no interactive ' + id); const i = m.index; const j = html.indexOf('<script>', i), k = html.indexOf('</script>', j); return html.slice(j + 8, k); };
  return { html, wsrc }; };
const fn = HX.fn = (src, name) => { const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src); if (!m) throw new Error('no function ' + name);
  let k = src.indexOf('{', m.index), d = 0, q = null;
  for (; k < src.length; k++) { const c = src[k]; if (q) { if (c === '\\') k++; else if (c === q) q = null; } else if (c === "'" || c === '"' || c === '`') q = c; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break; } }
  return src.slice(m.index, k + 1); };
const between = HX.between = (src, a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error('no "' + a + '"'); const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error('no "' + b + '" after "' + a + '"'); return src.slice(i, j); };
const mk = (code) => new Function('X', code + '\n;return function(__s){return eval(__s)};')({ wrap: wrapPi, fm: (v, d) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d) });
// wheel-speed loop (step 1)
HX.lp = P => { const s = P.wsrc('lp'); return mk(between(s, 'const K=', 'function counts') + fn(s, 'counts') + fn(s, 'ctrlTick') + fn(s, 'bump') + fn(s, 'step') + between(s, 'v=r;u=uD=uI=r/K;', 'const St=')); };
// joint with a weight (step 2)
HX.pd = P => { const s = P.wsrc('pd'); return mk('const D=Math.PI/180;' + between(s, 'const g0=', 'function ctrl') + fn(s, 'ctrl') + fn(s, 'step')); };
// balancing stick (step 3)
HX.ip = P => { const s = P.wsrc('ip'); return mk('const g0=9.81,DT=0.00025,NB=1400;' + between(s, 'let lu=', 'function gains') + fn(s, 'gains') + fn(s, 'reset') + fn(s, 'params') + fn(s, 'step') + ';params();reset();'); };
// quadrotor cascade (step 4)
HX.cq = P => { const s = P.wsrc('cq'); return mk('const D=180/Math.PI;' + between(s, 'const g0=', 'function reset') + fn(s, 'reset') + fn(s, 'step') + ';reset();'); };
// PWM and the current loop (step 5)
HX.pw = P => { const s = P.wsrc('pw'); return mk(between(s, 'const R=1', 'function sim') + fn(s, 'sim') + fn(s, 'stats') + fn(s, 'compute')); };
// the whole vacuum (step 8)
HX.st = P => { const s = P.wsrc('st'); return mk(between(s, 'const RW=', 'function solid') + ['solid', 'buildMap', 'inflate'].map(n => fn(s, n)).join('') + between(s, 'const cell=', 'function los') + ['los', 'astar', 'plan', 'ray', 'perceive', 'local', 'base', 'wheels', 'physics', 'step', 'reset'].map(n => fn(s, n)).join('') + ';reset();'); };

const H = HX;
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/loops/index.html'); process.exit(2); }
  const P = H.load(file);
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
    // the readout line of an interactive (class "sum")
    met: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .sum')].map(m => m.innerText).join(' ## '), id).then(norm),
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
  // wait until a readout matches (training widgets): polls every 100 ms, at most `max` seconds
  const until = async (w, re, max) => { for (let k = 0; k < (max || 120) * 10; k++) { const m = await w.met(); if (re.test(m)) return m; await p.waitForTimeout(100); } return await w.met(); };
  // drag inside a canvas from one canvas pixel to another
  const dragPx = async (cvId, a, c) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const r = await p.evaluate(i => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left, q.top]; }, cvId);
    await p.mouse.move(r[0] + a[0], r[1] + a[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(r[0] + a[0] + (c[0] - a[0]) * k / 6, r[1] + a[1] + (c[1] - a[1]) * k / 6); await p.mouse.up(); await p.waitForTimeout(250); };
  // run a snippet inside the page
  const EV = (fn, arg) => p.evaluate(fn, arg);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-')) : NaN; };
  // the visible text of a section, folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);

  const wait = ms => p.waitForTimeout(ms);
  const KEEP = {};
  const r3 = v => Math.round(v * 1000) / 1000;
  const stat = a => { const n = a.length, m = a.reduce((s, v) => s + v, 0) / n; return { mean: m, sd: Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / n), min: Math.min(...a), max: Math.max(...a) }; };

  // =============================================================================================================
  // Part A: the interactives
  // =============================================================================================================
  sec('step ① · lp: one wheel-speed loop');
  {
    const w = W('lp'); await w.show(); await wait(1500);
    let m = await w.met(), s = await w.status();
    ok('lp at rest: closed loop, true speed 0.30 m/s', has(m, '真实轮速 y = 0.30 m/s') && s.startsWith('闭环'), m);
    // the simulation code of this interactive, run outside the page
    const mk = () => { const E = H.lp(P); return { E, run: E('(function(n){for(let i=0;i<n;i++)step()})') }; };
    { const a = mk(); const c = a.E('[K,TAU,UM,KP,KI,MPC,DT,CARPET]');
      ok('lp constants: 0.04 (m/s)/V so 0.30 m/s needs 7.5 V; battery 14.4 V; Kp 100; Ki = Kp/τ ≈ 1700; one pulse = 0.61 mm; the carpet leaves 60%', near(.3 / c[0], 7.5, 1e-9) && c[2] === 14.4 && c[3] === 100 && Math.round(c[4] / 100) === 17 && (c[5] * 1000).toFixed(2) === '0.61' && near(1 - c[7], .6, 1e-9), c.join(' ')); }
    // a step response of the copy: change something, record the true speed every millisecond
    const resp = (setup, change, secs) => { const a = mk(); a.E(setup); a.run(15000); a.E(change); const tr = []; for (let k = 0; k < secs * 1000; k++) { a.run(5); tr.push(a.E('v')); }
      const fin = tr.slice(-200).reduce((x, y) => x + y, 0) / 200; let settle = 0; for (let i = tr.length - 1; i >= 0; i--) if (Math.abs(tr[i] - fin) > .006) { settle = (i + 1) / 1000; break; }
      let sw = 0, last = 0; for (let i = 1; i < tr.length - 1; i++) if ((tr[i] - tr[i - 1]) * (tr[i + 1] - tr[i]) < 0 && Math.abs(tr[i] - fin) > .012 && i - last > 20) { sw++; last = i; }
      return { fin, min: Math.min(...tr), max: Math.max(...tr), settle, sw }; };
    await w.click('压上地毯'); await wait(2500); m = await w.met(); s = await w.status();
    ok('lp carpet: the status says the voltage goes from 7.5 V to about 12.5 V and the speed is back at 0.30 m/s', has(s, '把电压从 7.5 V 加到约 12.5 V') && has(m, '真实轮速 y = 0.30 m/s') && near(num(m, /电压 u = ([\d.]+) V/), 12.5, .6), m);
    { const r = resp('', 'carpet=true', 2);
      ok('lp carpet (the interactive\'s own code): the speed dips to about 0.27 m/s and is back within 0.006 of 0.30 in under 0.2 s; the voltage it needs is 0.30 / (0.04 × 0.6) = 12.5 V', near(r.min, .268, .006) && r.settle < .2 && near(r.fin, .3, .002) && near(.3 / (.04 * .6), 12.5, 1e-9), JSON.stringify(r)); }
    await w.click('断开反馈'); await wait(2500); m = await w.met();
    ok('lp feedback cut on the carpet: 7.5 V, true speed 0.18 m/s', has(m, '控制器一直给 7.5 V') && has(m, '真实轮速 y = 0.18 m/s'), m);
    await w.click('断开反馈'); await wait(2000);
    await w.set('lp-w', 2); await wait(1500); s = await w.status();
    ok('lp 2 ms window: on average 1.0 pulse per window, one pulse = 0.31 m/s', has(s, '平均只数得到 1.0 个脉冲') && has(s, '每个脉冲就差 0.31 m/s'), s);
    { const one = (r) => { const a = mk(); a.E('W=2;carpet=true;r=' + r); a.run(15000); const us = [], vs = [], yms = new Set(); for (let k = 0; k < 20000; k++) { a.run(5); const o = a.E('[v,u,ym]'); vs.push(o[0]); us.push(o[1]); yms.add(o[2].toFixed(2)); } return { v: stat(vs), u: stat(us), top: us.filter(x => x >= 14.39).length / us.length, yms: [...yms].sort() }; };
      const a = one(.3), b2 = one(.2);
      ok('lp 2 ms window, target 0.30 on the carpet: steady (voltage scatter under 1 V)', a.u.sd < 1 && near(a.v.mean, .3, .003), JSON.stringify(a.u));
      ok('lp 2 ms window, target 0.20: the measured speed is 0, 0.31 or 0.61 m/s, the voltage is at 14.4 V about four-tenths of the time and the wheel runs about 0.01 m/s below target', b2.yms.every(y => ['0.00', '0.31', '0.61'].includes(y)) && b2.yms.includes('0.00') && b2.yms.includes('0.31') && near(b2.top, .4, .08) && near(.2 - b2.v.mean, .012, .006), JSON.stringify(b2)); }
    await w.set('lp-w', 50); await wait(1200); s = await w.status();
    ok('lp 50 ms window: the status says the measurement is about 25 ms late', has(s, '晚了约 25 毫秒'), s);
    { const c = resp('W=50;carpet=true', 'r=.2', 3), f = resp('W=50', 'r=.2', 3);
      ok('lp 50 ms window, target 0.30 → 0.20 on the carpet: overshoots down to about 0.16, swings two or three times, settles after about 0.2 s', near(c.min, .157, .008) && c.sw >= 2 && c.sw <= 3 && near(c.settle, .2, .06), JSON.stringify(c));
      ok('lp the same on the hard floor: overshoots to about 0.11 and swings for over half a second', near(f.min, .11, .008) && f.settle > .5 && f.settle < .8, JSON.stringify(f)); }
    await w.set('lp-w', 20); await w.set('lp-r', .4); await wait(2500); m = await w.met(); s = await w.status();
    ok('lp carpet, target 0.40: would need 16.7 V, stops at 0.35 m/s with 14.4 V', has(s, '得给 16.7 V') && has(s, '轮子最多 0.35 m/s') && has(m, '真实轮速 y = 0.35 m/s') && has(m, '电压 u = 14.4 V'), m);
    await w.click('压上地毯'); await w.set('lp-r', .3); await wait(1500); await w.click('去掉积分'); await wait(2500); m = await w.met(); s = await w.status();
    ok('lp hard floor, target 0.30, no integral: settles at 0.24 m/s, 0.06 short', has(m, '真实轮速 y = 0.24 m/s') && has(s, '稳定后还差约 0.06 m/s'), m + ' || ' + s);
    await w.click('去掉积分'); await wait(1500); await w.click('反馈接反'); await wait(2500); m = await w.met(); s = await w.status();
    ok('lp feedback wired backwards: 14.4 V, the wheel runs away to 0.58 m/s', has(m, '电压 u = 14.4 V') && has(s, '轮速冲到 0.58 m/s'), m);
    await w.click('反馈接反');
  }

  sec('step ② · pd: a joint holding a weight');
  {
    const w = W('pd'); await w.show(); await wait(3000);
    let m = await w.met(), s = await w.status();
    ok('pd PD loop, 1 kg: rests 5.1° below the target (4.45 N·m ÷ 50 ≈ 0.089 rad)', has(m, '差 5.1°') && has(s, '4.45 N·m ÷ 50 ≈ 0.089 rad'), m);
    const mk = () => { const E = H.pd(P); return { E, run: E('(function(n){for(let i=0;i<n;i++)step(.001)})'), deg: () => E('q*180/Math.PI') }; };
    const sim = (setup, act, secs) => { const a = mk(); a.E(setup); a.run(8000); const q0 = a.deg(); a.E(act); const tr = []; for (let k = 0; k < secs * 1000; k++) { a.run(1); tr.push(a.deg()); }
      const fin = tr[tr.length - 1]; let settle = 0; for (let i = tr.length - 1; i >= 0; i--) if (Math.abs(tr[i] - fin) > .5) { settle = (i + 1) / 1000; break; } return { q0, fin, min: Math.min(...tr), max: Math.max(...tr), settle }; };
    await w.click('开环'); await w.click('回到目标'); await wait(1500); m = await w.met();
    ok('pd open loop, 1 kg, at the target: a constant 4.25 N·m just holds it at 30.0°', has(m, '实际 30.0°') && has(m, '前馈 4.25'), m);
    await w.set('pd-w', 1.5); await wait(14000); m = await w.met();
    const qo = num(m, /实际 (-?[\d.]+)°/), eo = num(m, /差 (-?[\d.]+)°/);
    ok('pd open loop, 1.5 kg: the arm ends about 52° below the horizontal, 82° from the target', near(qo, -51.8, 1.2) && near(eo, 81.8, 1.2), m);
    { const r = sim('mode="open";q=qt;w=0', 'mp=1.5', 60), r2 = sim('mode="open";mp=1.5;q=-51.79*D;w=0', 'w-=2.5', 60);
      ok('pd (own code) open loop 1 kg → 1.5 kg: settles at −51.8° after ten seconds or so; a push there sends it swinging and it settles at −51.8° again', near(r.fin, -51.79, .05) && r.settle > 7 && r.settle < 14 && near(r2.fin, -51.79, .05) && r2.min < -70, JSON.stringify([r, r2])); }
    await w.click('推一下'); await wait(600);
    await w.set('pd-w', 1); await w.click('PD 闭环'); await wait(3500); m = await w.met();
    ok('pd PD loop again, 1 kg: 5.1° below', has(m, '差 5.1°'), m);
    await w.set('pd-w', 1.5); await wait(3000); m = await w.met(); s = await w.status();
    ok('pd PD loop, 1.5 kg: 7.3° below (6.33 N·m ÷ 50 ≈ 0.127 rad)', has(m, '差 7.3°') && has(s, '6.33 N·m ÷ 50 ≈ 0.127 rad'), m);
    await w.click('推一下'); await wait(1500); m = await w.met();
    { const r = sim('mp=1.5', 'w-=2.5', 10);
      ok('pd PD loop, a push: back in under half a second (readout 1.5 s later: 7.3° again)', has(m, '差 7.3°') && r.settle < .5, m + ' ' + JSON.stringify(r)); }
    await w.set('pd-kd', 0); await w.click('推一下'); await wait(1200); s = await w.status();
    { const r = sim('mp=1.5;Kd=0', 'w-=2.5', 40);
      ok('pd K_d = 0, a push: swings between about 12° and 32° and takes six or seven seconds to settle', has(s, '阻尼太小') && near(r.min, 12.5, .7) && near(r.max, 32, .7) && r.settle > 5.8 && r.settle < 7.5, s.slice(0, 30) + ' ' + JSON.stringify(r)); }
    await wait(7000);
    await w.set('pd-kd', 4); await w.click('PD + 重力补偿'); await wait(3500); m = await w.met(); s = await w.status();
    ok('pd PD + gravity comp., 1.5 kg: 2.1° low, the feedforward gives 1.8 N·m too little', has(m, '差 2.1°') && has(s, '前馈少给了 1.8 N·m'), m + ' || ' + s);
    await w.set('pd-w', 1); await wait(3000); m = await w.met();
    ok('pd PD + gravity comp., 1 kg: the sag is 0.0°', has(m, '差 0.0°'), m);
    await w.click('PD 闭环');
  }

  sec('step ③ · ip: how fast a loop has to be');
  {
    const w = W('ip'); await w.show(); await wait(800);
    await w.click('人手'); await wait(500);
    let m = await w.met();
    const lv = () => p.evaluate(() => document.getElementById('ip-lv').textContent);
    ok('ip human hand (30 Hz, 0.12 s): stick 1.07 m, T = 330 ms, total lag about 137 ms = 0.41 T', (await lv()) === '1.07 m' && has(m, 'T = √(l/g) = 330 ms') && has(m, '总滞后约 137 ms = 0.41 T'), (await lv()) + ' ' + m);
    await w.set('ip-l', .73); m = await w.met(); const l60 = await lv();
    await w.set('ip-l', .72); const m58 = await w.met(), l58 = await lv();
    ok('ip slider: 60 cm reads 0.55 T and 58 cm reads 0.56 T', l60 === '60 cm' && has(m, '= 0.55 T') && l58 === '58 cm' && has(m58, '= 0.56 T'), l60 + ' ' + m + ' / ' + l58 + ' ' + m58);
    const mk = () => { const E = H.ip(P); return { E, run: E('(function(sec){const n=Math.round(sec/DT);for(let i=0;i<n;i++){step();if(fallen)return t}return null})') }; };
    const fall = (setup, secs) => { const a = mk(); a.E(setup + ';params();reset()'); const t0 = a.E('t'); const c = a.run(secs); return c === null ? null : c - t0; };
    const HUM = 'fu=Math.log(30/5)/Math.log(200);dms=120';
    { const f60 = fall('lu=.73;' + HUM, 120), f58 = fall('lu=.72;' + HUM, 120), f107 = fall('lu=.9;' + HUM, 120), f15 = fall('lu=.325;' + HUM, 60);
      ok('ip (own code) human hand: 1.07 m and 60 cm stand for two minutes, 58 cm falls after ten seconds or so, a 15 cm “pencil” (1.1 T) within about a second', f107 === null && f60 === null && f58 !== null && f58 > 5 && f58 < 25 && f15 !== null && f15 < 2 && near((.12 + .5 / 30) / Math.sqrt(.05 * Math.pow(30, .325) / 9.81), 1.1, .03), JSON.stringify([f107, f60, f58, f15])); }
    await w.click('电机控制器'); await w.set('ip-l', 0); await wait(2500); m = await w.met(); let s = await w.status();
    ok('ip motor controller (1 kHz, 1 ms), 5 cm stick: T = 71 ms, lag 0.02 T, stands firm', (await lv()) === '5 cm' && has(m, 'T = √(l/g) = 71 ms') && has(m, '= 0.02 T') && s.startsWith('稳稳立住'), m);
    await w.set('ip-d', 30); await wait(600); m = await w.met(); s = await w.status();
    ok('ip 5 cm stick, delay 30 ms: 0.43 T, “precarious”', has(m, '= 0.43 T') && s.startsWith('很悬'), m + ' ' + s.slice(0, 12));
    await w.set('ip-d', 45); await wait(300); m = await w.met();
    { const f43 = fall('lu=0;fu=1;dms=43', 120), f45 = fall('lu=0;fu=1;dms=45', 60);
      ok('ip 5 cm stick, delay 45 ms: 0.64 T; (own code) it stands for two minutes at 43 ms and falls within three seconds at 45 ms', has(m, '= 0.64 T') && f43 === null && f45 !== null && f45 < 3.5, m + ' ' + JSON.stringify([f43, f45])); }
    await w.set('ip-d', 1);
  }

  sec('step ④ · nl: the vacuum\'s three nested loops');
  {
    const w = W('nl'); await w.show(); await wait(500);
    await w.click('③ 轮速环'); const t3 = await w.text('.nld');
    await w.click('② 路线环'); const t2 = await w.text('.nld');
    await w.click('① 任务环'); const t1 = await w.text('.nld');
    ok('nl ③ wheel loop: 1000 times a second, pulses × 0.61 mm ÷ window, the error is a subtraction in m/s', has(t3, '每秒 1000 次', '0.61 mm', '单位 m/s'), t3.slice(0, 160));
    ok('nl ② route loop: 10 times a second, lidar against the map plus wheel odometry (SLAM), an error that can still be subtracted', has(t2, '每秒 10 次', '激光雷达每 0.2 秒扫一圈', 'SLAM', '可以直接相减'), t2.slice(0, 200));
    ok('nl ① task loop: acts on events, a coverage map, and a comparison that is mostly a judgement', has(t1, '有事才动', '覆盖地图', '多半是一个判断，不是减法'), t1.slice(0, 200));
  }

  sec('step ④ · cq: the quadrotor\'s four loops');
  {
    const w = W('cq'); await w.show(); await wait(600);
    const rows = () => p.evaluate(() => [...document.querySelectorAll('#cq-ch > div')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).join(' | ')).then(norm);
    const tapAt = async (x, z) => { await p.evaluate(() => document.getElementById('cq-cv').scrollIntoView({ block: 'center' })); await wait(300);
      const r = await p.evaluate(() => { const q = document.getElementById('cq-cv').getBoundingClientRect(); return { l: q.left, t: q.top, w: q.width, h: q.height }; });
      const sc = Math.min(r.w / 6.8, (r.h - 26) / 4.3); await p.mouse.move(r.l + r.w / 2 + x * sc, r.t + r.h - 16 - z * sc); await p.mouse.down(); await p.mouse.up(); };
    const mk = () => { const E = H.cq(P); return { E, run: E('(function(sec){const n=Math.round(sec/DT);for(let i=0;i<n;i++){step();if(crash)return t}return null})') }; };
    await wait(6500); let t = await rows();
    { const a = mk(); a.run(6); const x = a.E('s.x'), z = a.E('s.z');
      ok('cq at load the drone flies by itself to the target at the top right (2.20 m); the copy of its code is there after 6 s too', has(t, '位置 50 Hz | 2.20 m | 2.2') && near(x, 2.2, .05) && near(z, 2.4, .05), t.slice(0, 90) + ' copy ' + r3(x) + ',' + r3(z)); }
    await tapAt(-2.2, 2.4); await wait(120); t = await rows();
    ok('cq tap far left: the position loop asks for the 3 m/s limit', has(t, 'v* -3.00 m/s'), t.slice(0, 120));
    { const a = mk(); a.run(8); a.E('xt=-2.2;zt=2.4'); let vmax = 0, thmax = 0, wmax = 0, dfmax = 0, arr = null, mn = 9; for (let k = 0; k < 800; k++) { a.run(.01); const o = a.E('[c.vx,c.th,c.w,c.F1-c.F2,s.x]'); vmax = Math.max(vmax, Math.abs(o[0])); thmax = Math.max(thmax, Math.abs(o[1]) * 180 / Math.PI); wmax = Math.max(wmax, Math.abs(o[2]) * 180 / Math.PI); dfmax = Math.max(dfmax, Math.abs(o[3])); mn = Math.min(mn, o[4]); if (arr === null && o[4] <= -2.15) arr = (k + 1) / 100; }
      ok('cq (own code) a 4.4 m move: speed asked 3 m/s (limit), tilt asked about 29° (limit), turning rate asked over 200°/s, thrust difference over 1 N; there in under 3 s, overshoot 3 cm', vmax === 3 && near(thmax, 28.6, .2) && wmax > 200 && dfmax > 1 && arr < 3 && near(-2.2 - mn, .03, .012), JSON.stringify([vmax, r3(thmax), r3(wmax), r3(dfmax), arr, r3(-2.2 - mn)])); }
    await wait(6000); await w.click('一阵风', 60); await wait(900); let s = await w.status();
    ok('cq gust: the status says the body tilted only about 3°', has(s, '机身只歪了 3° 左右'), s.slice(0, 120));
    { const a = mk(); a.run(8); a.E('gustT=t;gk=0'); const x0 = a.E('s.x'); let mx = 0, back = null; for (let k = 0; k < 800; k++) { a.run(.01); const d = a.E('s.x') - x0; mx = Math.max(mx, d); if (back === null && k > 80 && Math.abs(d) < .05) back = (k + 1) / 100; }
      ok('cq (own code) gust: tilt 3°, blown about 0.3 m off, back within 5 cm after two to three seconds', near(a.E('gk'), 3, .4) && near(mx, .34, .06) && back > 2 && back < 3, JSON.stringify([r3(a.E('gk')), r3(mx), back])); }
    await wait(4000); await w.set('cq-r', .15); await wait(800); s = await w.status();
    ok('cq rate loop at 20 Hz: the status says the body keeps shaking', (await p.evaluate(() => document.getElementById('cq-rv').textContent)) === '20 Hz' && has(s, '角速度环每秒只跑 20 次'), s.slice(0, 60));
    { // by slider step: hover for 40 s, and (separately) hover 3 s then a new target far away, 40 s
      const trial = u => { const set = 'ru=' + u + ';fr=10*Math.pow(100,ru)'; const a = mk(); a.run(8); a.E(set); const t0 = a.E('t'); let tilt = 0, c1 = null; for (let k = 0; k < 4000 && c1 === null; k++) { c1 = a.run(.01); if (k < 2000) tilt = Math.max(tilt, Math.abs(a.E('s.th')) * 180 / Math.PI); } if (c1 !== null) c1 -= t0;
        const b2 = mk(); b2.run(8); b2.E(set); let c2 = b2.run(3), reach = false; if (c2 === null) { b2.E('xt=-2.2;zt=2.4'); const t1 = b2.E('t'); c2 = b2.run(40); if (c2 !== null) c2 -= t1; else reach = Math.abs(b2.E('s.x') + 2.2) < .4; } return { hz: 10 * Math.pow(100, u), tilt, c1, c2, reach }; };
      const t20 = trial(.15), t15 = trial(.09), low = [.04, .045, .05, .055, .06, .065, .07, .075].map(trial);
      ok('cq (own code) 20 Hz: swings to 20° or so, never crashes, still gets to a new target', near(t20.tilt, 22, 5) && t20.c1 === null && t20.c2 === null && t20.reach, JSON.stringify(t20));
      ok('cq (own code) 15 Hz: swings to 50° or so without crashing in 40 s', near(t15.tilt, 52, 8) && t15.c1 === null, JSON.stringify(t15));
      ok('cq (own code) 12 to 14 Hz (the eight slider steps that read 12, 13 or 14 Hz): most of them flip within 40 s, hovering or after a new target, some after a few seconds and some after tens of seconds', low.filter(o => o.c1 !== null || o.c2 !== null).length >= 5 && low.every(o => [12, 13, 14].includes(Math.round(o.hz))) && low.some(o => (o.c1 !== null && o.c1 < 8) || (o.c2 !== null && o.c2 < 8)) && low.some(o => (o.c1 !== null && o.c1 > 15) || (o.c2 !== null && o.c2 > 15)), JSON.stringify(low.map(o => [r3(o.hz), o.c1 && r3(o.c1), o.c2 && r3(o.c2)]))); }
    await w.click('复位'); await wait(500);
    { const a = mk(); a.run(8); a.E('kx=4;xt=-2.2;zt=2.4'); let mn = 9; const tr = []; for (let k = 0; k < 1500; k++) { a.run(.01); const x = a.E('s.x'); tr.push(x); mn = Math.min(mn, x); } let settle = 0; for (let i = tr.length - 1; i >= 0; i--) if (Math.abs(tr[i] + 2.2) > .05) { settle = (i + 1) / 100; break; }
      ok('cq (own code) k_x = 4: overshoots by about 0.7 m and stays within 5 cm only after six or seven seconds', near(-2.2 - mn, .71, .06) && settle > 5.5 && settle < 7.5, JSON.stringify([r3(-2.2 - mn), settle])); }
    await wait(6000); await w.set('cq-k', 4); await tapAt(-2.2, 2.4); await wait(1200); s = await w.status();
    ok('cq k_x = 4: the status says the position loop\'s gain is too large', has(s, '位置环的增益太大'), s.slice(0, 60));
    await wait(8000); await w.set('cq-k', 1); await wait(1500); await w.click('关掉角速度环', 60);
    let crashed = null; const t0 = Date.now(); while (Date.now() - t0 < 12000) { s = await w.status(); if (s.startsWith('坠机了')) { crashed = (Date.now() - t0) / 1000; break; } await wait(100); }
    { const a = mk(); a.run(8); a.E('rateOn=false'); const t1 = a.E('t'); const c = a.run(40);
      ok('cq rate loop off while hovering: crashes after three or four seconds (interactive: status “crashed”; own code: 3 to 4.5 s)', crashed !== null && crashed < 8 && has(s, '角速度环关掉后') && c !== null && c - t1 > 3 && c - t1 < 4.5, crashed + ' ' + r3(c - t1)); }
    await w.click('复位');
  }

  sec('step ⑤ · pw: a switch and a coil');
  {
    const w = W('pw'); await w.show(); await wait(500);
    let m = await w.met(), s = await w.status();
    ok('pw manual 50%, 20 kHz: 12.0 A, 1.20 N·m, ripple 0.30 A = 2.5% of the average', has(m, '平均电流 12.0 A', '力矩 1.20 N·m', '纹波 0.30 A') && has(s, '只有平均值的 2.5%'), m);
    await w.set('pw-f', 0); m = await w.met(); s = await w.status();
    ok('pw 1 kHz: ripple 5.88 A, 49% of the average', has(m, '纹波 5.88 A', '开关 1 kHz') && has(s, '是平均值的 49%'), m + ' ' + s.slice(0, 90));
    await w.set('pw-f', 13); await w.click('电池电压掉了'); m = await w.met(); s = await w.status();
    ok('pw 20 kHz, supply drops to 18 V, manual: the current falls to 9.0 A, a quarter less', has(m, '平均电流 9.0 A') && has(s, '少了四分之一'), m);
    await w.click('电流环'); m = await w.met(); s = await w.status();
    ok('pw current loop with the same drop: still 12.0 A, the duty cycle goes from 50% to about 66%', has(m, '平均电流 12.0 A', '占空比 66%') && has(s, '从 50% 调到约 66%'), m);
    await w.click('电池电压掉了'); s = await w.status();
    { const E = H.pw(P); const rise = (mode) => { E('mode="' + mode + '";sag=false;fi=13;compute()'); const o = E('res.out'), N = 100, tgt = mode === 'man' ? E('D*VN/R') : E('It'); const per = []; for (let k = 0; k * N * 3 < o.length; k++) { let sm = 0; for (let n = 0; n < N; n++) sm += o[(k * N + n) * 3 + 2]; per.push([o[k * N * 3], sm / N]); } const at = fr => (per.find(q => q[1] >= fr * tgt)[0] - .5e-3) * 1000; return [at(.63), at(.95)]; };
      const man = rise('man'), loop = rise('loop');
      ok('pw (own code) switch-on at 20 kHz: manual reaches 63% after 1 ms and 95% after 3 ms; the current loop reaches 95% after about 0.65 ms, more than four times sooner', near(man[0], 1, .051) && near(man[1], 3, .051) && near(loop[1], .65, .051) && man[1] / loop[1] > 4 && has(s, '约 0.6 毫秒就到了目标'), JSON.stringify([man, loop])); }
    await w.click('手动设占空比');
  }

  // a literal (array or object) that follows `start` in a script, evaluated on its own
  const literal = (src, start) => { const i = src.indexOf(start); if (i < 0) throw new Error('no ' + start); let k = i + start.length, d = 0, q = null; const o = k;
    for (; k < src.length; k++) { const c = src[k]; if (q) { if (c === '\\') k++; else if (c === q) q = null; } else if (c === "'" || c === '"' || c === '`') q = c; else if (c === '[' || c === '{') d++; else if (c === ']' || c === '}') { d--; if (d === 0) break; } }
    return new Function('E', 'return ' + src.slice(o, k + 1))(0); };

  sec('step ⑥ · sc: who reacts first');
  {
    const w = W('sc'); await w.show(); await wait(500);
    const look = async (robot, k) => { await w.click(robot, 250); await p.evaluate(k => document.querySelectorAll('#sc .scmi')[k - 1].click(), k); await wait(250);
      return p.evaluate(() => { const q = s => [...document.querySelectorAll('#sc ' + s)].filter(e => e.getClientRects().length > 0); const t = e => e.innerText.replace(/\s+/g, ' ').trim();
        return { title: q('.sctl').map(t).join(' '), hot: q('.scb.hot').map(b => t(b.querySelector('.sch'))).join(' / '), cards: q('.scb').map(t).join(' ## '), st: q('.status').map(t).join(' ') }; }); };
    let o = await look('扫地机器人', 3);
    ok('sc vacuum, moment 3 (the sill): the ③ wheel loop reacts first; right wheel down to 0.17 m/s, voltage 6.3 V → about 10 V, back at 0.25 m/s within 0.1 s; the body is less than 1° off', has(o.title, '右轮压上门槛') && o.hot.startsWith('③ 轮速环') && has(o.cards, '掉到 0.17 m/s', '从 6.3 V 加到约 10 V', '0.1 秒内回到 0.25 m/s') && has(o.st, '不到 1°') && (.25 / .04).toFixed(2) === '6.25', o.hot + ' | ' + o.st.slice(0, 80));
    o = await look('扫地机器人', 5);
    ok('sc vacuum, moment 5 (the wet patch): the ② route loop reacts first (heading 8° off); the encoders count every pulse', has(o.title, '在水渍上打滑') && o.hot.startsWith('② 路线环') && has(o.cards, '朝向差 8°') && has(o.st, '编码器数到的脉冲一个不少'), o.hot + ' | ' + o.st.slice(0, 80));
    o = await look('机械臂', 3);
    ok('sc arm, moment 3: the ③ velocity loop reacts first, not the innermost ④ current loop; 0.2 kg × 9.8 × 0.6 m ≈ 1.2 N·m, ÷ 100 ÷ 0.1 N·m/A ≈ 0.12 A', o.hot.startsWith('③ 速度环') && has(o.cards, '④ 电流环') && has(o.st, '多出来的 0.2 kg', '约 1.2 N·m', '约 0.12 A') && (.2 * 9.8 * .6).toFixed(1) === '1.2' && (.2 * 9.8 * .6 / 100 / .1).toFixed(2) === '0.12', o.hot);
    o = await look('四旋翼', 2);
    ok('sc quadrotor, moment 2 (a gust): the innermost ⑤ rate loop reacts first', o.hot.startsWith('⑤ 角速度环'), o.hot);
    o = await look('自动驾驶汽车', 2);
    ok('sc car, moment 2: the new target enters at the outermost ① loop and passes through ② tracking, ③ brake pressure, ④ motor current; about 0.3 s in all, in which a car at 40 km/h covers over 3 m (3.3 m)', o.hot.startsWith('① 行为与规划环') && has(o.cards, '② 轨迹跟踪环', '③ 转向角环、制动压力环', '④ 电机电流环') && has(o.st, '0.3 秒左右', '已经开出去 3 m 多') && near(40 / 3.6 * .3, 3.33, .01), o.hot + ' | ' + o.st.slice(0, 60));
  }

  sec('step ⑥ · tz: the same 0.3 s on eight clocks');
  {
    const w = W('tz'); await w.show(); await wait(400);
    let m = await w.met();
    ok('tz runs in the 0.3 s after the push: task 0, navigation 0, camera 9, MPC 12, whole-body 150, state estimate 300, joint PD 3000, current loop 12000', has(m, '任务 0', '导航规划 0', '相机感知 9', 'MPC 脚力 12', '全身控制 150', '状态估计 300', '关节 PD 3000', '电流环 12000'), m);
    await w.click('1 秒'); let s = await w.status();
    ok('tz 1 s window: navigation, camera and MPC tick by tick; whole-body control, state estimate, joint PD and current loop are solid bands', has(s, '一道一道看得清的是导航规划、相机感知、MPC 脚力；全身控制、状态估计、关节 PD、电流环密成了色带'), s);
    await w.click('0.1 毫秒'); s = await w.status();
    const src = P.wsrc('tz'), ROWS = literal(src, 'const ROWS='), ph = literal(src, 'const ph='); const first = i => ((1 - ph[i] % 1) % 1) / ROWS[i].f;
    const runsIn = (i, T) => { let n = 0; for (let t = first(i); t <= T + 1e-12; t += 1 / ROWS[i].f) n++; return n; };
    const iC = ROWS.findIndex(r => r.zh === '电流环'), iJ = ROWS.findIndex(r => r.zh === '关节 PD');
    ok('tz 0.1 ms window: only joint PD and current loop are visible, the rows above have not run; in the 85 µs after the push the current loop (every 25 µs) runs 3 times and the joint PD once', has(s, '一道一道看得清的是关节 PD、电流环', '一次都没运行', '推还没有发生') && ROWS[iC].f === 40000 && runsIn(iC, 85e-6) === 3 && runsIn(iJ, 85e-6) === 1 && runsIn(iC, .3) === 12000, s.slice(0, 60) + ' ' + runsIn(iC, 85e-6) + ' ' + runsIn(iJ, 85e-6));
    await w.click('1 秒');
  }

  sec('step ⑦ · sk: layers × levels');
  {
    const w = W('sk'); await w.show(); await wait(600);
    await w.click('扫地机器人', 300); await w.click('感知与估计', 300); let t = await w.text('.nld');
    ok('sk vacuum, “Perception and estimation”: ① coverage map, ② SLAM, ③ does not pass through this layer', has(t, '① 任务环 · 有事才动 覆盖地图（扫过的格子、电量）', '② 路线环 · 每秒 10 次 SLAM（位置和朝向）', '③ 轮速环 · 每秒 1000 次 不经过这一层'), t.slice(-150));
    await w.click('机械臂', 300); await w.click('控制', 300); t = await w.text('.nld');
    ok('sk arm, “Control”: ② position P at 4000/s, ③ velocity PI at 8000/s, ④ current PI at 16,000/s; ① does not pass through', has(t, '不经过这一层 ② 位置环 · 每秒 4000 次 位置 P', '③ 速度环 · 每秒 8000 次 速度 PI', '④ 电流环 · 每秒 1.6 万次 电流 PI'), t.slice(-190));
    const R = literal(P.wsrc('sk'), 'const R=');
    const cols = R.map(o => o.L.map(L => L.cmp)), names = R.map(o => o.n[0]);
    ok('sk the three control levels of the arm are all computed in the joint drive', R[1].L.slice(1).every(L => L.hw[0] === '关节驱动器') && R[1].L.length === 4, R[1].L.map(L => L.hw[0]).join(','));
    ok('sk where each level compares (column 2 = decision, 3 = planning, 4 = control): outermost always decision; vacuum route loop and quadruped MPC loop in planning; all others in control; 3, 4, 4, 5, 5 levels', JSON.stringify(cols) === '[[2,3,4],[2,4,4,4],[2,4,4,4],[2,4,4,4,4],[2,3,4,4,4]]' && names.join() === '扫地机器人,机械臂,自动驾驶汽车,四旋翼,四足机器人' && R[0].L[1].n[0] === '路线环' && R[4].L[1].n[0] === 'MPC 环', JSON.stringify(cols));
    await w.click('扫地机器人', 300);
  }

  sec('step ⑧ · st: the whole vacuum');
  {
    const mk = () => { const E = H.st(P); const run = E('(function(n){for(let i=0;i<n;i++)step()})'); return { E, run, until: (cond, maxSec) => { const f = E('(function(maxN){for(let i=0;i<maxN;i++){step();if(' + cond + ')return t}return null})'); return f(Math.round(maxSec * 1000)); } }; };
    const BOX = (x, y) => 'boxes.push({x:' + (x - .22) + ',y:' + (y - .22) + ',w:.44,h:.44})';
    // one undisturbed lap
    const a = mk(); const tA = a.until('N.task>=1', 60), tB = a.until('N.task>=2', 60), tLap = a.until('N.task>=3', 60), N = a.E('Object.assign({},N)');
    ok('st (own code) one lap dock → A → B → dock takes about 61 s of simulated time (about half a minute at speed ×2): task 3, global planning 4, perception about 300, local planning about 600, base control about 3000, wheel loop over 60,000 runs; safety 0', near(tLap, 61.3, 1) && N.task === 3 && N.glob === 4 && near(N.per, 307, 6) && near(N.loc, 614, 10) && near(N.base, 3067, 40) && N.wheel > 60000 && N.wheel < 63000 && N.safe === 0, JSON.stringify([tA, tB, tLap, N]));
    KEEP.tA = tA;
    // a box on the A → B leg with perception on
    { const b2 = mk(); b2.until('N.task>=1', 60); const g0 = b2.E('N.glob'); b2.E(BOX(3.2, 1.08)); const t2 = b2.until('N.task>=2', 80);
      ok('st (own code) a box dropped on the path, perception on: global planning searches again, the robot reaches B without a bump', t2 !== null && b2.E('N.safe') === 0 && b2.E('N.glob') - g0 >= 2 && b2.E('Math.hypot(R.x-6.6,R.y-1.9)') < .2, JSON.stringify([t2, b2.E('N.glob') - g0, b2.E('N.safe')])); }
    // perception off, a box in the open room
    { const b2 = mk(); b2.until('N.task>=1', 60); b2.E('on.per=false;plan();' + BOX(5.6, 1.45)); const tb = b2.until('N.safe>=1', 60), mode = b2.E('safe.mode'), plen = b2.E('path.length'); const t2 = b2.until('N.task>=2', 80);
      ok('st (own code) perception off, a box in the open: the robot bumps into it (safety takes over and backs off), the spot goes into the map, global planning finds a way round, and it reaches B', tb !== null && mode === 'bump' && plen > 1 && t2 !== null && b2.E('Math.hypot(R.x-6.6,R.y-1.9)') < .2 && b2.E('map.some(v=>v===2)'), JSON.stringify([tb, mode, plen, t2])); }
    // perception off, a box that blocks the passage between table and wall
    { const b2 = mk(); b2.until('N.task>=1', 60); b2.E('on.per=false;plan();' + BOX(3.2, 1.08)); const tb = b2.until('N.safe>=1', 60), plen = b2.E('path.length'); const t2 = b2.until('N.task>=2', 30), far = b2.E('Math.hypot(R.x-6.6,R.y-1.9)');
      ok('st (own code) perception off, a box blocking the narrow passage: after the bump global planning finds no route, and 3 s later the task program moves on to the next goal without having reached B', tb !== null && plen === 0 && t2 !== null && near(t2 - tb, 3.3, .8) && far > 2, JSON.stringify([tb, plen, t2 && r3(t2 - tb), r3(far)])); }
    // global planning off
    { const b2 = mk(); b2.E('on.glob=false;plan()'); b2.run(30000);
      ok('st (own code) global planning off: in 30 s it bumps into furniture again and again and never reaches A', b2.E('N.safe') >= 5 && b2.E('N.task') === 0, 'bumps ' + b2.E('N.safe')); }
    // wheel loop off between A and B
    { const b2 = mk(); const t1 = b2.until('N.task>=1', 60); b2.E('on.wheel=false'); const t2 = b2.until('N.task>=2', 80);
      ok('st (own code) wheel loop off: A → B takes nearly a fifth longer (about 25 s against 21 s)', near(tB - tA, 21.2, .6) && near(t2 - t1, 25.1, .8) && (t2 - t1) / (tB - tA) > 1.14 && (t2 - t1) / (tB - tA) < 1.22, JSON.stringify([r3(tB - tA), r3(t2 - t1)])); }
    // freeze the main computer
    { const b2 = mk(); b2.run(25000); const n0 = b2.E('[N.task,N.glob,N.per,N.loc,N.base,N.wheel]'); b2.E('freeze=true'); b2.run(350); const mode = b2.E('safe.mode'), wt = b2.E('[wt.L,wt.R]'); b2.run(1000); const n1 = b2.E('[N.task,N.glob,N.per,N.loc,N.base,N.wheel]');
      ok('st (own code) main computer frozen: 0.35 s later the watchdog has stopped both wheels; the four programs on the main computer stop counting, base control and the wheel loop go on', mode === 'wd' && wt[0] === 0 && wt[1] === 0 && n1.slice(0, 4).join() === n0.slice(0, 4).join() && n1[4] > n0[4] + 50 && n1[5] > n0[5] + 1000, mode + ' ' + JSON.stringify([n0, n1])); }
    // the interactive itself: arrival at A, then the freeze
    const w = W('st'); await w.show();
    const cells = () => p.evaluate(() => { const c = [...document.querySelectorAll('#st-ly > div')].map(e => e.innerText.replace(/\s+/g, ' ').trim()); const o = {}; for (let i = 3; i < c.length; i += 3) o[c[i].split(' ')[0]] = [c[i + 1], c[i + 2]]; return o; });
    let c = null; const t0 = Date.now(); while (Date.now() - t0 < 30000) { c = await cells(); if (+c['任务'][1] >= 1) break; await wait(80); }
    ok('st interactive: when it reaches A the wheel loop has run about 17,200 times, as in the copy (' + Math.round(tA * 1000) + ')', +c['任务'][1] === 1 && near(+c['轮速环'][1], tA * 1000, 700) && c['全局规划'][1] === '2', JSON.stringify(c['轮速环']) + ' ' + JSON.stringify(c['全局规划']));
    await wait(1500); await w.click('让主电脑卡住', 60); await wait(900); c = await cells(); const loc0 = c['局部规划'][1], wh0 = +c['轮速环'][1]; await wait(1000); const c2 = await cells();
    ok('st interactive, main computer frozen: the safety row reads “watchdog: stop”, both wheel targets are 0.00, local planning stops counting and the wheel loop goes on', c['安全'][0] === '看门狗：停车' && c['底盘控制'][0] === '左 0.00 · 右 0.00' && c2['局部规划'][1] === loc0 && +c2['轮速环'][1] > wh0 + 500, JSON.stringify([c['安全'], c['底盘控制'], loc0, c2['局部规划'][1]]));
    await w.click('让主电脑卡住');
  }

  sec('step ⑨ · rb: five robots by frequency');
  {
    const w = W('rb'); await w.show(); await wait(500);
    const BOTS = literal(P.wsrc('rb'), 'const BOTS=');
    const st = {}; for (const r of ['机械臂', '四足', '自动驾驶汽车', '四旋翼', '扫地机器人']) { await w.click(r, 250); st[r] = await w.status(); }
    const row = (bot, name) => BOTS.find(o => o.zh === bot).rows.find(q => q[0] === name);
    ok('rb arm: control layer from the controller\'s real-time interface (125 Hz – 1 kHz) through the joint position and velocity loops (1 – 8 kHz) to the current loop (10 – 40 kHz); camera from 15 Hz; about 3 orders of magnitude', has(st['机械臂'], '差了约 3 个数量级', '控制器的实时接口（125 Hz – 1 kHz）', '电流环（10 kHz – 40 kHz）', '腕部相机视觉（15 Hz）') && row('机械臂', '关节位置环、速度环')[2] === 1000 && row('机械臂', '关节位置环、速度环')[3] === 8000, st['机械臂'].slice(0, 120));
    ok('rb quadrotor rate loop 400 Hz – 8 kHz; car lateral and longitudinal control 50 – 100 Hz', has(st['四旋翼'], '角速度环（400 Hz – 8 kHz）') && has(st['自动驾驶汽车'], '横向和纵向控制（50 Hz – 100 Hz）'), st['四旋翼'].slice(0, 100));
    const ord = Object.fromEntries(Object.entries(st).map(([k, v]) => [k, num(v, /差了约 (\d) 个数量级/)]));
    ok('rb quadruped: current loop at 40 kHz against navigation planning at 0.5 Hz, about 5 orders of magnitude, the widest of the five (3, 5, 4, 4, 4)', has(st['四足'], '（40 kHz）', '导航规划（0.5 Hz）', '差了约 5 个数量级') && JSON.stringify(ord) === '{"机械臂":3,"四足":5,"自动驾驶汽车":4,"四旋翼":4,"扫地机器人":4}' && near(Math.log10(40000 / .5), 4.9, .01), JSON.stringify(ord));
    ok('rb vacuum: motor PWM at 20 kHz (the innermost box of figure 1)', has(st['扫地机器人'], '电机 PWM（20 kHz）'), st['扫地机器人'].slice(0, 60));
  }

  sec('step ⑩ · bs: CAN and EtherCAT');
  {
    const w = W('bs'); await w.show(); await wait(400);
    const stepAll = async () => { const out = []; for (let k = 0; k < 11; k++) { await w.click('下一位', 100); out.push(await w.status()); } return out; };
    await w.click('重来'); let ss = await stepAll();
    ok('bs all four send: Air con (0x3E8) drops out at bit 9, Battery (0x1F4) at bit 8, Steering (0x0C8) at bit 7; Brakes (0x064) wins', has(ss[1], '第 9 位', '空调发现自己发的 1 被盖掉') && has(ss[2], '第 8 位', '电池发现自己发的 1 被盖掉') && has(ss[3], '第 7 位', '转向发现自己发的 1 被盖掉') && has(ss[10], '刹车（ID 最小，0x064）赢了') && (1000).toString(16) === '3e8' && (500).toString(16) === '1f4' && (200).toString(16) === 'c8' && (100).toString(16) === '64', ss[10].slice(-80));
    await w.click('刹车 0x064'); ss = await stepAll();
    ok('bs without Brakes: Steering (0x0C8) wins', has(ss[10], '转向（ID 最小，0x0C8）赢了'), ss[10].slice(-80));
    await w.click('刹车 0x064'); await w.click('EtherCAT：一列火车'); await wait(300);
    const at = async n => { await w.set('bs-n', n, 120); return (await w.met()) + ' || ' + (await w.status()); };
    const s4 = await at(4), s5 = await at(5), s60 = await at(60);
    ok('bs EtherCAT, 4 drives: polling over CAN takes 0.9 ms and still fits; with 5 it takes 1.1 ms and no longer fits in 1 ms', has(s4, '要 0.9 ms，还塞得下') && has(s5, '要 1.1 ms', '装不下') && (4 * 2 * .111).toFixed(1) === '0.9' && (5 * 2 * .111).toFixed(1) === '1.1', s5.slice(-90));
    ok('bs EtherCAT, 60 drives: a frame of about 1472 bytes takes about 161 µs, 16% of the 1 ms cycle (about a sixth); CAN would take 13.3 ms', has(s60, '1472 字节', '约 161 µs', '的 16%', '要 13.3 ms') && 32 + 24 * 60 === 1472 && Math.round((52 + 24 * 60) * .08 + 60 * .7) === 161 && near(1 / .161, 6.2, .1), s60.slice(0, 40));
    await w.set('bs-n', 12); await w.click('CAN：谁先说话'); await w.click('重来');
  }

  sec('step ⑩ · tm: time stamps that disagree');
  {
    const w = W('tm'); await w.show(); await wait(400);
    const at = async (d, v) => { if (v !== undefined) await w.set('tm-v', v, 100); await w.set('tm-d', d, 120); return { m: await w.met(), s: await w.status() }; };
    let o = await at(0, 20);
    ok('tm 20 m/s, Δt = 0: aligned, 6.0 m', has(o.m, '错开 0.00 m', '平均距离 6.0 m') && o.s.startsWith('时间对齐了'), o.m);
    o = await at(1);
    ok('tm Δt = 1 ms: 2 cm out of place, 2% of the points already behind the car, 6.2 m', has(o.m, '错开 0.02 m', '平均距离 6.2 m') && has(o.s, '错开 0.02 m', '有 2% 的点'), o.m + ' || ' + o.s);
    const o10 = await at(10), o30 = await at(30), o50 = await at(50);
    ok('tm Δt = 10 ms: 0.20 m, 5%, 6.3 m; 30 ms: 0.60 m, 15%, 7.0 m', has(o10.m, '错开 0.20 m', '平均距离 6.3 m') && has(o10.s, '有 5% 的点') && has(o30.m, '错开 0.60 m', '平均距离 7.0 m') && has(o30.s, '有 15% 的点'), o10.m + ' / ' + o30.m);
    ok('tm Δt = 50 ms: 1.00 m out of place, 22% of the points behind the car, fused distance 7.5 m, 1.5 m too far', has(o50.m, '错开 1.00 m', '平均距离 7.5 m') && has(o50.s, '框里 22% 的激光点打在车后面', '7.5 m 外') && near(7.5 - 6, 1.5, 1e-9), o50.m);
    o = await at(50, 0);
    ok('tm speed 0 with Δt = 50 ms: nothing out of place, 6.0 m', has(o.m, '错开 0.00 m', '平均距离 6.0 m') && o.s.startsWith('车停着不动'), o.m);
    await w.set('tm-v', 20); await w.click('用 PTP 对齐时钟'); const s = await w.status();
    ok('tm PTP: clocks about 1 µs apart, the car 0.02 mm out of place', has(s, '时间对齐了', '只差约 1 微秒', '只错开 0.02 毫米') && near(20 * 1e-6 * 1000, .02, 1e-9), s);
  }

  // =============================================================================================================
  // Part B: the numbers of the text and of the figures
  // =============================================================================================================
  const TX = {}; for (const id of ['s-map', 's-loop', 's-law', 's-rate', 's-cas', 's-cur', 's-run', 's-layer', 's-stack', 's-kinds', 's-wire', 's-sum']) TX[id] = await secText(id);
  const HDR = await p.evaluate(() => document.querySelector('header').innerText).then(norm);
  const T = (id, ...strs) => strs.every(s => (id === 'hdr' ? HDR : TX[id]).includes(s));
  const missing = (id, ...strs) => strs.filter(s => !(id === 'hdr' ? HDR : TX[id]).includes(s)).join(' ¦ ');
  // the text inside a figure (labels and caption), in Chinese
  const FIG = await p.evaluate(() => [...document.querySelectorAll('figure.fig')].map(f => [...f.querySelectorAll('text')].map(t => [...t.childNodes].map(n => n.nodeName === 'es' || (n.classList && n.classList.contains('en')) ? '' : n.textContent).join('')).join(' ¦ ') + ' ¦¦ ' + [...f.querySelectorAll('figcaption .zh, figcaption')].map(e => e.innerText)[0])).then(a => a.map(norm));
  const lpc = (() => { const E = H.lp(P); return E('({K,TAU,UM,KP,KI,MPC,CARPET})'); })();

  sec('text · the header and step 0');
  ok('hdr "the route is recomputed over a thousand times, the wheel speed corrected hundreds of thousands of times, the power switches flipped millions of times" in a few minutes: at 10, 1000 and 20,000 times a second, 3 to 5 minutes give 1800–3000, 180,000–300,000 and 3.6–6 million', T('hdr', '路线重算了上千次', '纠正了几十万次', '开关了几百万次') && 10 * 180 === 1800 && 1000 * 300 === 300000 && 20000 * 180 === 3.6e6, missing('hdr', '路线重算了上千次', '纠正了几十万次', '开关了几百万次'));
  ok('fig 1: the rates on the nested boxes (10 and 1000 times a second, about 20,000) are those of the interactives', FIG[0].includes('每秒 10 次') && FIG[0].includes('每秒 1000 次') && FIG[0].includes('每秒约 2 万次'), FIG[0].slice(0, 200));

  sec('text · step ① the wheel loop');
  { const K = lpc.K, vP = K * lpc.KP * .3 / (1 + K * lpc.KP);
    ok('card: with the proportional term alone the wheel settles at 0.24 m/s; the missing 0.06 m/s times K_p is 6 V, and 6 V gives 0.24 m/s; 0.30 m/s needs 7.5 V', T('s-loop', '这里会停在 0.24 m/s', '差的 0.06 m/s 乘上 Kp 正好是 6 V', '6 V 只够转出 0.24 m/s', '大约 7.5 V') && near(vP, .24, 1e-9) && near((.3 - vP) * lpc.KP, 6, 1e-9) && near(6 * K, .24, 1e-9), missing('s-loop', '这里会停在 0.24 m/s', '差的 0.06 m/s 乘上 Kp 正好是 6 V', '6 V 只够转出 0.24 m/s', '大约 7.5 V'));
    ok('card: K_i ≈ 1700 V/m (K_p ÷ 0.06 s = 1667); example: e = 0.03 m/s gives 3 V, plus about 7.5 V, about 10.5 V', T('s-loop', 'Ki ≈ 1700 V/m', 'e = 0.03 m/s', '比例项给 3 V', '加起来约 10.5 V') && Math.round(lpc.KI / 100) * 100 === 1700 && near(.03 * lpc.KP, 3, 1e-9) && near(3 + 7.5, 10.5, 1e-9), missing('s-loop', 'Ki ≈ 1700 V/m', 'e = 0.03 m/s', '比例项给 3 V', '加起来约 10.5 V'));
    ok('text: circumference 0.22 m ÷ 360 pulses = 0.61 mm a pulse; 7.5 V on the carpet gives only 0.18 m/s', T('s-loop', '轮子周长 0.22 m，一圈 360 个脉冲，一个脉冲就是 0.61 mm', '同样 7.5 V，在地毯上只转得出 0.18 m/s') && (.22 / 360 * 1000).toFixed(2) === '0.61' && near(7.5 * K * (1 - lpc.CARPET), .18, 1e-9), missing('s-loop', '轮子周长 0.22 m，一圈 360 个脉冲，一个脉冲就是 0.61 mm', '同样 7.5 V，在地毯上只转得出 0.18 m/s'));
    ok('quiz 1: 0.20 ÷ 0.22 ≈ 0.91, so the wheel really turns at 0.30 ÷ 0.91 ≈ 0.33 m/s, 10% fast', T('s-sum', '0.20 ÷ 0.22 ≈ 0.91', '0.30 ÷ 0.91 ≈ 0.33 m/s，快了 10%') && (.2 / .22).toFixed(2) === '0.91' && (.3 / .91).toFixed(2) === '0.33' && Math.round((.22 / .2 - 1) * 100) === 10, missing('s-sum', '0.20 ÷ 0.22 ≈ 0.91', '0.30 ÷ 0.91 ≈ 0.33 m/s，快了 10%'));
    const pulses = (v, w) => v * w / lpc.MPC;
    ok('fig 2: at 0.30 m/s a pulse comes about every 2 ms; 1 or 2 pulses in 2 ms read 0.31 or 0.61 m/s, 9 or 10 in 20 ms read 0.275 or 0.306, 24 or 25 in 50 ms read 0.293 or 0.306', FIG[1].includes('0、0.31 或 0.61 m/s') && FIG[1].includes('0.275 或 0.306 m/s') && FIG[1].includes('0.293 或 0.306 m/s') && FIG[1].includes('约每 2 毫秒来一个') && near(lpc.MPC / .3 * 1000, 2.04, .01) && (lpc.MPC / .002).toFixed(2) === '0.31' && (2 * lpc.MPC / .002).toFixed(2) === '0.61' && (9 * lpc.MPC / .02).toFixed(3) === '0.275' && (10 * lpc.MPC / .02).toFixed(3) === '0.306' && (24 * lpc.MPC / .05).toFixed(3) === '0.293' && (25 * lpc.MPC / .05).toFixed(3) === '0.306' && Math.floor(pulses(.3, .02)) === 9 && Math.floor(pulses(.3, .05)) === 24, FIG[1].slice(0, 260)); }

  sec('text · step ② the joint');
  { const G = (.5 * .2 + 1 * .4) * 9.8 * Math.cos(Math.PI / 6);
    ok('card example: 50 × 0.1 rad = 5 N·m (0.1 rad is about 6°), minus 4 N·m of damping leaves 1 N·m', T('s-law', '0.1 rad（约 6°）', '弹簧给 5 N·m', '再减掉 4 N·m，实际只出 1 N·m') && Math.round(.1 * 180 / Math.PI) === 6 && near(50 * .1 - 4 * 1, 1, 1e-9), missing('s-law', '0.1 rad（约 6°）', '弹簧给 5 N·m', '再减掉 4 N·m，实际只出 1 N·m'));
    ok('text: gravity torque (0.5 × 0.2 + 1 × 0.4) × 9.8 × cos 30° ≈ 4.2 N·m; sag ≈ 4.2 ÷ 50 ≈ 0.084 rad, about 5°', T('s-law', '(0.5 × 0.2 + 1 × 0.4) × 9.8 × cos 30° ≈ 4.2 N·m', '4.2 ÷ 50 ≈ 0.084 rad，约 5°') && G.toFixed(1) === '4.2' && (4.2 / 50).toFixed(3) === '0.084' && Math.round(.084 * 180 / Math.PI) === 5, missing('s-law', '(0.5 × 0.2 + 1 × 0.4) × 9.8 × cos 30° ≈ 4.2 N·m', '4.2 ÷ 50 ≈ 0.084 rad，约 5°') + ' ' + G);
    ok('quiz 2: 4.2 ÷ 50 = 0.084 rad ≈ 4.8°; 1° ≈ 0.0175 rad; K_p at least 4.2 ÷ 0.0175 = 240 N·m/rad', T('s-sum', '4.2 ÷ 50 = 0.084 rad ≈ 4.8°', '1° ≈ 0.0175 rad', '4.2 ÷ 0.0175 = 240 N·m/rad') && (.084 * 180 / Math.PI).toFixed(1) === '4.8' && (Math.PI / 180).toFixed(4) === '0.0175' && near(4.2 / .0175, 240, 1e-9), missing('s-sum', '4.2 ÷ 50 = 0.084 rad ≈ 4.8°', '1° ≈ 0.0175 rad', '4.2 ÷ 0.0175 = 240 N·m/rad')); }

  sec('text · step ③ rate and delay');
  { const Tb = Math.sqrt(1.2 / 9.8), Tp = Math.sqrt(.15 / 9.8);
    ok('card example: T = √(1.2 ∕ 9.8) ≈ 0.35 s for the broom, √(0.15 ∕ 9.8) ≈ 0.12 s for the pencil', T('s-rate', 'T = √(1.2 ∕ 9.8) ≈ 0.35 s', 'T = √(0.15 ∕ 9.8) ≈ 0.12 s') && Tb.toFixed(2) === '0.35' && Tp.toFixed(2) === '0.12', missing('s-rate', 'T = √(1.2 ∕ 9.8) ≈ 0.35 s', 'T = √(0.15 ∕ 9.8) ≈ 0.12 s'));
    ok('fig 4: starting from rest the tilt grows as cosh(t ∕ T): after 0.15 s the broom is at ×1.1 (a tenth more) and the pencil at ×1.8; after 0.30 s the pencil is at ×5.7 and the broom at ×1.4', FIG[3].includes('T ≈ 0.35 秒') && FIG[3].includes('T ≈ 0.12 秒') && FIG[3].includes('铅笔已经是 1.8 倍') && FIG[3].includes('铅笔是 5.7 倍，扫把 1.4 倍') && FIG[3].includes('多偏了一成') && Math.cosh(.15 / Tb).toFixed(1) === '1.1' && Math.cosh(.15 / Tp).toFixed(1) === '1.8' && Math.cosh(.3 / Tp).toFixed(1) === '5.7' && Math.cosh(.3 / Tb).toFixed(1) === '1.4', FIG[3].slice(-200));
    ok('quiz 3: T at least 0.15 ÷ 0.5 = 0.3 s, so l = g · T² ≈ 9.8 × 0.09 ≈ 0.9 m', T('s-sum', '0.15 ÷ 0.5 = 0.3 s', '9.8 × 0.09 ≈ 0.9 m') && near(.15 / .5, .3, 1e-9) && (9.8 * .09).toFixed(1) === '0.9', missing('s-sum', '0.15 ÷ 0.5 = 0.3 s', '9.8 × 0.09 ≈ 0.9 m')); }

  sec('text · step ④ the cascade');
  ok('card example: 2 m × 1 /s = 2 m/s; 2.5 /s × 2 m/s = 5 m/s²; 5 ∕ 9.8 ≈ 0.5 rad, nearly 30°; 8 /s × 0.5 rad ≈ 4 rad/s, about 230° a second', T('s-cas', '要的速度 2 m/s', '要的加速度 5 m/s²', '5 ∕ 9.8 ≈ 0.5 rad，将近 30°', '约 4 rad/s，每秒转 230° 左右') && (5 / 9.8).toFixed(1) === '0.5' && near(5 / 9.8 * 180 / Math.PI, 29.2, .1) && Math.round(8 * 5 / 9.8) === 4 && Math.round(4 * 180 / Math.PI / 10) * 10 === 230, missing('s-cas', '要的速度 2 m/s', '要的加速度 5 m/s²', '5 ∕ 9.8 ≈ 0.5 rad，将近 30°', '约 4 rad/s，每秒转 230° 左右'));
  { const c = (() => { const E = H.cq(P); return E('({KV,KTH,KW,TMOT})'); })();
    ok('the gains of the card example are those of the interactive (k_v = 2.5 /s, k_θ = 8 /s) and the motors take about 20 ms to follow', c.KV === 2.5 && c.KTH === 8 && c.TMOT === .02 && T('s-cas', 'kv = 2.5 /s', 'kθ = 8 /s', '电机的推力要 20 毫秒左右才跟上命令'), JSON.stringify(c) + missing('s-cas', 'kv = 2.5 /s', 'kθ = 8 /s', '电机的推力要 20 毫秒左右才跟上命令')); }

  sec('text · step ⑤ the current loop');
  ok('card example: D ≈ 7.5 ∕ 14.4 ≈ 0.52; 24 V at 50% is 12 V, 12 A through 1 Ω, 1.2 N·m at 0.1 N·m/A; ripple 24 × 0.5 × 0.5 ∕ (0.001 × 20000) = 0.3 A, about 6 A at 1 kHz', T('s-cur', 'D ≈ 7.5 ∕ 14.4 ≈ 0.52', '平均 12 V', '平均电流约 12 A', '力矩 1.2 N·m', '24 × 0.5 × 0.5 ∕ (0.001 × 20000) = 0.3 A', '纹波约 6 A') && (7.5 / 14.4).toFixed(2) === '0.52' && near(24 * .5 * .5 / (.001 * 20000), .3, 1e-9) && near(24 * .25 / (.001 * 1000), 6, 1e-9) && near(12 * .1, 1.2, 1e-9), missing('s-cur', 'D ≈ 7.5 ∕ 14.4 ≈ 0.52', '平均 12 V', '平均电流约 12 A', '力矩 1.2 N·m', '24 × 0.5 × 0.5 ∕ (0.001 × 20000) = 0.3 A', '纹波约 6 A'));
  ok('quiz 5: from 20 kHz to 2 kHz the ripple grows about 10 times (formula: exactly 10; the interactive: 2.98 A against 0.30 A)', T('s-sum', '大约变成 10 倍') && near(2.98 / .3, 10, .1), missing('s-sum', '大约变成 10 倍'));

  sec('text · steps ⑥ to ⑩');
  { const ROWS = literal(P.wsrc('tz'), 'const ROWS='); const f = n => ROWS.find(r => r.zh === n).f;
    ok('step 6 text: whole-body control 500 times a second, camera 30 frames, navigation once a second, joint PD drawn at 10,000 and the current loop at 40,000: the rows of the time-zoom interactive; 40,000 against 1 is nearly five orders of magnitude', T('s-run', '全身控制每秒 500 次', '相机每秒 30 帧', '导航规划一秒才一次', '画成每秒 1 万次', '每秒 4 万次', '差了将近五个数量级') && f('全身控制') === 500 && f('相机感知') === 30 && f('导航规划') === 1 && f('关节 PD') === 10000 && f('电流环') === 40000 && near(Math.log10(40000), 4.6, .01), missing('s-run', '全身控制每秒 500 次', '相机每秒 30 帧', '导航规划一秒才一次', '画成每秒 1 万次', '每秒 4 万次', '差了将近五个数量级')); }
  ok('step 8 card example and fig 7: v = 0.3 m/s, ω = 1 rad/s, b = 0.25 m give 0.175 m/s for the left wheel and 0.425 m/s for the right', T('s-stack', '左轮 0.3 − 0.125 = 0.175 m/s，右轮 0.425 m/s'.replace('−', '-')) && near(.3 - 1 * .25 / 2, .175, 1e-9) && near(.3 + 1 * .25 / 2, .425, 1e-9) && FIG[6].includes('= 0.175 m/s') && FIG[6].includes('= 0.425 m/s'), missing('s-stack', '左轮 0.3 - 0.125 = 0.175 m/s，右轮 0.425 m/s') + FIG[6].slice(0, 120));
  ok('step 8 text: the watchdog stops the base 0.3 s after the last command (the interactive\'s constant)', T('s-stack', '0.3 秒没收到新命令，就主动停车') && /t-cmd\.t>\.3/.test(P.wsrc('st')), missing('s-stack', '0.3 秒没收到新命令，就主动停车'));
  ok('step 10 card example: 72 km/h is 20 m/s, × 10 ms = 0.2 m; clocks 50 ppm apart drift 600 × 0.00005 = 0.03 s in ten minutes', T('s-wire', '车速 72 km/h，也就是每秒 20 m', '错开 0.2 m', '600 × 0.00005 = 0.03 s') && near(72 / 3.6, 20, 1e-9) && near(20 * .01, .2, 1e-9) && near(600 * 50e-6, .03, 1e-9), missing('s-wire', '车速 72 km/h，也就是每秒 20 m', '错开 0.2 m', '600 × 0.00005 = 0.03 s'));
  ok('quiz 6: 15 m/s × 0.03 s = 0.45 m', T('s-sum', '15 × 0.03 = 0.45 m') && near(15 * .03, .45, 1e-9), missing('s-sum', '15 × 0.03 = 0.45 m'));
  ok('summary: 3 levels for the vacuum, 4 for the arm and the car, 5 for the quadrotor and the quadruped, as in the table interactive', T('s-sum', '扫地机器人 3 级，机械臂和汽车 4 级，四旋翼和四足 5 级') && (() => { const R = literal(P.wsrc('sk'), 'const R='); return R.map(o => o.L.length).join() === '3,4,4,5,5'; })(), missing('s-sum', '扫地机器人 3 级，机械臂和汽车 4 级，四旋翼和四足 5 级'));

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
