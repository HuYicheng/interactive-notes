// Check the numbers of "Control Methods" (control/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt literally: pressing buttons, moving sliders, dragging the block with the mouse, and
// letting the real-time simulations run) and compares the readouts with the numbers quoted in the "你会看到 / What you
// will see" lines. Most interactives are real-time simulations, so a readout depends a little on the moment a button
// is pressed: those numbers are quoted with "约 / about" and checked with a tolerance. Numbers a readout does not show
// (what happens at an exact time, what is drawn only on a canvas, statistics over many runs) are recomputed inside
// the page with the page's own engine, window.CTL, with the same loops, constants and random seeds as the
// interactives; the comments say "same loop as the interactive" where that is done, and wherever a readout exists the
// re-run is first compared with it.
// Part B recomputes the numbers quoted in the formula cards, the paragraphs and the figures.
//   usage: node check.js /absolute/path/to/control/index.html      (takes about a quarter of an hour)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/control/index.html'); process.exit(2); }
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
  // wait until a readout matches (training widgets): polls every 100 ms, at most `max` seconds
  const until = async (w, re, max) => { for (let k = 0; k < (max || 120) * 10; k++) { const m = await w.met(); if (re.test(m)) return m; await p.waitForTimeout(100); } return await w.met(); };
  // drag inside a canvas from one canvas pixel to another
  const dragPx = async (cvId, a, c) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const r = await p.evaluate(i => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left, q.top]; }, cvId);
    await p.mouse.move(r[0] + a[0], r[1] + a[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(r[0] + a[0] + (c[0] - a[0]) * k / 6, r[1] + a[1] + (c[1] - a[1]) * k / 6); await p.mouse.up(); await p.waitForTimeout(250); };
  // run a snippet inside the page, where the engine CTL lives
  const EV = (fn, arg) => p.evaluate(fn, arg);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-')) : NaN; };
  // the visible text of a section, folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);

  // ------------------------------------------------------------------------------------------------------------
  // The in-page helper library (it runs inside the page, where the engine CTL lives): the interactives' own loops,
  // copied from their code, so that a run can be repeated at exact times, for many seeds, or read where the
  // interactive only draws. Part A compares each of them with the readouts of the interactive it copies.
  // ------------------------------------------------------------------------------------------------------------
  const LIBFN = () => {
// ---- in-page helpers: the interactives' own loops, re-run with the engine CTL (same constants, same seeds) ----
window.CHK = (() => { const K = CTL, P = K.P0, MGL = P.m * P.g * P.l, I0 = K.inert(P), D2R = Math.PI / 180, R2D = 180 / Math.PI, C = {};
// --- pid: same control() and step() as the interactive (1 ms steps, history every 10 ms, readouts over the last 1 s)
C.pid = () => { const DT = .001; const S = { mode: 'p', kp: 20, ki: 30, kd: 1, um: 6, ref: 60 * D2R, aw: true, ff: false, noise: false, dfilt: true, x: [60 * D2R, 0], I: 0, dF: 0, lastM: 60 * D2R, relay: 1, t: 0, rn: K.rng(7), H: [], U: [], ev: { from: 60 * D2R, to: 60 * D2R, peak: 0 }, acc: 0 };
  S.control = () => { const m = S.x[0] + (S.noise ? K.gauss(S.rn) * .4 * D2R : 0), e = S.ref - m; const dm = (m - S.lastM) / DT; S.lastM = m; S.dF = S.dfilt ? S.dF + (dm - S.dF) * (1 - Math.exp(-2 * Math.PI * 30 * DT)) : dm; const f = S.ff ? MGL * Math.sin(S.ref) : 0;
    if (S.mode === 'onoff') { if (e > 1.5 * D2R) S.relay = 1; else if (e < -1.5 * D2R) S.relay = -1; return S.relay * S.um; }
    const useI = S.mode === 'pi' || S.mode === 'pid', useD = S.mode === 'pd' || S.mode === 'pid'; const raw = S.kp * e + (useI ? S.I : 0) + (useD ? -S.kd * S.dF : 0) + f, u = K.clamp(raw, -S.um, S.um);
    if (useI) { const sat = raw !== u, push = Math.sign(e) === Math.sign(raw); if (!(S.aw && sat && push)) S.I += S.ki * e * DT; S.I = K.clamp(S.I, -10, 10); } return u; };
  S.step = () => { const u = S.control(); S.x = K.rk4(S.x, u, P, DT, 0); S.t += DT; S.u = u; const dir = Math.sign(S.ev.to - S.ev.from) || 1; S.ev.peak = Math.max(S.ev.peak, (S.x[0] - S.ev.to) * dir); };
  S.run = sec => { const n = Math.round(sec / DT); for (let k = 0; k < n; k++) { S.step(); S.acc += DT; if (S.acc >= .01 - 1e-9) { S.acc = 0; S.H.push(S.x[0] * R2D); S.U.push(S.u); if (S.H.length > 600) { S.H.shift(); S.U.shift(); } } } return S; };
  S.met = () => { const w = S.H.slice(-100), avg = w.reduce((a, b) => a + b, 0) / w.length, pp = Math.max(...w) - Math.min(...w), step = Math.abs(S.ev.to - S.ev.from) * R2D, os = step > 1 ? Math.max(0, S.ev.peak * R2D) / step * 100 : 0; const uw = S.U.slice(-100), um = uw.reduce((a, b) => a + b, 0) / uw.length;
    return { err: S.ref * R2D - avg, pp, os, uStd: Math.sqrt(uw.reduce((a, b) => a + (b - um) * (b - um), 0) / uw.length), theta: S.x[0] * R2D }; };
  S.target = deg => { S.ev = { from: S.x[0], to: deg * D2R, peak: 0 }; S.ref = deg * D2R; }; S.setMode = m => { S.mode = m; S.I = 0; };
  for (let k = 0; k < 2000; k++) { S.step(); if (k % 10 === 0) { S.H.push(S.x[0] * R2D); S.U.push(S.u); } } return S; };
// --- lqr: gains and poles; the interactive's steady-state Kalman gain and estimator poles; its control loop with noise seed 11
C.lqr = lr => { const LN = K.upLin(P), G = K.lqr2(LN.a1, LN.a2, LN.b, 1, 0, Math.pow(10, lr)); return { K: G.K, poles: K.poles2(LN.a1, LN.a2, LN.b, G.K[0], G.K[1]), open: K.poles2(LN.a1, LN.a2, LN.b, 0, 0), LN }; };
C.kalman = sig => { const LN = K.upLin(P), TC = .005, QV = 1e-3, a1 = LN.a1, a2 = LN.a2, dt = TC, A = [[1 + a1 * dt * dt / 2, dt + a2 * dt * dt / 2], [a1 * dt + a1 * a2 * dt * dt / 2, 1 + a2 * dt + (a1 + a2 * a2) * dt * dt / 2]], R = Math.pow(Math.max(sig, .02) * D2R, 2);
  let p00 = 1, p01 = 0, p11 = 1, L0 = 0, L1 = 0;
  for (let it = 0; it < 4000; it++) { const a00 = A[0][0] * p00 + A[0][1] * p01, a01 = A[0][0] * p01 + A[0][1] * p11, a10 = A[1][0] * p00 + A[1][1] * p01, a11 = A[1][0] * p01 + A[1][1] * p11; const m00 = a00 * A[0][0] + a01 * A[0][1] + 1e-10, m01 = a00 * A[1][0] + a01 * A[1][1], m11 = a10 * A[1][0] + a11 * A[1][1] + QV, S = m00 + R; L0 = m00 / S; L1 = m01 / S; p00 = (1 - L0) * m00; p01 = (1 - L0) * m01; p11 = m11 - L1 * m01; }
  const F00 = A[0][0] * (1 - L0) - A[0][1] * L1, F01 = A[0][1], F10 = A[1][0] * (1 - L0) - A[1][1] * L1, F11 = A[1][1], tr = F00 + F11, det = F00 * F11 - F01 * F10, Dd = tr * tr / 4 - det; let ps;
  if (Dd >= 0) ps = [tr / 2 + Math.sqrt(Dd), tr / 2 - Math.sqrt(Dd)].map(z => [Math.log(Math.abs(z)) / dt, 0]); else { const m = Math.sqrt(det), th = Math.atan2(Math.sqrt(-Dd), tr / 2); ps = [[Math.log(m) / dt, th / dt], [Math.log(m) / dt, -th / dt]]; } return { L: [L0, L1], poles: ps }; };
C.lqrRun = (vs, sig, lr, secs) => { const G = C.lqr(lr), KF = C.kalman(sig), DT = .001, TC = .005, UM = 8; let x = [Math.PI + 10 * D2R, 0], xh = [10 * D2R, 0], yP = 10 * D2R, uP = 0, u = 0, be = [10 * D2R, 0], sub = 0, ac = 0; const rn = K.rng(11), We = [], Wu = [];
  const ctrl = (mode) => { const phi = K.wrap(x[0] - Math.PI), y = phi + (sig > 0 ? K.gauss(rn) * sig * D2R : 0), fd = (y - yP) / TC; yP = y; let ph = xh[0], om = xh[1]; const ns = 5, h = TC / ns; for (let i = 0; i < ns; i++) { const al = (MGL * Math.sin(ph) - P.b * om + uP) / I0; ph += om * h; om += al * h; }
    const inn = y - ph; xh = [ph + KF.L[0] * inn, om + KF.L[1] * inn]; be = mode === 'true' ? [phi, x[1]] : mode === 'fd' ? [y, fd] : [xh[0], xh[1]]; u = K.clamp(-(G.K[0] * be[0] + G.K[1] * be[1]), -UM, UM); uP = u; };
  const step = (mode, rec) => { if (sub % 5 === 0) ctrl(mode); sub++; x = K.rk4(x, u, P, DT, 0); ac += DT; if (ac >= .01 - 1e-9) { ac = 0; if (rec) { We.push((be[1] - x[1]) * R2D); Wu.push(u); } } };
  for (let k = 0; k < 4000; k++) step('kf', false); for (let k = 0; k < 1000; k++) step(vs, false); for (let k = 0; k < secs * 1000; k++) step(vs, true);
  const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length), wins = (a) => { const r = []; for (let i = 0; i + 100 <= a.length; i += 100) r.push(rms(a.slice(i, i + 100))); return r; }; const we = wins(We), wu = wins(Wu);
  return { weMean: rms(We), weMin: Math.min(...we), weMax: Math.max(...we), uMean: rms(Wu), uMin: Math.min(...wu), uMax: Math.max(...wu), tilt: Math.abs(K.wrap(x[0] - Math.PI)) * R2D }; };
// --- swing: the catch zone and the interactive's loop (2 ms steps) from the bottom
C.swingLQR = (() => { const LIN = K.upLin(P), G = K.lqr2(LIN.a1, LIN.a2, LIN.b, 10, 1, 1), PM = G.P, l11 = Math.sqrt(PM[0][0]), l21 = PM[0][1] / l11, l22 = Math.sqrt(PM[1][1] - l21 * l21); const ell = (a, c) => { const s = Math.sqrt(c), w = Math.sin(a) * s / l22; return [(Math.cos(a) * s - l21 * w) / l11, w]; }; const lqrU = (ph, w, um) => K.clamp(-G.K[0] * ph - G.K[1] * w, -um, um);
  const catchC = um => { const dt = .005; const ok = x => { for (let i = 0; i < 600; i++) { x = K.rk4(x, lqrU(K.wrap(x[0] - Math.PI), x[1], um), P, dt); if (Math.abs(K.wrap(x[0] - Math.PI)) > 1.2) return false; } return Math.abs(K.wrap(x[0] - Math.PI)) < .03 && Math.abs(x[1]) < .08; }; let lo = 0, hi = 40; for (let it = 0; it < 13; it++) { const c = (lo + hi) / 2; let good = true; for (let j = 0; j < 24 && good; j++) { const e = ell(j / 24 * 2 * Math.PI, c); if (!ok([Math.PI + e[0], e[1]])) good = false; } if (good) lo = c; else hi = c; } return lo; };
  return { PM, lqrU, catchC, zoneDeg: um => { const c = catchC(um), det = PM[0][0] * PM[1][1] - PM[0][1] * PM[0][1]; return Math.sqrt(c * PM[1][1] / det) * R2D; } }; })();
C.swing = (mode, um, T) => { const L = C.swingLQR, PM = L.PM, DT = .002, KP = 2; let x = [.05, 0], t = 0, lq = false, tCatch = -1, peak = 0, satT = 0, minUp = 9; const cc = L.catchC(um), V = (ph, w) => PM[0][0] * ph * ph + 2 * PM[0][1] * ph * w + PM[1][1] * w * w;
  for (let i = 0; i < T / DT; i++) { const ph = K.wrap(x[0] - Math.PI), E = K.energy(x, P), v = V(ph, x[1]); if (mode === 'pc') { if (!lq && v < cc) { lq = true; if (tCatch < 0) tCatch = t; } else if (lq && (v > 4 * cc || Math.abs(ph) > 1)) lq = false; }
    const on = mode === 'lqr' || (mode === 'pc' && lq), u = on ? L.lqrU(ph, x[1], um) : K.clamp(KP * (MGL - E) * x[1], -um, um); if (Math.abs(u) >= um - 1e-9) satT += DT; x = K.rk4(x, u, P, DT); t += DT; peak = Math.max(peak, Math.abs(K.wrap(x[0])) * R2D); if (t > T - 6) minUp = Math.min(minUp, Math.abs(K.wrap(x[0] - Math.PI))); }
  return { tCatch, peak, satShare: satT / T, end: Math.abs(K.wrap(x[0] - Math.PI)) * R2D, E: K.energy(x, P) / MGL, closest: minUp * R2D }; };
// --- smc: same control() and phys() as the interactive; metrics over [warm, T]
C.smc = (o, T, warm) => { const D = D2R, G = 9.81, L = .5, B = .05, M0 = 1, IM = M0 * L * L, UM = 15, DT = .0005, PD_KP = 225, PD_KD = 30; const ref = t => [45 * D - 20 * D * Math.cos(Math.PI * t), 20 * D * Math.PI * Math.sin(Math.PI * t), 20 * D * Math.PI * Math.PI * Math.cos(Math.PI * t)];
  let t = 0, th = ref(0)[0] - 6 * D, om = 0, u = 0, uPrev = 0, lp = 0, ns = 0; const mt = o.mf * M0, It = mt * L * L, Fc = o.fric ? .3 : 0, fT = (x, w, uu) => (uu - mt * G * L * Math.sin(x) - B * w - Fc * Math.tanh(w / .01)) / It;
  let n = 0, e2 = 0, du = 0, r2 = 0, dm = 0, tReach = -1, tSmall = -1; const nsub = Math.round(1 / o.rate / DT), tr = [];
  for (let i = 0; i < T / DT; i++) { if (ns % nsub === 0) { const [r, rd, rdd] = ref(t), e = th - r, ed = om - rd, s = ed + o.lam * e, ueq = IM * (rdd - o.lam * ed) + M0 * G * L * Math.sin(th) + B * om; let un;
      if (o.mode === 'pd') un = IM * (rdd - PD_KD * ed - PD_KP * e) + M0 * G * L * Math.sin(th) + B * om; else if (o.mode === 'sign') un = ueq - o.k * (s > 0 ? 1 : s < 0 ? -1 : 0); else un = ueq - o.k * K.clamp(s / (o.phi * D), -1, 1);
      u = K.clamp(un, -UM, UM); const dl = ueq - (It * (rdd - o.lam * ed) + mt * G * L * Math.sin(th) + B * om + Fc * Math.tanh(om / .01)); lp += (ed - lp) * (1 - Math.exp(-2 * Math.PI * 10 / o.rate)); const rp = ed - lp;
      if (tReach < 0 && s >= 0) tReach = t; if (tReach >= 0 && tSmall < 0 && Math.abs(e) < .1 * D) tSmall = t; if (Math.abs(t - .1) < 1e-9 || Math.abs(t - .2) < 1e-9 || Math.abs(t - .3) < 1e-9) tr.push(e / D);
      if (t >= warm) { n++; e2 += e * e; du += Math.abs(u - uPrev); r2 += rp * rp; dm = Math.max(dm, Math.abs(dl)); } uPrev = u; }
    ns++; const h = DT, k1 = fT(th, om, u), k2 = fT(th + h / 2 * om, om + h / 2 * k1, u), k3 = fT(th + h / 2 * (om + h / 2 * k1), om + h / 2 * k2, u), k4 = fT(th + h * (om + h / 2 * k2), om + h * k3, u); th += h * (om + h / 6 * (k1 + k2 + k3)); om += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += h; }
  return { eRMS: Math.sqrt(e2 / n) / D, jump: du / n, ripple: Math.sqrt(r2 / n) / D, dmax: dm, tReach, tSmall, tr }; };
// --- cbf: one 5 s run of the cart, same loop as the interactive (the jitter of the "learned policy" is seeded by the run number)
C.cbf = o => { const XM = 1, XG = 1.3, AB = 3.5, EPS = .05, DT = .001, CT = .01, TE = 5, KP = 6, KD = 2.5; let x = 0, v = 0, te = 0, u = 0, un = 0, J = 0, acc = 0, minD = 9, tAct = -1, tActEnd = -1; const crash = [], rn = K.rng(100 + (o.ep || 1)), at = {}, hOf = (x, v) => XM - x - v * Math.max(v, 0) / (2 * AB);
  const n = Math.round(TE / DT); for (let i = 0; i < n; i++) { if (acc <= 1e-12) { if (o.nom === 'rl') J += (-J / .3) * CT + 2 * Math.sqrt(2 * CT / .3) * K.gauss(rn); un = KP * (XG - x) - KD * v + (o.nom === 'rl' ? J : 0); const us = AB * (o.gam * hOf(x, v) - v) / Math.max(v, EPS); u = o.filt ? Math.min(un, us) : un; const act = o.filt && u < un - 1e-9 && us < o.ul; u = K.clamp(u, -o.ul, o.ul); if (act) { if (tAct < 0) tAct = te; tActEnd = te; } }
    acc += DT; if (acc >= CT - 1e-9) acc = 0; x += v * DT + u * DT * DT / 2; v += u * DT; te += DT; if (x >= XM) { if (v > .05) crash.push([te, v]); x = XM; v = Math.min(v, 0); } if (XM - x < minD) minD = XM - x; for (const T of [1, 2]) if (Math.abs(te - T) < DT / 2) at[T] = (XM - x) * 100; }
  return { crash, minD: minD * 100, end: (XM - x) * 100, tAct, tActEnd, at }; };
C.cbfMany = (o, n) => { let eps = 0, c = 0, vm = 0; for (let ep = 1; ep <= n; ep++) { const r = C.cbf(Object.assign({}, o, { ep })); if (r.crash.length) { eps++; c += r.crash.length; vm = Math.max(vm, ...r.crash.map(q => q[1])); } } return { runsWithCrash: eps, crashes: c, fastest: vm }; };
// --- rl: the random-search training, same episode, noise sequences, update rule and seeds as the interactive
C.rl = (() => { const T = 3, DC = .01, NS = 300, UM = 6, ICS = [.15, -.15, .3, -.3], QV = .1, RW = .1, SC = [10, 2], MLO = .5, MHI = 2.5, MS = [.5, 1, 1.5, 2, 2.5], TM = [.5, 1, 2.5], G = 9.81, LL = .5;
  const NZ = ICS.map((_, j) => { const r = K.rng(100 + j), a = new Float64Array(2 * NS); for (let i = 0; i < NS; i++) { a[2 * i] = .003 * K.gauss(r); a[2 * i + 1] = .03 * K.gauss(r); } return a; }); let fell = false, endPh = 0;
  function ep(k1, k2, m, j) { const I = m * LL * LL, Gt = m * G * LL, B = .05, h = DC, nz = NZ[j]; let th = Math.PI + ICS[j], w = 0, J = 0; fell = false;
    for (let i = 0; i < NS; i++) { const ph = th - Math.PI; let u = -k1 * (ph + nz[2 * i]) - k2 * (w + nz[2 * i + 1]); u = u < -UM ? -UM : u > UM ? UM : u; J += (ph * ph + QV * w * w + RW * u * u) * h;
      const a1 = (u - Gt * Math.sin(th) - B * w) / I, t2 = th + h / 2 * w, w2 = w + h / 2 * a1, a2 = (u - Gt * Math.sin(t2) - B * w2) / I, t3 = th + h / 2 * w2, w3 = w + h / 2 * a2, a3 = (u - Gt * Math.sin(t3) - B * w3) / I, t4 = th + h * w3, w4 = w + h * a3, a4 = (u - Gt * Math.sin(t4) - B * w4) / I;
      th += h / 6 * (w + 2 * w2 + 2 * w3 + w4); w += h / 6 * (a1 + 2 * a2 + 2 * a3 + a4); if (th - Math.PI > 1 || th - Math.PI < -1) { fell = true; endPh = 1; return J + 5 + 2 * (T - (i + 1) * h); } } endPh = Math.abs(th - Math.PI); return J; }
  const evalJ = (k1, k2, ms) => { let s = 0; for (const m of ms) for (let j = 0; j < 4; j++) s += ep(k1, k2, m, j); return s / (4 * ms.length); }, testJ = (k1, k2, m) => { let s = 0, f = 0; for (let j = 0; j < 4; j++) { s += ep(k1, k2, m, j); if (fell || endPh > .15) f++; } return [s / 4, f / 4]; };
  const lin = K.upLin(P), LQ = K.lqr2(lin.a1, lin.a2, lin.b, 1, QV, RW).K, jL = evalJ(LQ[0], LQ[1], [1]);
  const train = (seed, itsNom, itsDR) => { let th = [.3, .3], it = 0, eps = 0, first = -1, firstEps = -1; const rs = K.rng(seed * 7919), AL = .08, NU = .15, ND = 4, kOf = t => [t[0] * SC[0], t[1] * SC[1]], log = {};
    const masses = () => { const q = [0, 1, 2, 3].map(i => MLO + (MHI - MLO) / 4 * (i + rs())); for (let i = 3; i > 0; i--) { const j = Math.floor(rs() * (i + 1)), t = q[i]; q[i] = q[j]; q[j] = t; } return q; };
    const iterate = mode => { const ms = mode === 'dr' ? masses() : [1, 1, 1, 1], ds = [], Rp = [], Rm = []; for (let n = 0; n < ND; n++) { const d = [K.gauss(rs), K.gauss(rs)]; ds.push(d); for (const sg of [1, -1]) { const k1 = (th[0] + sg * NU * d[0]) * SC[0], k2 = (th[1] + sg * NU * d[1]) * SC[1]; let s = 0; for (let j = 0; j < 4; j++) s += ep(k1, k2, ms[j], j); (sg > 0 ? Rp : Rm).push(-s / 4); eps += 4; } }
      const all = Rp.concat(Rm), mu = all.reduce((a, b) => a + b, 0) / all.length, sd = Math.sqrt(all.reduce((a, b) => a + (b - mu) * (b - mu), 0) / all.length) + 1e-9; let g0 = 0, g1 = 0; for (let n = 0; n < ND; n++) { g0 += (Rp[n] - Rm[n]) * ds[n][0]; g1 += (Rp[n] - Rm[n]) * ds[n][1]; } th = [K.clamp(th[0] + AL / (ND * sd) * g0, 0, 4), K.clamp(th[1] + AL / (ND * sd) * g1, 0, 4)]; it++; };
    for (let i = 0; i < itsNom; i++) { iterate('nom'); const k = kOf(th), J = evalJ(k[0], k[1], [1]); if (first < 0 && J < 1.1 * jL) { first = it; firstEps = eps; } log[it] = [k[0], k[1], J]; }
    const kN = kOf(th), holdsN = testJ(kN[0], kN[1], 2.5)[1] === 0; let drFirst = -1; for (let i = 0; i < itsDR; i++) { iterate('dr'); const k = kOf(th); if (drFirst < 0 && testJ(k[0], k[1], 2.5)[1] === 0) drFirst = it; }
    const kD = kOf(th), tD = TM.map(m => testJ(kD[0], kD[1], m)); return { first, firstEps, it7: log[7], kNom: kN, JNom: evalJ(kN[0], kN[1], [1]), nomHolds25: holdsN, kDR: kD, drHolds: tD.map(t => t[1] === 0), J1: tD[1][0], ratio: tD[1][0] / jL, drFirst }; };
  return { LQ, jL, train, mgl25: 2.5 * G * LL }; })();
// --- wm: same data collection, ridge regression, MPPI planner (seed 7) and pendulum loop as the interactive
C.wm = (() => { const DT = .02, SUB = 10, DS = DT / SUB, UM = 3, NH = 60, KS = 128, LAM = .05, SW = .15, STH = .01, NMAX = 2000, TAU = 2 * Math.PI; const wrapA = a => a - TAU * Math.round(a / TAU);
  function collect(seed, n, sw, sth) { const r = K.rng(seed), A = { th: new Float64Array(n), w: new Float64Array(n), u: new Float64Array(n), dw: new Float64Array(n) }; for (let i = 0; i < n; i++) { const th = (r() * 2 - 1) * Math.PI, w = (r() * 2 - 1) * 9, u = (r() * 2 - 1) * UM; let x = [th, w]; for (let j = 0; j < SUB; j++) x = K.rk4(x, u, P, DS); const thm = th + sth * K.gauss(r), wm = w + sw * K.gauss(r), wm2 = x[1] + sw * K.gauss(r); A.th[i] = thm; A.w[i] = wm; A.u[i] = u; A.dw[i] = wm2 - wm; } return A; }
  const TS = collect(999, 400, 0, 0), FE = { lin: (th, w, u) => [K.wrap(th), w, u, 1], phys: (th, w, u) => [Math.sin(th), Math.cos(th), w, u, 1] };
  function solve(A, b) { const n = b.length; for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < n; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; } } const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; } return x; }
  function fit(kind, N, seed) { const S = collect(seed, NMAX, SW, STH), fe = FE[kind], m = kind === 'phys' ? 5 : 4, A = [...Array(m)].map(() => new Array(m).fill(0)), b = new Array(m).fill(0); for (let i = 0; i < N; i++) { const f = fe(S.th[i], S.w[i], S.u[i]); for (let p = 0; p < m; p++) { b[p] += f[p] * S.dw[i]; for (let q = 0; q < m; q++) A[p][q] += f[p] * f[q]; } } for (let p = 0; p < m; p++) A[p][p] += 1e-3;
    const c = solve(A, b), dw = kind === 'phys' ? (th, s, co, w, u) => c[0] * s + c[1] * co + c[2] * w + c[3] * u + c[4] : (th, s, co, w, u) => c[0] * wrapA(th) + c[1] * w + c[2] * u + c[3]; let se = 0, sq = 0; for (let i = 0; i < TS.th.length; i++) { const th = TS.th[i], p = dw(th, Math.sin(th), Math.cos(th), TS.w[i], TS.u[i]); se += (p - TS.dw[i]) ** 2; sq += TS.dw[i] ** 2; }
    const gA = th => I0 * dw(th, Math.sin(th), Math.cos(th), 0, 0) / DT; let maxDiff = 0; for (let j = 0; j <= 120; j++) { const a = K.clamp(-Math.PI + j / 120 * TAU, -Math.PI + 1e-6, Math.PI - 1e-6); maxDiff = Math.max(maxDiff, Math.abs(gA(a) - (-MGL * Math.sin(a)))); }
    return { dw, E1: Math.sqrt(se / sq) * 100, maxDiff, gTop: (Math.abs(gA(Math.PI - 1e-3)) + Math.abs(gA(-Math.PI + 1e-3))) / 2 }; }
  function planner(seed) { const r = K.rng(seed), U = new Float64Array(NH), EPS = new Float64Array(KS * NH), Sc = new Float64Array(KS), T = new Float64Array(NH), SM = 4; let spare = null; const gn = () => { if (spare !== null) { const v = spare; spare = null; return v; } let a = 0; while (a === 0) a = r(); const v = r(), m = Math.sqrt(-2 * Math.log(a)); spare = m * Math.sin(TAU * v); return m * Math.cos(TAU * v); };
    return { U, plan(th0, w0, f) { for (let k = 0; k < KS; k++) { let th = th0, w = w0, J = 0; const o = k * NH; for (let t = 0; t < NH; t++) { let u = U[t] + gn(); if (u > UM) u = UM; else if (u < -UM) u = -UM; EPS[o + t] = u - U[t]; const s = Math.sin(th), co = Math.cos(th); J += DT * (4 * (1 + co) + .1 * w * w + .01 * u * u); const d = f(th, s, co, w, u); th += (w + d / 2) * DT; w += d; } Sc[k] = J + 10 * (1 + Math.cos(th)) + .5 * w * w; }
        let mn = Infinity; for (let k = 0; k < KS; k++) if (Sc[k] < mn) mn = Sc[k]; let z = 0; for (let k = 0; k < KS; k++) { Sc[k] = Math.exp(-(Sc[k] - mn) / LAM); z += Sc[k]; } for (let t = 0; t < NH; t++) { let s = 0; for (let k = 0; k < KS; k++) s += Sc[k] * EPS[k * NH + t]; T[t] = s / z; }
        for (let t = 0; t < NH; t++) { let s = 0, q = 0; for (let j = -SM; j <= SM; j++) { const i = t + j; if (i < 0 || i >= NH) continue; const wg = SM + 1 - Math.abs(j); s += wg * T[i]; q += wg; } const v = U[t] + s / q; U[t] = v > UM ? UM : v < -UM ? -UM : v; } }, shift() { for (let t = 0; t < NH - 1; t++) U[t] = U[t + 1]; } }; }
  function run(dw, Tend) { const pl = planner(7); let x = [.05, 0], t = 0, u = 0, tUp = -1, hold = 0; const nC = Math.round(Tend / DT); for (let c = 0; c < nC; c++) { pl.plan(x[0], x[1], dw); u = pl.U[0]; pl.shift(); const ph = Math.abs(K.wrap(x[0] - Math.PI)); if (ph < .2) { hold += DT; if (hold >= 2 && tUp < 0) tUp = t - 2; } else hold = 0; for (let j = 0; j < SUB; j++) { x = K.rk4(x, u, P, DS); t += DS; } } return tUp < 0 ? null : tUp; }
  return { fit, run }; })();
