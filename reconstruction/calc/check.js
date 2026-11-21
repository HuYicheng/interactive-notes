// Check the numbers of "3D Reconstruction, NeRF and Gaussian Splatting" (reconstruction/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each widget the way a reader would (following the
// "先玩 / Try first" prompt literally, including picking pixels on the photo strips with the mouse and letting the
// training widgets run to the end) and compares the readouts with the numbers quoted in the "你会看到 / What you
// will see" lines. Numbers a readout does not show (the step at which a PSNR is first reached, where the bad points
// lie, what the figures state) are recomputed with the page's own engine, window.TB, inside the page, with the same
// loops and the same seeds as the widgets; the comments say "same loop as the widget" where that is done.
// Part B recomputes, with the same engine, the numbers quoted in the formula cards, the paragraphs and the figures.
//   usage: node check.js /absolute/path/to/reconstruction/index.html      (takes about 8 minutes: four trainings run twice)
// Training is seeded, so every PSNR and count is the same on every run in a Chromium browser; only the seconds and the
// milliseconds per step depend on the machine (they are printed and checked against wide bounds).
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/reconstruction/index.html'); process.exit(2); }
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
  // choose pixel px (0..95) on a photo strip: the widgets map canvas x -> pixel with floor((x - 8) / (w - pad) * 96)
  const pickPx = async (cvId, px, pad) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(120);
    const pt = await p.evaluate(([i, px, pad]) => { const cv = document.getElementById(i), r = cv.getBoundingClientRect(); return [r.left + 8 + (px + .5) / 96 * (cv.clientWidth - pad), r.top + 20]; }, [cvId, px, pad]);
    await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0], pt[1]); await p.mouse.up(); await p.waitForTimeout(120); };
  // wait until a readout matches (training widgets): polls every 100 ms, at most `max` seconds
  const until = async (w, re, max) => { for (let k = 0; k < (max || 120) * 10; k++) { const m = await w.met(); if (re.test(m)) return m; await p.waitForTimeout(100); } return await w.met(); };
  // drag inside a canvas from one canvas pixel to another
  const dragPx = async (cvId, a, c) => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), cvId); await p.waitForTimeout(250);
    const r = await p.evaluate(i => { const q = document.getElementById(i).getBoundingClientRect(); return [q.left, q.top]; }, cvId);
    await p.mouse.move(r[0] + a[0], r[1] + a[1]); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(r[0] + a[0] + (c[0] - a[0]) * k / 6, r[1] + a[1] + (c[1] - a[1]) * k / 6); await p.mouse.up(); await p.waitForTimeout(250); };
  // run a snippet inside the page, where the engine TB lives; the snippet is the body of a function
  const EV = (fn, arg) => p.evaluate(fn, arg);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace('−', '-')) : NaN; };
  // the visible text of a section, folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);

  // ======================= Part A: the widgets, operated as each "Try first" prompt says =======================
  let RAY = null, METHODS = null;   // kept for Part B
  // ---- step 0 · the task
  { sec('step 0 · task'); const w = W('task'); await w.show(); await w.click('播放', 300);
    let m = await until(w, /已拍 24 \/ 24/, 60); await p.waitForTimeout(1200); m = await w.met(); let s = await w.status();
    ok('task, after Play: 24 / 24 photos, the last one from 345.0° at (30.9, -8.3) cm, 96 × 72 pixels', has(m, '已拍 24 / 24', '相机转到 345.0°', '(30.9, -8.3) cm', '96 × 72 像素') && has(s, '第 24 张，相机在 345°'), m + ' || ' + s);
    await w.click('没拍过的角度', 600); m = await w.met(); s = await w.status();
    ok('task, "The angle nobody shot": camera at 37.5°, between photos 3 and 4, at (25.4, 19.5) cm', has(m, '相机转到 37.5°', '(25.4, 19.5) cm') && has(s, '37.5°（第 3、4 张之间）'), m + ' || ' + s);
    const r = await EV(() => { const K = TB, DEG = Math.PI / 180;
      const info = (cam, px) => { const d = K.ray2(cam, px + .5), h = K.castSlice(cam.o, d); if (!h) return null; const psi = ((Math.atan2(h.p[1], h.p[0]) / DEG) + 360) % 360, alb = h.k === 'wall' ? K.albedo(psi * DEG) : K.CREAM, nl = h.n[0] * K.L3[0] + h.n[1] * K.L3[1], v = [-d[0], -d[1]], nv = h.n[0] * v[0] + h.n[1] * v[1], lv = K.L3[0] * v[0] + K.L3[1] * v[1], rv = 2 * nl * nv - lv; return { k: h.k, psi, blue: alb === K.BLUE, sp: nl > 0 ? .55 * Math.pow(Math.max(0, rv), 32) : 0 }; };
      const runs = cam => { const o = []; let cur = null; for (let px = 0; px < K.W; px++) { const q = info(cam, px), key = !q ? 'bg' : q.k === 'handle' ? 'handle' : q.blue ? 'blue' : 'cream'; if (!cur || cur[0] !== key) { cur = [key, 1]; o.push(cur); } else cur[1]++; } return o; };
      const hl = cam => { let best = null; for (let px = 0; px < K.W; px++) { const q = info(cam, px); if (!q || q.k !== 'wall') continue; if (!best || q.sp > best.sp) best = q; } return best; };
      const cams = K.cams(); return { r13: runs(cams[12]), r1: runs(cams[0]), h1: hl(cams[0]), h10: hl(cams[9]), ang13: cams[12].ang / DEG, ang10: cams[9].ang / DEG, fov: 2 * Math.atan(48 / K.FPX) / DEG, K: { RO: K.RO, RI: K.RI, rh: K.rh, HX: K.HX, RC: K.RC, NV: K.NV, W: K.W, HH: K.HH, H: K.H, ZC: K.ZC } }; });
    const st = r.r13.filter(q => q[0] !== 'bg').map(q => q[1]).join(' ');
    ok('task (engine): photo 13 is taken from 180°; its stripes are 1 4 6 9 9 6 4 1 pixels wide (the two middle ones 9, then 6, 4, 1 towards either edge)', near(r.ang13, 180, 1e-9) && st === '1 4 6 9 9 6 4 1', st);
    ok('task (engine): photo 1 shows no blue stripe at all, only cream glaze and the handle', r.r1.every(q => q[0] !== 'blue') && r.r1.some(q => q[0] === 'handle'), JSON.stringify(r.r1));
    ok('task (engine): the highlight sits at ' + r.h1.psi.toFixed(0) + '° on the mug in photo 1 (plain glaze) and at ' + r.h10.psi.toFixed(0) + '° in photo 10 (on the first blue stripe): about 70° for 135° of camera travel', near(r.h10.psi - r.h1.psi, 70, 5) && !r.h1.blue && r.h10.blue && r.h10.psi > 90 && r.h10.psi < 112.5 && near(r.ang10, 135, 1e-9), JSON.stringify([r.h1, r.h10]));
    // figure 1
    const k = r.K; ok('figure of step 0: outer diameter 9 cm, wall 5 mm, handle 1.2 cm thick, gap 1.9 cm, camera circle 32 cm with 24 positions, 96 pixels opening 37.8°', near(2 * k.RO, .09, 1e-9) && near(k.RO - k.RI, .005, 1e-9) && near(2 * k.rh, .012, 1e-9) && near(k.HX - k.rh - k.RO, .019, 1e-9) && near(k.RC, .32, 1e-9) && k.NV === 24 && k.W === 96 && r.fov.toFixed(1) === '37.8', JSON.stringify(k) + ' ' + r.fov);
    const body1 = r.r1.filter(q => q[0] !== 'bg').reduce((a, q) => a + q[1], 0);
    ok('figure of step 0: in photo 1 the mug falls on 40 of the 96 pixels', body1 === 40, body1); }

  // ---- step 1 · triangulation
  { sec('step 1 · tri'); const w = W('tri'); await w.show(); const rows = {};
    for (let s = 1; s <= 8; s++) { await w.set('tri-s', s, 200); rows[s] = await w.met(); }
    const ang = s => num(rows[s], /夹角 ([\d.]+)°/), along = s => num(rows[s], /沿 A 的视线差多少 ± ([\d.]+) mm/), across = s => num(rows[s], /横着差多少 ± ([\d.]+) mm/);
    ok('tri, stripe edge, 1 px: 1 photo on 16.7° ± 14.5 mm; 2 on 33.9° ± 6.7 mm; 4 on 68.7° ± 2.9 mm', ang(1) === 16.7 && along(1) === 14.5 && ang(2) === 33.9 && along(2) === 6.7 && ang(4) === 68.7 && along(4) === 2.9, rows[1] + ' | ' + rows[2] + ' | ' + rows[4]);
    ok('tri: smallest at 5 photos on (85.9°, ± 2.2 mm), back to ± 5.1 mm at 8 (134.3°)', ang(5) === 85.9 && along(5) === 2.2 && ang(8) === 134.3 && along(8) === 5.1 && [1, 2, 3, 4, 6, 7, 8].every(s => along(s) > along(5)), [1, 2, 3, 4, 5, 6, 7, 8].map(along).join(' '));
    ok('tri: sideways error ± 2.1 mm at every spacing', [1, 2, 3, 4, 5, 6, 7, 8].every(s => across(s) === 2.1), [1, 2, 3, 4, 5, 6, 7, 8].map(across).join(' '));
    await w.click('素色的地方', 300); const st = {}; st[8] = await w.status(); const m8 = await w.met();
    for (let s = 7; s >= 1; s--) { await w.set('tri-s', s, 200); st[s] = await w.status(); }
    ok('tri, plain glaze with B still 8 photos on: hidden by the mug itself (also at 7); readouts "—"', has(st[8], '它被杯子自己挡住') && has(st[7], '它被杯子自己挡住') && has(m8, '沿 A 的视线差多少 —', '横着差多少 —'), st[8] + ' | ' + m8);
    const cnt = s => num(st[s], /有 (\d+) 个像素和 A 看到的颜色差不到 2%/);
    ok('tri, plain glaze: 3 look-alike pixels at 6 photos on, 4 from 2 to 5, 5 at 1', cnt(6) === 3 && [2, 3, 4, 5].every(s => cnt(s) === 4) && cnt(1) === 5, [1, 2, 3, 4, 5, 6].map(cnt).join(' ')); }

  // ---- step 2 · multi-view stereo
  { sec('step 2 · mvs'); const w = W('mvs'); await w.show(); let m = await w.met(), s = await w.status();
    ok('mvs, default pixel (photo 10, on the stripes): 28.6 cm estimated, 28.4 cm true, 2.3 mm apart, status green', has(m, '估出的深度 28.6 cm', '真深度 28.4 cm', '差 2.3 mm') && has(s, '颜色差在一个深度上突然掉到底'), m + ' || ' + s);
    const cls = {}, err = {}, stx = {};
    for (let px = 62; px >= 27; px--) { await pickPx('mvs-ch', px, 16); stx[px] = await w.status(); err[px] = num(await w.met(), /差 ([\d.]+) mm/); cls[px] = await p.evaluate(() => document.getElementById('mvs-st').className.includes('ok') ? 'g' : 'r'); }
    const what = await EV(() => { const K = TB, DEG = Math.PI / 180, cam = K.cams()[9], o = {}; for (let px = 27; px <= 67; px++) { const set = new Set(); let sp = 0, k = ''; for (let j = 0; j < 4; j++) { const d = K.ray2(cam, px + (j + .5) / 4), h = K.castSlice(cam.o, d); if (!h) { set.add('bg'); continue; } k = h.k; const psi = ((Math.atan2(h.p[1], h.p[0]) / DEG) + 360) % 360; set.add(h.k === 'wall' ? (K.albedo(psi * DEG) === K.BLUE ? 'blue' : (psi >= 90 && psi < 270 ? 'cream stripe' : 'plain')) : 'handle'); const nl = h.n[0] * K.L3[0] + h.n[1] * K.L3[1], v = [-d[0], -d[1]], nv = h.n[0] * v[0] + h.n[1] * v[1], lv = K.L3[0] * v[0] + K.L3[1] * v[1], rv = 2 * nl * nv - lv; sp = Math.max(sp, nl > 0 ? .55 * Math.pow(Math.max(0, rv), 32) : 0); } o[px] = { kinds: [...set], sp }; } return o; });
    const striped = []; for (let px = 41; px <= 62; px++) striped.push(px);
    const g = striped.filter(px => cls[px] === 'g'), r = striped.filter(px => cls[px] === 'r');
    ok('mvs, dragging left over the stripes (pixels 62 to 41): green more often than red (' + g.length + ' against ' + r.length + ')', g.length > r.length, striped.map(px => cls[px]).join(''));
    const edges = await EV(() => { const K = TB, DEG = Math.PI / 180, cam = K.cams()[9], o = []; for (let a = 90; a <= 270; a += 22.5) { const P = [K.RO * Math.cos(a * DEG), K.RO * Math.sin(a * DEG)]; if (P[0] * (cam.o[0] - P[0]) + P[1] * (cam.o[1] - P[1]) <= 0) continue; const qx = P[0] - cam.o[0], qy = P[1] - cam.o[1], z = qx * cam.f[0] + qy * cam.f[1]; o.push(K.CX + K.FPX * (qx * cam.r[0] + qy * cam.r[1]) / z); } return o; });
    const gap = px => Math.min(...edges.map(u => u < px ? px - u : u > px + 1 ? u - px - 1 : 0));   // pixels between this pixel and the nearest stripe boundary
    ok('mvs: red pixels 47, 48 and 56 touch a boundary between two stripes (within half a pixel); red pixels 52 and 53 lie in the middle of the wide blue stripe (pixels 48 to 56), more than 2.5 pixels from either boundary', [47, 48, 56].every(px => cls[px] === 'r' && gap(px) <= .5) && [52, 53].every(px => cls[px] === 'r' && what[px].kinds.join() === 'blue' && gap(px) > 2.5) && near(edges[2], 48, .01) && near(edges[3], 56.66, .01), JSON.stringify([47, 48, 52, 53, 56].map(px => [px, cls[px], gap(px).toFixed(2)])) + ' edges ' + edges.map(u => u.toFixed(2)).join(' '));
    ok('mvs, the highlight (pixels 33 to 35, on the first blue stripe): red, the readout 6.6, 10.6 and 15.3 mm off (the "7 to 15 mm")', [33, 34, 35].every(px => cls[px] === 'r' && what[px].kinds.join() === 'blue' && what[px].sp > .2 && has(stx[px], '找不出一个明确的深度')) && err[33] === 6.6 && err[34] === 10.6 && err[35] === 15.3, JSON.stringify([33, 34, 35].map(px => [err[px], what[px].sp.toFixed(2)])));
    ok('mvs, the plain glaze at the far left (pixels 28 to 30): "no clear depth"', [28, 29, 30].every(px => cls[px] === 'r' && what[px].kinds.join() === 'plain' && has(stx[px], '找不出一个明确的深度：颜色差的低谷又宽又平')), stx[29]);
    await w.click('24 张全算', 2500); m = await w.met(); ok('mvs, "All 24 photos": 319 points within 3 mm, 166 farther', has(m, '319 / 166'), m);
    // same loop as the widget (sweep + buildCloud), then count the red rings by half
    const c = await EV(() => { const K = TB, DEG = Math.PI / 180, ND = 160, NB = [-2, -1, 1, 2], cams = K.cams(), phs = cams.map(c => K.photo1(c, 4));
      const proj = (cam, P) => { const qx = P[0] - cam.o[0], qy = P[1] - cam.o[1], z = qx * cam.f[0] + qy * cam.f[1]; return { u: K.CX + K.FPX * (qx * cam.r[0] + qy * cam.r[1]) / z, z }; };
      const sample = (ph, u) => { const x = u - .5, i = Math.floor(x), f = x - i; if (i < 0 || i >= K.W - 1) return null; const a = ph[i], b = ph[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
      const isWall = c => Math.abs(c[0] - K.WALL[0]) + Math.abs(c[1] - K.WALL[1]) + Math.abs(c[2] - K.WALL[2]) < .03;
      function sweep(r, p) { const cam = cams[r], d = K.ray2(cam, p + .5), sg = K.seg(cam.o, d), ref = phs[r][p]; if (!sg || isWall(ref)) return null; const ts = [], cs = [];
        for (let k = 0; k < ND; k++) { const t = sg[0] + (k + .5) * (sg[1] - sg[0]) / ND, P = [cam.o[0] + t * d[0], cam.o[1] + t * d[1]]; let s = 0, n = 0; for (const o of NB) { const j = (r + o + K.NV) % K.NV, q = proj(cams[j], P); if (q.z <= 0) continue; const c = sample(phs[j], q.u); if (!c) continue; s += (c[0] - ref[0]) ** 2 + (c[1] - ref[1]) ** 2 + (c[2] - ref[2]) ** 2; n++; } ts.push(t); cs.push(n ? s / n : NaN); }
        let bi = -1; for (let k = 0; k < ND; k++) if (!isNaN(cs[k]) && (bi < 0 || cs[k] < cs[bi])) bi = k;
        let sec = Infinity; for (let k = 1; k < ND - 1; k++) { if (Math.abs(ts[k] - ts[bi]) < .008 || isNaN(cs[k])) continue; if (cs[k] <= cs[k - 1] && cs[k] <= cs[k + 1]) sec = Math.min(sec, cs[k]); }
        const h = K.castSlice(cam.o, d), tt = h ? h.t : null, best = bi >= 0 ? ts[bi] : null, cmin = bi >= 0 ? cs[bi] : Infinity; return { ok: bi >= 0 && cmin < .003 && !(sec < 2.5 * cmin + .002), best, tt, P: best != null ? [cam.o[0] + best * d[0], cam.o[1] + best * d[1]] : null }; }
      let good = 0, bad = 0, badPlain = 0; for (let r = 0; r < K.NV; r++) for (let p = 0; p < K.W; p++) { const s = sweep(r, p); if (!s || !s.ok) continue; const e = s.tt != null ? Math.abs(s.best - s.tt) : Infinity; if (e < .003) good++; else { bad++; if (s.P[0] > 0) badPlain++; } } return { good, bad, badPlain }; });
    ok('mvs (engine, same loop as the widget): 319 blue, 166 red, and 120 of the red rings on the plain half with the handle', c.good === 319 && c.bad === 166 && c.badPlain === 120, JSON.stringify(c));
    await w.click('视觉外壳', 2000); s = await w.status(); ok('mvs, "Visual hull": the hollow always lies inside the outline, so it is never carved', has(s, '杯子里面那一圈空心永远在轮廓里面，所以削不掉'), s);
    const hull = await EV(() => { const K = TB, cams = K.cams(); let inKept = 0, inAll = 0; for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) { const x = -.04 + (i + .5) * .08 / 60, y = -.04 + (j + .5) * .08 / 60; if (Math.hypot(x, y) >= K.RI) continue; inAll++; let keep = true; for (const cam of cams) { const qx = x - cam.o[0], qy = y - cam.o[1], z = qx * cam.f[0] + qy * cam.f[1], u = K.CX + K.FPX * (qx * cam.r[0] + qy * cam.r[1]) / z, pi = Math.floor(u); if (pi < 0 || pi >= K.W) continue; if (!K.castSlice(cam.o, K.ray2(cam, pi + .5))) { keep = false; break; } } if (keep) inKept++; } return { inKept, inAll }; });
    ok('mvs (engine): every sample point of the hollow survives the carving (' + hull.inKept + ' of ' + hull.inAll + ')', hull.inKept === hull.inAll && hull.inAll > 1000, JSON.stringify(hull)); }

  // ---- step 3 · depth fusion
  { sec('step 3 · tsdf'); const w = W('tsdf'); await w.show(); await w.click('融合下一帧', 300); let m = await w.met();
    ok('tsdf, first frame (noise 1.5 mm): 38 of 96 pixels measured, surface 0.83 mm RMS from the truth', has(m, '已融合 1 / 24', '这一帧测到的像素 38 / 96', '均方根 0.83 mm'), m);
    for (let k = 2; k <= 24; k++) await w.click('融合下一帧', 120); await p.waitForTimeout(300); m = await w.met(); let s = await w.status();
    ok('tsdf, 24 frames: 0.29 mm, about a third of the single-frame error; the inside of the mug is never measured', has(m, '已融合 24 / 24', '均方根 0.29 mm') && has(s, '杯子里面从来没被测到') && near(.29 / .83, 1 / 3, .03), m + ' || ' + s);
    await w.set('tsdf-n', 5, 300); m = await w.met(); ok('tsdf: moving the noise slider starts the fusion again', has(m, '已融合 0 / 24'), m);
    await w.click('融合下一帧', 300); const m1 = await w.met(); await w.click('融合全部 24 帧', 1000); m = await w.met();
    ok('tsdf, noise 5 mm: 1.67 mm after one frame, 1.52 mm after 24', has(m1, '均方根 1.67 mm') && has(m, '已融合 24 / 24', '均方根 1.52 mm'), m1 + ' | ' + m);
    // same loop as the widget (measure + fuse + marching squares): signed error of the outer wall, cells inside the mug
    const r = await EV(() => { const K = TB, TAU = 2 * Math.PI, DEG = Math.PI / 180, STEP = TAU / K.NV, N = 128, X0 = -.096, X1 = .096, CS = (X1 - X0) / N, MU = .006, WMAX = 60, out = { cs: CS, mu: MU };
      for (const sig of [1.5, 5]) { let D = new Float32Array(N * N), Wt = new Float32Array(N * N);
        const measure = ci => { const cam = K.camAt(ci * STEP), r = K.rng(1000 + ci * 7 + Math.round(sig * 10)), o = []; for (let i = 0; i < K.W; i++) { const d = K.ray2(cam, i + .5), h = K.castSlice(cam.o, d), cf = d[0] * cam.f[0] + d[1] * cam.f[1]; let z = null; if (h) { const inc = Math.acos(K.clamp(-(d[0] * h.n[0] + d[1] * h.n[1]), -1, 1)); if (!(inc > 70 * DEG)) z = h.t * cf + sig / 1000 * K.gauss(r); } o.push(z); } return { cam, z: o }; };
        const fuse = ci => { const M = measure(ci), cam = M.cam; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = X0 + (i + .5) * CS, y = X0 + (j + .5) * CS, qx = x - cam.o[0], qy = y - cam.o[1], zc = qx * cam.f[0] + qy * cam.f[1]; if (zc <= 0) continue; const u = K.CX + K.FPX * (qx * cam.r[0] + qy * cam.r[1]) / zc, pi = Math.floor(u); if (pi < 0 || pi >= K.W) continue; const zm = M.z[pi]; if (zm == null) continue; const sd = zm - zc; if (sd < -MU) continue; const tv = Math.min(1, sd / MU), q = j * N + i; D[q] = (D[q] * Wt[q] + tv) / (Wt[q] + 1); Wt[q] = Math.min(WMAX, Wt[q] + 1); } };
        const surface = () => { const segs = [], at = (i, j) => D[j * N + i], sw = (i, j) => Wt[j * N + i] > 0, P = (i, j) => [X0 + (i + .5) * CS, X0 + (j + .5) * CS]; for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { if (!(sw(i, j) && sw(i + 1, j) && sw(i, j + 1) && sw(i + 1, j + 1))) continue; const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], c = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], pts = []; for (let e = 0; e < 4; e++) { const a = v[e], b = v[(e + 1) % 4]; if ((a < 0) !== (b < 0)) { const t = a / (a - b), A = c[e], B = c[(e + 1) % 4]; pts.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); } } if (pts.length === 2) segs.push(pts); else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); } } return segs; };
        for (let k = 0; k < 24; k++) fuse(k); let sr = 0, nr = 0; for (const s of surface()) { const mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2; if (Math.hypot(mx - K.HX, my) > .012) { sr += Math.hypot(mx, my) - K.RO; nr++; } }
        let inside = 0, insideSeen = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = X0 + (i + .5) * CS, y = X0 + (j + .5) * CS; if (Math.hypot(x, y) < K.RI - MU) { inside++; if (Wt[j * N + i] > 0) insideSeen++; } }
        out[sig] = { bias: sr / nr * 1000, inside, insideSeen }; } return out; });
    ok('tsdf (engine, same loop as the widget), noise 5 mm: after 24 frames the outer wall sits ' + (-r[5].bias).toFixed(1) + ' mm too far in on average; with 1.5 mm noise only ' + Math.abs(r[1.5].bias).toFixed(2) + ' mm', (-r[5].bias).toFixed(1) === '2.2' && Math.abs(r[1.5].bias).toFixed(2) === '0.02', JSON.stringify(r));
    ok('tsdf (engine): with 1.5 mm noise none of the ' + r[1.5].inside + ' cells well inside the mug is ever updated; cells are 1.5 mm, the truncation distance 6 mm is 4 times the 1.5 mm noise', r[1.5].insideSeen === 0 && r[1.5].inside > 1000 && near(r.cs, .0015, 1e-9) && near(r.mu, .006, 1e-12) && 6 / 1.5 === 4, JSON.stringify(r));
    ok('figure of step 3: the three illustrative readings +1.5, -1.2 and +0.6 mm average to 0.3 mm', near((1.5 - 1.2 + .6) / 3, .3, 1e-9)); }

  // ---- step 4 · one ray through the field
  { sec('step 4 · ray'); const w = W('ray'); await w.show(); const rows = {}, sts = {};
    for (let n = 7; n >= 2; n--) { await w.set('ray-n', n, 200); rows[n] = await w.met(); sts[n] = await w.status(); }
    ok('ray, 128 samples: 1.3 mm apart, the colour equals the photo (0.0%), the first one or two samples in the wall block the light', has(rows[7], '相邻采样点隔 1.3 mm', '最后还透过来的光 T 0.0%', '和照片差多少 0.0%') && has(sts[7], '最前面一两个落进杯壁的采样点就挡住了几乎所有的光'), rows[7]);
    ok('ray, 64 samples (2.6 mm) 0.1% off; 32 samples (5.3 mm) 0.8% off', has(rows[6], '相邻采样点隔 2.6 mm', '和照片差多少 0.1%') && has(rows[5], '相邻采样点隔 5.3 mm', '和照片差多少 0.8%'), rows[6] + ' | ' + rows[5]);
    ok('ray, 16 samples: 10.6 mm apart, T stays at 100.0%, the pixel is the background (10.4% off), "missed"; 8 and 4 samples miss too', has(rows[4], '相邻采样点隔 10.6 mm', '最后还透过来的光 T 100.0%', '和照片差多少 10.4%') && has(sts[4], '漏掉了', '没有一个点落在杯壁里') && has(sts[3], '漏掉了') && has(sts[2], '漏掉了'), rows[4] + ' || ' + sts[4]);
    await w.set('ray-n', 7, 250); await w.click('加一团雾', 300); const m = await w.met(), s = await w.status();
    ok('ray, back at 128 samples with fog: 1.3 mm apart, the pixel 7.1% off the fog-free colour', has(m, '相邻采样点隔 1.3 mm', '和没有雾时差多少 7.1%') && has(s, '雾是半透明的'), m + ' || ' + s);
    // same field() and march() as the widget, camera 4, pixel 44
    const r = await EV(() => { const K = TB, TAU = 2 * Math.PI, STEP = TAU / K.NV, SMAX = 2000, EPS = .0008, FOG = [.060, .050], FR = .022, FS = 32, FC = [.80, .84, .90]; let mode = 'fog';
      const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
      function field(x, y, d) { let s = 0, col = null, fog = 0; const r = Math.hypot(x, y), din = Math.min(r - K.RI, K.RO - r); if (din > -EPS) { const w = smooth((din + EPS) / (2 * EPS)); s = SMAX * w; col = K.shade(K.albedo(Math.atan2(y, x)), [x / r, y / r], [-d[0], -d[1]]); }
        const dh = K.rh - Math.hypot(x - K.HX, y); if (dh > -EPS) { const w = smooth((dh + EPS) / (2 * EPS)), n = Math.hypot(x - K.HX, y) || 1; if (SMAX * w > s) { s = SMAX * w; col = K.shade(K.CREAM, [(x - K.HX) / n, y / n], [-d[0], -d[1]]); } }
        if (mode === 'fog') { const df = Math.hypot(x - FOG[0], y - FOG[1]); if (df < FR) { const f = FS * (1 - (df / FR) ** 2); fog = f; if (!col) col = FC.slice(); else { const a = s / (s + f); col = col.map((c, j) => a * c + (1 - a) * FC[j]); } s += f; } } return { s, col: col || [0, 0, 0], fog }; }
      function march(cam, u, n) { const d = K.ray2(cam, u), sg = K.seg(cam.o, d), dt = (sg[1] - sg[0]) / n, S = []; let T = 1; for (let k = 0; k < n; k++) { const t = sg[0] + (k + .5) * dt, f = field(cam.o[0] + t * d[0], cam.o[1] + t * d[1], d), a = 1 - Math.exp(-f.s * dt); S.push({ a, w: T * a, T, s: f.s, fog: f.fog }); T *= 1 - a; } return { S, dt }; }
      const cam = K.camAt(3 * STEP), M = march(cam, 44.5, 128), fogS = M.S.filter(q => q.fog > 0 && q.s < 100), wall = M.S.findIndex(q => q.s >= 100); mode = 'mug'; const M0 = march(cam, 44.5, 128), first = M0.S.findIndex(q => q.s > 1000); let inWall = 0; for (let k = first; k < M0.S.length && M0.S[k].s > 0; k++) inWall++;
      return { fogN: fogS.length, amax: Math.max(...fogS.map(q => q.a)), Twall: M.S[wall].T, fogShare: fogS.reduce((a, q) => a + q.w, 0), inWall, smax: SMAX, fs: FS, a53: 1 - Math.exp(-SMAX * .0053), af: 1 - Math.exp(-.17) }; });
    ok('ray (engine, same field and march as the widget): 22 samples in the fog, each blocking less than 5% (' + (r.amax * 100).toFixed(1) + '% at most), T down to ' + (r.Twall * 100).toFixed(0) + '% at the wall, the fog holding ' + (r.fogShare * 100).toFixed(0) + '% of the pixel', r.fogN === 22 && r.amax < .05 && (r.Twall * 100).toFixed(0) === '50' && near(r.fogShare, .5, .01), JSON.stringify(r));
    ok('ray (engine): at 128 samples ' + r.inWall + ' samples fall inside the front wall ("several")', r.inWall >= 3, r.inWall);
    RAY = r; }

  // ---- step 5 · NeRF and the grid
  let NERF = null;
  { sec('step 5 · nerf'); const w = W('nerf'); await w.show(); let m = await w.met();
    ok('nerf, untrained network: 2 476 parameters, the new view at 8.8 dB', has(m, '参数（旋钮） 2 476', '训练 0 步', '新角度 PSNR 8.8 dB'), m);
    const steps = async () => num(await w.met(), /训练 (\d+) 步/), psnr = async () => num(await w.met(), /PSNR ([\d.]+) dB/);
    // press Start, let it run until `stop` steps (then Pause) or to the end; remember the first reading at or above 25 dB
    const run = async (stop) => { let first = null; await w.click('开始训练', 60); for (;;) { const s = await steps(), q = await psnr(); if (first == null && q >= 25) first = s; if (stop && s >= stop) { await w.click('暂停', 250); break; } if (s >= 2400) break; await p.waitForTimeout(80); } await p.waitForTimeout(500); return { first, m: await w.met(), s: await w.status(), steps: await steps(), q: await psnr() }; };
    let r = await run(300);
    ok('nerf, network paused after about three hundred steps (' + r.steps + '): between 21 and 24 dB (' + r.q + ')', r.steps >= 300 && r.steps <= 420 && r.q >= 20.5 && r.q <= 24.6, r.m);
    await w.click('位置编码', 400); m = await w.met(); ok('nerf, positional encoding off: 1 708 parameters', has(m, '参数（旋钮） 1 708', '训练 0 步'), m);
    r = await run(0); ok('nerf, without positional encoding: never reaches 25 dB, 22.5 dB after the full 2400 steps, "the field stays blurry"', r.first == null && has(r.m, '训练 2400 步', '新角度 PSNR 22.5 dB') && has(r.s, '关掉了位置编码', '场糊成一片'), r.m + ' || ' + r.s);
    await w.click('位置编码', 400); await w.click('格子（Plenoxels 式）', 400); m = await w.met(); ok('nerf, grid: 40 960 parameters', has(m, '参数（旋钮） 40 960', '训练 0 步'), m);
    r = await run(0); const gFirst = r.first; ok('nerf, grid: first reading above 25 dB within about 160 steps (shown at step ' + r.first + '), 25.7 dB after 2400 steps, "stray specks"', r.first != null && r.first <= 260 && has(r.m, '训练 2400 步', '新角度 PSNR 25.7 dB') && has(r.s, '长出杂点'), r.m + ' || ' + r.s);
    await w.click('网络（NeRF）', 400); m = await w.met(); ok('nerf, back to the network: positional encoding is on again (2 476 parameters)', has(m, '参数（旋钮） 2 476', '训练 0 步'), m);
    r = await run(0); ok('nerf, network: first reading above 25 dB at about 520 steps (shown at step ' + r.first + '), 29.9 dB after 2400 steps', r.first >= 500 && r.first <= 640 && r.first > gFirst && has(r.m, '训练 2400 步', '新角度 PSNR 29.9 dB'), r.m);
    // same loop as the widget (fresh() + trainStep()), PSNR of the unseen view every 10 steps
    NERF = await EV(() => { const K = TB, DEG = Math.PI / 180, data = K.makeData([...Array(K.NV).keys()]), ncam = K.camAt(37.5 * DEG), nph = K.photo1(ncam, 4), nrays = nph.map((c, i) => ({ o: ncam.o, d: K.ray2(ncam, i + .5), col: c }));
      const run = store => { const ITS = 2400, M = store === 'net' ? K.nerfMake({ L: 6, H: 32, NS: 24, lr: 5e-3 }) : K.gridMake({ G: 64, lr: .05, init: -4, tv: 0 }), r = K.rng(3), B = store === 'net' ? 64 : 192; let it = 0, tt = 0;
        const psnr = () => { const R = store === 'net' ? K.nerfRender(M, nrays, false, null) : K.gridRender(M, nrays, false, null); let s = 0; for (let i = 0; i < K.W; i++) for (let j = 0; j < 3; j++) s += (R.out[i][j] - nph[i][j]) ** 2; return -10 * Math.log10(s / K.W / 3); };
        const o = { p0: psnr(), first25: null, first27: null, best: 0, at: {}, params: store === 'net' ? K.nParams(M.trunk) + K.nParams(M.head) : M.P.length };
        while (it < ITS) { const b = []; for (let k = 0; k < B; k++) b.push(data.rays[Math.floor(r() * data.rays.length)]); const t0 = performance.now(); if (store === 'net') { const f = Math.pow(.1, Math.min(1, it / ITS)); M.ot.lr = M.oh.lr = 5e-3 * f; } (store === 'net' ? K.nerfRender : K.gridRender)(M, b, true, r); tt += performance.now() - t0; it++;
          if (it % 10 === 0) { const q = psnr(); if (o.first25 == null && q >= 25) o.first25 = it; if (o.first27 == null && q >= 27) o.first27 = it; o.best = Math.max(o.best, q); if (it === 200 || it === 300 || it === 400 || it === 2400) o.at[it] = q; } } o.ms = tt / ITS; return o; };
      return { net: run('net'), grid: run('grid') }; });
    const N = NERF;
    ok('nerf (engine, same loop as the widget): the grid first passes 25 dB at step 160 and the network at step 520 (checked every 10 steps)', N.grid.first25 === 160 && N.net.first25 === 520, JSON.stringify([N.grid.first25, N.net.first25]));
    ok('nerf (engine): network 21.5 dB at step 300 and 24.2 dB at step 400 (the "21 to 24 dB"); 29.9 dB at 2400; start 8.8 dB', N.net.at[300].toFixed(1) === '21.5' && N.net.at[400].toFixed(1) === '24.2' && N.net.at[2400].toFixed(1) === '29.9' && N.net.p0.toFixed(1) === '8.8', JSON.stringify(N.net));
    ok('nerf (engine): grid 27 dB by step 200 (' + N.grid.at[200].toFixed(1) + '), best ' + N.grid.best.toFixed(1) + ' dB on the way, 25.7 dB at 2400; the network reaches 27 dB at step ' + N.net.first27 + ' ("about a thousand")', N.grid.first27 === 200 && N.grid.best.toFixed(1) === '28.5' && N.grid.at[2400].toFixed(1) === '25.7' && N.net.first27 >= 800 && N.net.first27 <= 1100, JSON.stringify(N.grid));
    ok('nerf (engine): 2476 and 40 960 parameters; a grid step takes ' + N.grid.ms.toFixed(1) + ' ms and a network step ' + N.net.ms.toFixed(1) + ' ms on this machine (text: seven or eight against about twenty, on the machine that ran this check)', N.net.params === 2476 && N.grid.params === 40960 && N.net.ms / N.grid.ms > 1.5 && N.net.ms / N.grid.ms < 5, JSON.stringify([N.grid.ms, N.net.ms])); }

  // ---- step 6 · Gaussian splatting
  let GS = null;
  { sec('step 6 · gs'); const w = W('gs'); await w.show(); let m = await w.met();
    ok('gs, start from the SfM points: 53 Gaussians (795 numbers), the new view at 19.0 dB', has(m, '高斯 / 参数 53 / 795', '新角度 PSNR 19.0 dB'), m);
    const train = async () => { await w.click('开始训练', 60); await until(w, /训练 2500 步/, 60); await p.waitForTimeout(400); return { m: await w.met(), s: await w.status() }; };
    let r = await train(); ok('gs, SfM start: 38.0 dB after 2500 steps with 195 Gaussians (170 added, 28 removed)', has(r.m, '高斯 / 参数 195 / 2 925', '训练 2500 步', '新角度 PSNR 38.0 dB') && has(r.s, '新长出 170 个高斯、删掉 28 个'), r.m + ' || ' + r.s);
    await w.click('增减高斯', 300); r = await train(); ok('gs, "Add and remove Gaussians" off: the count stays at 53, 31.2 dB', has(r.m, '高斯 / 参数 53 / 795', '新角度 PSNR 31.2 dB') && has(r.s, '没有增减高斯'), r.m + ' || ' + r.s);
    await w.click('增减高斯', 300); await w.click('颜色随方向变', 300); r = await train(); ok('gs, back on, "Colour changes with direction" off: 35.8 dB, "the highlight that moves with the camera cannot be learned"', has(r.m, '新角度 PSNR 35.8 dB') && has(r.s, '跟着相机走的高光学不出来') && !has(r.s, '没有增减高斯'), r.m + ' || ' + r.s);
    await w.click('颜色随方向变', 300); await w.click('随机撒', 300); m = await w.met(); ok('gs, "Random": 100 Gaussians, 13.5 dB before training', has(m, '高斯 / 参数 100 / 1 500', '新角度 PSNR 13.5 dB'), m);
    r = await train(); ok('gs, random start: 36.5 dB with 204 Gaussians (161 added, 57 removed), 1.5 dB below the SfM start', has(r.m, '高斯 / 参数 204 / 3 060', '新角度 PSNR 36.5 dB') && has(r.s, '新长出 161 个高斯、删掉 57 个') && near(38.0 - 36.5, 1.5, 1e-9), r.m + ' || ' + r.s);
    // same loop as the widget (fresh() + trainStep())
    GS = await EV(() => { const K = TB, DEG = Math.PI / 180, cams = K.cams(), phs = cams.map(c => K.photo1(c, 4)), ncam = K.camAt(37.5 * DEG), nph = K.photo1(ncam, 4), ITS = 2500;
      const reg = []; for (let i = 0; i < K.W; i++) { const d = K.ray2(ncam, i + .5), h = K.castSlice(ncam.o, d); if (!h) { reg.push('bg'); continue; } if (h.k === 'handle') { reg.push('handle'); continue; } const a = ((Math.atan2(h.p[1], h.p[0]) / DEG) + 360) % 360, nl = h.n[0] * K.L3[0] + h.n[1] * K.L3[1], v = [-d[0], -d[1]], nv = h.n[0] * v[0] + h.n[1] * v[1], lv = K.L3[0] * v[0] + K.L3[1] * v[1], rv = 2 * nl * nv - lv, sp = nl > 0 ? .55 * Math.pow(Math.max(0, rv), 32) : 0; reg.push(sp > .05 ? 'highlight' : (a >= 90 && a < 270 ? 'striped' : 'plain')); }
      const where = M => { let vis = 0, out = 0; for (const g of M.G) { const op = 1 / (1 + Math.exp(-g[5])); if (op < .05) continue; vis++; if (Math.hypot(g[0] - K.HX, g[1]) >= .012 && Math.hypot(g[0], g[1]) > K.RO + .005) out++; } return { vis, out }; };
      const run = (init, dens, vdep) => { const r = K.rng(5), pts = init === 'sfm' ? K.gsInitSfM(r, 80) : K.gsInitRandom(r, 100), M = K.gsMake(pts), lr0 = M.lr.slice(); let it = 0, first35 = null, tt = 0; const w0 = where(M);
        const split = { striped: 0, plain: 0, handle: 0 }; for (const q of pts) { if (Math.hypot(q[0] - K.HX, q[1]) < .012) split.handle++; else if (q[0] < 0) split.striped++; else split.plain++; }
        const img = () => K.gsRender(M, ncam, null).img, psnr = () => { const im = img(); let s = 0; for (let i = 0; i < K.W; i++) for (let j = 0; j < 3; j++) s += (im[i][j] - nph[i][j]) ** 2; return -10 * Math.log10(s / K.W / 3); };
        while (it < ITS) { const t0 = performance.now(), f = Math.pow(.01, Math.min(1, it / ITS)); M.lr[0] = lr0[0] * f; M.lr[1] = lr0[1] * f; const v = Math.floor(r() * K.NV), R = K.gsRender(M, cams[v], phs[v]); if (!vdep) for (const [, gr] of R.grads) for (let k = 9; k < 15; k++) gr.g[k] = 0; K.gsStep(M, R.grads); it++; if (dens && it % 100 === 0 && it <= 1500) K.gsDensify(M, r, { thr: 5e-5 }); tt += performance.now() - t0; if (it % 10 === 0 && first35 == null && psnr() >= 35) first35 = it; }
        const im = img(), e = {}; for (let i = 0; i < K.W; i++) { const x = Math.max(...[0, 1, 2].map(j => Math.abs(im[i][j] - nph[i][j]))); (e[reg[i]] = e[reg[i]] || []).push(x); } const mean = {}, mx = {}; for (const k in e) { mean[k] = e[k].reduce((a, x) => a + x, 0) / e[k].length * 100; mx[k] = Math.max(...e[k]) * 100; }
        return { n0: pts.length, split, w0, w1: where(M), n: M.G.length, final: psnr(), first35, mean, mx, ms: tt / ITS }; };
      return { A: run('sfm', true, true), B: run('sfm', false, true), C: run('sfm', true, false), D: run('random', true, true) }; });
    const G = GS;
    ok('gs (engine, same loop as the widget): the 53 starting points are 44 on the striped half, 5 on the plain half and 4 on the handle', G.A.n0 === 53 && G.A.split.striped === 44 && G.A.split.plain === 5 && G.A.split.handle === 4, JSON.stringify(G.A.split));
    ok('gs (engine): from the SfM points the new view first passes 35 dB at step 990 (checked every 10 steps); final 38.0 dB', G.A.first35 === 990 && G.A.final.toFixed(1) === '38.0', G.A.first35 + ' ' + G.A.final);
    const ratio = k => G.B.mean[k] / G.A.mean[k];
    ok('gs (engine): without adding Gaussians the mean error at the handle, the highlight and the stripe pixels of the new view is about three times as large (' + ['handle', 'highlight', 'striped'].map(k => ratio(k).toFixed(1)).join(', ') + ' times)', ['handle', 'highlight', 'striped'].every(k => ratio(k) > 2.4 && ratio(k) < 3.4) && G.B.final.toFixed(1) === '31.2' && G.B.n === 53, JSON.stringify([G.A.mean, G.B.mean]));
    ok('gs (engine): without view-dependent colour the largest error among the highlight pixels rises from 2.7% to 5.1%; final 35.8 dB', G.A.mx.highlight.toFixed(1) === '2.7' && G.C.mx.highlight.toFixed(1) === '5.1' && G.C.final.toFixed(1) === '35.8', JSON.stringify([G.A.mx, G.C.mx]));
    ok('gs (engine): random start: 54 of the 100 Gaussians begin outside the mug’s outline; after training only 1 visible Gaussian is still outside; 204 Gaussians, 36.5 dB', G.D.n0 === 100 && G.D.w0.out === 54 && G.D.w1.out === 1 && G.D.n === 204 && G.D.final.toFixed(1) === '36.5', JSON.stringify([G.D.w0, G.D.w1]));
    const tn = NERF.net.ms * 2400, tg = G.A.ms * 2500;
    ok('gs (engine): a Gaussian step takes ' + G.A.ms.toFixed(2) + ' ms on this machine (text: about half a millisecond) against ' + NERF.net.ms.toFixed(1) + ' ms for a network step; the whole network training takes ' + (tn / tg).toFixed(0) + ' times as long ("dozens of times")', NERF.net.ms / G.A.ms > 10 && tn / tg > 12 && tn / tg < 100 && G.A.ms < 3, JSON.stringify([G.A.ms, NERF.net.ms]));
    ok('figure of step 6: 140 × 2 / 280 = 1.0 pixel; shares 0.60, 0.4 × 0.8 = 0.32 and 0.08', near(140 * 2 / 280, 1, 1e-12) && near(.4 * .8, .32, 1e-12) && near(1 - .6 - .32, .08, 1e-12)); }

  // ---- step 7 · surfaces
  { sec('step 7 · surf'); const w = W('surf'); await w.show(); let m = await until(w, /PSNR [\d.]+ dB/, 60); await p.waitForTimeout(400); m = await w.met(); let s = await w.status();
    ok('surf, photos only: 1017 points, 438 (43%) more than 3 mm off, 333 inside the mug, new view 38.0 dB, handle centre 1.0 mm off', has(m, '点 1017', '离真表面 3 mm 以上 438 (43%)', '落进杯子里面（本是空的） 333', 'PSNR 38.0 dB', '把手中心：差多少 1.0 mm') && has(s, '只用照片训练', '素色那半边最乱'), m + ' || ' + s);
    await w.click('照片 + 深度相机', 400); for (let k = 0; k < 600; k++) { s = await w.status(); if (/训练时再加一项/.test(s)) break; await p.waitForTimeout(100); } await p.waitForTimeout(300); m = await w.met(); s = await w.status();
    ok('surf, photos + depth camera: 69 (7%) more than 3 mm off, 7 inside, 32.8 dB (5.2 dB lower), handle centre 0.8 mm off', has(m, '离真表面 3 mm 以上 69 (7%)', '落进杯子里面（本是空的） 7 ', 'PSNR 32.8 dB', '把手中心：差多少 0.8 mm') && has(s, '从 38.0 dB 降到 32.8 dB') && near(38.0 - 32.8, 5.2, 1e-9), m + ' || ' + s);
    // same loop as the widget (train('rgb') + build()): on which half do the red rings lie
    const r = await EV(() => { const K = TB, DEG = Math.PI / 180, cams = K.cams(), phs = cams.map(c => K.photo1(c, 4)), ITS = 2500;
      const depths = (M, cam) => { const pr = K.gsProject(M, cam), o = []; for (let p = 0; p < K.W; p++) { const up = p + .5, rd = K.ray2(cam, up); let T = 1, t = null; for (const q of pr) { const d = up - q.u; if (d * d > 12 * q.vu) continue; let a = q.op * Math.exp(-d * d / (2 * q.vu)); if (a < 1 / 255) continue; if (a > .99) a = .99; if (T * (1 - a) < .5) { const G = M.G[q.i], S = q.S, det = S[0] * S[2] - S[1] * S[1], i00 = S[2] / det, i01 = -S[1] / det, i11 = S[0] / det, mx = G[0] - cam.o[0], my = G[1] - cam.o[1]; t = (rd[0] * (i00 * mx + i01 * my) + rd[1] * (i01 * mx + i11 * my)) / (rd[0] * (i00 * rd[0] + i01 * rd[1]) + rd[1] * (i01 * rd[0] + i11 * rd[1])); break; } T *= 1 - a; } o.push(t == null ? null : [cam.o[0] + t * rd[0], cam.o[1] + t * rd[1]]); } return o; };
      const surfDist = P => { const r = Math.hypot(P[0], P[1]); return Math.min(Math.abs(r - K.RO), Math.abs(Math.hypot(P[0] - K.HX, P[1]) - K.rh)); };
      const rr = K.rng(5), G = K.gsMake(K.gsInitSfM(rr, 80)), lr0 = G.lr.slice(); G.dep = 0; let it = 0; while (it < ITS) { const f = Math.pow(.01, it / ITS); G.lr[0] = lr0[0] * f; G.lr[1] = lr0[1] * f; const v = Math.floor(rr() * K.NV), Q = K.gsRender(G, cams[v], phs[v]); K.gsStep(G, Q.grads); it++; if (it % 100 === 0 && it <= 1500) K.gsDensify(G, rr, { thr: 5e-5 }); }
      const pts = []; for (const cam of cams) for (const P of depths(G, cam)) if (P) pts.push(P); const bad = pts.filter(P => surfDist(P) > .003); let seeHandle = 0; for (const cam of cams) { let n = 0; for (let px = 0; px < K.W; px++) { const h = K.castSlice(cam.o, K.ray2(cam, px + .5)); if (h && h.k === 'handle') n++; } if (n) seeHandle++; }
      return { n: pts.length, bad: bad.length, plain: bad.filter(P => P[0] > 0).length, inside: pts.filter(P => Math.hypot(P[0], P[1]) < K.RI).length, seeHandle, t: [K.RC - K.HX - K.rh, K.RC - K.HX + K.rh, K.RC - K.RO] }; });
    ok('surf (engine, same loop as the widget): of the 438 red rings 293 (two thirds) are on the plain half; the handle shows in ' + r.seeHandle + ' of the 24 photos', r.n === 1017 && r.bad === 438 && r.inside === 333 && r.plain === 293 && near(r.plain / r.bad, 2 / 3, .01) && r.seeHandle >= 12, JSON.stringify(r));
    ok('figure of step 7: from the camera at 0° the handle spans 24.4 to 25.6 cm and the wall starts at 27.5 cm; 0.55 × 24.4 + 0.45 × 27.5 = 25.8 cm, inside the gap', r.t.map(v => (v * 100).toFixed(1)).join(' ') === '24.4 25.6 27.5' && (.55 * 24.4 + .45 * 27.5).toFixed(1) === '25.8' && 25.8 > 25.6 && 25.8 < 27.5, JSON.stringify(r.t)); }

  // ---- step 8 · few photos and a learned prior
  { sec('step 8 · few'); const w = W('few'); await w.show(); let m = await until(w, /拍过的角度 [\d.]+ dB/, 60); await p.waitForTimeout(400); m = await w.met(); let s = await w.status();
    const waitSt = async (re) => { for (let k = 0; k < 600; k++) { const t = await w.status(); if (re.test(t) && !/—/.test(await w.met())) break; await p.waitForTimeout(100); } await p.waitForTimeout(300); return { m: await w.met(), s: await w.status() }; };
    ok('few, 3 photos: photographed angles 47.9 dB, angles in between 21.2 dB, back of the mug 11.2 dB', has(m, '拍过的角度 47.9 dB', '弧里没拍过的角度 21.2 dB', '杯子背面（135°–225°） 11.2 dB') && has(s, '照片太少'), m + ' || ' + s);
    await w.click('加上网络估的深度', 300); let r = await waitSt(/每张照片再配一张/);
    ok('few, 3 photos with the prior: in between 25.4 dB, a gain of 4.2 dB; the back still 11.7 dB', has(r.m, '弧里没拍过的角度 25.4 dB', '杯子背面（135°–225°） 11.7 dB') && has(r.s, '弧里没拍过的角度提高了 4.2 dB') && near(25.4 - 21.2, 4.2, 1e-9), r.m + ' || ' + r.s);
    await w.click('7', 300); r = await waitSt(/每张照片再配一张/); const with7 = r.m;
    await w.click('加上网络估的深度', 300); r = await waitSt(/照片够多|拍过的角度几乎/);
    ok('few, 7 photos without the prior: in between already 38.2 dB, back 11.5 dB', has(r.m, '弧里没拍过的角度 38.2 dB', '杯子背面（135°–225°） 11.5 dB') && has(r.s, '照片够多'), r.m + ' || ' + r.s);
    await w.click('加上网络估的深度', 300); r = await waitSt(/每张照片再配一张/);
    ok('few, 7 photos with the prior: in between 32.6 dB, 5.6 dB lower; back 11.3 dB (all four backs about 11 dB)', has(r.m, '弧里没拍过的角度 32.6 dB', '杯子背面（135°–225°） 11.3 dB') && r.m === with7 && has(r.s, '反而降了 5.6 dB') && near(38.2 - 32.6, 5.6, 1e-9) && [11.2, 11.7, 11.5, 11.3].every(v => Math.abs(v - 11) <= .7), r.m + ' || ' + r.s); }

  // ---- step 9 · the method map
  { sec('step 9 · sp'); const w = W('sp'); await w.show();
    const groups = () => p.evaluate(() => [...document.querySelectorAll('#sp-g .spgr')].map(g => ({ name: g.querySelector('.spgh b').innerText.trim(), n: +g.querySelector('.spgh i').innerText, n2: g.querySelectorAll('.spk').length, items: [...g.querySelectorAll('.spk')].map(b => ({ y: parseInt(b.querySelector('small').innerText, 10), t: b.childNodes[0].textContent.trim() })) })));
    await w.click('存成什么', 400); let g = await groups(); const by = [...g].sort((a, b) => b.n - a.n);
    ok('sp, "Stored as": the two largest groups are "Gaussians and other primitives" (24) and "Radiance fields: networks" (19)', by[0].name === '高斯和其他基元' && by[0].n === 24 && by[1].name === '辐射场：网络' && by[1].n === 19 && g.every(q => q.n === q.n2), by.slice(0, 3).map(q => q.name + ' ' + q.n).join(' | '));
    const old = by[0].items.filter(q => q.y < 2023);
    ok('sp: in the Gaussian group only surfels (2000) and EWA splatting (2001) are older than 2023; 3DGS itself is 2023', old.length === 2 && old.some(q => q.y === 2000 && /面元/.test(q.t)) && old.some(q => q.y === 2001 && /EWA 泼溅/.test(q.t)) && by[0].items.some(q => q.y === 2023 && /3DGS/.test(q.t)), JSON.stringify(old));
    await w.click('怎么求', 400); g = await groups(); const ff = g.find(q => q.name === '一次前向');
    ok('sp, "Solved by": "One forward pass" has 22 methods, the earliest from 2014 (depth from a deep network), 11 of them from 2024 or later', ff && ff.n === 22 && Math.min(...ff.items.map(q => q.y)) === 2014 && /深度网络估深度/.test(ff.items.find(q => q.y === 2014).t) && ff.items.filter(q => q.y >= 2024).length === 11, ff && JSON.stringify(ff.items.map(q => q.y)));
    await w.click('年代', 400); g = await groups();
    ok('sp, "Era": 4 before 1990, 14 in 1990–2009, 16 in 2010–2019, 25 in 2020–2022, 42 from 2023', g.map(q => q.n).join(' ') === '4 14 16 25 42', g.map(q => q.name + ' ' + q.n).join(' | '));
    // the widget's own list of methods (embedded in the page), counted by era
    const M = await p.evaluate(() => { const t = [...document.querySelectorAll('script')].map(s => s.textContent).find(s => s.includes('const M=[{"id":"zhangcal"')), a = t.indexOf('const M=') + 8; let d = 0, k = a, str = false, esc = false; for (; ; k++) { const c = t[k]; if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; } else if (c === '"') str = true; else if (c === '[') d++; else if (c === ']') { d--; if (d === 0) break; } } return JSON.parse(t.slice(a, k + 1)).map(m => ({ e: m.e, rep: m.rep, how: m.how, cmp: m.cmp, out: m.out, sv: !!m.sv })); });
    const era = m => m.e < 1990 ? 0 : m.e < 2010 ? 1 : m.e < 2020 ? 2 : m.e < 2023 ? 3 : 4, E = k => M.filter(m => !m.sv && era(m) === k), cnt = (a, f) => a.filter(f).length;
    ok('sp (the widget’s data): 104 methods; 1990–2009: 10 of 14 solve directly; 2010–2019: 6 one-pass networks and 5 per-scene optimisations', M.length === 104 && E(1).length === 14 && cnt(E(1), m => m.how === 'solve') === 10 && E(2).length === 16 && cnt(E(2), m => m.how === 'ff') === 6 && cnt(E(2), m => m.how === 'opt') === 5, [cnt(E(1), m => m.how === 'solve'), cnt(E(2), m => m.how === 'ff'), cnt(E(2), m => m.how === 'opt')].join(' '));
    ok('sp (the widget’s data): 2020–2022: 15 of 25 store a radiance field in a network and 21 are optimised per scene; from 2023: 22 of 42 are stored as Gaussians', E(3).length === 25 && cnt(E(3), m => m.rep.includes('rfnet')) === 15 && cnt(E(3), m => m.how === 'opt') === 21 && E(4).length === 42 && cnt(E(4), m => m.rep.includes('gauss')) === 22, [cnt(E(3), m => m.rep.includes('rfnet')), cnt(E(3), m => m.how === 'opt'), cnt(E(4), m => m.rep.includes('gauss'))].join(' '));
    METHODS = M; }

  // ======================= Part B: the numbers in the cards, the paragraphs and the figures, recomputed with the page's engine =======================
  { sec('text · numbers recomputed with the engine');
    const T = {}; for (const id of ['k-intro', 'k-cam', 'k-geo', 'k-depth', 'k-field', 'k-nerf', 'k-gs', 'k-surf', 'k-prior', 'k-map']) T[id] = await secText(id);
    const R = await EV(() => { const K = TB, DEG = Math.PI / 180, o = {};
      o.K = { RO: K.RO, RI: K.RI, H: K.H, rh: K.rh, HX: K.HX, RC: K.RC, ZC: K.ZC, NV: K.NV, W: K.W, HH: K.HH, FPX: K.FPX, CX: K.CX, RB: K.RB };
      { const cam = K.cams()[1], P = [K.HX, 0], qx = P[0] - cam.o[0], qy = P[1] - cam.o[1], z = qx * cam.f[0] + qy * cam.f[1], x = qx * cam.r[0] + qy * cam.r[1]; o.h2 = { ang: cam.ang / DEG, z, x, u: K.CX + K.FPX * x / z }; }
      // triangulation card: the stripe-edge point of the widget is on the wall at polar angle 157.5° (see the widget), camera A is photo 10
      o.tri = [17, 34, 69, 90].map(a => (1 + Math.abs(Math.cos(a * DEG))) / Math.sin(a * DEG));
      o.pe = [Math.sin(.3 * Math.PI), Math.cos(.3 * Math.PI), Math.sin(.6 * Math.PI), Math.cos(.6 * Math.PI), Math.cos(.7 * Math.PI), Math.sin(.35 * Math.PI)];
      { const M = K.nerfMake({ L: 6, H: 32, NS: 24, lr: 5e-3 }), G = K.gridMake({ G: 64, lr: .05, init: -4, tv: 0 }); o.net = { L: M.L, NS: M.NS, params: K.nParams(M.trunk) + K.nParams(M.head) }; o.grid = { G: G.G, C: G.C, n: G.P.length, NS: G.NS }; }
      o.psi3 = .5 * Math.exp(-3); return o; });
    const k = R.K;
    ok('step 0 text: mug 9 cm across, 10 cm high, wall 5 mm; handle 1.2 cm thick with a 1.9 cm gap; stripes 22.5°', has(T['k-intro'], '外径 9 cm，高 10 cm，杯壁厚 5 mm', '粗 1.2 cm，和杯身之间留着 1.9 cm 的空', '每条宽 22.5°') && near(2 * k.RO, .09, 1e-9) && near(k.H, .10, 1e-9) && near(k.RO - k.RI, .005, 1e-9) && near(2 * k.rh, .012, 1e-9) && near(k.HX - k.rh - k.RO, .019, 1e-9));
    ok('step 0 text: camera 32 cm from the axis, 5 cm above the table, a photo every 15°, 24 photos of 96 × 72 pixels', has(T['k-intro'], '相机离杯子的轴线 32 cm', '离桌面 5 cm', '每转 15° 拍一张，一共 24 张，每张 96 × 72 像素') && near(k.RC, .32, 1e-9) && near(k.ZC, .05, 1e-9) && 360 / k.NV === 15 && k.W === 96 && k.HH === 72);
    ok('step 0 text: the slice is a ring of radii 4.5 and 4.0 cm plus a disc of radius 6 mm centred 7 cm from the axis', has(T['k-intro'], '外半径 4.5 cm、内半径 4.0 cm', '半径 6 mm，圆心离杯子的轴线 7 cm', '中间隔着 1.9 cm 的空', '一行 96 个像素') && near(k.RO, .045, 1e-9) && near(k.RI, .040, 1e-9) && near(k.rh, .006, 1e-9) && near(k.HX, .07, 1e-9));
    ok('step 1 card: f = 140 pixels, so a point 1 m away and 1 cm off axis lands 1.4 pixels off centre', has(T['k-cam'], '离相机 1 m、偏离光轴 1 cm 的点，像偏离中心 1.4 个像素') && k.FPX === 140 && k.CX === 48 && near(k.FPX * .01 / 1, 1.4, 1e-9));
    ok('step 1 card: handle centre in photo 2 (15°): z = 25.2 cm, x = -1.81 cm, u = 48 - 10.06 = 37.94 (exactly ' + R.h2.u.toFixed(2) + ')', has(T['k-cam'], '第 2 张照片在 15° 拍', 'zc = 25.2 cm，在它左边 1.81 cm（xc = -1.81 cm）：u = 48 + 140 × (-0.0181 / 0.252) = 48 - 10.06 = 37.94') && near(R.h2.ang, 15, 1e-9) && (R.h2.z * 100).toFixed(1) === '25.2' && (R.h2.x * 100).toFixed(2) === '-1.81' && (140 * .0181 / .252).toFixed(2) === '10.06' && (48 - 10.06).toFixed(2) === '37.94' && near(R.h2.u, 37.94, .02), JSON.stringify(R.h2));
    ok('step 1 card: e = 0.29 × 1 / 140 = 2.1 mm; at 34° the factor is 3.3 and the error about 6.8 mm; about 14 mm at 17°, about 3 mm at 69°; the factor is 1 at 90°', has(T['k-cam'], 'e = 0.29 × 1 / 140 = 2.1 mm', '(1 + 0.83) / 0.56 = 3.3，沿视线最多差 2.1 × 3.3 ≈ 6.8 mm，交互里是 6.7 mm', '照式子算约差 14 mm', '只差 3 mm 左右（交互里是 14.5 mm 和 2.9 mm', '(1 + |cos φ|) / sin φ = 1') && (.29 / 140 * 1000).toFixed(1) === '2.1' && R.tri[1].toFixed(1) === '3.3' && Math.cos(34 * Math.PI / 180).toFixed(2) === '0.83' && Math.sin(34 * Math.PI / 180).toFixed(2) === '0.56' && near(.29 / 140 * 1000 * R.tri[1], 6.8, .06) && near(.29 / 140 * 1000 * R.tri[0], 14, .5) && near(.29 / 140 * 1000 * R.tri[2], 3, .1) && near(R.tri[3], 1, 1e-9), JSON.stringify(R.tri));
    ok('step 1 card: the widget’s 2.2 mm at 5 photos on (86°) and 5.1 mm at 8 (134°)', has(T['k-cam'], '交互里隔 5 张、86° 时只差 2.2 mm，隔 8 张、134° 又涨到 5.1 mm', '交互里有三五个差不到 2%'));
    ok('step 2 card: 100 photos, 50 000 points seen 4 times each: 150 600 unknowns, 200 000 observations, 400 000 equations', has(T['k-geo'], '5 万 × 3 + 100 × 6 = 15.06 万个未知数', '20 万次观测、40 万个方程') && 50000 * 3 + 100 * 6 === 150600 && 50000 * 4 === 200000 && 50000 * 4 * 2 === 400000);
    ok('step 2 card: the default pixel of the widget, 28.4 cm true, dip at 28.6 cm, 2.3 mm apart (checked on the widget above)', has(T['k-geo'], '真深度 28.4 cm，颜色差的谷在 28.6 cm，差 2.3 mm', '交互里用前后各两张，共 4 张'));
    ok('step 3 card: 4.5 / 6 = 0.75; (3 × 0.52 + 0.75) / 4 = 0.58', has(T['k-depth'], 'zm - z = 4.5 mm，s = 4.5 / 6 = 0.75', 'D ← (3 × 0.52 + 0.75) / 4 = 0.58，W = 4', '截断距离，本篇 6 mm') && near(3 + 1.5, 4.5, 1e-12) && near(4.5 / 6, .75, 1e-12) && ((3 * .52 + .75) / 4).toFixed(2) === '0.58');
    ok('step 3 legend: 128 × 128 cells of 1.5 mm; no depth beyond 70° of incidence', has(T['k-depth'], '128 × 128 个小格子（每格 1.5 mm）', '入射角大于 70° 的像素这一帧没有深度') && near(.192 / 128, .0015, 1e-12));
    ok('step 4 card: wall density 2000 /m, so α ≈ 1 at 5.3 mm spacing; fog 32 /m, α = 1 - e^-0.17 = 0.16', has(T['k-field'], '交互里杯壁的密度是 2000 /m', 'α = 1 - e-2000 × 0.0053 = 1 - e-10.6 ≈ 1', '雾的中心密度是 32 /m：α = 1 - e-0.17 = 0.16，每个点只挡掉 16%') && RAY.smax === 2000 && RAY.fs === 32 && near(2000 * .0053, 10.6, 1e-9) && RAY.a53 > .9999 && (32 * .0053).toFixed(2) === '0.17' && RAY.af.toFixed(2) === '0.16');
    ok('step 5 card: the widget’s network has 2476 parameters, 24 samples per ray, 64 rays per batch, L = 6', has(T['k-nerf'], '交互里的小网络只有 2476 个参数，每条射线采 24 个点，每批 64 条射线', '交互里用 6') && R.net.params === 2476 && R.net.NS === 24 && R.net.L === 6);
    ok('step 5 card: γ(0.3) with L = 2 is (0.81, 0.59, 0.95, -0.31); at 0.35 the last term is -0.59 and the first 0.89', has(T['k-nerf'], '(0.81, 0.59, 0.95, -0.31)', '从 -0.31 变到 -0.59', '从 0.81 变到 0.89') && R.pe.slice(0, 4).map(v => v.toFixed(2)).join(' ') === '0.81 0.59 0.95 -0.31' && R.pe[4].toFixed(2) === '-0.59' && R.pe[5].toFixed(2) === '0.89');
    ok('step 5 text: grid at 27 dB after 200 steps, the network after about a thousand; 192 against 64 rays; 1536 samples a step; the grid hovers at 27–28 dB and ends below 26 dB, the network climbs to about 30 dB', has(T['k-nerf'], '格子 200 步就到了 27 dB，网络要一千步左右才到', '192 条对 64 条', '格子一步七八毫秒，网络一步二十毫秒左右', '1536 个采样点', '格子停在 27–28 dB 上下，到 2400 步反而掉到 26 dB 以下；网络却一路涨到 30 dB 左右') && NERF.grid.first27 === 200 && NERF.net.first27 >= 800 && NERF.net.first27 <= 1100 && 64 * 24 === 1536 && NERF.grid.at[2400] < 26 && NERF.grid.best < 28.6 && NERF.grid.best > 27 && near(NERF.net.at[2400], 30, .3));
    ok('step 5 text: the grid is 64 × 64 cells with 10 numbers each, 40 960 numbers against the network’s 2476', has(T['k-nerf'], '64 × 64 个格子、每格 10 个数', '交互里的格子有 40 960 个数，网络只有 2476 个') && R.grid.G === 64 && R.grid.C === 10 && R.grid.n === 40960);
    ok('step 6 card: a 2 mm Gaussian 28 cm away projects to 140 × 0.002 / 0.28 = 1.0 pixel; one pixel from the centre α = e^-0.5 o = 0.61 o', has(T['k-gs'], '140 × 0.002 / 0.28 = 1.0 个像素', 'α = o · e-0.5 = 0.61 o') && near(140 * .002 / .28, 1, 1e-9) && Math.exp(-.5).toFixed(2) === '0.61');
    ok('step 6 text: Gaussians are added or removed every 100 steps; the random start scatters 100 of them within 8.5 cm; a step takes about half a millisecond against about twenty', has(T['k-gs'], '每隔 100 步看一次', '半径 8.5 cm 的圆里随机撒 100 个', '高斯一步约半毫秒，上一步的网络一步二十毫秒左右') && near(k.RB, .085, 1e-9));
    ok('step 7 card: 0.55 × 24.4 + 0.45 × 27.5 = 25.8 cm; the gap runs from 25.6 to 27.5 cm; the median depth is 24.4 cm', has(T['k-surf'], '平均深度 = 0.55 × 24.4 + 0.45 × 27.5 = 25.8 cm', '空的那段从 25.6 cm 到 27.5 cm', '中位深度 = 24.4 cm') && (.55 * 24.4 + .45 * 27.5).toFixed(1) === '25.8' && ((k.RC - k.HX - k.rh) * 100).toFixed(1) === '24.4' && ((k.RC - k.HX + k.rh) * 100).toFixed(1) === '25.6' && ((k.RC - k.RO) * 100).toFixed(1) === '27.5');
    ok('step 7 card: with β = 1 mm, Ψ(-3 mm) = ½ e^-3 ≈ 0.025 and Ψ(+3 mm) ≈ 0.975', has(T['k-surf'], 'Ψβ(-3 mm) = ½ e-3 ≈ 0.025，密度只有里面的 2.5%', 'Ψ ≈ 0.975') && R.psi3.toFixed(3) === '0.025' && (1 - R.psi3).toFixed(3) === '0.975');
    const M = METHODS, era = m => m.e < 1990 ? 0 : m.e < 2010 ? 1 : m.e < 2020 ? 2 : m.e < 2023 ? 3 : 4, c = f => M.filter(f).length;
    ok('step 9 text: 104 methods; 50 optimised per scene, all from 2019 on; 30 compared with a learned prior, all from 2014 on except Make3D (2009)', has(T['k-map'], '这里把 104 种放在一起', '逐场景优化的最多，50 个，全是 2019 年以后的', '用学来的先验去比的有 30 个，除了 2009 年的 Make3D，全在 2014 年以后') && M.length === 104 && c(m => m.how === 'opt') === 50 && Math.min(...M.filter(m => m.how === 'opt').map(m => m.e)) === 2019 && c(m => m.cmp === 'prior') === 30 && c(m => m.cmp === 'prior' && m.e < 2014) === 1 && M.find(m => m.cmp === 'prior' && m.e < 2014).e === 2009);
    ok('step 9 text: of the 42 methods from 2023 on, 24 optimise per scene, 12 run one forward pass and 5 generate; 14 compare geometry only, none after 2016 except one of 2019', has(T['k-map'], '2023 年以后的 42 个方法里，逐场景优化 24 个，一次前向 12 个，生成 5 个', '只比几何的 14 个，除了 DeepSDF，都不晚于 2016 年') && c(m => !m.sv && era(m) === 4) === 42 && c(m => !m.sv && era(m) === 4 && m.how === 'opt') === 24 && c(m => !m.sv && era(m) === 4 && m.how === 'ff') === 12 && c(m => !m.sv && era(m) === 4 && m.how === 'gen') === 5 && c(m => m.cmp === 'geo') === 14 && c(m => m.cmp === 'geo' && m.e > 2016) === 1 && M.find(m => m.cmp === 'geo' && m.e > 2016).e === 2019);
    ok('step 9 text: 24 Gaussian-type methods, all from 2023 on but two (2000, 2001); 31 radiance-field methods, most (26) from 2019 to 2023; 60 output new views; 9 methods from 2023 on output camera poses, more than in any earlier era', has(T['k-map'], '高斯和其他基元有 24 个，除了 2000、2001 年的面元和 EWA 泼溅，全在 2023 年以后', '辐射场（网络或格子）有 31 个，大多在 2019—2023 年', '新视角最多（60 个）', '2023 年以后有 9 个，比以前任何一个年代都多') && c(m => m.rep.includes('gauss')) === 24 && M.filter(m => m.rep.includes('gauss') && m.e < 2023).map(m => m.e).sort().join() === '2000,2001' && c(m => m.rep.includes('rfnet') || m.rep.includes('rfgrid')) === 31 && c(m => (m.rep.includes('rfnet') || m.rep.includes('rfgrid')) && m.e >= 2019 && m.e <= 2023) === 26 && c(m => m.out.includes('view')) === 60 && c(m => !m.sv && era(m) === 4 && m.out.includes('pose')) === 9 && [0, 1, 2, 3].every(e => c(m => !m.sv && era(m) === e && m.out.includes('pose')) < 9)); }

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
