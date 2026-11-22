// Check the numbers of "Camera Models and Point-Cloud Registration" (perception/index.html) against the page itself.
// Part A opens the page in a headless browser, operates each interactive the way a reader would (following the
// "先玩 / Play first" prompt literally: pressing buttons, moving sliders, dragging and tapping on the pictures with the
// mouse, letting the animations and the ICP runs finish) and compares the readouts with the numbers quoted in the
// "你会看到 / What you will see" lines; every check first requires the quoted string to be in that line. Wherever an
// interactive uses chance it draws from a seeded generator, so the readouts are the same on every run as long as the
// controls are used in the order of the prompt. Statements that no readout shows (where the epipolar lines meet, which
// pixels of the toy depth image belong to the kettle, how far each marker pair is off after a wrong label, why two
// patches slide) are recomputed inside the page with the interactive's own code, cut out of the page source and run
// unchanged (see "harness"), or with the page's shared matrix helpers (window.RX).
// Part B recomputes, with arithmetic written out in this file, the numbers quoted in the formula cards, the paragraphs
// and the figures, and requires each quoted string to be in the page.
//   usage: node check.js /absolute/path/to/perception/index.html      (takes about two minutes)
// needs Node and Playwright (npm i playwright; npx playwright install chromium)
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  if (!file) { console.log('usage: node check.js /absolute/path/to/perception/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('file://' + file); await p.waitForTimeout(700);
  await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });   // jumps, not glides: the mouse positions below are computed right after scrolling
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
    set: async (inp, v, w) => { await p.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }, [inp, v]); await p.waitForTimeout(w || 250); },
    // the readouts of this page: classes "rd", "mono" and "met" (numbers), "mat" (matrices), "status" (the sentence under them)
    rd: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .rd, #' + i + ' .mono, #' + i + ' .met')].map(m => m.innerText).join(' ## '), id).then(norm),
    mat: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .mat')].map(m => m.innerText).join(' ## '), id).then(norm),
    status: () => p.evaluate(i => [...document.querySelectorAll('#' + i + ' .status')].map(m => m.innerText).join(' ## '), id).then(norm),
    text: (sel) => p.evaluate(([i, s]) => [...document.querySelectorAll('#' + i + ' ' + s)].filter(e => e.getClientRects().length > 0).map(m => m.innerText).join(' ## '), [id, sel]).then(norm),
    row: (inp) => p.evaluate(i => { const e = document.getElementById(i); return (e.closest('.row') || e.parentElement).innerText; }, inp).then(norm),
    btns: () => p.evaluate(i => [...document.getElementById(i).querySelectorAll('button')].filter(e => e.getClientRects().length > 0).map(e => (e.classList.contains('on') ? '[x]' : '[ ]') + e.innerText.replace(/\s+/g, ' ').trim()).join(' '), id),
  });
  // the mouse on a picture: positions are given in the picture's own pixels (from its top-left corner)
  const rect = id => p.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, id);
  const view = async id => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(350); };
  const dragCv = async (id, pts) => { await view(id); const r = await rect(id); await p.mouse.move(r[0] + pts[0][0], r[1] + pts[0][1]); await p.mouse.down();
    for (const q of pts.slice(1)) await p.mouse.move(r[0] + q[0], r[1] + q[1], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200); };
  const tapCv = async (id, x, y) => { await view(id); const r = await rect(id); await p.mouse.move(r[0] + x, r[1] + y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200); };
  const has = (s, ...res) => res.every(re => (re instanceof RegExp ? re.test(s) : s.includes(re)));
  const lack = (s, ...res) => res.filter(re => !(re instanceof RegExp ? re.test(s) : s.includes(re))).join(' ¦ ');
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const sec = t => log.push('-- ' + t);
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/\u2212/g, '-')) : NaN; };
  // the visible Chinese text of a section with its folds opened
  const secText = id => p.evaluate(i => { const s = document.getElementById(i); s.querySelectorAll('details').forEach(d => d.open = true); return s.innerText; }, id).then(norm);
  // the "你会看到" line that follows each interactive, and the "先玩" prompt in front of it
  const WIDS = ['pin', 'kk', 'ds', 'rt', 'he', 'cm', 'ep', 'q', 'sm', 'pc', 'cv', 'kb', 'ic', 'ata'];
  const SEE = {}, TRY = {};
  for (const id of WIDS) {
    SEE[id] = await p.evaluate(i => { let e = document.getElementById(i).nextElementSibling; while (e && (e.tagName === 'SCRIPT' || e.tagName === 'STYLE')) e = e.nextElementSibling; return e && e.classList.contains('see') ? e.innerText : ''; }, id).then(norm);
    TRY[id] = await p.evaluate(i => { const e = document.getElementById(i).previousElementSibling; return e && e.classList.contains('try') ? e.innerText : ''; }, id).then(norm);
  }
  ok('every interactive has a "先玩" prompt in front of it and a "你会看到" line after it', WIDS.every(id => SEE[id].startsWith('你会看到：') && /^先[玩猜]/.test(TRY[id])), WIDS.filter(id => !(SEE[id].startsWith('你会看到：') && /^先[玩猜]/.test(TRY[id]))).join(' '));
  const see = (id, ...strs) => strs.every(s => SEE[id].includes(s));
  const seeMiss = (id, ...strs) => strs.filter(s => !SEE[id].includes(s)).join(' ¦ ');
  // one check: the strings are in the see line AND the readout contains what it should
  const both = (name, id, strs, readout, ...res) => ok(name, see(id, ...strs) && has(readout, ...res), 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ readout lacks: ' + lack(readout, ...res) + ' ¦¦ readout: ' + readout.slice(0, 300));
  // one check: the strings are in the see line AND a condition computed elsewhere holds
  const seeAnd = (name, id, strs, cond, got) => ok(name, see(id, ...strs) && cond, 'see line lacks: ' + seeMiss(id, ...strs) + ' ¦¦ got: ' + String(got).slice(0, 400));
  // the scripts of the interactives, for constants that no readout shows
  const SRC = await p.evaluate(ids => { const o = {}; for (const id of ids) { const t = [...document.scripts].map(s => s.textContent).find(t => t.includes("$('" + id + "-")); o[id] = t || ''; } return o; }, WIDS);
  ok('the script of every interactive was found in the page', WIDS.every(id => SRC[id].length > 500), WIDS.filter(id => !(SRC[id].length > 500)).join(' '));

  // ---------------------------------------------------------------------------------------------------------------
  // harness: pieces of the interactives' own code, cut out of the page source and run unchanged inside the page
  // ---------------------------------------------------------------------------------------------------------------
  await p.evaluate(() => {
    const srcOf = key => { const t = [...document.scripts].map(s => s.textContent).find(t => t.includes(key)); if (!t) throw new Error('no script with ' + key); return t; };
    const between = (src, a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error('no "' + a + '"'); const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error('no "' + b + '"'); return src.slice(i, j); };
    const H = window.__H = {};
    // the toy depth image of step 6: the interactive's own loop over its 32 × 24 pixels (depths Dp, kinds TG: 0 wall, 1 kettle, 2 not measured)
    H.depth = () => { const s = srcOf("$('pc-dep')"); return new Function(between(s, 'const NW=32', 'let fA=40') + ';return {Dp,TG,NW,NH,F0,CX,CY}')(); };
    // the five marker pairs of step 7: the interactive's own points and solve(), with the noise and the wrong label as arguments
    H.kb = () => { const s = srcOf("$('kb-cv')"); return new Function('X', 'const D=X.D;' + between(s, 'const MM=90', 'const St=X.stage') + ';return {solve,rot,set:(a,nzz,sw)=>{al=a;nz=nzz;swap=sw},TAU,D}')(RX); };
    // the outline of the kettle seen from above (the same function in steps 6 to 8): radius as a function of the angle
    H.rOf = () => { const s = srcOf("$('ata-cv')"); return new Function(between(s, 'const rOf=', 'const pt=') + ';return rOf')(); };
  });

  // ===================================================== Part A =====================================================
  sec('Part A · the interactives, operated along their prompts');
  let w, r, st, t;

  // ---- step 1 · pinhole (pin): the point is dragged with the mouse; the picture maps 1 m to (204 - 22) / 1.25 px
  sec('step 1 · pinhole');
  w = W('pin'); await w.show();
  { const g = await rect('pin-cv'), s = (204 - 22) / 1.25, px = (X, Z) => [g[2] / 2 + X * s, 204 - Z * s];
    ok('pin: the picture maps the point as the script says (oy = H − 96, s = (oy − 22) / ZM, ZM = 1.25)', SRC.pin.includes('H=300,ZM=1.25') && SRC.pin.includes('oy=H-96,s=(oy-22)/ZM'), '');
    r = await w.rd();
    both('pin start: 0.500 m ahead, 0.050 m to the right, x′ = 0.050 ÷ 0.500 = 0.100', 'pin', ['开始时点在相机前 0.500 m、偏右 0.050 m', 'x′ = 0.050 ÷ 0.500 = 0.100'], r, 'X = 0.050 m，Z = 0.500 m', 'x′ = X ÷ Z = 0.050 ÷ 0.500 = 0.100');
    await dragCv('pin-cv', [px(.05, .5), px(.05, 1.0)]); r = await w.rd(); st = await w.status();
    both('pin dragged away to X = 0.050 m, Z = 1.000 m: x′ = 0.050', 'pin', ['拖到 X = 0.050 m、Z = 1.000 m，x′ 只剩 0.050'], r, 'X = 0.050 m，Z = 1.000 m', '0.050 ÷ 1.000 = 0.050');
    seeAnd('pin: twice as far, half as far from the centre of the photo (0.100 → 0.050); the status calls it near-large far-small', 'pin', ['远一倍，在照片上离中心就近一半', '近大远小'], near(0.05 / 1.0, (0.05 / 0.5) / 2, 1e-12) && st.includes('近大远小'), st);
    await w.click('复位'); await w.click('沿视线拖'); r = await w.rd();
    ok('pin after "复位" and "沿视线拖": back at (0.050, 0.500), the lock is on', has(r, 'X = 0.050 m，Z = 0.500 m') && (await w.btns()).includes('[x]沿视线拖'), r);
    await dragCv('pin-cv', [px(.05, .5), px(.1, 1.0)]); r = await w.rd(); st = await w.status();
    both('pin locked to the line of sight, Z = 1.000 m: X = 0.100 m and x′ still 0.100', 'pin', ['Z 拖到 1.000 m 时，X 跟着变成 0.100 m，x′ 还是 0.100'], r, 'X = 0.100 m，Z = 1.000 m', '0.100 ÷ 1.000 = 0.100', '≅ (0.100, 1)');
    seeAnd('pin locked: the status says the point in the photo does not move and depth is lost here', 'pin', ['照片上的点一动不动', '深度就是在这一步丢掉的'], has(st, '照片上的点一动不动', '深度在这一步丢掉了'), st);
    await dragCv('pin-cv', [px(.1, 1.0), px(.3, .9), px(.4, .6)]); r = await w.rd();
    seeAnd('pin locked: pulled sideways, the point stays on the dashed line (x′ = 0.100 whatever X and Z are)', 'pin', ['点只能在橙色虚线上走'], /= 0\.100 齐次坐标/.test(r) && !r.includes('Z = 1.000'), r);
    await w.click('复位'); }

  // ---- step 2 · intrinsics (kk)
  sec('step 2 · intrinsics');
  w = W('kk'); await w.show(); r = await w.rd();
  both('kk start: u = 380.0, v = 204.0, field of view 56.1° × 43.6°', 'kk', ['(x′, y′) = (0.1, -0.06)', 'u = 600 × 0.1 + 320 = 380.0', 'v = 600 × (-0.06) + 240 = 204.0', '水平视场角 56.1°，垂直 43.6°'], r, '(x′, y′) = (0.100, -0.060)', '600×0.100 + 0×(-0.060) + 320 = 380.0', '600×(-0.060) + 240 = 204.0', '水平 56.1°，垂直 43.6°');
  ok('kk: the readout\'s arithmetic (600 × 0.1 + 320, 600 × (−0.06) + 240, 2 atan(320 / 600), 2 atan(240 / 600))', near(600 * .1 + 320, 380, 1e-9) && near(600 * -.06 + 240, 204, 1e-9) && (2 * Math.atan(320 / 600) * 180 / Math.PI).toFixed(1) === '56.1' && (2 * Math.atan(240 / 600) * 180 / Math.PI).toFixed(1) === '43.6', '');
  await w.set('kk-fx', 1200); r = await w.rd(); st = await w.status();
  both('kk focal length 1200 (linked): the orange point at (440.0, 168.0), field of view 29.9° × 22.6°', 'kk', ['橙点到了 (440.0, 168.0)', '视场角变成 29.9° 和 22.6°'], r, '= 440.0', '= 168.0', '水平 29.9°，垂直 22.6°');
  seeAnd('kk focal length 1200: f_y followed, twice as far from the principal point, the status calls it zooming', 'kk', ['离主点远了一倍', '这就是变焦'], (await w.row('kk-fy')).includes('1200 px') && (440 - 320) / (380 - 320) === 2 && (168 - 240) / (204 - 240) === 2 && st.includes('这就是变焦') && TRY.kk.includes('联动开着'), st);
  await w.click('复位'); await w.set('kk-cx', 400); r = await w.rd(); st = await w.status();
  both('kk principal point c_x = 400: u goes from 380.0 to 460.0 (80 pixels), the cells keep their size', 'kk', ['往右平移 80 像素', 'u 从 380.0 变成 460.0', '格子大小一点没变'], r + ' ' + st, '600×0.100 + 0×(-0.060) + 400 = 460.0', '格子大小一点没变');
  await w.click('复位'); await w.click('联动'); await w.set('kk-fx', 900); r = await w.rd(); st = await w.status();
  both('kk f_x alone at 900: u = 410.0, v still 204.0, squares become rectangles', 'kk', ['u = 410.0，v 还是 204.0', '正方形成了长方形'], r + ' ' + st + ' ' + await w.mat(), '900×0.100 + 0×(-0.060) + 320 = 410.0', '600×(-0.060) + 240 = 204.0', '正方形的格子被拉成了长方形', '900 0 320 0 600 240 0 0 1');
  await w.click('复位');

  // ---- step 2 · distortion (ds)
  sec('step 2 · distortion');
  w = W('ds'); await w.show(); r = await w.rd(); st = await w.status();
  both('ds start (k₁ = −0.2): radial factor 0.887 at (0.6, 0.45), 11.3% closer to the centre, barrel', 'ds', ['橙点的理想位置是 (0.6, 0.45)', '径向倍数是 0.887', '拉近了 11.3%', '桶形'], r + ' ' + st, '(x′, y′) = (0.600, 0.450)', '= 0.887', '缩短了 11.3%', '桶形畸变');
  await w.set('ds-k1', 0.2); r = await w.rd(); st = await w.status();
  both('ds k₁ = 0.2: factor 1.113, 11.3% further out, pincushion', 'ds', ['倍数 1.113', '推远 11.3%', '枕形'], r + ' ' + st, '= 1.113', '变长了 11.3%', '枕形畸变');
  await w.set('ds-k2', -0.2); r = await w.rd(); st = await w.status();
  both('ds k₁ = 0.2, k₂ = −0.2: factor 1.049, moustache', 'ds', ['倍数变成 1.049', '胡子形'], r + ' ' + st, '= 1.049', '胡子形');
  { const fac = rr => 1 + .2 * rr * rr - .2 * rr ** 4; let up = true, peak = 0; for (let i = 1; i <= 100; i++) { const a = fac((i - 1) / 100), c = fac(i / 100); if (c > a) { if (!up) peak = -1; } else if (up) { up = false; peak = (i - 1) / 100; } }
    seeAnd('ds: the curve 1 + 0.2 r² − 0.2 r⁴ first rises (to r ≈ 0.71) and then falls (back to 1 at r = 1)', 'ds', ['下面那条曲线先升后降'], near(peak, Math.SQRT1_2, .011) && Math.abs(fac(1) - 1) < 1e-12 && SRC.ds.includes('1+S.k1*r2+S.k2*r2*r2'), peak); }
  await w.set('ds-p1', 0.03); r = await w.rd(); st = await w.status();
  both('ds p₁ = 0.03: a tangential offset of (0.016, 0.029), no longer symmetric top to bottom', 'ds', ['切向偏移 (0.016, 0.029)', '画面不再上下对称'], r + ' ' + st, '= (0.016, 0.029)', '画面不再上下对称');
  ok('ds: the offset is (2 p₁ x′ y′, p₁ (r² + 2 y′²)) = (0.0162, 0.0290) at (0.6, 0.45)', (2 * .03 * .6 * .45).toFixed(3) === '0.016' && (.03 * (.5625 + 2 * .45 * .45)).toFixed(3) === '0.029', '');
  await w.click('复位');

  // ---- step 3 · extrinsics (rt)
  sec('step 3 · extrinsics');
  w = W('rt'); await w.show();
  await w.click('例 1'); r = await w.rd(); st = await w.status();
  both('rt example 1: C = (0, 0, −0.6), t = (0, 0, 0.6) = −C', 'rt', ['例 1：相机在 C = (0, 0, -0.6)', 't = (0, 0, 0.6)', 't 正好等于 -C'], r + ' ' + st, 't = (0.000, 0.000, 0.600) m', 'C = -Rᵀt = (0.000, 0.000, -0.600) m', 't 刚好等于 -C');
  await w.click('例 2'); r = await w.rd(); st = await w.status();
  both('rt example 2 (turned 90° on the spot): C unchanged, t = (−0.6, 0, 0)', 'rt', ['原地右转 90°', 'C 还是 (0, 0, -0.6)', 't 却变成了 (-0.6, 0, 0)'], r + ' ' + st, 't = (-0.600, 0.000, 0.000) m', 'C = -Rᵀt = (0.000, 0.000, -0.600) m', '原地右转 90°');
  await w.click('例 1'); await w.set('rt-a', 30); r = await w.rd(); st = await w.status();
  both('rt example 1 turned by 30°: C unchanged, t = (−0.300, 0.000, 0.520); the world turns the other way in the camera-frame picture', 'rt', ['C 一点没变，t = (-0.300, 0.000, 0.520)', '在"相机坐标系"那张图里', '反着转'], r + ' ' + st, 't = (-0.300, 0.000, 0.520) m', 'C = -Rᵀt = (0.000, 0.000, -0.600) m', '"相机坐标系"那张图里整个世界反着转', '所以 t 不是相机的位置');
  { const g = await p.evaluate(() => { const X = RX, Rwc = X.Ry(30 * X.D), R = [0, 1, 2].map(i => [Rwc[0][i], Rwc[1][i], Rwc[2][i]]), C = [0, 0, -.6], t = X.scl(X.mv(R, C), -1); return t; });
    ok('rt: t = −R C for a pan of 30° is (−0.300, 0, 0.520) (0.6 sin 30°, 0.6 cos 30°)', g[0].toFixed(3) === '-0.300' && g[2].toFixed(3) === '0.520' && (0.6 * Math.cos(Math.PI / 6)).toFixed(3) === '0.520', g); }
  await w.click('例 1');

  // ---- step 3 · hand-eye (he)
  sec('step 3 · hand-eye');
  w = W('he'); await w.show(); r = await w.rd(); st = await w.status();
  { let all0 = has(r, '差 0.0 mm'); for (const bb of [40, 100, 140]) { await w.set('he-b', bb); all0 = all0 && has(await w.rd(), '差 0.0 mm', '紫点之间最远相差 0.0 mm'); }
    seeAnd('he with the right X: every pose reads "差 0.0 mm"', 'he', ['读数里都是"差 0.0 mm"'], all0 && st.includes('X 标得准'), st); }
  await w.click('复位'); await w.set('he-e', 3); r = await w.rd(); st = await w.status();
  both('he angle error 3° (after "复位"): the purple points are up to 16.8 mm apart, this pose is off by 14.7 mm', 'he', ['最远相差 16.8 mm', '差了 14.7 mm'], r + ' ' + st, '差 14.7 mm', '紫点之间最远相差 16.8 mm', 'X 标错了一点');
  await w.click('扫一遍'); for (let i = 0; i < 40; i++) { await wait(250); if ((await w.btns()).includes(']扫一遍') && (await w.row('he-b')).includes('140°')) break; }
  { const offs = [], pts = []; for (const bb of [40, 55, 70, 85, 100, 115, 130, 140]) { await w.set('he-b', bb); r = await w.rd(); offs.push(num(r, /差 ([\d.]+) mm/)); const m = r.match(/p_base = T_base_flange · X · p_cam = \((-?[\d.]+), (-?[\d.]+)\) m/); pts.push([+m[1] - .5, +m[2]]); }
    const angs = pts.map(q => Math.atan2(q[1], q[0]) * 180 / Math.PI), span = Math.max(...angs) - Math.min(...angs);
    seeAnd('he sweep: every pose is off by 14.7 mm, in a direction that turns with the camera (the purple points lie on an arc)', 'he', ['每个姿态都差 14.7 mm', '偏的方向却跟着相机转，紫点排成了一段弧'], offs.every(v => v === 14.7) && span > 60 && pts.every(q => near(Math.hypot(q[0], q[1]) * 1000, 14.7, 1.0)), JSON.stringify([offs, angs.map(a => +a.toFixed(0))]));
    ok('he: 14.7 mm is a turn of 3° at the distance of the target from the camera, 0.28 m (2 × 0.28 × sin 1.5° = 14.66 mm)', see('he', '靶点离相机 0.28 m') && SRC.he.includes('RHO=.28') && (2 * .28 * Math.sin(1.5 * Math.PI / 180) * 1000).toFixed(1) === '14.7', 2 * .28 * Math.sin(1.5 * Math.PI / 180) * 1000); }
  await w.click('复位');

  // ---- step 4 · the whole camera (cm)
  sec('step 4 · projection');
  w = W('cm'); await w.show(); r = await w.rd();
  const uv = s => [num(s, /u = fx·x″ \+ cx = (-?[\d.]+)/), num(s, /v = fy·y″ \+ cy = (-?[\d.]+)/)];
  const uv0 = uv(r);
  both('cm start: the orange corner at pixel (364.4, 128.9), 0.540 m from the camera while the board is at 0.600 m', 'cm', ['从像素 (364.4, 128.9)', '比棋盘离相机近 6 cm'], r + ' ' + await w.mat(), 'u = fx·x″ + cx = 364.4', 'v = fy·y″ + cy = 128.9', 'X_c = R·X_w + t = (0.040, -0.100, 0.540) m', '0.000 0.000 1.000 0.600');
  await w.set('cm-fx', 900); r = await w.rd(); const uvF = uv(r);
  both('cm focal length 900: the corner at (386.7, 73.3)', 'cm', ['到 (386.7, 73.3)'], r + ' ' + await w.row('cm-fy'), 'cx = 386.7', 'cy = 73.3', '900 px');
  seeAnd('cm focal length 900: board and corner both magnified 1.5 times about the principal point (320, 240)', 'cm', ['两种办法都把棋盘放大到 1.5 倍', '它也正好放大 1.5 倍', '离主点 (320, 240) 的距离乘了 1.5'], near(900 / 600, 1.5, 1e-12) && near((uvF[0] - 320) / (uv0[0] - 320), 1.5, .005) && near((uvF[1] - 240) / (uv0[1] - 240), 1.5, .005), [uv0, uvF]);
  await w.click('复位'); await w.set('cm-d', 0.4); r = await w.rd(); const uvD = uv(r);
  both('cm camera at 0.40 m: the corner at (390.6, 63.5), now 0.340 m from the camera', 'cm', ['它到了 (390.6, 63.5)'], r, 'cx = 390.6', 'cy = 63.5', '(0.040, -0.100, 0.340) m');
  seeAnd('cm camera at 0.40 m: the board grows 0.60 ÷ 0.40 = 1.5 times, the corner 0.54 ÷ 0.34 ≈ 1.59 times', 'cm', ['放大了 0.54 ÷ 0.34 ≈ 1.59 倍，比棋盘多'], (0.6 / 0.4).toFixed(2) === '1.50' && (0.54 / 0.34).toFixed(2) === '1.59' && near((uvD[0] - 320) / (uv0[0] - 320), 0.54 / 0.34, .005) && near((uvD[1] - 240) / (uv0[1] - 240), 0.54 / 0.34, .005), [uv0, uvD]);
  await w.click('复位'); await w.click('推拉变焦'); for (let i = 0; i < 40; i++) { await wait(250); if ((await w.btns()).includes(']推拉变焦')) break; }
  r = await w.rd(); st = await w.status();
  both('cm dolly zoom ends at 0.30 m with a focal length of 300', 'cm', ['从 1.10 m 走到 0.30 m', '焦距从 1100 降到 300'], (await w.row('cm-d')) + ' ' + (await w.row('cm-fx')) + ' ' + st, '0.30 m', '300 px', '推拉变焦：');
  seeAnd('cm dolly zoom: it starts at 1.10 m and 1100 px; focal length ÷ distance stays 1000 px per metre, so the board keeps its size', 'cm', ['棋盘在画面里一样大'], SRC.cm.includes('S.d=1.1+(.3-1.1)*k') && SRC.cm.includes('S.fx=S.fy=Math.round(1000*S.d/10)*10') && near(1100 / 1.1, 1000, 1e-9) && near(300 / .3, 1000, 1e-9) && near(600 / .6, 1000, 1e-9), '');
  await w.click('复位');

  // ---- step 5 · epipolar geometry (ep): taps on the left image; image pixel (u, v) sits at (ox + u k, oy + v k) of the picture
  sec('step 5 · epipolar geometry');
  w = W('ep'); await w.show();
  { const g = await rect('ep-l'), k = Math.min(g[2] / 640, g[3] / 480), ox = (g[2] - 640 * k) / 2, oy = (g[3] - 480 * k) / 2;
    const tap = async (u, v) => { await tapCv('ep-l', ox + u * k, oy + v * k); return w.rd(); };
    const ang = s => num(s, /和水平方向夹角 ([\d.]+)°/), abc = s => { const m = s.match(/= \((-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)/); return [+m[1], +m[2], +m[3]]; };
    const top = [], bot = [], lines = [];
    for (const [u, v] of [[320, 90], [150, 100], [500, 110]]) { r = await tap(u, v); top.push(ang(r)); lines.push(abc(r)); }
    for (const [u, v] of [[320, 370], [150, 380], [500, 390]]) { r = await tap(u, v); bot.push(ang(r)); lines.push(abc(r)); }
    st = await w.status();
    seeAnd('ep before rectification: slanted lines, about 11° for taps near v = 100 (10.9° to 11.3°) and less than 5° near v = 380 (4.3° to 4.8°)', 'ep', ['v 在 100 上下', '夹 11° 左右', 'v 在 380 上下', '不到 5°', '这些线是斜的'], top.every(a => Math.round(a) === 11) && bot.every(a => a < 5 && a > 4) && st.includes('校正前的对极线是斜的'), JSON.stringify([top, bot]));
    // where the lines meet: the image of the left camera's optical centre in the right camera (computed with the interactive's own numbers)
    const epi = await p.evaluate(() => { const X = RX, D = X.D, tr = M => [0, 1, 2].map(i => [M[0][i], M[1][i], M[2][i]]), R = tr(X.mm(X.Ry(-12 * D), X.mm(X.Rx(10 * D), X.Rz(8 * D)))), T = X.scl(X.mv(R, [.08, 0, 0]), -1); return [520 * T[0] / T[2] + 320, 520 * T[1] / T[2] + 240, T[2]]; });
    const res = lines.map(l => Math.abs(l[0] * epi[0] + l[1] * epi[1] + l[2]));
    seeAnd('ep: all six lines pass through one point outside the picture (the image of the left camera\'s centre in the right camera)', 'ep', ['朝着画面外的同一个点汇聚'], SRC.ep.includes('Ry(-12*D)') && SRC.ep.includes('F=520') && SRC.ep.includes('BL=.08') && (epi[0] < 0 || epi[0] > 640 || epi[1] < 0 || epi[1] > 480) && res.every(v => v < 3), JSON.stringify([epi.map(v => +v.toFixed(1)), res.map(v => +v.toFixed(2))]));
    // a corner of the cube: its true image in the right camera lies on the line
    const cor = await p.evaluate(() => { const X = RX, D = X.D, tr = M => [0, 1, 2].map(i => [M[0][i], M[1][i], M[2][i]]), R = tr(X.mm(X.Ry(-12 * D), X.mm(X.Rx(10 * D), X.Rz(8 * D)))), T = X.scl(X.mv(R, [.08, 0, 0]), -1);
      const cr = X.mm(X.Ry(30 * D), X.Rx(20 * D)), P = X.add([.03, .02, .62], X.mv(cr, [.08, .08, .08])), c = X.add(X.mv(R, P), T); return { l: [520 * P[0] / P[2] + 320, 520 * P[1] / P[2] + 240], r: [520 * c[0] / c[2] + 320, 520 * c[1] / c[2] + 240] }; });
    r = await tap(cor.l[0], cor.l[1]); st = await w.status(); const lc = abc(r);
    seeAnd('ep: tapped on a corner of the cube, its true position in the right image (the orange ring) lies on the line', 'ep', ['点到立方体的角上', '（橙圈）正好压在线上'], st.includes('选中的是立方体的一个角，右图里它真正的位置（橙圈）正好在线上') && Math.abs(lc[0] * cor.r[0] + lc[1] * cor.r[1] + lc[2]) < 1.5, JSON.stringify([cor, lc]));
    await w.click('校正后'); const flat = [];
    for (const [u, v] of [[320, 100], [150, 380], [500, 240]]) { r = await tap(u, v); const l = abc(r); flat.push(ang(r) === 0 && l[0] === 0 && l[1] === 1 && near(-l[2], v, .6)); }
    st = await w.status();
    seeAnd('ep rectified: every angle is 0.0° and the line is the row of the tapped point (a = 0, b = 1, c = −v)', 'ep', ['夹角都是 0.0°', '线和左图的点在同一行'], flat.every(Boolean) && st.includes('和左图的点在同一行') && (await w.mat()) === '0.000 0.000 0.000 0.000 0.000 0.080 0.000 -0.080 0.000', JSON.stringify(flat) + ' ' + await w.mat());
    await w.click('校正前'); }

  // ---- step 5 · disparity and depth (q)
  sec('step 5 · disparity');
  w = W('q'); await w.show(); r = await w.rd(); const q60 = r;
  both('q disparity 60: depth 0.50 m, one pixel of disparity is 8.3 mm of depth', 'q', ['视差 60 像素时，点在 0.50 m 深', '在 0.50 m 处差 8.3 mm'], r + ' ' + await w.status(), '(0.050, -0.025, 0.500) m', '深度差 ≈ 8.3 mm', 'd = 60 像素，深度 0.50 m');
  await w.set('q-d', 120); r = await w.rd();
  both('q disparity 120: depth 0.25 m, 2.1 mm per pixel', 'q', ['视差翻倍到 120，深度减半，成了 0.25 m', '在 0.25 m 处深度只差 2.1 mm'], r + ' ' + await w.status(), '(0.025, -0.013, 0.250) m', '深度差 ≈ 2.1 mm', '深度 0.25 m');
  await w.set('q-d', 30); r = await w.rd();
  both('q disparity 30: depth 1.00 m, 33 mm per pixel', 'q', ['视差减半到 30，深度翻倍，成了 1.00 m', '在 1.00 m 处差 33 mm'], r + ' ' + await w.status(), '(0.100, -0.050, 1.000) m', '深度差 ≈ 33 mm', '深度 1.00 m');
  { const fb = 600 * .05, e = z => z * z / fb * 1000, zs = []; for (let d = 20; d <= 150; d += 10) zs.push(fb / d); const gaps = zs.slice(1).map((z, i) => zs[i] - z);
    seeAnd('q: Z = f B ÷ d with f B = 30; the error Z² ÷ (f B) is 2.08, 8.33 and 33.3 mm, four times as large at twice the distance; the grey lines (every 10 px) get closer together towards the camera', 'q', ['视差和深度成反比', '距离翻一倍，误差变成 4 倍', '灰线越往远越稀'], SRC.q.includes('F=600,CX=320,CY=240,B=.05') && e(.25).toFixed(1) === '2.1' && e(.5).toFixed(1) === '8.3' && e(1).toFixed(0) === '33' && near(e(.5) / e(.25), 4, 1e-9) && near(e(1) / e(.5), 4, 1e-9) && gaps.every((g, i) => i === 0 || g < gaps[i - 1]), JSON.stringify(gaps.map(g => +g.toFixed(3)))); }
  await w.set('q-d', 60);

  // ---- step 5 · stereo matching (sm): the generator is seeded; every "重拍一张" moves on to the next seed
  sec('step 5 · stereo matching');
  w = W('sm'); await w.show(); r = await w.rd(); st = await w.status();
  both('sm textured, 0.50 m: true disparity 14.0, matched 14, a clear minimum', 'sm', ['0.50 m 处真实视差 14.0 像素，匹配到 14', '有一个尖尖的最低点'], r + ' ' + st, '真实视差 14.0 像素', '匹配到的视差 14 像素', '有一个清楚的最低点');
  await w.set('sm-z', 0.25); r = await w.rd();
  both('sm textured, 0.25 m: 28.0 and 28', 'sm', ['0.25 m 处是 28.0 和 28'], r, '真实视差 28.0 像素', '匹配到的视差 28 像素');
  await w.set('sm-z', 1.5); r = await w.rd(); st = await w.status();
  both('sm textured, 1.50 m: true disparity 4.7, matched 5, depth 1.40 m, 10 cm off', 'sm', ['真实视差只有 4.7 像素', '取整数 5', '算出的深度是 1.40 m，差了 10 cm'], r + ' ' + st, '真实视差 4.7 像素', '匹配到的视差 5 像素', '算出来的深度 1.40 m', '深度还差 100 mm');
  ok('sm: f B = 140 px × 0.05 m = 7; 7 ÷ 1.5 = 4.67, 7 ÷ 5 = 1.40', SRC.sm.includes('const FB=7') && (await w.text('.hint')).includes('焦距 f = 140 像素，基线 B = 5 cm') && near(140 * .05, 7, 1e-12) && (7 / 1.5).toFixed(1) === '4.7' && (7 / 5).toFixed(2) === '1.40', '');
  await w.set('sm-z', 0.5); await w.click('光滑表面'); r = await w.rd(); st = await w.status();
  both('sm smooth surface, 0.50 m: matched 18, depth 0.39 m, the curve is almost flat', 'sm', ['匹配到的视差是 18，深度算成了 0.39 m', '曲线几乎是平的'], r + ' ' + st, '匹配到的视差 18 像素', '算出来的深度 0.39 m', '曲线几乎是平的');
  { const seq = []; for (let i = 0; i < 5; i++) { await w.click('重拍一张'); seq.push(num(await w.rd(), /匹配到的视差 (\d+) 像素/)); }
    seeAnd('sm smooth surface, five more shots: 21, 18, 17, 14, 23 (right only once)', 'sm', ['重拍 5 次，依次是 21、18、17、14、23', '只有一次碰巧对了'], seq.join(',') === '21,18,17,14,23' && seq.filter(v => v === 14).length === 1 && SRC.sm.includes("$('sm-re').addEventListener('click',()=>{seed++;all()})"), seq.join(',')); }
  await w.click('光滑 + 红外散斑'); r = await w.rd();
  both('sm smooth + infrared speckle: 14 again, depth 0.50 m', 'sm', ['换成红外散斑', '又是 14，深度 0.50 m'], r, '匹配到的视差 14 像素', '算出来的深度 0.50 m');

  // ---- step 6 · back-projection (pc): taps on the depth image, whose cells are 1/32 of its width
  sec('step 6 · back-projection');
  w = W('pc'); await w.show(); r = await w.rd(); st = await w.status();
  both('pc start: pixel (16, 13), depth 0.353 m, 3D point (0.004, 0.013, 0.353) m', 'pc', ['像素 (16, 13) 在壶嘴上，深度 0.353 m', '三维点 (0.004, 0.013, 0.353) m', '主点 (15.5, 11.5)'], r + ' ' + st + ' ' + await w.text('.hint'), '(u, v) = (16, 13)', '深度 Z = 0.353 m', '三维点 = (0.004, 0.013, 0.353) m', '焦距对了：壶身是圆的，壶嘴朝着相机凸出来', 'cx = 15.5、cy = 11.5');
  { const dm = await p.evaluate(() => { const o = __H.depth(); const cnt = [0, 0, 0], lo = [9, 9, 9], hi = [0, 0, 0]; o.Dp.forEach((z, i) => { const k = o.TG[i]; cnt[k]++; if (z > 0) { lo[k] = Math.min(lo[k], z); hi[k] = Math.max(hi[k], z); } });
      const i0 = 13 * o.NW + 16, z = o.Dp[i0], Xh = (16 - o.CX) * z / o.F0, Yh = (13 - o.CY) * z / o.F0; let closest = 0; o.Dp.forEach((v, i) => { if (v > 0 && v < o.Dp[closest || i0]) closest = i; });
      return { n: o.Dp.length, NW: o.NW, NH: o.NH, cnt, lo, hi, z, kind: o.TG[i0], bump: .02 * Math.exp(-(Xh * Xh + (Yh - .015) * (Yh - .015)) / (2 * .012 * .012)), holes: o.Dp.filter(v => v <= 0).length, rank: o.Dp.filter(v => v > 0 && v < z).length }; });
    seeAnd('pc: the depth image is 32 × 24 numbers; pixel (16, 13) is on the spout (the bump towards the camera is 1.8 cm of its 2 cm there; only a few pixels are nearer)', 'pc', ['深度图是 32 × 24 个数', '在壶嘴上'], dm.NW === 32 && dm.NH === 24 && dm.n === 768 && dm.kind === 1 && dm.z.toFixed(3) === '0.353' && dm.bump > .015 && dm.rank <= 3 && SRC.pc.includes('.02*Math.exp('), JSON.stringify(dm));
    seeAnd('pc: the wall pixels are 0.62 m deep, give or take (0.615 to 0.626 m)', 'pc', ['墙上的像素，深度都在 0.62 m 上下'], dm.lo[0] > .61 && dm.hi[0] < .63 && dm.lo[0].toFixed(2) === '0.62' && dm.hi[0].toFixed(2) === '0.63', JSON.stringify([dm.lo[0], dm.hi[0]]));
    const g = await rect('pc-dep'), cell = g[2] / 32;
    await tapCv('pc-dep', 16.5 * cell, 6.5 * cell); r = await w.rd();
    seeAnd('pc: a black pixel, (16, 6), has no depth and gives no point (28 such pixels)', 'pc', ['黑色的像素没测到深度，反投影不出点'], has(r, '(u, v) = (16, 6)', '这个像素没测到深度（Z = 0）') && dm.holes === 28 && dm.cnt[2] === 28, r);
    await tapCv('pc-dep', 2.5 * cell, 20.5 * cell); r = await w.rd();
    ok('pc: a wall pixel, (2, 20): depth 0.619 m', has(r, '(u, v) = (2, 20)', '深度 Z = 0.619 m'), r);
    seeAnd('pc: the kettle (176 pixels) and the unmeasured pixels hide part of the wall, which has only 564 of the 768 pixels', 'pc', ['墙上还有一块空白，那是被水壶挡住的地方', '点云里永远只有相机看得到的那一面'], dm.cnt[1] === 176 && dm.cnt[0] === 564 && dm.cnt[0] + dm.cnt[1] + dm.cnt[2] === 768, JSON.stringify(dm.cnt));
    await tapCv('pc-dep', 16.5 * cell, 13.5 * cell); }
  await w.set('pc-f', 60); st = await w.status();
  both('pc assumed focal length 60: X and Y shrink to 0.67 times, Z unchanged, squeezed narrow and long', 'pc', ['X、Y 只剩真实的 0.67 倍，Z 没变', '水壶被挤得又窄又长'], st, 'X、Y 都只剩真实的 0.67 倍，Z 没变', '水壶被挤成了左右窄、前后长的样子');
  await w.set('pc-f', 30); st = await w.status();
  both('pc assumed focal length 30: X and Y grow to 1.33 times, flattened', 'pc', ['X、Y 放大成 1.33 倍，水壶被压扁了'], st, 'X、Y 被放大成真实的 1.33 倍，Z 没变', '水壶被压成了左右宽、前后扁的样子');
  ok('pc: 40 ÷ 60 = 0.67 and 40 ÷ 30 = 1.33 (the true focal length of the toy camera is 40)', (40 / 60).toFixed(2) === '0.67' && (40 / 30).toFixed(2) === '1.33' && SRC.pc.includes('F0=40'), '');
  await w.set('pc-f', 40);

  // ---- step 6 · normals (cv): the points are regenerated from the same seed whenever the noise slider moves
  sec('step 6 · normals');
  w = W('cv'); await w.show(); r = await w.rd(); st = await w.status(); const cv0 = r;
  both('cv start (back of the kettle, k = 12): λ₁ = 52.4, λ₂ = 0.41, curvature measure 0.008, a long thin ellipse', 'cv', ['λ₁ = 52.4、λ₂ = 0.41', '弯曲程度只有 0.008', '椭圆又细又长'], r + ' ' + st + ' ' + await w.btns(), 'λ₁ = 52.4 λ₂ = 0.41', '= 0.008', '椭圆又细又长', '[x]壶身背面');
  ok('cv: the spread along the surface is over a hundred times the spread across it (52.4 ÷ 0.41 = 128)', see('cv', '一百多倍') && 52.4 / .41 > 100 && 52.4 / .41 < 200, 52.4 / .41);
  await w.set('cv-k', 40); r = await w.rd();
  both('cv k = 40: λ₂ = 10.38, curvature measure 0.018', 'cv', ['λ₂ 涨到 10.38，弯曲程度 0.018'], r, 'λ₂ = 10.38', '= 0.018');
  await w.set('cv-k', 12); ok('cv k back at 12: the readout is the one at the start', (await w.rd()) === cv0, await w.rd());
  await w.set('cv-n', 2); r = await w.rd(); st = await w.status();
  both('cv noise 2.0 mm (k = 12): λ₂ = 3.17, curvature measure 0.056, the status warns of a fat ellipse', 'cv', ['λ₂ = 3.17，弯曲程度 0.056', '状态栏提醒椭圆变胖了'], r + ' ' + st, 'λ₂ = 3.17', '= 0.056', '椭圆变胖了');
  await w.set('cv-n', 0.4); ok('cv noise back at 0.4 mm: the readout is the one at the start', (await w.rd()) === cv0, await w.rd());
  await w.click('壶嘴尖'); r = await w.rd(); st = await w.status();
  both('cv spout tip: λ₂ = 12.45, curvature measure 0.106, the surface turns a corner', 'cv', ['λ₂ = 12.45，弯曲程度 0.106', '表面在这里拐了个弯'], r + ' ' + st, 'λ₂ = 12.45', '= 0.106', '壶嘴尖附近表面拐了个弯');
  await w.click('壶身背面');

  // ---- step 7 · five marker pairs (kb)
  sec('step 7 · Kabsch');
  w = W('kb'); await w.show(); r = await w.rd(); st = await w.status(); const kb0 = r;
  both('kb start: angle 59.7° (true 60°, 1 mm of noise), residual 1.0 mm', 'kb', ['算出的转角是 59.7°，真实的是 60°', '加了 1 mm 的噪声', '对齐后的残差（每对点还差多远，取平方、平均、再开根号）是 1.0 mm'], r + ' ' + st + ' ' + await w.row('kb-n'), '= 59.7°', '对齐后的残差 RMS = 1.0 mm', '真实是 60°', '1.0 mm');
  await w.click('① 对重心', 1300); await w.click('② 转过去', 1300);
  ok('kb: the two steps move the picture, not the solution (the readout is unchanged)', (await w.rd()) === kb0, await w.rd());
  await w.click('标错一个点'); r = await w.rd(); st = await w.status();
  both('kb one point mislabelled: angle 51.2°, 8.8° off, translation 8.0 mm off, residual 15.2 mm', 'kb', ['转角成了 51.2°，偏了 8.8°，平移偏了 8.0 mm，残差涨到 15.2 mm', '4 号点'], r + ' ' + st, '= 51.2°', 'RMS = 15.2 mm', '4 号点标错了', '转角偏了 8.8°、平移偏了 8.0 mm，别的点也跟着被带偏');
  await w.click('回到开头', 1300); await w.click('① 对重心', 1300); await w.click('② 转过去', 1300);
  ok('kb mislabelled, the two steps once more: the same readout', has(await w.rd(), '= 51.2°', 'RMS = 15.2 mm'), await w.rd());
  { const g = await p.evaluate(() => { const K = __H.kb(); const run = sw => { K.set(60, 1, sw); const s = K.solve(); return { th: s.th / K.D, rms: s.rms, res: s.Pm.map((q, i) => { const a = K.rot(s.th, q); return Math.hypot(a[0] + s.t[0] - s.Qm[i][0], a[1] + s.t[1] - s.Qm[i][1]); }) }; }; return { a: run(false), b: run(true) }; });
    seeAnd('kb: with the wrong label the mislabelled pair (number 4) is 25.0 mm apart after alignment and three of the other four pairs are more than 10 mm apart (without it every pair is within 2 mm)', 'kb', ['它差了 25.0 mm', '另外四对里，有三对也差到了 10 mm 以上'], g.a.th.toFixed(1) === '59.7' && g.b.th.toFixed(1) === '51.2' && g.b.rms.toFixed(1) === '15.2' && g.a.res.every(v => v < 2) && g.b.res[3].toFixed(1) === '25.0' && g.b.res.filter((v, i) => i !== 3 && v > 10).length === 3 && g.b.res.filter((v, i) => i !== 3 && v < 2).length === 1, JSON.stringify([g.a.res.map(v => +v.toFixed(1)), g.b.res.map(v => +v.toFixed(1))])); }
  await w.click('标错一个点'); await w.click('回到开头', 1300);

  // ---- step 8 · ICP in 2D (ic): every toggle and the angle slider restart the run from the same seeded cloud
  sec('step 8 · ICP');
  w = W('ic'); await w.show();
  const icRun = async () => { await w.click('自动跑完'); for (let i = 0; i < 80; i++) { await wait(250); if ((await w.btns()).includes('已经停下了')) break; } return (await w.rd()) + ' ' + (await w.status()); };
  const icE = s => [num(s, /已迭代 (\d+) 轮/), num(s, /RMSE（ICP 看得到） ([\d.]+) mm/), num(s, /真实位置误差 ([\d.]+) mm/), num(s, /真实转角误差 ([\d.]+)°/)];
  { r = await w.rd(); const h0 = icE(r); const hist = {};
    for (let k = 1; k <= 12; k++) { await w.click('下一步', 30); await w.click('下一步', 30); if (k === 1 || k === 12) hist[k] = icE(await w.rd()); }
    seeAnd('ic ① stepped: RMSE 30.4 mm at the start, 7.5 mm after round 1, 2.5 mm after round 12, when the true error is still 9.7 mm', 'ic', ['RMSE 第 1 轮就从 30.4 mm 掉到 7.5 mm', '第 12 轮是 2.5 mm', '真实误差在第 12 轮还有 9.7 mm'], h0[1] === 30.4 && hist[1][0] === 1 && hist[1][1] === 7.5 && hist[12][0] === 12 && hist[12][1] === 2.5 && hist[12][2] === 9.7, JSON.stringify([h0, hist]));
    await w.click('重来'); r = await icRun();
    both('ic ① run to the end: stops at the limit of 60 rounds with RMSE 1.1 mm and a true error of 0.7 mm', 'ic', ['跑满 60 轮的上限才停', '到第 60 轮才降到 0.7 mm'], r, '已迭代 60 轮', 'RMSE（ICP 看得到） 1.1 mm', '真实位置误差 0.7 mm', '对上了：60 轮后停下');
    ok('ic: the limit is 60 rounds (MAXIT in the script)', SRC.ic.includes('MAXIT=60'), ''); }
  await w.click('点到面'); r = await icRun();
  both('ic ② point-to-plane: stops after 7 rounds, true error 0.4 mm', 'ic', ['② 点到面：7 轮就停，真实误差 0.4 mm'], r, '已迭代 7 轮', '真实位置误差 0.4 mm', '点到面几轮就收敛了');
  await w.click('点到面'); await w.set('ic-a', 80); r = await icRun();
  both('ic ③ from 80° (point-to-point): stops after 18 rounds, RMSE 34.1 mm, true error 122.2 mm, angle off by 129.9°', 'ic', ['18 轮后停下，RMSE 还有 34.1 mm，真实误差 122.2 mm，转角差到了 129.9°'], r, '已迭代 18 轮', 'RMSE（ICP 看得到） 34.1 mm', '真实位置误差 122.2 mm', '真实转角误差 129.9°', '卡在了局部最优');
  await w.set('ic-a', 30); await w.click('加离群点'); r = await icRun();
  both('ic ④ with 10 outliers: pulled 8.9 mm off', 'ic', ['加了 10 个离群点：结果被拉偏 8.9 mm'], r, '真实位置误差 8.9 mm', '被离群点拉偏了');
  ok('ic: the outliers are 10 points (the loop in the script)', /if\(useOut\)\{for\(let i=0;i<10;i\+\+\)/.test(SRC.ic), '');
  await w.click('剔除远点'); await w.click('点到面'); r = await icRun();
  both('ic ④ with far pairs rejected and point-to-plane: 7 rounds, true error 0.3 mm', 'ic', ['打开剔除远点和点到面以后，7 轮，真实误差 0.3 mm'], r + ' ' + await w.btns(), '已迭代 7 轮', '真实位置误差 0.3 mm', '[x]加离群点 [x]剔除远点 [x]点到面');
  await w.click('加离群点'); await w.click('剔除远点'); await w.click('点到面'); await w.click('只拍到背面'); r = await icRun();
  both('ic ⑤ back only: stops after 7 rounds with RMSE 1.0 mm, yet the true error is 22.7 mm and the angle is 16.5° off', 'ic', ['7 轮就停，RMSE 只有 1.0 mm，真实误差却有 22.7 mm，转角差 16.5°', '沿着圆弧滑到了别处'], r + ' ' + await w.btns(), '已迭代 7 轮', 'RMSE（ICP 看得到） 1.0 mm', '真实位置误差 22.7 mm', '真实转角误差 16.5°', '沿着圆弧滑到了错的位置', '[ ]加离群点 [ ]剔除远点 [ ]点到面');
  await w.click('拍到壶嘴这面');

  // ---- step 8 · which directions are held (ata)
  sec('step 8 · AᵀA');
  w = W('ata'); await w.show(); await wait(400);
  await w.click('背面一小块'); r = await w.rd(); st = await w.status();
  both('ata back, small patch: λ₃ ≈ 0, weakest direction (1.00, 0.00, 0.00), a pure rotation', 'ata', ['λ₃ ≈ 0', '(ω, tx, ty) = (1.00, 0.00, 0.00)', '纯转动'], r + ' ' + st + ' ' + await w.text('#ata-ev'), 'λ₁ : λ₂ : λ₃ = 1 : 0.100 : ≈ 0', '= (1.00, 0.00, 0.00)', '这一块会滑', '转动为主');
  await w.click('侧面一小块'); r = await w.rd(); st = await w.status();
  both('ata side, small patch: also λ₃ ≈ 0 and (1.00, 0.00, 0.00)', 'ata', ['"背面一小块"和"侧面一小块"：λ₃ ≈ 0'], r + ' ' + st, 'λ₁ : λ₂ : λ₃ = 1 : 0.043 : ≈ 0', '= (1.00, 0.00, 0.00)', '这一块是一段圆弧，所有法向量都穿过壶的中心');
  { const g = await p.evaluate(() => { const rOf = __H.rOf(), D = Math.PI / 180; const rs = a => { const o = []; for (let x = a[0]; x <= a[1]; x += 2) o.push(rOf(x * D)); return [Math.min(...o), Math.max(...o)]; }; return { back: rs([150, 210]), side: rs([90, 130]), spout: rs([-35, 35]) }; });
    seeAnd('ata: both patches (150° to 210° and 90° to 130°) lie on one circle about the centre of the kettle (radius 0.9 throughout); the spout patch does not', 'ata', ['这两块都落在同一段圆弧上', '绕着壶的中心转，每个点都还贴着表面'], near(g.back[0], .9, 1e-9) && near(g.back[1], .9, 1e-9) && near(g.side[0], .9, 1e-9) && near(g.side[1], .9, 1e-9) && g.spout[1] - g.spout[0] > .2 && await p.evaluate(() => { const h = document.getElementById('ata').innerHTML; return h.includes('data-p="180,60"') && h.includes('data-p="110,40"'); }), JSON.stringify(g)); }
  await w.click('带上壶嘴'); r = await w.rd(); st = await w.status();
  both('ata with the spout: λ₃ is 0.040 times the largest eigenvalue, all three directions are held', 'ata', ['"带上壶嘴"：λ₃ 是最大特征值的 0.040 倍'], r + ' ' + st, 'λ₁ : λ₂ : λ₃ = 1 : 0.858 : 0.040', '三个方向都约束得住');
  await w.click('大半个壶'); r = await w.rd(); st = await w.status();
  both('ata most of the kettle: 0.056 times', 'ata', ['"大半个壶"：0.056 倍'], r + ' ' + st, 'λ₁ : λ₂ : λ₃ = 1 : 0.604 : 0.056', '三个方向都约束得住');
  await w.click('背面一小块');

  // ===================================================== Part B =====================================================
  sec('Part B · numbers in the text, recomputed here');
  const SECS = ['s-map', 's-pin', 's-k', 's-rt', 's-p', 's-st', 's-pc', 's-reg', 's-icp', 's-sum'];
  const TX = {}; for (const id of SECS) TX[id] = await secText(id);
  TX.hdr = await p.evaluate(() => { const h = document.querySelector('header'); h.querySelectorAll('details').forEach(d => d.open = true); return h.innerText; }).then(norm);
  const miss = (id, strs) => strs.filter(x => !TX[id].includes(x)).join(' ¦ ');
  // one check: every string is in that section's text AND the recomputed condition holds
  const tx = (name, id, strs, cond, got) => ok(name, !miss(id, strs) && cond, 'text lacks: ' + miss(id, strs) + ' ¦¦ got: ' + String(got).slice(0, 400));
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1), f3 = v => v.toFixed(3);

  // ---- header: every interactive that uses chance draws from a seeded generator
  { const rnd = WIDS.filter(id => SRC[id].includes('Math.random')), seeded = WIDS.filter(id => /\bmk\(/.test(SRC[id])).sort().join(' ');
    tx('header: no interactive uses the browser\'s own random numbers; seeded generators in sm, pc, cv, kb and ic', 'hdr', ['用的都是固定的随机数序列', '深度图和点云上的噪声、立体匹配的"重拍一张"、标记点的噪声、ICP 的点云和离群点'], rnd.length === 0 && seeded === 'cv ic kb pc sm', rnd.join(' ') + ' / ' + seeded); }
  // ---- step 0: the small example of a matrix times a column
  tx('overview: (2 0; 1 3) times (4; 5) is (8; 19)', 's-map', ['2×4 + 0×5', '1×4 + 3×5', '8', '19'], 2 * 4 + 0 * 5 === 8 && 1 * 4 + 3 * 5 === 19, '');
  // ---- step 1
  tx('pinhole card: 0.05 ÷ 0.5 = 0.1, and 0.05 at 1 m', 's-pin', ['x′ = 0.05 ÷ 0.5 = 0.1', '挪到 1 m 远，x′ 只剩 0.05'], near(.05 / .5, .1, 1e-12) && .05 / 1 === .05, '');
  tx('homogeneous coordinates: (600, 300, 2) is the pixel (300, 150); (2, 4, 2) ≅ (1, 2, 1)', 's-pin', ['(600 ÷ 2, 300 ÷ 2) = (300, 150)', '(2, 4, 2) ≅ (1, 2, 1)'], 600 / 2 === 300 && 300 / 2 === 150 && 2 / 2 === 1 && 4 / 2 === 2, '');
  // ---- step 2
  tx('K card: 1.93 mm ÷ 0.003 mm ≈ 643 pixels; u = 643 × 0.1 + 640 = 704.3, v = 643 × (−0.06) + 360 = 321.4', 's-k', ['镜头焦距 1.93 mm，像素边长 3 µm（0.003 mm）', '1.93 ÷ 0.003 ≈ 643 像素', '1280 × 720', 'cx = 640、cy = 360', 'u = 643 × 0.1 + 640 = 704.3', 'v = 643 × (-0.06) + 360 = 321.4'], Math.round(1.93 / .003) === 643 && f1(643 * .1 + 640) === '704.3' && f1(643 * -.06 + 360) === '321.4' && 1280 / 2 === 640 && 720 / 2 === 360, [1.93 / .003, 643 * .1 + 640, 643 * -.06 + 360]);
  tx('distortion card: r² = 0.36 + 0.2025 = 0.5625, 1 + k₁r² = 0.8875, x″ = 0.5325, y″ ≈ 0.399, 11% closer', 's-k', ['r² = 0.36 + 0.2025 = 0.5625', '1 + k₁r² = 0.8875', 'x″ = 0.5325、y″ ≈ 0.399', '缩短了 11%'], near(.6 * .6, .36, 1e-12) && near(.45 * .45, .2025, 1e-12) && near(1 - .2 * .5625, .8875, 1e-12) && near(.6 * .8875, .5325, 1e-12) && f3(.45 * .8875) === '0.399' && Math.round((1 - .8875) * 100) === 11, [.6 * .8875, .45 * .8875]);
  // ---- step 3
  { const g = await p.evaluate(() => { const X = RX, Rwc = X.Ry(90 * X.D), R = [0, 1, 2].map(i => [Rwc[0][i], Rwc[1][i], Rwc[2][i]]), C = [0, 0, -.6], t = X.scl(X.mv(R, C), -1), back = X.scl(X.mv(Rwc, t), -1); return { R, t, back }; });
    const rr = g.R.map(row => row.map(v => Math.round(v)).join(',')).join(' / ');
    tx('extrinsics card: turned 90° to the right, the rows of R are (0, 0, −1), (0, 1, 0), (1, 0, 0), t = −R C = (−0.6, 0, 0) and −Rᵀt = (0, 0, −0.6)', 's-rt', ['R 的三行是 (0, 0, -1)、(0, 1, 0)、(1, 0, 0)', 't = -R C = (-0.6, 0, 0)', '反算 -Rᵀt = (0, 0, -0.6)'], rr === '0,0,-1 / 0,1,0 / 1,0,0' && near(g.t[0], -.6, 1e-9) && near(g.t[1], 0, 1e-9) && near(g.t[2], 0, 1e-9) && near(g.back[0], 0, 1e-9) && near(g.back[2], -.6, 1e-9), JSON.stringify(g)); }
  tx('hand-eye card: an error of 1° in X moves a point 30 cm from the camera by about 5 mm', 's-rt', ['X 差 1°，离相机 30 cm 的点就差 5 mm 左右'], Math.round(300 * Math.tan(Math.PI / 180)) === 5, 300 * Math.tan(Math.PI / 180));
  // ---- step 4
  { const K = [[600, 0, 320], [0, 600, 240], [0, 0, 1]], Xc = [.06, -.03, 0 + .6], h = K.map(row => row[0] * Xc[0] + row[1] * Xc[1] + row[2] * Xc[2]);
    tx('projection card: (0.06, −0.03, 0) → (0.06, −0.03, 0.6) → (228, 126, 0.6) → pixel (380, 210); 5 + 6 = 11 degrees of freedom', 's-p', ['相机坐标 (0.06, -0.03, 0.6)', '= (228, 126, 0.6)', '像素是 (380, 210)', '只有 11 个自由度', '内参 5 个', '加外参 6 个'], near(h[0], 228, 1e-9) && near(h[1], 126, 1e-9) && near(h[0] / h[2], 380, 1e-9) && near(h[1] / h[2], 210, 1e-9) && 5 + 6 === 11 && 12 - 1 === 11, h); }
  // ---- step 5
  tx('figure: a wall 0.60 m ahead, point B 0.30 m to the side: depth 0.60 m, straight line 0.67 m', 's-st', ['正前方的 A 和偏右 0.30 m 的 B，深度都是 0.60 m', '直线距离却是 0.67 m'], Math.hypot(.6, .3).toFixed(2) === '0.67', Math.hypot(.6, .3));
  tx('stereo card: (0.1, 0, 0.5) is (0.05, 0, 0.5) for the right camera; 600 × 0.2 and 600 × 0.1 differ by 60 pixels', 's-st', ['在右相机里是 (0.05, 0, 0.5)', '两者差 60 像素'], near(.1 - .05, .05, 1e-12) && near(600 * (.1 / .5) - 600 * (.05 / .5), 60, 1e-9), '');
  { const B = .08, T = [-B, 0, 0], Tx = [[0, -T[2], T[1]], [T[2], 0, -T[0]], [-T[1], T[0], 0]];
    tx('essential matrix card: for T = (−B, 0, 0) the rows of [T]× are (0, 0, 0), (0, 0, B), (0, −B, 0), so the constraint is y_r = y_l', 's-st', ['三行是 (0, 0, 0)、(0, 0, B)、(0, -B, 0)', 'B (yr - yl) = 0'], Tx[0].every(v => v === 0) && Tx[1][2] === B && Tx[2][1] === -B && Tx[1][0] === 0 && Tx[1][1] === 0 && Tx[2][0] === 0 && Tx[2][2] === 0, JSON.stringify(Tx)); }
  tx('disparity card: 640 × 0.05 ÷ 0.4 = 80 pixels, 20 pixels at 160 cm', 's-st', ['d = 640 × 0.05 ÷ 0.4 = 80 像素', '退到 160 cm，d 只剩 20 像素'], near(640 * .05 / .4, 80, 1e-9) && near(640 * .05 / 1.6, 20, 1e-9), '');
  tx('depth error card: f × B = 32; 0.4² ÷ 32 = 0.005 m = 5 mm; 80 mm at 160 cm', 's-st', ['f × B = 32', '0.4² ÷ 32 = 0.005 m，也就是 5 mm', '在 160 cm 处变成 80 mm'], near(640 * .05, 32, 1e-9) && near(.4 * .4 / 32, .005, 1e-12) && near(1.6 * 1.6 / 32 * 1000, 80, 1e-9), '');
  tx('depth error, why: one pixel in 120 is less than 1%, one pixel in 30 is more than 3%', 's-st', ['d 是 120 时错 1 像素，只错了不到百分之一', 'd 是 30 时错 1 像素，就错了百分之三还多'], 1 / 120 < .01 && 1 / 30 > .03, '');
  { const Q = [[1, 0, 0, -320], [0, 1, 0, -240], [0, 0, 0, 600], [0, 0, 1 / .05, 0]], v = [380, 210, 60, 1], h = Q.map(row => row.reduce((a, c, i) => a + c * v[i], 0));
    tx('Q card: Q (380, 210, 60, 1) = (60, −30, 600, 1200), the point (0.05, −0.025, 0.5) m; the interactive shows the same', 's-st', ['Q 乘出来是 (60, -30, 600, 1200)', '= (0.05, -0.025, 0.5) m'], h.map(x => Math.round(x)).join(',') === '60,-30,600,1200' && near(h[0] / h[3], .05, 1e-12) && near(h[1] / h[3], -.025, 1e-12) && near(h[2] / h[3], .5, 1e-12) && has(q60, '= (60, -30, 600, 1200)', '= (0.050, -0.025, 0.500) m'), h); }
  tx('stereo matching: the window of the toy matcher is 7 pixels wide (the text gives 7 × 7 as an example)', 's-st', ['比如 7×7'], SRC.sm.includes('HW=3') && (await W('sm').text('.hint')).includes('匹配窗口 7 像素宽'), '');
  // the figure of the two triangles is drawn to scale: d ÷ f = B ÷ Z in its own pixels
  { const g = await p.evaluate(() => { const fig = [...document.querySelectorAll('#s-st figure.fig')].find(f => f.innerText.includes('d ÷ f = B ÷ Z')); if (!fig) return null; const cs = [...fig.querySelectorAll('circle')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy'), +c.getAttribute('r')]); return cs; });
    const cam = g ? g.filter(c => c[2] === 3.6) : [], P = g ? g.find(c => c[2] === 4.4) : null, onPlane = g ? g.filter(c => c[2] === 3 && c[1] === 152).map(c => c[0]).sort((a, b) => a - b) : [];
    ok('figure "Z = f × B ÷ d": drawn to scale (B = 160, Z = 160, f = 44 and d = 44 of its own units, so d ÷ f = B ÷ Z)', !!g && cam.length === 2 && !!P && onPlane.length === 3 && near(Math.abs(cam[1][0] - cam[0][0]), 160, .01) && near(cam[0][1] - P[1], 160, .01) && near(cam[0][1] - 152, 44, .01) && near(onPlane[1] - onPlane[0], 44, .11) && near((onPlane[1] - onPlane[0]) / 44, 160 / 160, .01), JSON.stringify([cam, P, onPlane])); }
  // ---- step 6
  tx('back-projection card: pixel 380 is 60 cells right of 320; 60 × 0.5 ÷ 600 = 0.05 m', 's-pc', ['X = 60 × 0.5 ÷ 600 = 0.05 m'], 380 - 320 === 60 && near(60 * .5 / 600, .05, 1e-12), '');
  { const P4 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], C = [0, 1, 2].map(i => [0, 1, 2].map(j => P4.reduce((a, q) => a + q[i] * q[j], 0) / 4));
    tx('covariance card: the four neighbours (±1, 0, 0), (0, ±1, 0) give a diagonal C with (0.5, 0.5, 0), so the normal is along z', 's-pc', ['对角线是 (0.5, 0.5, 0) cm²', '对应方向 (0, 0, 1)'], C[0][0] === .5 && C[1][1] === .5 && C[2][2] === 0 && C[0][1] === 0 && C[0][2] === 0 && C[1][2] === 0, JSON.stringify(C)); }
  // ---- step 7
  { const ps = [[1, 0], [-1, 0]], qs = [[0, 1], [0, -1]]; let cr = 0, dt = 0; ps.forEach((a, i) => { cr += a[0] * qs[i][1] - a[1] * qs[i][0]; dt += a[0] * qs[i][0] + a[1] * qs[i][1]; });
    tx('Kabsch card, the 2D example: cross products add up to 2, dot products to 0, θ = atan2(2, 0) = 90°', 's-reg', ['叉积之和 = 1×1 - 0×0 + (-1)×(-1) - 0×0 = 2', '点积之和 = 0', 'θ = atan2(2, 0) = 90°'], cr === 2 && dt === 0 && Math.atan2(cr, dt) * 180 / Math.PI === 90, [cr, dt]); }
  tx('registration: a rigid transform has 6 unknowns, 3 for the rotation and 3 for the translation', 's-reg', ['一共 6 个未知数：3 个管转动，3 个管平移'], 3 + 3 === 6, '');
  // ---- step 8: a perfect sphere leaves three directions unconstrained (rank of A with rows [(p × n)ᵀ, nᵀ] is 3)
  { const rows = []; let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 60; i++) { const a = rnd() * 2 * Math.PI, z = 2 * rnd() - 1, q = Math.sqrt(1 - z * z), nn = [q * Math.cos(a), q * Math.sin(a), z], pp = [.3 + .09 * nn[0], -.2 + .09 * nn[1], .5 + .09 * nn[2]];
      rows.push([pp[1] * nn[2] - pp[2] * nn[1], pp[2] * nn[0] - pp[0] * nn[2], pp[0] * nn[1] - pp[1] * nn[0], nn[0], nn[1], nn[2]]); }
    let rank = 0; const M = rows.map(x => x.slice()); for (let c = 0, rw = 0; c < 6 && rw < M.length; c++) { let pv = rw; for (let i = rw + 1; i < M.length; i++) if (Math.abs(M[i][c]) > Math.abs(M[pv][c])) pv = i; if (Math.abs(M[pv][c]) < 1e-9) continue; [M[rw], M[pv]] = [M[pv], M[rw]]; for (let i = 0; i < M.length; i++) if (i !== rw) { const f = M[i][c] / M[rw][c]; for (let k = c; k < 6; k++) M[i][k] -= f * M[rw][k]; } rw++; rank++; }
    tx('point-to-plane card: on a perfect sphere (60 points, centre away from the origin) A has rank 3, so AᵀA has 3 eigenvalues of zero', 's-icp', ['AᵀA 就有 3 个接近 0 的特征值'], rank === 3, rank); }
  tx('ICP: the 2D interactive has one angle and two translations (AᵀA is 3×3); in 3D it is 6×6', 's-icp', ['每一轮解一个 6×6 方程'], (await W('ata').text('.hint')).includes('AᵀA 是 3×3；三维里是 3 个转角加 3 个平移，6×6'), '');
  // ---- the summary table lists the 13 matrices of the page ("a dozen or so" in the lead)
  { const nrow = await p.evaluate(() => document.querySelectorAll('#s-sum table tbody tr').length);
    tx('lead: "a dozen or so matrices": the summary table has 13 rows', 'hdr', ['十来个矩阵'], nrow === 13, nrow); }
  // ---- figures
  { const figs = await p.evaluate(() => [...document.querySelectorAll('figure.fig')].map(f => [f.closest('section').id, f.querySelector('figcaption').innerText.slice(0, 14)]));
    ok('figures: six, in steps 0, 3, 5 (three) and 8', figs.length === 6 && figs.map(f => f[0]).join(' ') === 's-map s-rt s-st s-st s-st s-icp', JSON.stringify(figs)); }
  ok('no page errors while the interactives were operated', perr.length === 0, perr.join(' | '));

  console.log(log.join('\n'));
  console.log('\n' + n + ' checks, ' + bad + ' failed; page errors: ' + perr.length + (perr.length ? ' ' + perr.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(bad || perr.length ? 1 : 0);
})();
