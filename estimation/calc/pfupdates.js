// Where is the robot at AMCL update n in the particle-filter interactive (W:pf)?  Same path, odometry errors and update
// rule as the widget's engine (update when |dx| > 0.25 m or |dy| > 0.25 m or |dθ| > 0.2 rad since the last update; the
// first scan is used at once).  No random numbers are involved in this part.
//   node pfupdates.js [update numbers …]   → pfupdates.txt
const PI = Math.PI, TAU = 2 * PI, wrap = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
function path(st, legs) { const S = []; let p = st.slice(); for (const L of legs) { const q = L[0] === 'd' ? [p[0] + L[1] * Math.cos(p[2]), p[1] + L[1] * Math.sin(p[2]), p[2]] : [p[0], p[1], p[2] + L[1]]; S.push({ a: p, b: q, T: Math.abs(L[1]) / (L[0] === 'd' ? 0.3 : 0.5) }); p = q; } return S; }
const H = PI / 2, LAP = path([1.2, 1.2, 0], [['d', 3.6], ['t', H], ['d', 2.1], ['t', H], ['d', 3.6], ['t', H], ['d', 2.1], ['t', H]]);
const TT = LAP.reduce((a, q) => a + q.T, 0);
function at(S, t) { for (const q of S) { if (t <= q.T) { const u = q.T ? t / q.T : 1; return [q.a[0] + u * (q.b[0] - q.a[0]), q.a[1] + u * (q.b[1] - q.a[1]), wrap(q.a[2] + u * (q.b[2] - q.a[2]))]; } t -= q.T; } const q = S[S.length - 1]; return [q.b[0], q.b[1], wrap(q.b[2])]; }
const DT = 0.025, B = 0.40, EB = 0.01, ER = 0.002;
let tp = 0, prev = [1.2, 1.2, 0], odo = [1.2, 1.2, 0], last = null, n = 0, dist = 0; const out = [];
while (tp < TT - 1e-9) { tp = Math.min(TT, tp + DT); const q = at(LAP, tp), p = prev;
  const ds = (q[0] - p[0]) * Math.cos(p[2]) + (q[1] - p[1]) * Math.sin(p[2]), dth = wrap(q[2] - p[2]), rr = (ds + B / 2 * dth) * (1 + ER / 2), ll = (ds - B / 2 * dth) * (1 - ER / 2), dso = (rr + ll) / 2, dto = (rr - ll) / (B * (1 + EB));
  odo = [odo[0] + dso * Math.cos(odo[2] + dto / 2), odo[1] + dso * Math.sin(odo[2] + dto / 2), wrap(odo[2] + dto)]; dist += Math.hypot(q[0] - p[0], q[1] - p[1]); prev = q.slice();
  let upd = false; if (!last) { last = odo.slice(); upd = true; } else { const dx = odo[0] - last[0], dy = odo[1] - last[1], da = wrap(odo[2] - last[2]); if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25 || Math.abs(da) > 0.2) { last = odo.slice(); upd = true; } }
  if (upd) { n++; out.push([n, tp, q[0], q[1], q[2] * 180 / PI, dist]); } }
console.log('updates in one lap: ' + n + ' (lap ' + TT.toFixed(2) + ' s, ' + dist.toFixed(2) + ' m)');
for (const k of (process.argv.slice(2).map(Number).length ? process.argv.slice(2).map(Number) : [1, 12, 17, 61, 62, 63, 73])) { const r = out[k - 1]; if (r) console.log('update ' + r[0] + ': t = ' + r[1].toFixed(2) + ' s, truth (' + r[2].toFixed(2) + ', ' + r[3].toFixed(2) + '), heading ' + r[4].toFixed(0) + ' deg, driven ' + r[5].toFixed(2) + ' m (' + (100 * r[5] / dist).toFixed(0) + ' % of the lap)'); }
