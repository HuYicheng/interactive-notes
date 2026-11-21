// Kidnapping test on the particle-filter engine of the page (the code between ENGINE-START and ENGINE-END in the
// W:pf widget of estimation/index.html, run here in node without the drawing).
//   node pfseeds.js ../index.html [number of seeds, default 100]   → pfseeds.txt   (about 2 minutes)
// For each seed: global localisation, one lap anticlockwise, turn on random-particle recovery
// (recovery_alpha_slow 0.001 / recovery_alpha_fast 0.1), kidnap to (4.8, 1.2) facing west, then two laps clockwise.
// "Found again" = the published estimate is within 0.5 m and 30° of the truth (the same test as the widget's status line).
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || '../index.html', 'utf8');
const a = html.indexOf('// ENGINE-START'), b = html.indexOf('// ENGINE-END');
if (a < 0 || b < 0) throw new Error('engine not found');
const TAU = 2 * Math.PI;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (u < 1e-12) u = r(); const v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
const K = { rng, gauss };                                   // the page's TB.rng and TB.gauss (mulberry32, Box–Muller)
const ENG = new Function('K', html.slice(a, b) + '\nreturn ENG;')(K);
const DG = Math.PI / 180;
function lap(E) { let guard = 0; while (!E.lapDone() && guard++ < 1e6) E.step(); }
function ok(E) { const s = E.summary(); return s.err < 0.5 && s.eh <= 30 * DG; }
function run(seed, rec) {
  const E = ENG.create(seed); lap(E); const before = E.summary();
  if (rec) E.setRec(true); E.kidnap();
  const first = []; let found = -1;
  for (let L = 0; L < 2; L++) { E.nextLap(); let guard = 0; while (!E.lapDone() && guard++ < 1e6) { if (E.step() && found < 0 && ok(E)) found = E.S.updates - E.S.kid.at; } first.push(ok(E)); }
  const s = E.summary();
  return { seed, locBefore: before.one, errBefore: before.err, endLap1: first[0], endLap2: first[1], err: s.err, inj: E.S.injTotal, found };
}
const NS = +(process.argv[3] || 100);
let all = 0, loc = 0, on1 = 0, on2 = 0, off2 = 0, on2all = 0, off2all = 0; const rows = [];
for (let s = 1; s <= NS; s++) {
  const r = run(s, true), q = run(s, false); all++;
  if (r.endLap2) on2all++; if (q.endLap2) off2all++;
  if (r.locBefore) { loc++; if (r.endLap1) on1++; if (r.endLap2) on2++; if (q.endLap2) off2++; }
  rows.push(String(s).padStart(4) + '  ' + (r.locBefore ? 'one cluster ' : 'not settled ') + (100 * r.errBefore).toFixed(1).padStart(7) + ' cm | on: ' + (r.endLap1 ? 'found' : 'lost ') + ' / ' + (r.endLap2 ? 'found' : 'lost ') + ' ' + r.err.toFixed(2).padStart(5) + ' m, injected ' + String(r.inj).padStart(4) + ' | off: ' + (q.endLap2 ? 'found' : 'lost ') + ' ' + q.err.toFixed(2).padStart(5) + ' m');
}
console.log('seed  before the kidnap (error) | recovery on: end of lap 1 / lap 2, error, random particles | recovery off: end of lap 2, error');
console.log(rows.join('\n'));
console.log('seeds 1-' + NS + ': the filter had settled on one cluster before the kidnap in ' + loc + ' of ' + all + ' runs');
console.log('of those ' + loc + ': recovery on  -> found again by the end of lap 1: ' + on1 + ', by the end of lap 2: ' + on2);
console.log('of those ' + loc + ': recovery off -> found again by the end of lap 2: ' + off2 + '   (Nav2 default)');
console.log('all ' + all + ' runs (settled or not): recovery on ' + on2all + ', off ' + off2all + ' found by the end of lap 2');
const w = run(92, true), w0 = run(92, false);
console.log('seed 92 (the interactive): one cluster before: ' + w.locBefore + '; recovery on: ' + (w.endLap1 ? 'found' : 'lost') + ' by the end of lap 1, first within 0.5 m and 30 deg ' + w.found + ' updates after the kidnap, ' + w.inj + ' random particles; recovery off: ' + (w0.endLap2 ? 'found' : 'lost') + ', ' + w0.err.toFixed(2) + ' m off after two laps');
