#!/usr/bin/env python3
# Page 17 "What Next, and How?" — every number the text marks as our own arithmetic.
# Run: python3 -I calcnum.py > numbers.txt   (needs numpy, scipy)
import math, heapq
import numpy as np
from scipy.ndimage import distance_transform_edt
from scipy.stats import norm

def H(t): print('\n## ' + t)

# ---------------------------------------------------------------- kitchen costmap (Nav2-style)
RES = 0.05; W, Hh = 120, 90          # 6.0 m × 4.5 m
R_INS, R_INF, K_SC = 0.30, 0.55, 3.0  # our base radius (inscribed), Nav2 default inflation radius and cost_scaling_factor
BOXES = {  # x0, x1, y0, y1  (metres, map frame, origin at the south-west corner)
    'north counter': (0.9, 6.0, 3.9, 4.5), 'fridge': (0.0, 0.9, 3.6, 4.5), 'oven cabinet': (3.0, 3.6, 3.7, 4.5),
    'south counter': (0.0, 6.0, 0.0, 0.6), 'island': (2.1, 3.9, 1.8, 2.7)}

def occupancy():
    occ = np.zeros((Hh, W), bool)
    xs = (np.arange(W) + 0.5) * RES; ys = (np.arange(Hh) + 0.5) * RES
    X, Y = np.meshgrid(xs, ys)
    for x0, x1, y0, y1 in BOXES.values():
        occ |= (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)
    occ[:, 0] = True; occ[:, -1] = True; occ[0, :] = True; occ[-1, :] = True   # walls (doors lead off the map)
    return occ, X, Y

def costmap(r_ins=R_INS, r_inf=R_INF, k=K_SC):
    occ, X, Y = occupancy()
    d = distance_transform_edt(~occ) * RES          # metres from each cell centre to the nearest obstacle cell
    c = np.where(d <= r_ins, 253.0, np.where(d <= r_inf, 252.0 * np.exp(-k * (d - r_ins)), 0.0))
    c[occ] = 254.0
    return c, d

def cell(x, y): return int(y / RES), int(x / RES)

def search(cost, start, goal, mode='astar', eps=1.0):
    # 8-connected grid search; step cost = step length (cells) × NavFn cell cost (50 + 0.8·costmap), cells ≥ 253 blocked
    trav = 50.0 + 0.8 * cost
    blocked = cost >= 253
    sr, sc = start; gr, gc = goal
    def h(r, c):
        e = math.hypot(r - gr, c - gc) * 50.0
        return {'dijkstra': 0.0, 'astar': e, 'wastar': eps * e, 'greedy': e}[mode]
    g = {start: 0.0}; parent = {}; openh = [(h(sr, sc), 0.0, start)]; closed = set(); expanded = 0
    while openh:
        f, gc0, u = heapq.heappop(openh)
        if u in closed: continue
        closed.add(u); expanded += 1
        if u == goal: break
        r, c = u
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0: continue
                v = (r + dr, c + dc)
                if not (0 <= v[0] < Hh and 0 <= v[1] < W) or blocked[v]: continue
                step = math.sqrt(2) if dr and dc else 1.0
                ng = gc0 + step * trav[v]
                if ng < g.get(v, 1e18):
                    g[v] = ng; parent[v] = u
                    key = h(*v) if mode == 'greedy' else ng + h(*v)
                    heapq.heappush(openh, (key, ng, v))
    path = [goal]
    while path[-1] != start: path.append(parent[path[-1]])
    path.reverse()
    length = sum(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(path, path[1:])) * RES
    return path, length, g[goal], expanded

H('1  Nav2 inflation layer: cost = 252·exp(−k·(d − r_ins)) for r_ins < d ≤ r_inf; NavFn cell cost = 50 + 0.8·cost')
for d in (0.30, 0.35, 0.40, 0.45, 0.50, 0.55):
    c = 253 if d <= R_INS else 252 * math.exp(-K_SC * (d - R_INS))
    print(f'  d = {d:.2f} m: cost {c:6.1f} (int {int(c)}), NavFn cell cost {50 + 0.8 * int(c):.1f} = {(50 + 0.8 * int(c)) / 50:.2f} × free')
print('  with TurtleBot default robot_radius 0.22: d = 0.50 m → cost', round(252 * math.exp(-3 * (0.50 - 0.22)), 1))
print('  north corridor 1.2 m wide (island top 2.7, counter front 3.9): centre 0.60 m from both → cost 0 (beyond 0.55)')
print('  beside the oven cabinet (front 3.7): 1.0 m wide, centre 0.50 m from both → cost', round(252 * math.exp(-3 * 0.20), 1))
print('  place pose (2.5, 3.3): 0.6 m from the counter front and the island → cost 0;  (3.0, 3.3): 0.4 m from the cabinet → cost',
      round(252 * math.exp(-3 * 0.10), 1))