// --- mpc: the first plan of the interactive (iLQR from the bottom, 30 iterations, 20 ms steps)
C.plan = (N, um) => { const TS = .02, f = (x, u) => K.rk4(x, u, P, TS), l = (x, u) => TS * (4 * (1 + Math.cos(x[0])) + .1 * x[1] * x[1] + .01 * u * u), lf = x => 10 * (1 + Math.cos(x[0])) + .1 * x[1] * x[1]; const x = [.02, 0], s = K.ilqr(x, { f, l, lf, N, umax: um, iters: 30, U: new Array(N).fill(0) }), Xs = [x]; for (let k = 0; k < N; k++) Xs.push(f(Xs[k], s.U[k])); const th = Xs.map(q => q[0] * R2D);
  return { U0: s.U[0], thMin: Math.min(...th), thMax: Math.max(...th), thEnd: th[N], sat: s.U.filter(v => Math.abs(v) >= um - 1e-3).length / N * 100 }; };
return C; })();

  };

  // ------------------------------------------------------------------------------------------------------------
  // Part A: the interactives, operated along the "先玩" prompts; the quoted strings must be in the "你会看到" lines
  // ------------------------------------------------------------------------------------------------------------
  await p.evaluate(LIBFN);
  const KEEP = {};
  const SEE = await p.evaluate(() => { const o = {}; document.querySelectorAll('p.see').forEach(e => { const id = e.closest('section').id; (o[id] = o[id] || []).push(e.innerText); }); return o; });
  for (const k in SEE) SEE[k] = SEE[k].map(norm);
  const see = (id, i, ...strs) => strs.every(s => SEE[id] && SEE[id][i || 0] && SEE[id][i || 0].includes(s));
  const wait = ms => p.waitForTimeout(ms);
  const rdo = (m, label, unit) => num(m, new RegExp(label + ' (-?[\\d.]+)' + (unit || '')));
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  // poll a readout or status until it matches, at most `max` seconds
  const untilSt = async (w, re, max) => { for (let k = 0; k < (max || 20) * 5; k++) { const s = await w.status(); if (re.test(s)) return s; await wait(200); } return await w.status(); };

  sec('step ① · pid: on-off, P, PD, PI, PID; anti-windup; sensor noise');
  { const w = W('pid'); await w.show(); let m;
    await w.click('开关', 100); await wait(5000); m = await w.met(); const pp5 = rdo(m, '晃动（峰峰值）', '°');
    await wait(15000); m = await w.met(); const pp20 = rdo(m, '晃动（峰峰值）', '°');
    ok('on-off does not settle and the swing grows: about 67° peak to peak after 5 s, about 90° after 20 s (readouts ' + pp5 + '°, ' + pp20 + '°)', see('k-pid', 0, '5 秒后峰峰值约 67°', '20 秒后约 90°') && near(pp5, 67, 9) && near(pp20, 90, 5), m);
    const rr = await EV(() => [.5, 1.5, 3].map(T => { const s = CHK.pid(); s.run(T); s.setMode('onoff'); s.run(5); const a = s.met().pp; s.run(15); return [a, s.met().pp]; }));
    ok('same loop as the interactive, on-off entered 0.5, 1.5 or 3 s after loading: ' + rr.map(q => r1(q[0]) + '° / ' + r1(q[1]) + '°').join(', '), rr.every(q => near(q[0], 67, 3.5) && near(q[1], 90, 2)), JSON.stringify(rr));
    ok('the status no longer says it only "chatters around the target"', has(await w.status(), '越晃越大'), await w.status());
    await w.click('P', 100, 0); await wait(20000); m = await w.met();
    ok('P: after 20 s the swing is still there (readout ' + rdo(m, '晃动（峰峰值）', '°') + '°) and the mean error is near 10.7° (' + rdo(m, '平均误差（近 1 秒）', '°') + '°)', rdo(m, '晃动（峰峰值）', '°') > 5 && near(rdo(m, '平均误差（近 1 秒）', '°'), 10.7, 1.5), m);
    const rp = await EV(() => { const s = CHK.pid(); s.run(1.5); s.setMode('onoff'); s.run(20); s.setMode('p'); s.run(20); const a = s.met(); s.run(40); const b = s.met(); s.run(60); const c = s.met(); return [a.pp, b.pp, b.err, c.pp, c.err]; });
    ok('same loop: with P the swing is ' + r1(rp[0]) + '° after 20 s and ' + r2(rp[1]) + '° after a minute; it stops 10.7° below the target (' + r2(rp[4]) + '°)', see('k-pid', 0, '要一分钟左右才停', '低 10.7° 的地方') && rp[0] > 8 && rp[1] < 1 && rp[3] < .05 && near(rp[4], 10.66, .02), JSON.stringify(rp));
    await w.click('PD', 100); await wait(4500); m = await w.met();
    ok('PD: no swinging after three or four seconds, the error is still 10.7°', see('k-pid', 0, 'PD 三四秒就不晃了，误差还是 10.7°') && has(m, '平均误差（近 1 秒） 10.7°', '晃动（峰峰值） 0.0°'), m);
    await w.click('PI', 100, 0); await wait(12000); m = await w.met(); const st = await w.status();
    ok('PI: the swing grows (readout ' + rdo(m, '晃动（峰峰值）', '°') + '° after 12 s)', see('k-pid', 0, 'PI 越晃越大') && rdo(m, '晃动（峰峰值）', '°') > 30 && has(st, 'PI 没有阻尼'), m + ' || ' + st);
    await w.click('PID', 100); await wait(8500); m = await w.met();
    ok('PID: the error is back to zero after about 8 s', see('k-pid', 0, 'PID 约 8 秒后误差归零') && has(m, '平均误差（近 1 秒） 0.0°', '晃动（峰峰值） 0.0°'), m);
    await w.click('抗积分饱和', 100); await w.click('120°', 100); await wait(8000); m = await w.met(); const st2 = await w.status();
    ok('anti-windup off, 60° → 120°: overshoot 52%', see('k-pid', 0, '60° 到 120° 这一步的超调是 52%') && has(m, '超调 52%'), m);
    await w.click('抗积分饱和', 100); await w.click('60°', 100); await wait(8000); m = await w.met();
    ok('anti-windup on, back to 60°: overshoot 116%', see('k-pid', 0, '回 60° 那一步的超调有 116%') && has(m, '超调 116%'), m);
    await w.click('120°', 100); await wait(8000); m = await w.met();
    ok('anti-windup on, 60° → 120°: overshoot 21%', see('k-pid', 0, '同样一步只有 21%') && has(m, '超调 21%'), m);
    const rs = await EV(() => { const s = CHK.pid(); s.setMode('pd'); s.run(6); s.target(120); s.run(6); s.target(60); s.run(6); return [s.met().os, 4.905 * Math.sin(Math.PI / 3)]; });
    ok('same loop: PD alone overshoots the step back to 60° by ' + r1(rs[0]) + '%; holding the arm at 60° takes ' + r2(rs[1]) + ' N·m of the 6 N·m, leaving ' + r2(6 - rs[1]), see('k-pid', 0, '只用 PD 也冲过头这么多', '4 N·m 多', '不到 2 N·m') && rs[0] > 100 && rs[1] > 4 && rs[1] < 4.5 && 6 - rs[1] < 2, JSON.stringify(rs));
    await w.click('60°', 100); await wait(8000); await w.click('测量噪声', 100); await wait(5000); m = await w.met(); const ppOn = rdo(m, '晃动（峰峰值）', '°');
    await w.click('微分滤波', 100); await wait(6000); m = await w.met(); const ppOff = rdo(m, '晃动（峰峰值）', '°');
    ok('sensor noise: with the D filter the arm swings by less than 0.5° (' + ppOn + '°), without it by 4° to 9° (' + ppOff + '°)', see('k-pid', 0, '杆的晃动不到 0.5°', '杆的晃动变成 4° 到 9°') && ppOn < .5 && ppOff > 3.5 && ppOff < 10.5, m);
    const rn = await EV(() => { const s = CHK.pid(); s.run(1.5); s.setMode('pid'); s.run(10); s.noise = true; s.run(5); const a = s.met(); s.dfilt = false; const o = []; for (let k = 0; k < 6; k++) { s.run(3); o.push(s.met()); } return [a.uStd, a.pp, Math.min(...o.map(q => q.pp)), Math.max(...o.map(q => q.pp)), Math.min(...o.map(q => q.uStd))]; });
    ok('same loop: the torque jitters by ' + r2(rn[0]) + ' N·m (standard deviation) with the filter and at least ' + r2(rn[4]) + ' N·m without it; the swing without it is ' + r1(rn[2]) + '° to ' + r1(rn[3]) + '°', rn[0] < 1.6 && rn[4] > 2.8 && rn[1] < .5 && rn[2] > 3.5 && rn[3] < 10.5, JSON.stringify(rn));
    await w.click('微分滤波', 100); await w.click('测量噪声', 100); }

  sec('step ② · bode: delay, bandwidth, the D and I terms');
  { const w = W('bode'); await w.show(); let m;
    await w.click('稳健', 300); m = await w.met(); const wc = rdo(m, '穿越频率 ωc', ' rad/s');
    ok('Robust: ωc 9.3 rad/s, phase margin 61°, overshoot 6%', see('k-freq', 0, '相位裕度从 61° 掉到 29°', '超调从 6% 涨到 14%', '9.3 rad/s') && has(m, '穿越频率 ωc 9.3 rad/s', '相位裕度 61°', '超调 6%'), m);
    await w.set('bode-tau', 40, 300); m = await w.met(); const pm40 = rdo(m, '相位裕度', '°');
    ok('Robust with 40 ms: the delay eats ωc·τ = ' + r1(wc * .04 * 180 / Math.PI) + '° and the margin is ' + pm40 + '°', see('k-freq', 0, '43° 对 21°') && near(wc * .04 * 180 / Math.PI, 21, .6) && pm40 === 40, m);
    await w.set('bode-tau', 60, 300); m = await w.met(); let st = await w.status();
    ok('Robust with 60 ms: phase margin 29°, overshoot 14%, the status says the response swings', has(m, '相位裕度 29°', '超调 14%') && has(st, '来回晃'), m + ' || ' + st);
    await w.click('加延迟', 300); m = await w.met(); st = await w.status(); const wc2 = rdo(m, '穿越频率 ωc', ' rad/s');
    ok('Add delay: ωc 18.8 rad/s, margin 15°, overshoot 32%; 40 ms eat ' + r1(wc2 * .04 * 180 / Math.PI) + '°', see('k-freq', 0, '18.8 对 9.3 rad/s', '裕度只剩 15°，超调 32%') && has(m, '穿越频率 ωc 18.8 rad/s', '相位裕度 15°', '超调 32%') && near(wc2 * .04 * 180 / Math.PI, 43, .6) && has(st, '43°'), m + ' || ' + st);
    await w.set('bode-tau', 0, 300); KEEP.addDelay0 = await w.met();
    await w.click('稳健', 300); await w.set('bode-kd', 0, 300); m = await w.met();
    ok('Robust with Kd = 0: phase margin 2°, overshoot 96%', see('k-freq', 0, '相位裕度从 61° 掉到 2°，超调 96%') && has(m, '相位裕度 2°', '超调 96%'), m);
    await w.click('稳健', 300); await w.set('bode-ki', 20, 300); m = await w.met(); st = await w.status();
    ok('Robust with Ki = 20: phase margin still 55°, overshoot 42%', see('k-freq', 0, '相位裕度还有 55°，超调已经 42%') && has(m, '相位裕度 55°', '超调 42%'), m + ' || ' + st);
    await w.click('稳健', 300); }

  sec('step ③ · lqr: the price of torque, differencing against the Kalman filter');
  { const w = W('lqr'); await w.show(); await wait(1500); let m = await w.met();
    ok('torque cost 0.01: K = (16.0, 2.78), poles −5.7 ± 3.5j', see('k-ss', 0, 'K 从 (16.0, 2.78) 涨到 (105.0, 7.20)', '从 -5.7 ± 3.5j 跑到 -14.5 ± 13.8j') && has(m, '16.0 , 2.78', '闭环极点 -5.7 ± 3.5j'), m);
    await w.set('lqr-r', -4, 400); m = await w.met(); ok('torque cost 0.0001: K = (105.0, 7.20), poles −14.5 ± 13.8j', has(await w.text('.row'), '0.0001') && has(m, '105.0 , 7.20', '闭环极点 -14.5 ± 13.8j'), m);
    await w.set('lqr-r', 0, 400); m = await w.met(); const lq = await EV(() => { const a = CHK.lqr(0); return [a.K, a.poles[0], a.open.map(q => q[0])]; });
    ok('torque cost 1: K = (9.9, 2.18), poles −4.5 ± 0.4j; the open-loop poles are ' + r2(lq[2][0]) + ' and ' + r2(lq[2][1]), see('k-ss', 0, 'K 降到 (9.9, 2.18) 就不再降', '极点停在 -4.5 ± 0.4j', '+4.3') && has(m, '9.9 , 2.18', '闭环极点 -4.5 ± 0.4j') && near(lq[2][0], 4.33, .01) && near(lq[1][0], -4.45, .01), m);
    await w.set('lqr-r', -2, 400); await w.click('差分', 200); await wait(2500); m = await w.met(); const we = rdo(m, '速度估计误差（均方根）', ' °/s'), ur = rdo(m, '力矩（均方根，近 1 秒）', ' N·m');
    const lr = await EV(() => [CHK.lqrRun('fd', .3, -2, 40), CHK.lqrRun('kf', .3, -2, 40)]);
    ok('finite differences: speed estimate off by about 85 °/s, torque jitter about 4 N·m (readouts ' + we + ' °/s, ' + ur + ' N·m; same loop over 40 s: ' + r1(lr[0].weMean) + ' °/s and ' + r2(lr[0].uMean) + ' N·m)', see('k-ss', 0, '速度估计差了约 85 °/s', '约 4 N·m') && near(we, 85, 16) && near(ur, 4, .8) && near(lr[0].weMean, 85, 5) && near(lr[0].uMean, 4, .3), m);
    KEEP.fd = lr[0]; KEEP.kf = lr[1];
    await w.click('卡尔曼滤波', 200); await wait(2500); m = await w.met(); const we2 = rdo(m, '速度估计误差（均方根）', ' °/s'), ur2 = rdo(m, '力矩（均方根，近 1 秒）', ' N·m');
    ok('Kalman filter: about 3 °/s and 0.16 N·m (readouts ' + we2 + ' °/s, ' + ur2 + ' N·m; same loop: ' + r2(lr[1].weMean) + ' °/s and ' + r2(lr[1].uMean) + ' N·m)', see('k-ss', 0, '约 3 °/s 和 0.16 N·m') && near(we2, 3, 1.2) && near(ur2, .16, .07) && near(lr[1].weMean, 3, .6) && near(lr[1].uMean, .16, .02), m);
    await w.set('lqr-n', 1, 400); const kp = await EV(() => [CHK.kalman(.3).poles[0], CHK.kalman(1).poles[0]]);
    ok('noise 0.3° → 1°: the estimator poles go from ' + r1(kp[0][0]) + ' ± ' + r1(kp[0][1]) + 'j to ' + r1(kp[1][0]) + ' ± ' + r1(kp[1][1]) + 'j (same computation as the interactive)', see('k-ss', 0, '从 -25 ± 24j 退到 -14 ± 13j') && Math.round(kp[0][0]) === -25 && Math.round(kp[0][1]) === 24 && Math.round(kp[1][0]) === -14 && Math.round(kp[1][1]) === 13, JSON.stringify(kp));
    await w.set('lqr-n', .3, 300); }

  sec('step ④ · swing: LQR alone, the energy pump, pump then catch');
  { const w = W('swing'); await w.show(); let m, st;
    await w.click('只用 LQR', 200); await wait(6000); m = await w.met(); st = await w.status();
    ok('LQR only at 1.5 N·m: torque pinned at +1.5, at most 32° from hanging', see('k-nl', 0, '力矩一直顶在 +1.5 N·m 的上限', '离垂下 32°') && has(m, '力矩 1.50 N·m') && has(st, '离垂下 32°'), m + ' || ' + st);
    await w.set('swing-u', 4.2, 300); await wait(5000); st = await w.status(); m = await w.met();
    ok('limit above 4: it goes over the top and is held', has(st, '冲上了顶') && has(m, '离竖直 0°'), m + ' || ' + st);
    const sw = await EV(() => [CHK.swing('lqr', 3.7, 12), CHK.swing('lqr', 3.8, 12), CHK.swing('lqr', 1.5, 12)]);
    ok('same loop, restarted from the bottom: 3.7 N·m fails (peak ' + r1(sw[0].peak) + '°), 3.8 N·m gets up; at 1.5 the peak is ' + r1(sw[2].peak) + '°', see('k-nl', 0, '3.8 N·m 起才冲得上去') && sw[0].end > 90 && sw[1].end < 1 && near(sw[2].peak, 32, .5) && has(st, '3.8 N·m'), JSON.stringify(sw.map(q => [q.peak, q.end])));
    await w.set('swing-u', 1.5, 300); await w.click('能量泵', 200); await wait(14000); m = await w.met(); st = await w.status(); const cl = num(st, /离竖直 (\d+)° 的地方/);
    ok('energy pump: the energy reaches 0.99 and the arm comes within about 6° of upright on every turn (status: ' + cl + '°)', see('k-nl', 0, '能量到了 0.99', '离竖直约 6° 的地方') && has(m, '能量 E/mgl 0.99') && near(cl, 6, 1.5), m + ' || ' + st);
    await w.click('能量泵 + LQR 接住', 200); await wait(6000); m = await w.met(); st = await w.status();
    ok('pump, then LQR catches: caught at 3.4 s', see('k-nl', 0, '第 3.4 秒轨迹进了蓝色区域') && has(m, '接住用时 3.4 s') && has(st, '第 3.4 秒'), m);
    await w.set('swing-u', .5, 800); await w.click('重来', 200); await wait(16500); m = await w.met();
    const z = await EV(() => [CHK.swingLQR.zoneDeg(1.5), CHK.swingLQR.zoneDeg(.5), CHK.swingLQR.zoneDeg(2.5)]); KEEP.zone = z;
    ok('limit 0.5 N·m: caught at 13.4 s, 10 s later; the catch zone shrinks from ±' + r1(z[0]) + '° to ±' + r1(z[1]) + '° along the angle axis', see('k-nl', 0, '13.4 秒才接住，多花 10 秒', '从 ±34° 缩到 ±11°') && has(m, '接住用时 13.4 s') && Math.round(z[0]) === 34 && Math.round(z[1]) === 11, m + ' ' + JSON.stringify(z));
    await w.set('swing-u', 1.5, 500); await w.click('重来', 100); }

  sec('step ⑤ · smc: sliding mode against PD; chattering and the boundary layer');
  { const w = W('smc'); await w.show(); let m;
    const R = async ms => { await wait(ms || 6600); return await w.met(); };
    await w.click('重来', 200);
    const s0 = await EV(() => CHK.smc({ mode: 'sign', mf: 1.5, lam: 10, k: 6, phi: 6, rate: 1000, fric: false }, 8, 4));
    ok('same loop after a restart: the sliding line is reached at ' + r2(s0.tReach) + ' s; the error is then ' + s0.tr.map(r2).join('°, ') + '° at 0.1, 0.2, 0.3 s (ratios ' + r2(s0.tr[1] / s0.tr[0]) + ', ' + r2(s0.tr[2] / s0.tr[1]) + ') and below 0.1° from ' + r2(s0.tSmall) + ' s', see('k-unc', 0, '从误差 -6° 出发，不到 0.1 秒', '约 37%', '半秒后只剩不到 0.1°') && s0.tReach < .1 && near(s0.tr[1] / s0.tr[0], .37, .02) && near(s0.tr[2] / s0.tr[1], .37, .02) && s0.tSmall < .5, JSON.stringify(s0));
    m = await R(); ok('default (1.5×, switching): error RMS 0.026°, torque jumps 8.7 N·m per step', has(m, '误差 RMS 0.026°', '力矩跳变 8.7 N·m') && near(s0.eRMS, .026, .0006), m); KEEP.smcDef = m;
    await w.click('PD', 200); m = await R(); KEEP.smcPD15 = m;
    await w.set('smc-mf', 1, 200); m = await R(); const pd1 = m; await w.set('smc-mf', 2, 200); m = await R();
    ok('PD: error RMS 0.000° at 1× and 3.24° at 2×', see('k-unc', 0, '质量 1 倍时误差均方根 0.000°，2 倍时 3.24°') && has(pd1, '误差 RMS 0.000°') && has(m, '误差 RMS 3.24°'), pd1 + ' || ' + m);
    await w.click('滑模（开关）', 200); m = await R();
    ok('sliding mode at 2×: about 0.04° (' + rdo(m, '误差 RMS', '°') + '°), torque jumps 5.3 N·m per step', see('k-unc', 0, '切回滑模只有约 0.04°', '平均每步跳 5.3 N·m') && near(rdo(m, '误差 RMS', '°'), .04, .003) && has(m, '力矩跳变 5.3 N·m'), m);
    await w.click('干摩擦', 200); m = await R(); const dmx = rdo(m, '模型误差 \\|Δ\\| 最大', ' N·m');
    const rip0 = rdo(m, '速度抖动', ' °/s'); ok('dry friction on: largest model error about 3.9 N·m (' + dmx + '), speed ripple about 0.4 °/s (' + rip0 + ')', see('k-unc', 0, '模型误差最大约 3.9 N·m', '从约 0.4 涨到约 1.7 °/s') && near(dmx, 3.93, .04) && near(rip0, .4, .04), m);
    await w.set('smc-k', 4, 200); m = await R(); const k4 = m; await w.set('smc-k', 3.5, 200); m = await R(); const k35 = m; await w.set('smc-k', 3, 200); m = await R();
    ok('k = 4 still holds (' + rdo(k4, '误差 RMS', '°') + '°); k = 3.5: 1.54°; k = 3: 6.78°', see('k-unc', 0, 'k 降到 4 还压得住（仍是约 0.04°）', '误差 1.54°', '降到 3 是 6.78°') && near(rdo(k4, '误差 RMS', '°'), .04, .003) && near(rdo(k35, '误差 RMS', '°'), 1.54, .011) && near(rdo(m, '误差 RMS', '°'), 6.78, .011), k4 + ' || ' + k35 + ' || ' + m);
    await w.set('smc-k', 6, 200); await w.click('200 Hz', 200); m = await R();
    ok('k back at 6, 200 Hz: speed ripple about 1.7 °/s (' + rdo(m, '速度抖动', ' °/s') + '), error about 0.2° (' + rdo(m, '误差 RMS', '°') + '°)', see('k-unc', 0, '误差约 0.2°') && near(rdo(m, '速度抖动', ' °/s'), 1.7, .08) && near(rdo(m, '误差 RMS', '°'), .2, .02), m);
    await w.click('相平面放大', 200); await w.click('滑模（边界层）', 200); await w.set('smc-phi', 1, 200); m = await R(); const j1 = rdo(m, '力矩跳变', ' N·m');
    await w.set('smc-phi', 2, 200); m = await R(); const j2 = rdo(m, '力矩跳变', ' N·m'), e2 = m;
    await w.set('smc-phi', 6, 200); m = await R(); const e6 = m; await w.set('smc-phi', 20, 200); m = await R();
    ok('boundary layer at 200 Hz: φ = 1 still jumps (' + j1 + ' N·m per step), φ = 2 does not (' + j2 + ' N·m) with an error of 0.11°; 0.34° at φ = 6, 1.11° at φ = 20', see('k-unc', 0, '平均每步约 5 N·m', '约 0.01 N·m', '误差 0.11°', '6 °/s 时 0.34°，20 °/s 时 1.11°') && near(j1, 5, .6) && j2 < .03 && has(e2, '误差 RMS 0.11°') && has(e6, '误差 RMS 0.34°') && has(m, '误差 RMS 1.11°'), e2 + ' || ' + m);
    await w.click('相平面放大', 100); await w.click('1000 Hz', 100); await w.click('干摩擦', 100); await w.set('smc-phi', 6, 100); await w.set('smc-mf', 1.5, 100); await w.click('滑模（开关）', 100); }

  sec('step ⑤ · dob: a payload nobody announced');
  { const w = W('dob'); await w.show(); let m, st;
    const run = async (ms) => { await wait(ms || 8200); return [await w.met(), await w.status()]; };
    await w.click('PD + 重力前馈', 200); [m, st] = await run(); const pd = m;
    await w.click('PID', 200); [m, st] = await run(); const pid = m;
    await w.click('自适应', 200); [m, st] = await run(); const ad = m;
    await w.click('扰动观测器', 200); [m, st] = await run(); const adrc = m;
    ok('2 kg payload: PD + feedforward sags 6.91° and stays 5.70° short; PID 5.96°, 1.75 s; Adaptive 4.49°, 1.01 s; ADRC 2.18°, 0.34 s', see('k-unc', 1, '下垂 6.91°，回不来，一直差 5.70°', 'PID 下垂 5.96°，1.75 秒回来', '自适应 4.49°，1.01 秒', 'ADRC 只有 2.18°，0.34 秒') && has(pd, '最大偏差 6.91°', '还没回来', '稳态误差 -5.70°') && has(pid, '最大偏差 5.96°', '恢复时间 1.75 s') && has(ad, '最大偏差 4.49°', '恢复时间 1.01 s') && has(adrc, '最大偏差 2.18°', '恢复时间 0.34 s'), pd + ' || ' + pid + ' || ' + ad + ' || ' + adrc);
    ok('ADRC at ωo = 60: torque noise about 0.02 N·m per step (' + rdo(adrc, '力矩噪声', ' N·m') + ')', see('k-unc', 1, '（约 0.02）') && near(rdo(adrc, '力矩噪声', ' N·m'), .019, .002), adrc); KEEP.dob = { pd, pid, ad, adrc };
    await w.click('自适应', 200); await w.set('dob-ga', 0, 200); await w.click('重来', 200); [m, st] = await run();
    ok('Adaptive with γ = 0 is exactly PD + feedforward (6.91°)', see('k-unc', 1, '一模一样（6.91°）') && has(m, '最大偏差 6.91°', '稳态误差 -5.70°') && has(st, '就是 PD + 重力前馈'), m + ' || ' + st);
    await w.set('dob-ga', 5, 200); await w.set('dob-mp', 3, 200); st = await untilSt(w, /太大/, 16);
    ok('γ = 5 with 3 kg: the mass estimate overshoots back and forth', see('k-unc', 1, '估计的质量来回过冲') && has(st, 'γ = 5.0 太大', '来回过冲'), st);
    await w.set('dob-mp', 2, 200); await w.click('扰动观测器', 200); await w.set('dob-wo', 10, 200); await w.click('重来', 200); [m, st] = await run(); const o10 = m;
    await w.set('dob-wo', 150, 200); await w.click('重来', 200); [m, st] = await run();
    const n150 = rdo(m, '力矩噪声', ' N·m'), n60 = rdo(adrc, '力矩噪声', ' N·m'); ok('ADRC: ωo = 10 sags 14.60° with torque noise 0.000; ωo = 150 sags 0.77° with about 0.21 N·m (' + n150 + '), ' + r1(n150 / n60) + ' times the ' + n60 + ' at ωo = 60', see('k-unc', 1, '下垂 14.60°，力矩噪声 0.000 N·m', '下垂只有 0.77°，力矩噪声约 0.21 N·m', '十倍多') && has(o10, '最大偏差 14.60°', '力矩噪声 0.000 N·m') && has(m, '最大偏差 0.77°') && near(n150, .21, .006) && n150 / n60 > 10 && n150 / n60 < 12.5, o10 + ' || ' + m);
    KEEP.dobO = { o10, o150: m };
    await w.set('dob-wo', 60, 200); await w.set('dob-ga', 1, 200);
    const off = async (mode) => { await w.click(mode, 200); await wait(8200); await w.click('换负载', 200); await wait(4200); return [await w.met(), await w.status()]; };
    const a = await off('PD + 重力前馈'), b2 = await off('PID'), c = await off('自适应');
    const up = s => num(s, /先往上冲了 ([\d.]+)°/);
    ok('payload taken off: PD goes straight back; PID and Adaptive first shoot up by about 5.6° and 4.2° (status: ' + up(b2[1]) + '°, ' + up(c[1]) + '°)', see('k-unc', 1, '先往上冲约 5.6° 和 4.2°', '直接回到 60°') && has(a[1], '1 kg 的模型又对了') && near(up(b2[1]), 5.6, .25) && near(up(c[1]), 4.2, .25), a[1] + ' || ' + b2[1] + ' || ' + c[1]); }

  sec('step ⑥ · imp: position, impedance, admittance and force control against a wall');
  { const w = W('imp'); await w.show(); let m, st;
    const R = async ms => { await wait(ms || 2600); return [await w.met(), await w.status()]; };
    await w.click('位置控制', 200); await w.set('imp-kw', 0, 200); [m, st] = await R(5000); const p0 = m;
    await w.set('imp-kw', 40, 200); [m, st] = await R(); const p40 = m; await w.set('imp-kw', 60, 200); [m, st] = await R(); const p60 = m, s60 = st; await w.set('imp-kw', 100, 200); [m, st] = await R();
    ok('position control: 54.5 N at 2 000 N/m, 158.8 N at 7 200, 200.0 N from 14 000 up; in series it would need 247 N to 429 N', see('k-con', 0, '稳态接触力 54.5 N', '7 200 时 158.8 N', '14 000 以上都是 200.0 N', '247 N 到 429 N') && has(p0, '稳态接触力 54.5 N') && has(p40, '稳态接触力 158.8 N') && has(p60, '稳态接触力 200.0 N') && has(s60, '要 247 N') && has(m, '稳态接触力 200.0 N') && has(st, '要 429 N') && has(await w.text('.row'), '50000 N/m'), p0 + ' || ' + p40 + ' || ' + s60 + ' || ' + st);
    await w.click('阻抗', 200); [m, st] = await R(4500); const i8 = m;
    await w.set('imp-k', 5000, 200); [m, st] = await R(); const i50 = m; await w.set('imp-kw', 0, 200); [m, st] = await R(); const i50s = m, st50s = st;
    await w.set('imp-k', 800, 200); [m, st] = await R(); const i8s = m; await w.set('imp-kw', 100, 200); [m, st] = await R();
    ok('impedance against the stiffest wall: 23.6 N at K = 800, 136.4 N at K = 5 000; softest wall: 42.9 N at K = 5 000, 17.1 N at K = 800', see('k-con', 0, 'K = 800 时 23.6 N，K = 5 000 时 136.4 N', '一路掉到 42.9 N', '从 23.6 变到 17.1') && has(i8, '稳态接触力 23.6 N') && has(i50, '稳态接触力 136.4 N') && has(i50s, '稳态接触力 42.9 N') && has(i8s, '稳态接触力 17.1 N') && has(m, '稳态接触力 23.6 N'), i8 + ' || ' + i50 + ' || ' + i50s + ' || ' + i8s);
    ok('the status for a soft wall now names the series stiffness instead of "K × 3 cm ≈ 43 N"', has(st50s, '串联的刚度 × 3 cm ≈ 43 N', '明显跟着墙的软硬变') && has(st, '几乎就是 K × 3 cm = 24 N'), st50s + ' || ' + st);
    // pull the block outwards with the mouse: press on it and move left; the status then says how far it gives way per 10 N
    const drag = async () => { for (let k = 0; k < 3; k++) { await p.evaluate(() => document.getElementById('imp-cv').scrollIntoView({ block: 'center' })); await wait(300);
        const g = await p.evaluate(() => { const cv = document.getElementById('imp-cv'), r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: cv.clientWidth }; }); const px = g.l + 12 + (.30 - .05) / .345 * (g.w - 24) - 8 - 6 * k, py = g.t + 80;
        await p.mouse.move(px, py); await p.mouse.down(); await p.mouse.move(px - 30, py, { steps: 6 }); await wait(800); const s = await w.status(); await p.mouse.up(); await wait(1200); if (s.includes('每 10 N')) return s; } return await w.status(); };
    const dImp = await drag(); await w.click('位置控制', 200); await wait(4500); const dPos = await drag();
    ok('pulled by hand: impedance (K = 800) gives way 12.5 mm per 10 N, position control 0.5 mm', see('k-con', 0, '阻抗每 10 N 让开 12.5 mm，位置控制只让 0.5 mm') && has(dImp, '每 10 N 让开 12.5 mm') && has(dPos, '每 10 N 只让开 0.5 mm'), dImp + ' || ' + dPos);
    await w.click('导纳', 200); await w.set('imp-d', 20, 200); [m, st] = await R(4500); const ppA = num(st, /峰峰值 (\d+) N/);
    ok('admittance, stiffest wall, D = 20: the contact force jumps by over 100 N (status: ' + ppA + ' N)', see('k-con', 0, '接触力上下跳 100 多牛') && has(st, '在抖') && ppA > 95 && ppA < 135, st); KEEP.admPP = ppA;
    await w.click('阻抗', 200); [m, st] = await R(4500);
    ok('the same settings under impedance: a steady 23.6 N', see('k-con', 0, '稳稳的 23.6 N') && has(m, '稳态接触力 23.6 N') && !has(st, '在抖'), m + ' || ' + st);
    await w.set('imp-d', 60, 200); await w.set('imp-kw', 0, 200); await w.click('力控', 200); [m, st] = await R(6000); const f0 = m, sf0 = st; await w.set('imp-kw', 100, 200); [m, st] = await R(3500);
    ok('force control: 15.0 N against the softest and the stiffest wall; pressed in 7.50 mm and 0.30 mm', see('k-con', 0, '接触力都是 15.0 N', '从 7.50 mm 到 0.30 mm') && has(f0, '稳态接触力 15.0 N') && has(sf0, '压进去 7.50 mm') && has(m, '稳态接触力 15.0 N') && has(st, '压进去 0.30 mm'), f0 + ' || ' + sf0 + ' || ' + m + ' || ' + st);
    await w.set('imp-kw', 72, 100); await w.click('阻抗', 100); }

  sec('step ⑦ · mpc: horizon, solver, planning once, a wrong model');
  { const w = W('mpc'); await w.show(); let m, st;
    await w.click('重来', 100); await wait(4500); m = await w.met(); const pl = await EV(() => [CHK.plan(60, 2.5), CHK.plan(25, 2.5)]); KEEP.ms = { ilqr: rdo(m, '每步计算（周期 20 ms）', ' ms') };
    ok('default (iLQR, 1.2 s): upright after 1.7 s; the first plan pushes at −2.5 N·m, swings out to ' + r1(-pl[0].thMin) + '° and ends at ' + r1(pl[0].thEnd) + '° on the other side', see('k-mpc', 0, '杆荡到约 36° 就掉头', '约 1.7 秒到顶') && near(rdo(m, '到达竖直用时', ' s'), 1.7, .11) && pl[0].U0 === -2.5 && near(-pl[0].thMin, 36, 1) && pl[0].thEnd > 90, m + JSON.stringify(pl[0]));
    await w.set('mpc-hz', .5, 300); await w.click('重来', 100); await wait(7500); m = await w.met(); st = await w.status(); const sat = rdo(m, '计划里顶到力矩上限', '%');
    ok('0.5 s horizon: never reaches the top; the plan sits at the torque limit (readout ' + sat + '%; the first plan: ' + pl[1].sat + '%, pushing one way to ' + r1(pl[1].thEnd) + '°)', see('k-mpc', 0, '力矩全顶在上限上', '上不去') && has(m, '到达竖直用时 到不了') && sat >= 90 && pl[1].sat === 100 && pl[1].thMax < 5 && has(st, '只往前看 0.5 s'), m + ' || ' + st);
    await w.click('MPPI', 100); await wait(5000); m = await w.met(); const tm = rdo(m, '到达竖直用时', ' s');
    ok('MPPI with 0.5 s: upright after about 2 seconds (' + tm + ' s)', see('k-mpc', 0, '约 2 秒到顶') && near(tm, 2, .45), m);
    await w.click('iLQR', 100); await w.set('mpc-hz', 1.2, 300); await w.click('只规划一次', 100); await wait(2600); m = await w.met(); const m1 = m; await wait(3600); m = await w.met(); st = await w.status(); const offv = rdo(m, '现在离竖直', '°');
    ok('planning once: at the top after 1.7 s, then it falls (now ' + offv + '° from upright)', see('k-mpc', 0, '也是约 1.7 秒到顶，可停不住') && near(rdo(m1, '到达竖直用时', ' s'), 1.7, .11) && offv > 30 && has(st, '只规划一次：计划本身没错'), m + ' || ' + st);
    await w.click('每步重新规划', 100); await w.click('模型有误差', 100); await wait(5500); m = await w.met(); st = await w.status();
    ok('re-planning every step with the model wrong: upright after 2.4 s, and held', see('k-mpc', 0, '约 2.4 秒到顶并稳住') && near(rdo(m, '到达竖直用时', ' s'), 2.4, .16) && has(st, '到顶并稳住了', '真实是 1.3 kg'), m + ' || ' + st);
    await w.click('MPPI', 100); await wait(4500); m = await w.met(); KEEP.ms.mppi = rdo(m, '每步计算（周期 20 ms）', ' ms');
    ok('computation per step on this machine: iLQR ' + KEEP.ms.ilqr + ' ms, MPPI ' + KEEP.ms.mppi + ' ms, both far below the 20 ms period', see('k-mpc', 0, '都远小于 20 ms 的周期') && KEEP.ms.ilqr < 10 && KEEP.ms.mppi < 10, m);
    await w.click('模型有误差', 100); await w.click('iLQR', 100); }

  sec('step ⑧ · rl: random search finds the LQR gains; domain randomisation');
  { const w = W('rl'); await w.show(); await wait(2500); let m = await w.met(), st;
    ok('before training: gains (3.0, 0.60), LQR (10.7, 2.47)', has(m, '迭代 0', '3.0 · 0.60', '10.7 · 2.47'), m);
    await w.click('开始训练', 100); for (let k = 0; k < 60; k++) { await wait(1000); if ((await w.met()).includes('迭代 150 ')) break; } await wait(600); m = await w.met(); st = await w.status();
    const tr = await EV(() => CHK.rl.train(2, 150, 150)); KEEP.rl = tr;
    ok('the first training after loading the page pauses at 150 iterations with the gains at (11.2, 2.59) and a cost of 0.086, the same as LQR', see('k-learn', 0, '增益停在 (11.2, 2.59)', 'LQR 是 (10.7, 2.47)', '两者的代价都是 0.086') && has(m, '迭代 150', '用掉的回合 4800', '11.2 · 2.59') && has(st, '代价 0.086，LQR 是 0.086', '自动暂停'), m + ' || ' + st);
    ok('same training re-run in the page (seed and update rule of the interactive): gains (' + r2(tr.kNom[0]) + ', ' + r2(tr.kNom[1]) + ') after 150 iterations; first within 10% of LQR at iteration ' + tr.first + ' (' + tr.firstEps + ' episodes) with a cost of ' + tr.it7[2].toFixed(3), see('k-learn', 0, '第 7 轮（用了 224 个回合）代价降到 0.089') && near(tr.kNom[0], 11.19, .01) && near(tr.kNom[1], 2.59, .01) && tr.first === 7 && tr.firstEps === 224 && tr.it7[2].toFixed(3) === '0.089' && near(tr.JNom, .086, .0006), JSON.stringify(tr));
    await w.click('2.5 kg', 400); m = await w.met(); st = await w.status();
    ok('test mass 2.5 kg: it falls; holding it needs k₁ above m·g·l = 12.3', see('k-learn', 0, '测试质量换成 2.5 kg：倒了', 'm·g·l = 12.3') && has(m, '2.5✗') && has(st, 'm·g·l = 12.3，现在只有 11.2'), m + ' || ' + st);
    await w.click('域随机化', 300); await w.click('开始训练', 100); for (let k = 0; k < 60; k++) { await wait(1000); if ((await w.met()).includes('迭代 300 ')) break; } await wait(600); m = await w.met(); st = await w.status();
    ok('randomised for another 150 iterations: gains (20.6, 4.23), all three test masses hold, cost at 1 kg 0.119 against 0.086', see('k-learn', 0, '走到 (20.6, 4.23)', '三个测试质量都稳得住', '从 0.086 涨到 0.119') && has(m, '迭代 300', '20.6 · 4.23', '0.5✓ 1✓ 2.5✓') && has(st, '1 kg 时代价 0.119，比 LQR 的 0.086') && near(tr.kDR[0], 20.6, .01) && near(tr.kDR[1], 4.23, .01) && near(tr.J1, .119, .0006), m + ' || ' + st); }

  sec('step ⑧ · cbf: the safety filter');
  { const w = W('cbf'); await w.show(); let m, st;
    const C0 = await EV(() => { const f = (o) => CHK.cbf(o); return { off: f({ filt: false, nom: 'pd', gam: 3, ul: 4 }), g3: f({ filt: true, nom: 'pd', gam: 3, ul: 4 }), g05: f({ filt: true, nom: 'pd', gam: .5, ul: 4 }), g20: f({ filt: true, nom: 'pd', gam: 20, ul: 4 }), w3: f({ filt: true, nom: 'pd', gam: 3, ul: 2.5 }), w6: f({ filt: true, nom: 'pd', gam: 6, ul: 2.5 }), w20: f({ filt: true, nom: 'pd', gam: 20, ul: 2.5 }) }; }); KEEP.cbf = C0;
    await w.click('关', 200); await w.click('重来', 100); st = await untilSt(w, /刚才 [\d.]+ m\/s/, 8); m = await w.met();
    ok('filter off: the cart hits the wall at ' + r2(C0.off.crash[0][0]) + ' s doing ' + r2(C0.off.crash[0][1]) + ' m/s (status: ' + (st.match(/刚才 [\d.]+ m\/s/) || [''])[0] + ')', see('k-learn', 1, '第 0.8 秒以 1.4 m/s 撞墙') && has(st, '刚才 1.4 m/s') && near(C0.off.crash[0][0], .83, .02) && near(C0.off.crash[0][1], 1.44, .02), st);
    await w.click('开', 200); await w.click('重来', 100); let bad2 = false; for (let k = 0; k < 23; k++) { await wait(200); if ((await w.status()).includes('还是撞了')) bad2 = true; } m = await w.met(); st = await w.status();
    ok('filter on, γ = 3: no crash; the command is edited from ' + r2(C0.g3.tAct) + ' s to the end (' + r2(C0.g3.tActEnd) + ' s); ' + r1(C0.g3.at[1]) + ' cm from the wall at 1 s, ' + r1(C0.g3.at[2] * 10) + ' mm at 2 s', see('k-learn', 1, '从 0.26 秒起', '1 秒时离墙 10.8 cm，2 秒时 3.7 mm') && has(m, '撞墙次数 0') && C0.g3.crash.length === 0 && near(C0.g3.tAct, .26, .001) && C0.g3.tActEnd > 4.9 && near(C0.g3.at[1], 10.8, .05) && near(C0.g3.at[2] * 10, 3.7, .05), m + JSON.stringify(C0.g3));
    ok('a clean run no longer shows the "it still crashed" status left over from an earlier run', !bad2 && has(st, '不会撞上去'), st);
    await w.set('cbf-g', .5, 200); await w.click('重来', 100); await wait(4700); m = await w.met(); const d05 = rdo(m, '离墙最近（本回合）', ' cm');
    ok('γ = 0.5: edited from ' + r2(C0.g05.tAct) + ' s; still ' + r1(C0.g05.end) + ' cm short when the 5 s are up (readout just before the end: ' + d05 + ' cm)', see('k-learn', 1, '0.06 秒就开始改', '还离墙 8.3 cm') && near(C0.g05.tAct, .06, .001) && near(C0.g05.end, 8.3, .05) && near(d05, 8.9, 1), m);
    await w.set('cbf-g', 20, 200); await w.click('重来', 100); await wait(4600); m = await w.met();
    ok('γ = 20: edited only from ' + r2(C0.g20.tAct) + ' s; ' + r1(C0.g20.at[1] * 10) + ' mm from the wall at 1 s; no crash', see('k-learn', 1, '0.52 秒才开始改', '离墙约 5 mm') && near(C0.g20.tAct, .52, .001) && near(C0.g20.at[1] * 10, 5.4, .2) && has(m, '撞墙次数 0'), m);
    await w.set('cbf-g', 3, 200); await w.click('学出来的策略', 200); await w.click('重来', 100); await wait(11000); m = await w.met();
    const many = await EV(() => ({ d3: CHK.cbfMany({ filt: true, nom: 'rl', gam: 3, ul: 4 }, 300), w3: CHK.cbfMany({ filt: true, nom: 'rl', gam: 3, ul: 2.5 }, 300), w6: CHK.cbfMany({ filt: true, nom: 'rl', gam: 6, ul: 2.5 }, 300), w20: CHK.cbfMany({ filt: true, nom: 'rl', gam: 20, ul: 2.5 }, 300) })); KEEP.cbfMany = many;
    ok('learned policy, γ = 3, dry floor: no crash (readout after two runs; same loop: ' + many.d3.runsWithCrash + ' of 300 runs crash)', see('k-learn', 1, '也一次不撞') && has(m, '撞墙次数 0') && many.d3.runsWithCrash === 0, m);
    await w.click('湿滑', 200); await w.click('重来', 100); await wait(6000); m = await w.met();
    ok('slippery floor, γ = 3: no crash (same loop: ' + many.w3.runsWithCrash + ' of 300)', see('k-learn', 1, '湿滑、γ = 3：不撞') && has(m, '撞墙次数 0') && many.w3.runsWithCrash === 0, m);
    await w.set('cbf-g', 6, 200); await w.click('重来', 100); st = await untilSt(w, /还是撞了/, 22); m = await w.met(); const v6 = num(st, /还是撞了（([\d.]+) m\/s）/);
    ok('slippery floor, γ = 6: it crashes at around 0.2 m/s (status: ' + v6 + ' m/s; same loop: ' + many.w6.runsWithCrash + ' of 300 runs crash, the fastest at ' + r2(many.w6.fastest) + ' m/s)', see('k-learn', 1, '多数回合都以 0.2 m/s 上下撞上') && has(st, '模型错了') && v6 > .05 && v6 <= .3 && many.w6.runsWithCrash > 150 && many.w6.fastest < .3, st + JSON.stringify(many.w6));
    ok('γ = 20: nearly every run crashes, the fastest at about 0.8 m/s (same loop: ' + many.w20.runsWithCrash + ' of 300, ' + r2(many.w20.fastest) + ' m/s; the plain PD: ' + r2(C0.w6.crash[0][1]) + ' m/s at γ = 6 and ' + r2(C0.w20.crash[0][1]) + ' at 20)', see('k-learn', 1, '20 时最快约 0.8 m/s') && many.w20.runsWithCrash > 280 && near(many.w20.fastest, .78, .08) && C0.w3.crash.length === 0 && C0.w20.crash[0][1] > C0.w6.crash[0][1], JSON.stringify(many.w20));
    await w.set('cbf-g', 3, 100); await w.click('干燥', 100); await w.click('激进 PD', 100); await w.click('重来', 100); }

  sec('step ⑨ · wm: MPC with a learned model');
  { const w = W('wm'); await w.show(); let m, st;
    await w.click('重来', 200); await wait(4600); m = await w.met(); const fit = await EV(() => { const a = CHK.wm.fit('phys', 500, 1), b = CHK.wm.fit('lin', 500, 1); return { e: a.E1, d: a.maxDiff, t: CHK.wm.run(a.dw, 9), le: b.E1, lt: b.gTop, lr: CHK.wm.run(b.dw, 9) }; }); KEEP.wm = fit;
    ok('default (physics features, 500 samples): one-step error 6%, upright after 1.9 s; the learned gravity curve is at most ' + r2(fit.d) + ' N·m from the true one', see('k-model', 0, '单步预测误差 6%，1.9 秒立住', '最多差 0.16 N·m') && has(m, '单步预测误差 6%', '立住用时 1.9 s') && near(fit.e, 5.8, .1) && near(fit.t, 1.88, .011) && near(fit.d, .16, .005), m + JSON.stringify(fit));
    await w.click('线性模型', 200); await wait(5200); m = await w.met(); st = await w.status(); const dr = rdo(m, '想象偏差（1.2 秒后）', '°');
    ok('linear model: one-step error 57%; it believes gravity at the top is 4.7 N·m; never upright; imagination and reality ' + dr + '° apart', see('k-model', 0, '单步误差 57%', '4.7 N·m', '差一百多度') && has(m, '单步预测误差 57%', '立住用时 —') && has(st, '重力力矩有 4.7 N·m') && dr > 100 && near(fit.lt, 4.73, .01) && fit.lr === null, m + ' || ' + st);
    await w.click('物理特征', 200); await w.set('wm-n', 0, 400); await wait(8200); m = await w.met(); const a50 = m;
    await w.click('换一批数据', 200); await wait(8200); m = await w.met(); const b50 = m, sb50 = await w.status(); await w.click('换一批数据', 200); await wait(6000); m = await w.met();
    ok('50 samples, batches 1 to 3: 27% and upright after 5.1 s; 30% and not upright; 28% and 2.8 s', has(a50, '单步预测误差 27%', '立住用时 5.1 s') && has(b50, '单步预测误差 30%', '立住用时 —') && has(sb50, '没立住') && has(m, '单步预测误差 28%', '立住用时 2.8 s'), a50 + ' || ' + b50 + ' || ' + m);
    const tab = await EV(() => { const o = {}; for (const N of [50, 200, 2000]) { o[N] = []; for (let s = 1; s <= 12; s++) { const f = CHK.wm.fit('phys', N, s); o[N].push([Math.round(f.E1), CHK.wm.run(f.dw, 9)]); } } return o; }); KEEP.wmTab = tab;
    const E = N => tab[N].map(q => q[0]), U = N => tab[N].map(q => q[1]).filter(v => v !== null), mn = a => Math.min(...a), mx = a => Math.max(...a);
    ok('same loop, the first 12 batches at 50 samples: errors ' + mn(E(50)) + '% to ' + mx(E(50)) + '%; ' + (12 - U(50).length) + ' are not upright within 9 s, the others take ' + r1(mn(U(50))) + ' to ' + r1(mx(U(50))) + ' s', see('k-model', 0, '单步误差 15% 到 34%', '前 12 批里有 5 批在 9 秒内立不住', '1.8 到 6.8 秒') && mn(E(50)) === 15 && mx(E(50)) === 34 && U(50).length === 7 && r1(mn(U(50))) === 1.8 && r1(mx(U(50))) === 6.8, JSON.stringify(tab[50]));
    ok('200 samples: errors ' + mn(E(200)) + '% to ' + mx(E(200)) + '%, ' + U(200).length + ' of 12 upright; 2000 samples: ' + mn(E(2000)) + '% to ' + mx(E(2000)) + '%, all upright after ' + r1(mn(U(2000))) + ' to ' + r1(mx(U(2000))) + ' s', see('k-model', 0, '200 条：误差 6% 到 17%，12 批里 10 批立住', '2000 条：误差 5% 到 7%', '2 秒上下立住') && mn(E(200)) === 6 && mx(E(200)) === 17 && U(200).length === 10 && mn(E(2000)) === 5 && mx(E(2000)) === 7 && U(2000).length === 12 && mn(U(2000)) >= 1.7 && mx(U(2000)) <= 2.5, JSON.stringify(tab[200]) + JSON.stringify(tab[2000]));
    await w.set('wm-n', 10, 400); await wait(6000); m = await w.met(); const before = rdo(m, '想象偏差（1.2 秒后）', '°');
    await w.click('推一下', 100); let peak = 0; for (let k = 0; k < 16; k++) { await wait(250); peak = Math.max(peak, rdo(await w.met(), '想象偏差（1.2 秒后）', '°')); } await wait(5000); m = await w.met(); const after = rdo(m, '想象偏差（1.2 秒后）', '°');
    ok('2000 samples, upright, then a push: the imagination error jumps from ' + before + '° to ' + peak + '° and is back at ' + after + '° a few seconds later', see('k-model', 0, '跳到几十度', '又回到十几度') && before < 25 && peak >= 30 && after < 25 && has(m, '离竖直'), m);
    await w.set('wm-n', 6, 300); }

  sec('step ⑩ · sp: the map of 51 methods');
  { const w = W('sp'); await w.show();
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp .spgr')].map(g => ({ h: g.querySelector('.spgh').innerText.replace(/\s+/g, ' ').trim(), ks: [...g.querySelectorAll('.spk')].map(k => k.innerText.replace(/\s+/g, ' ').trim()) })));
    const tile = async name => { await p.evaluate(n => { const k = [...document.querySelectorAll('#sp .spk')].find(k => k.innerText.replace(/\s+/g, ' ').trim().startsWith(n)); if (k) k.click(); }, name); await wait(250); return await p.evaluate(() => { const d = document.querySelector('#sp .spd'); return d && !d.hidden ? d.innerText.replace(/\s+/g, ' ').trim() : ''; }); };
    let g = await groups(); const total = g.reduce((a, q) => a + q.ks.length, 0); const d = norm(await tile('PID（手调）'));
    ok('by family: ' + g.length + ' groups, ' + total + ' methods; PID\'s relatives: LQR comes out as a PD, the sliding surface has the shape of a PD, ADRC\'s total disturbance does the integral\'s job', see('k-all', 0, '解出来就是一个 PD', '就是 PD 的形状', '干的是积分项的活') && total === 51 && has(d, 'LQR 解出来就是一个 PD', '滑模面 s = ė + λe 就是 PD 的形状', '干的是积分项的活，但快得多'), d.slice(0, 200));
    ok('the detail panel no longer refers to "the previous page"', !d.includes('上一篇') && has(d, '它跨了六个功能层里的哪几层'), d.slice(0, 400));
    await w.click('在哪几级环', 300); g = await groups(); const withPID = g.filter(q => q.ks.some(k => k.startsWith('PID（手调）'))), cur = g.find(q => q.h.startsWith('电流 / 力矩环'));
    ok('by loop level: PID is in ' + withPID.length + ' groups (' + withPID.map(q => q.h.split(' 每')[0].split(' 几秒')[0]).join('; ') + '); the current / torque loop holds ' + cur.ks.length + ' methods', see('k-all', 0, 'PID 出现在 4 组里（电流 / 力矩环、关节环、全身 / 平衡环、工业过程与家电）', '有 6 种：开关控制、PID、频域整形、滑模控制、显式 MPC、ADRC') && withPID.length === 4 && ['电流 / 力矩环', '关节环', '全身 / 平衡环', '工业过程与家电'].every(n => withPID.some(q => q.h.startsWith(n))) && cur.ks.length === 6 && ['开关控制', 'PID（手调）', '频域整形', '滑模控制', '显式 MPC', 'ADRC'].every(n => cur.ks.some(k => k.startsWith(n))), cur.ks.join(' | '));
    await w.click('什么时候算', 300); g = await groups(); const net = g.find(q => q.h.startsWith('离线训练，在线跑网络')), firstYr = k => +k.match(/(\d{4})/)[1];
    ok('by when the work is done: "trained offline, a network online" holds ' + net.ks.length + ' methods; first years: ' + net.ks.map(firstYr).join(', '), see('k-all', 0, '那一组有 8 种', '除了 1989 年的行为克隆，其余 7 种都出现在 2018 年以后') && net.ks.length === 8 && net.ks.filter(k => firstYr(k) >= 2018).length === 7 && net.ks.some(k => k.startsWith('行为克隆') && firstYr(k) === 1989) && g.reduce((a, q) => a + q.ks.length, 0) === 51, net.ks.join(' | '));
    await w.click('模型从哪来', 300); g = await groups(); const lm = g.find(q => q.h.startsWith('学出来的模型'));
    ok('by where the model comes from: "a learned model" holds ' + lm.ks.length + ' methods, each named in the "What you will see" line', see('k-all', 0, '"学出来的模型"有 9 种', '系统辨识、自校正调节器', '学个模型再做 MPC、Koopman 线性化、TD-MPC2、V-JEPA 2', 'PILCO、Dreamer、学出来的仿真器') && lm.ks.length === 9 && ['自校正调节器', '系统辨识', 'PILCO', '学个模型再做 MPC', 'Koopman 线性化', 'Dreamer', 'TD-MPC2', '视频世界模型做规划（V-JEPA 2）', '学出来的仿真器'].every(n => lm.ks.some(k => k.startsWith(n))), lm.ks.join(' | '));
    await w.click('占哪几层', 300); const note = await p.evaluate(() => document.querySelector('#sp .spn').innerText); ok('the note of the "layers" grouping names the six layers itself', !note.includes('上一篇') && has(note, '传感、感知与估计、决策、规划、控制、执行'), note);
    await w.click('家族', 200); }

  sec('step ⑪ · hum: the waves of humanoid control');
  { const w = W('hum'); await w.show();
    const rows = await p.evaluate(() => [...document.querySelectorAll('#hum .hmw')].map(r => { const t = [r.innerText]; let e = r.nextElementSibling; for (let k = 0; k < 6 && e; k++) { t.push(e.innerText); e = e.nextElementSibling; } return t.join(' ').replace(/\s+/g, ' ').trim(); }));
    const first = rows.findIndex(r => r.includes('学的'));
    ok('teal ("learned") first appears in the row "2019–2024 …" with three layers; the next row takes the decision layer too', see('k-hum', 0, '青色最早出现在"2019–2024 仿真里练出来的强化学习"那一行，占了感知与估计、规划、控制三层', '把决策也占了') && has(rows[first], '2019–2024 仿真里练出来的强化学习 硬件 学的 人 学的 学的 硬件') && has(rows[first + 1], '2024–2026 动作跟踪 + VLA 硬件 学的 学的 学的 学的 硬件') && rows.slice(0, first).every(r => !r.includes('学的')), rows.join(' / '));
    const det = async i => { await p.evaluate(i => document.querySelectorAll('#hum .hmw')[i].click(), i); await wait(250); return norm(await p.evaluate(() => document.querySelector('#hum .hmd').innerText)); };
    const d4 = await det(first - 1), d5 = await det(first), d6 = await det(first + 1);
    ok('MPC plus whole-body control: gait timing, MPC 30–100 Hz, whole-body control 0.5–1 kHz, joint torque loop; RL: one policy at ~50 Hz above the joint PD and the current loop', see('k-hum', 0, 'MPC（每秒 30 到 100 次）、全身控制（每秒 500 到 1 000 次）、关节力矩环', '每秒约 50 次的策略网络') && has(d4, '步态时序（状态机） 每步', 'MPC：未来半秒的脚底力 30–100 Hz', '全身控制 0.5–1 kHz', '关节力矩环 kHz') && has(d5, 'RL 策略 ~50 Hz', '关节 PD 1–10 kHz', '电流环 10–40 kHz'), d4.slice(0, 300) + ' || ' + d5.slice(0, 300));
    ok('where the model sits: online for MPC plus whole-body control, in the simulator for RL', see('k-hum', 0, '简化模型在 MPC 里，完整模型在全身控制里', '只在训练时用，放在仿真器里') && has(d4, '在线：简化模型在 MPC 里，完整模型在全身控制里') && has(d5, '离线：模型在仿真器里，只在训练时用'), '');
    ok('motion tracking plus a VLA: VLA at ~7–9 Hz, current loop up to 40 kHz: ' + Math.log10(40000 / 9).toFixed(2) + ' to ' + Math.log10(40000 / 7).toFixed(2) + ' orders of magnitude', see('k-hum', 0, '每秒 7 到 9 次', '每秒最多 4 万次，差了三个多数量级') && has(d6, 'VLA：看懂场景和指令 ~7–9 Hz', '关节 PD + 电流环 1–40 kHz') && Math.log10(40000 / 9) > 3 && Math.log10(40000 / 7) < 4, d6.slice(0, 300)); }

  // ------------------------------------------------------------------------------------------------------------
  // Part B: the numbers in the formula cards, the paragraphs and the figures, recomputed with the same engine.
  // Each check first requires the quoted string to be in the page, then the recomputed value to agree with it.
  // ------------------------------------------------------------------------------------------------------------
  const TX = {}; for (const id of ['k-map', 'k-pid', 'k-freq', 'k-ss', 'k-nl', 'k-unc', 'k-con', 'k-mpc', 'k-learn', 'k-model', 'k-all', 'k-hum', 'k-sum']) TX[id] = await secText(id);
  const HDR = norm(await p.evaluate(() => { const s = document.querySelector('header.hero'); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }));
  const SRC = await p.evaluate(() => [...document.querySelectorAll('script')].map(s => s.textContent).join('\n'));
  const T = (id, ...strs) => strs.every(s => (id === 'hdr' ? HDR : TX[id]).includes(s));
  const base = await EV(() => { const P = CTL.P0; return { I: CTL.inert(P), mgl: P.m * P.g * P.l, b: P.b, m: P.m, l: P.l }; });

  sec('text · the arm, the header and figure 1');
  ok('I = m l² = 0.25 kg·m², friction 0.05, mgl about 4.9 N·m', T('hdr', 'I = m l² = 0.25 kg·m²', '0.05 N·m·s/rad', '约 4.9 N·m') && base.I === .25 && base.b === .05 && near(base.mgl, 4.9, .01), JSON.stringify(base));
  ok('figure 1 and the lead: 1 kg, 0.5 m, 4.9 N·m; the header promises 51 methods', T('k-map', '挂着 1 kg 的重物，杆长 0.5 m', '杆水平时最大，4.9 N·m') && T('hdr', '51 种方法') && base.m === 1 && base.l === .5, '');
  ok('no sentence refers to "the previous page" any more (the page stands alone; the link to the previous page in the header is the navigation)', !Object.keys(TX).some(k => /上一篇|上篇/.test(TX[k])), Object.keys(TX).filter(k => /上一篇|上篇/.test(TX[k])).join(','));

  sec('text · step ① PID');
  { const r = await EV(() => { const a = CHK.pid(); a.setMode('pd'); a.run(12); const m = a.met(); const b = CHK.pid(); b.setMode('pd'); b.kp = 40; b.run(12); const m2 = b.met(); const c = CHK.pid(); c.run(1.5); c.setMode('onoff'); c.run(12); const p12 = c.met().pp; c.run(3); const p15 = c.met().pp; c.run(4); return { e20: m.err, th20: m.theta, e40: m2.err, th40: m2.theta, p12, p15, p19: c.met().pp }; });
    const tq = 4.905 * Math.sin(r.th20 * Math.PI / 180), tq40 = 4.905 * Math.sin(r.th40 * Math.PI / 180);
    ok('card: with Kp = 20 the arm rests at ' + r2(r.th20) + '°, where gravity needs ' + r2(tq) + ' N·m; that takes an error of ' + r2(tq / 20) + ' rad = ' + r2(r.e20) + '°', T('k-pid', '4.9 × sin 50° ≈ 3.7 N·m', '3.7 ÷ 20 ≈ 0.19 rad', '差 10° 多') && near(r.th20, 50, .8) && near(tq, 3.7, .05) && near(tq / 20, .19, .005) && r.e20 > 10 && r.e20 < 11, JSON.stringify(r));
    ok('quiz: with Kp = 40 it rests at ' + r2(r.th40) + '° (' + r2(tq40) + ' N·m), ' + r2(r.e40) + '° short: about half the ' + r2(r.e20) + '° of Kp = 20', T('k-sum', '4.9 × sin 55° ≈ 4.0 N·m', '4.0 ÷ 40 = 0.1 rad，约 6°', '11° 左右少了约一半') && near(r.th40, 55, .8) && near(tq40, 4.0, .05) && near(r.e40, 6, .5) && near(r.e20, 11, .5), '');
    ok('lead: on-off grows to about 90° peak to peak after ten to twenty seconds (' + r1(r.p12) + '°, ' + r1(r.p15) + '°, ' + r1(r.p19) + '° after 12, 15, 19 s)', T('k-pid', '十几秒后峰峰值有 90° 上下') && [r.p12, r.p15, r.p19].every(v => near(v, 90, 7)), '');
    ok('legend: dead band ±1.5°, noise 0.4°, D filter at 30 Hz, push of 6 N·m for 0.08 s, 6 N·m limit by default (constants in the interactive\'s code)', T('k-pid', '留 ±1.5° 的回差', '0.4° 左右', '30 Hz 的低通', '0.08 秒、6 N·m') && has(SRC, 'e>1.5*D2R', 'K.gauss(rn)*.4*D2R', '2*Math.PI*30*DT', 't-pushT<.08)d=-6', 'kp=20,ki=30,kd=1,um=6'), ''); }

  sec('text · step ② frequency');
  { const w = W('bode'); await w.show(); await w.click('稳健', 300); const a = await w.met(); await w.set('bode-tau', 40, 300); const b2 = await w.met(); await w.click('加延迟', 300); const c = await w.met(); await w.click('稳健', 300);
    ok('card: Robust has ωc ≈ 9.3 rad/s and a 61° margin; 40 ms cost 9.3 × 0.04 = ' + r2(9.3 * .04) + ' rad = ' + r1(9.3 * .04 * 180 / Math.PI) + '° and leave 40°', T('k-freq', 'ωc ≈ 9.3 rad/s，相位裕度 61°', '9.3 × 0.04 ≈ 0.37 rad ≈ 21°，裕度降到 40°') && has(a, '穿越频率 ωc 9.3 rad/s', '相位裕度 61°') && has(b2, '相位裕度 40°') && near(9.3 * .04, .37, .005), a + ' || ' + b2);
    ok('card: at twice the crossover frequency (18.8) the same 40 ms eat 43° and the margin drops from 58° to 15°', T('k-freq', 'ωc ≈ 18.8', '吃掉 43°，裕度从 58° 掉到 15°') && has(KEEP.addDelay0, '穿越频率 ωc 18.', '相位裕度 58°') && has(c, '相位裕度 15°') && near(18.8 * .04 * 180 / Math.PI, 43, .5), KEEP.addDelay0 + ' || ' + c);
    ok('text: Kd from 2 to 0 takes the margin from 61° to 2° and the overshoot from 6% to 96%; with Ki = 20 the margin is 55° and the overshoot 42% (readouts checked in Part A)', T('k-freq', '相位裕度从 61° 掉到 2°，超调从 6% 变成 96%', 'Ki = 20 时裕度还有 55°，超调已经 42%'), '');
    ok('quiz: 20 × 0.03 = 0.6 rad = ' + r1(.6 * 180 / Math.PI) + '°, leaving about 16° of 50°', T('k-sum', '20 × 0.03 = 0.6 rad ≈ 34°，裕度剩约 16°') && near(.6 * 180 / Math.PI, 34, .5), ''); }

  sec('text · step ③ state space');
  { const r = await EV(() => { const a = CHK.lqr(-2), LN = a.LN; let ph = Math.PI / 180, w = 0; const h = 1e-4; for (let i = 0; i < 10000; i++) { const al = LN.a1 * ph + LN.a2 * w; ph += w * h + al * h * h / 2; w += al * h; } return { LN, open: a.open.map(q => q[0]), K: a.K, poles: a.poles[0], lin1s: ph * 180 / Math.PI }; });
    ok('card: mgl ∕ I = ' + r2(r.LN.a1) + ' s⁻², A = [[0, 1], [19.6, −0.2]], B = [0, 4]ᵀ', T('k-ss', '4.9 ÷ 0.25 ≈ 19.6 s⁻²', 'A = [[0, 1], [19.6, -0.2]]，B = [0, 4]ᵀ') && near(r.LN.a1, 19.6, .03) && near(r.LN.a2, -.2, 1e-9) && r.LN.b === 4, JSON.stringify(r.LN));
    ok('card: open-loop poles ' + r2(r.open[0]) + ' and ' + r2(r.open[1]) + '; the deviation grows e-fold every ' + r2(1 / r.open[0]) + ' s; released 1° off, the linear model is ' + r1(r.lin1s) + '° off after 1 s', T('k-ss', '每过约 0.23 秒就放大 e ≈ 2.7 倍', '+4.3 和 -4.5', '偏了约 40°') && near(r.open[0], 4.3, .05) && near(r.open[1], -4.5, .05) && near(1 / r.open[0], .23, .005) && near(r.lin1s, 40, 2), '');
    ok('card: at 30° sin φ and φ differ by ' + r1((Math.PI / 6 - .5) / .5 * 100) + '%', T('k-ss', '偏到 30°，sin φ 和 φ 已经差了 5%') && near((Math.PI / 6 - .5) / .5 * 100, 5, .5), '');
    ok('card: K = [16.0, 2.78], closed-loop poles −5.7 ± 3.5j; 2·mgl = ' + r2(2 * base.mgl), T('k-ss', 'K = [16.0, 2.78]', '闭环极点 -5.7 ± 3.5j', 'K₁ ≈ 2mgl ≈ 9.8') && r.K[0].toFixed(1) === '16.0' && r.K[1].toFixed(2) === '2.78' && near(r.poles[0], -5.7, .05) && near(r.poles[1], 3.5, .05) && near(2 * base.mgl, 9.8, .02), JSON.stringify(r.K));
    ok('card: differencing turns 0.3° of noise into √2 × 0.3 ÷ 0.005 = ' + r1(Math.SQRT2 * .3 / .005) + ' °/s; in the interactive\'s loop the one-second readings range from ' + r1(KEEP.fd.weMin) + ' to ' + r1(KEEP.fd.weMax) + ' °/s (mean ' + r1(KEEP.fd.weMean) + '), torque jitter ' + r2(KEEP.fd.uMean) + ' N·m', T('k-ss', '√2 × 0.3° ÷ 0.005 s ≈ 85°/s', '70 到 100°/s 之间跳，平均约 88°/s', '力矩抖动约 4 N·m') && near(Math.SQRT2 * .3 / .005, 85, .5) && KEEP.fd.weMin > 68 && KEEP.fd.weMax < 104 && near(KEEP.fd.weMean, 88, 2.5) && near(KEEP.fd.uMean, 4, .15), JSON.stringify(KEEP.fd));
    ok('card: Kalman filter: speed error ' + r2(KEEP.kf.weMean) + ' °/s, torque jitter ' + r2(KEEP.kf.uMean) + ' N·m', T('k-ss', '速度误差约 3°/s，力矩抖动只有 0.16 N·m') && near(KEEP.kf.weMean, 3, .5) && near(KEEP.kf.uMean, .16, .012), JSON.stringify(KEEP.kf));
    ok('quiz: K₁ must exceed mgl ≈ 4.9; flipping +4.3 to −4.3 gives K₁ ≈ 9.8', T('k-sum', 'K₁ 必须大于 mgl ≈ 4.9 N·m/rad', '这时 K₁ ≈ 2mgl ≈ 9.8', '≈ 85°/s'), ''); }

  sec('text · step ④ nonlinear control and figure 5');
  { const r = await EV(() => ({ a: CHK.swing('pc', 1.5, 10).tCatch, b: CHK.swing('pc', .5, 25).tCatch, c: CHK.swing('pc', 2.5, 10).tCatch, l: CHK.swing('lqr', 1.5, 12), ub: [3.7, 3.8].map(u => CHK.swing('lqr', u, 12).end) }));
    const hold = Math.asin(1.5 / base.mgl) * 180 / Math.PI;
    ok('lead and figure 5: a 1.5 N·m motor holds the arm still up to asin(1.5 ∕ 4.9) = ' + r1(hold) + '°', T('k-nl', '抬到 18° 左右（sin θ = 1.5 ∕ 4.9 的地方）', '18°：只能静止托到这里', '电机上限 1.5 N·m') && near(hold, 18, .3), '');
    ok('card: from −4.9 J to +4.9 J is ' + r2(2 * base.mgl) + ' J; caught after ' + r2(r.a) + ' s at 1.5 N·m, ' + r2(r.b) + ' s at 0.5, ' + r2(r.c) + ' s at 2.5', T('k-nl', '一共 9.8 J', '约 3.4 s 接住，0.5 N·m 要 13 s，2.5 N·m 只要 1.5 s') && near(2 * base.mgl, 9.8, .02) && near(r.a, 3.4, .05) && near(r.b, 13, .5) && near(r.c, 1.5, .05), JSON.stringify(r));
    ok('text: LQR alone fails below about 3.8 N·m, reaches about 32° and then rocks around 18°; catch zone ±' + r1(KEEP.zone[1]) + '° at 0.5 N·m and ±' + r1(KEEP.zone[2]) + '° at 2.5', T('k-nl', '低于约 3.8 N·m 就上不去', '离垂下约 32° 的地方，然后在 18° 附近来回晃', '0.5 N·m 时只有 ±11°，2.5 N·m 时有 ±58°') && r.ub[0] > 90 && r.ub[1] < 1 && near(r.l.peak, 32, .5) && Math.round(KEEP.zone[1]) === 11 && Math.round(KEEP.zone[2]) === 58, ''); }

  sec('text · step ⑤ uncertainty');
  { const r = await EV(() => { const o = (x) => Object.assign({ mode: 'sign', mf: 2, lam: 10, k: 6, phi: 6, rate: 1000, fric: true }, x); return { k3: CHK.smc(o({ k: 3 }), 12, 8), k4: CHK.smc(o({ k: 4 }), 12, 8) }; });
    ok('card: at 1.5× mass PD has an error RMS of 1.67°, sliding mode 0.026° with jumps of 8.7 N·m per step (readouts)', T('k-unc', 'PD 的误差均方根 1.67°；滑模（开关）只有 0.026°，但力矩每一步平均跳 8.7 N·m') && has(KEEP.smcPD15, '误差 RMS 1.67°') && has(KEEP.smcDef, '误差 RMS 0.026°', '力矩跳变 8.7 N·m'), KEEP.smcPD15);
    ok('text: at 2× mass with friction the model error reaches ' + r2(r.k4.dmax) + ' N·m; k = 3 fails (' + r2(r.k3.eRMS) + '°), k = 4 holds (' + r2(r.k4.eRMS) + '°)', T('k-unc', '模型误差最多约 4 N·m，k 取 3 就压不住了（误差约 7°），取 4 以上才行') && near(r.k4.dmax, 4, .1) && near(r.k3.eRMS, 7, .3) && r.k4.eRMS < .05, JSON.stringify(r));
    ok('legend of the sliding-mode interactive: target 45° ± 20° with a 2 s period, 15 N·m limit, dry friction ±0.3 N·m (constants in its code)', T('k-unc', '45° ± 20°，2 秒一个周期', '力矩上限 15 N·m', '±0.3 N·m 的干摩擦') && has(SRC, '45*D-20*D*Math.cos(Math.PI*t)', 'UM=15', 'Fc=fric?.3:0'), '');
    ok('card: 2 kg payload: 6.9° and 5.7° short for PD; 6.0° and 1.75 s for PID; 4.5° and 1.0 s for Adaptive; 2.2° and 0.34 s for ADRC (readouts 6.91, −5.70, 5.96, 4.49, 2.18)', T('k-unc', '下垂 6.9°，而且回不来（停在差 5.7° 的地方）；PID 下垂 6.0°，1.75 秒回来；自适应控制下垂 4.5°、1.0 秒回来；ADRC（ωo = 60）只下垂 2.2°，0.34 秒回来') && has(KEEP.dob.pd, '最大偏差 6.91°', '稳态误差 -5.70°') && has(KEEP.dob.pid, '最大偏差 5.96°') && has(KEEP.dob.ad, '最大偏差 4.49°', '恢复时间 1.01 s') && has(KEEP.dob.adrc, '最大偏差 2.18°'), '');
    ok('card and quiz: ωo 60 → 150 cuts the sag from 2.2° to 0.77° and raises the torque noise from 0.02 to 0.21 N·m per step, about 11 times', T('k-unc', '下垂从 2.2° 降到 0.77°，力矩噪声却从每步 0.02 N·m 涨到 0.21 N·m，大了约 11 倍') && T('k-sum', '下垂从 2.2° 降到 0.77°，力矩噪声却大了约 11 倍') && has(KEEP.dobO.o150, '最大偏差 0.77°') && near(rdo(KEEP.dobO.o150, '力矩噪声', ' N·m'), .21, .006) && near(rdo(KEEP.dob.adrc, '力矩噪声', ' N·m'), .02, .003) && near(rdo(KEEP.dobO.o150, '力矩噪声', ' N·m') / rdo(KEEP.dob.adrc, '力矩噪声', ' N·m'), 11, 1), ''); }

  sec('text · step ⑥ contact');
  { const ser = (K1, kw) => K1 * kw / (K1 + kw);
    ok('card: 20 000 × 0.03 = ' + 20000 * .03 + ' N; 800 × 0.03 = ' + 800 * .03 + ' N (23.6 N in the interactive); in series with a 2 000 N/m wall ' + r1(ser(800, 2000)) + ' N/m and ' + r1(ser(800, 2000) * .03) + ' N; position control against 50 000 N/m would need ' + r1(ser(20000, 50000) * .03) + ' N', T('k-con', '20 000 × 0.03 = 600 N', '800 × 0.03 = 24 N（交互里 23.6 N）', 'Ks = 800 × 2000 ∕ 2800 ≈ 570 N/m，力 ≈ 17 N', '需要约 430 N，电机最多 200 N') && near(ser(800, 2000), 571, 1) && near(ser(800, 2000) * .03, 17.1, .05) && near(ser(20000, 50000) * .03, 429, 1) && near(ser(800, 50000) * .03, 23.6, .05), '');
    ok('text: admittance with D = 20 against the 50 000 N/m wall makes the contact force jump by over 100 N (status in Part A: ' + KEEP.admPP + ' N)', T('k-con', 'D = 20、墙 50 000 N/m 时，接触力上下跳 100 多牛') && KEEP.admPP > 95, '');
    ok('legend: a 1 kg tip, a 200 N motor, the wall at 30 cm, the target 3 cm inside, walls from 2 000 to 50 000 N/m, Kp = 20 000 N/m, virtual mass 0.5 kg, approach at 0.15 m/s (constants in the code)', T('k-con', '电机最多推 200 N', '墙面在 30 cm', '2 000 N/m', '50 000 N/m', 'Kp = 20 000 N/m', '虚拟质量 0.5 kg', '0.15 m/s') && has(SRC, 'M=1,XW=.30,XD=.33,X0=.10,VR=.15,FMAX=200', 'MV=.5', 'KP=20000', '2000*Math.pow(25,v/100)'), ''); }

  sec('text · step ⑦ MPC');
  { const w = W('mpc'); await w.show(); const per = 2 * Math.PI / Math.sqrt(base.mgl / base.I);
    ok('card: the natural period is 2π ∕ ' + r1(Math.sqrt(base.mgl / base.I)) + ' = ' + r2(per) + ' s', T('k-mpc', '2π ∕ 4.4 ≈ 1.4 s') && near(Math.sqrt(base.mgl / base.I), 4.4, .05) && near(per, 1.4, .03), '');
    await w.click('iLQR', 100); await w.set('mpc-hz', .7, 300); await w.click('重来', 100); await wait(7500); const a = await w.met();
    await w.set('mpc-hz', .8, 300); await w.click('重来', 100); await wait(6000); const b2 = await w.met();
    ok('card: with iLQR a horizon shorter than about 0.8 s never gets up (0.7 s: "' + (a.match(/到达竖直用时 \S+( s)?/) || [''])[0] + '"; 0.8 s: "' + (b2.match(/到达竖直用时 \S+( s)?/) || [''])[0] + '")', T('k-mpc', '预测时长短于约 0.8 s 就上不去，1.2 s 时约 1.7 秒到顶') && has(a, '到达竖直用时 到不了') && /到达竖直用时 [\d.]+ s/.test(b2), a + ' || ' + b2);
    await w.click('MPPI', 100); await w.set('mpc-hz', .3, 300); await w.click('重来', 100); let c = ''; for (let k = 0; k < 40; k++) { await wait(250); c = await w.met(); if (/到达竖直用时 [\d.]+ s/.test(c)) break; }
    ok('card: MPPI gets up even with a 0.3 s horizon ("' + (c.match(/到达竖直用时 \S+( s)?/) || [''])[0] + '")', T('k-mpc', '0.3 s 的预测也能上去') && /到达竖直用时 [\d.]+ s/.test(c), c);
    await w.click('iLQR', 100); await w.set('mpc-hz', 1.2, 300); await w.click('重来', 100);
    ok('legend: 128 random torque sequences, 20 ms steps, the true mass 30% heavier, disturbances of about 0.02 N·m, "upright" within ' + r1(Math.acos(.97) * 180 / Math.PI) + '° (constants in the code)', T('k-mpc', '128 条力矩序列', '重 30%', '0.02 N·m 左右', '离竖直 14° 以内') && has(SRC, 'K:128', 'TS=.02', 'm:P.m*1.3', 'NOISE=.02', 'Math.cos(x[0])<-.97') && near(Math.acos(.97) * 180 / Math.PI, 14, .1), ''); }

  sec('text · step ⑧ learning');
  { const s = await EV(() => { const runs = []; for (let sd = 2; sd <= 31; sd++) runs.push(CHK.rl.train(sd, 60, 60)); const med = a => { const b = a.slice().sort((x, y) => x - y); return (b[14] + b[15]) / 2; }, mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      return { LQ: CHK.rl.LQ, jL: CHK.rl.jL, mgl25: CHK.rl.mgl25, medFirst: med(runs.map(r => r.first)), medEps: med(runs.map(r => r.firstEps)), kN: [mean(runs.map(r => r.kNom[0])), mean(runs.map(r => r.kNom[1]))], nomHold: runs.filter(r => r.nomHolds25).length, kD: [mean(runs.map(r => r.kDR[0])), mean(runs.map(r => r.kDR[1]))], drHold: runs.filter(r => r.drHolds[2]).length, ratio: mean(runs.map(r => r.ratio)), k1max: Math.max(...runs.map(r => r.kNom[0])) }; });
    ok('card: with qω = 0.1 and r = 0.1 LQR gives K = (' + r1(s.LQ[0]) + ', ' + r2(s.LQ[1]) + ')', T('k-learn', 'qω = 0.1、r = 0.1，LQR 算出 K = (10.7, 2.47)') && s.LQ[0].toFixed(1) === '10.7' && s.LQ[1].toFixed(2) === '2.47', '');
    ok('card: 30 trainings from (3, 0.6) (the interactive\'s seeds 2 to 31, 60 iterations): median ' + s.medFirst + ' iterations and ' + s.medEps + ' episodes (' + r1(s.medEps * 3 / 60) + ' minutes) to come within 10% of LQR; mean gains after 60 iterations (' + r2(s.kN[0]) + ', ' + r2(s.kN[1]) + ')', T('k-learn', '中位数 6 轮、约 190 个回合（相当于真机上 10 分钟左右）', '60 轮后停在 (10.9, 2.5) 附近') && s.medFirst === 6 && near(s.medEps, 190, 5) && near(s.medEps * 3 / 60, 10, 1) && near(s.kN[0], 10.9, .05) && near(s.kN[1], 2.5, .05), JSON.stringify(s));
    ok('text: none of the 30 holds 2.5 kg (largest k₁ ' + r2(s.k1max) + ' < mgl = ' + r2(s.mgl25) + '); after 60 randomised iterations all 30 do, at about (' + r2(s.kD[0]) + ', ' + r2(s.kD[1]) + '), with a cost at 1 kg ' + r1((s.ratio - 1) * 100) + '% above LQR', T('k-learn', '30 次训练全部如此', 'mgl = 12.3', '(18.0, 4.2) 附近', '30 次全部成功', '差了约 23%') && T('k-sum', 'k₁ ≈ 11 还大', 'k₁ ≈ 18 附近', '高了约 23%', '12.3 N·m/rad') && s.nomHold === 0 && s.k1max < s.mgl25 && near(s.mgl25, 12.3, .05) && s.drHold === 30 && near(s.kD[0], 18.0, .06) && near(s.kD[1], 4.2, .06) && near((s.ratio - 1) * 100, 23, 1), '');
    ok('legend of the learning interactive: 6 N·m limit, starts at ±0.15 or ±0.3 rad, 3 s episodes, cost φ² + 0.1ω² + 0.1u² (constants in the code)', T('k-learn', '力矩上限 6 N·m', '±0.15 或 ±0.3 rad 出发、平衡 3 秒', 'J = ∫(φ² + 0.1ω² + 0.1u²)dt') && has(SRC, 'T=3,DC=.01,NS=300,UM=6,ICS=[.15,-.15,.3,-.3],QV=.1,RW=.1'), '');
    ok('card: without the filter the PD hits the wall at 1.4 m/s; with it (γ = 3, dry) never; on the slippery floor it crashes again from γ = 6 (same loop: no crash at 3, ' + r2(KEEP.cbf.w6.crash[0][1]) + ' m/s at 6)', T('k-learn', '原来的 PD 以 1.4 m/s 撞墙', 'γ 调到 6 以上，就又会撞了', '这里取 3.5 m/s²') && near(KEEP.cbf.off.crash[0][1], 1.4, .05) && KEEP.cbf.g3.crash.length === 0 && KEEP.cbf.w3.crash.length === 0 && KEEP.cbf.w6.crash.length > 0 && has(SRC, 'XM=1,XG=1.3,AB=3.5'), ''); }

  sec('text · steps ⑨ and ⑩');
  ok('card: with 500 samples and physics features the one-step error is about 6% (' + r1(KEEP.wm.e) + '%) and MPC has the arm upright after about 2 s (' + r2(KEEP.wm.t) + ' s); the linear model: 57% (' + r1(KEEP.wm.le) + '%), gravity at the top 4.7 N·m (' + r2(KEEP.wm.lt) + ') against the motor\'s 3 N·m', T('k-model', '单步预测误差约 6%，MPC 用它约 2 秒就把摆杆甩上竖直并稳住', '单步误差 57%', '还有 4.7 N·m（实际是 0），比电机的 3 N·m 还大') && near(KEEP.wm.e, 6, .5) && near(KEEP.wm.t, 2, .2) && near(KEEP.wm.le, 57, .5) && near(KEEP.wm.lt, 4.7, .05) && has(SRC, 'DT=.02,SUB=10,DS=DT/SUB,UM=3,NH=60,KS=128'), '');
  ok('card: an error of 10° is ' + r2(10 * Math.PI / 180) + ' rad and costs ' + (10 * Math.PI / 180) ** 2 + ' per step; 3 N·m costs ' + .01 * 9, T('k-all', '差 10°（0.17 rad）每一步罚 0.03，用 3 N·m 罚 0.09') && near(10 * Math.PI / 180, .17, .005) && near((10 * Math.PI / 180) ** 2, .03, .001) && near(.01 * 9, .09, 1e-9), '');
  ok('text: the map holds 51 methods and PID appears in four loop-level groups (counted in Part A)', T('k-all', '放了 51 种方法', '地图上 PID 出现在四组里'), '');

  sec('figures');
  { const figs = await p.evaluate(() => [...document.querySelectorAll('figure.fig')].map(f => f.closest('section').id + ' | ' + f.innerText.replace(/\s+/g, ' ')));
    ok('8 figures: k-map 1, k-pid 1, k-freq 1, k-ss 1, k-nl 1, k-unc 1, k-con 1, k-model 1', figs.length === 8 && ['k-map', 'k-pid', 'k-freq', 'k-ss', 'k-nl', 'k-unc', 'k-con', 'k-model'].every(id => figs.filter(f => f.startsWith(id + ' |')).length === 1), figs.map(f => f.slice(0, 8)).join(','));
    const F = id => norm(figs.find(f => f.startsWith(id + ' |')));
    ok('figure 3: a lag of 120° is 60° short of 180°; a lag of 180° means a margin of 0', has(F('k-freq'), '落后 120°：离 180° 还差 60°', '相位裕度 60°', '落后 180°：正好反了', '相位裕度 0') && 180 - 120 === 60, F('k-freq').slice(0, 200));
    const sp = 28, sm = 40, L = sp * sp / (sp * sp + sm * sm), se = Math.sqrt(sp * sp * sm * sm / (sp * sp + sm * sm));
    ok('figure 4 is drawn from the Kalman update for two Gaussians (widths 28 and 40): the estimate moves ' + r2(L) + ' of the way to the measurement and its width is ' + r1(se) + ', narrower than both', has(F('k-ss'), '模型的预测', '这次的测量', '新的估计') && L > 0 && L < .5 && se < sp && se < sm, '');
    ok('figure 5: the peak is 4.9 N·m, the limit 1.5 N·m, the holding angle 18°', has(F('k-nl'), '4.9 N·m', '电机上限 1.5 N·m', '18°：只能静止托到这里'), F('k-nl').slice(0, 120)); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