H('2  Grid search on the kitchen costmap: dock (1.2, 1.2) → grasp pose (4.5, 3.3), 8-connected, 5 cm cells')
cost, dist = costmap()
S, G = cell(1.2, 1.2), cell(4.5, 3.3)
res = {}
for mode, eps in (('dijkstra', 1), ('astar', 1), ('wastar', 2), ('greedy', 1)):
    p, L, gcost, ex = search(cost, S, G, mode, eps)
    ymax = max(r for r, c in p) * RES; route = 'west (round the west end of the island)' if min(c for r, c in p) * RES < 2.0 and ymax > 3.0 and p[len(p) // 3][0] * RES > 2.0 else 'east (round the south and east of the island)'
    res[mode] = (L, gcost, ex)
    clear = min(dist[r, c] for r, c in p)
    print(f'  {mode:8s} eps={eps}: expanded {ex:5d} cells, path {L:.2f} m, cost {gcost:8.0f}, min clearance {clear:.2f} m, route {route}')
print(f'  free cells: {(cost < 253).sum()} of {W * Hh}')
for k in (1.0, 3.0, 10.0):
    c2, d2 = costmap(k=k)
    p, L, gcost, ex = search(c2, S, G, 'astar')
    side = 'west' if np.mean([c for r, c in p[: len(p) // 3]]) * RES < 1.9 else 'east'
    print(f'  cost_scaling_factor {k:4.1f}: A* path {L:.2f} m, first third mostly {side}, min clearance {min(d2[r, c] for r, c in p):.2f} m')
p, L, gcost, ex = search(cost, G, cell(2.5, 3.3), 'astar')
print(f'  grasp pose → place pose (2.5, 3.3): A* path {L:.2f} m, expanded {ex}, max cell cost on path {max(cost[r, c] for r, c in p):.0f}')

H('3  Potential field (illustrative): U = ½·k_a·|x − g|² + ½·k_r·Σ(1/ρ − 1/ρ0)² for ρ < ρ0, gradient descent')
occ, X, Y = occupancy()
dfield = distance_transform_edt(~occ) * RES
gy, gx = np.gradient(dfield, RES)
def pf(start, goal, ka=1.0, kr=0.05, rho0=0.6, step=0.01, n=4000):
    x = np.array(start, float); g = np.array(goal, float)
    for i in range(n):
        r, c = int(x[1] / RES), int(x[0] / RES)
        rho = max(dfield[r, c] - R_INS, 0.02)
        F = -ka * (x - g)
        if rho < rho0:
            mag = kr * (1 / rho - 1 / rho0) / rho**2
            F += mag * np.array([gx[r, c], gy[r, c]])
        if np.linalg.norm(x - g) < 0.05: return x, i, 'reached'
        if np.linalg.norm(F) < 1e-3: return x, i, 'stuck'
        x = x + step * F / max(np.linalg.norm(F), 1e-9) * min(1.0, np.linalg.norm(F))
    return x, n, 'stuck (no progress)' if np.linalg.norm(x - g) > 0.05 else 'reached'
for st, gl, name in (((2.5, 1.2), (2.5, 3.3), 'south of island → place pose'), ((1.2, 1.2), (4.5, 3.3), 'dock → grasp pose'),
                     ((5.4, 1.2), (2.5, 3.3), 'east aisle → place pose')):
    x, it, s = pf(st, gl)
    print(f'  {name}: {s} at ({x[0]:.2f}, {x[1]:.2f}) after {it} steps, {np.linalg.norm(x - np.array(gl)):.2f} m from the goal')

H('4  Carrying cup A of water: when does it spill? (cylinder, free surface tilts tan φ = a / g)')
g0 = 9.81; D = 0.060; R = D / 2
for dh in (0.010, 0.005, 0.002):
    a_static = 2 * g0 * dh / D
    print(f'  water {dh * 1000:.0f} mm below the rim: static limit a = 2·g·Δh / D = {a_static:.2f} m/s²; a sudden step can overshoot ×2 → {a_static / 2:.2f} m/s²')
for h in (0.03, 0.06):
    w2 = g0 * 1.8412 / R * math.tanh(1.8412 * h / R)
    print(f'  first slosh mode, R = 30 mm, water depth {h * 1000:.0f} mm: f = {math.sqrt(w2) / (2 * math.pi):.2f} Hz (period {2 * math.pi / math.sqrt(w2):.3f} s)')
print('  Nav2 Humble default acc_lim_x 2.5 m/s² (TurtleBot 3) > 1.64 m/s² → would spill a cup 10 mm from the rim on a step')
for d, v, a in ((2.0, 0.3, 0.5), (2.0, 0.3, 2.5), (2.0, 0.26, 2.5)):
    T = d / v + v / a if d >= v * v / a else 2 * math.sqrt(d / a)
    print(f'  trapezoid {d} m at v = {v} m/s, a = {a} m/s²: T = {T:.2f} s')
for j in (1.0, 5.0):
    a, v, d = 0.5, 0.3, 2.0
    # S-curve (jerk-limited) with constant-acceleration phase if v ≥ a²/j: T = d/v + v/a + a/j
    T = d / v + v / a + a / j
    print(f'  S-curve, a = 0.5 m/s², jerk {j} m/s³: ramp {a / j:.2f} s, T = {T:.2f} s')
ws = math.sqrt(g0 * 1.8412 / R * math.tanh(1.8412 * 0.06 / R))
for Tr in (0.0, 0.128, 0.256, 0.5):
    amp = 1.0 if Tr == 0 else abs(math.sin(ws * Tr / 2) / (ws * Tr / 2))
    print(f'  acceleration ramped up over {Tr:.3f} s: residual slosh = {amp:.2f} × the static tilt (overshoot peak ≈ {1 + amp:.2f} ×)')

H('5  FR3 joint move times with the datasheet limits (2.62 rad/s, 10 rad/s², 5000 rad/s³), trapezoid / S-curve')
for dq in (0.5, 1.0, 1.5):
    v, a, j = 2.62, 10.0, 5000.0
    T = dq / v + v / a if dq >= v * v / a else 2 * math.sqrt(dq / a)
    print(f'  joint 1 turns {dq} rad: trapezoid T = {T:.3f} s; MoveIt Setup Assistant scales limits to 0.1 (page 15): {dq / 0.262 + 0.262 / 1.0 if dq >= 0.262**2 / 1.0 else 2 * math.sqrt(dq / 1.0):.2f} s')

H('6  DWB (Nav2 Humble default) at 20 Hz: the dynamic window and the number of candidate trajectories')
dt = 1 / 20
print(f'  dynamic window per 50 ms step: Δv = ±{2.5 * dt:.3f} m/s (acc_lim_x 2.5), Δω = ±{3.2 * dt:.2f} rad/s (acc_lim_theta 3.2)')
print(f'  samples: vx 20 × vtheta 20 = {20 * 20} trajectories (vy samples ignored: max_vel_y 0), each simulated {1.7} s ahead')
print(f'  at 0.26 m/s, 1.7 s ahead = {0.26 * 1.7:.2f} m;  at our 0.3 m/s: {0.3 * 1.7:.2f} m')

H('7  Grasp now or look again? (page 16 budget: σ = 6.28 mm first look, 4.49 mm after moving to 0.55 m; clearance 10 mm per side)')
c = 10.0
for s in (6.28, 4.49):
    print(f'  σ = {s} mm: P(|e| < {c:.0f} mm) = 2Φ({c / s:.3f}) − 1 = {2 * norm.cdf(c / s) - 1:.4f}')
p1, p2 = 2 * norm.cdf(c / 6.28) - 1, 2 * norm.cdf(c / 4.49) - 1
t_look = 3.0
for C in (10, 20, 35, 60, 120):
    e1 = (1 - p1) * C; e2 = t_look + (1 - p2) * C
    print(f'  failure costs {C:3d} s: grasp now E = {e1:.2f} s, look again E = {t_look} + {(1 - p2) * C:.2f} = {e2:.2f} s → {"grasp now" if e1 < e2 else "look again"}')
print(f'  break-even failure cost C* = t_look / (P2 − P1) = {t_look} / {p2 - p1:.4f} = {t_look / (p2 - p1):.1f} s')

H('8  Time budget of "bring cup A to the island" (illustrative durations; speeds from the page)')
p, L1, _, _ = search(cost, S, G, 'astar')
p, L2, _, _ = search(cost, G, cell(2.5, 3.3), 'astar')
TURN90 = (math.pi / 2) / 0.5      # one 90° turn at 0.5 rad/s
ALLOW = TURN90                     # illustrative allowance for starting, cornering and stopping (about 3.1 s)
items = [('plan the path (NavFn)', 0.1), (f'drive dock → stove: {L1:.2f} m at 0.3 m/s + one 90° turn + ~3.1 s start/corner/stop (illus.)', L1 / 0.3 + TURN90 + ALLOW),
         ('first look (detect + track)', 1.0), ('look again: 0.25 m closer + detect (= t_look, §7)', t_look),
         ('plan the arm (RRTConnect + TOTG)', 0.5), ('reach, close, lift', 6.0), ('turn to face west (π/2 at 0.5 rad/s)', TURN90),
         (f'carry to the island, {L2:.2f} m at a = 0.5 m/s²', L2 / 0.3 + 0.3 / 0.5), ('turn to face south (π/2)', TURN90), ('place and release', 5.0)]
tot = 0
for name, t in items:
    tot += t; print(f'  {name:48s} {t:5.1f} s   (cumulative {tot:5.1f} s)')
print(f'  total ≈ {tot:.0f} s')
