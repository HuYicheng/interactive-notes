# Time one Gauss-Newton linear solve of a 2D pose graph (laps around a kitchen island, a node every 0.5 m,
# one loop closure per lap), sparse (scipy SuperLU) vs dense (numpy LAPACK). usage: python3 posegraph.py
import time, math, numpy as np, scipy.sparse as sp, scipy.sparse.linalg as spla
rng = np.random.default_rng(16)
def lap_poses(n):
    # rectangle 3.6 m x 2.1 m (11.4 m), nodes every 0.5 m along the perimeter
    pts = []; L = 11.4; corners = [(1.2,1.2),(4.8,1.2),(4.8,3.3),(1.2,3.3),(1.2,1.2)]
    seg = [math.dist(corners[i],corners[i+1]) for i in range(4)]
    for k in range(n):
        s = (k*0.5) % L; i = 0
        while s > seg[i]: s -= seg[i]; i += 1
        (x0,y0),(x1,y1) = corners[i],corners[i+1]; t = s/seg[i]
        pts.append((x0+t*(x1-x0), y0+t*(y1-y0), math.atan2(y1-y0, x1-x0)))
    return np.array(pts)
def system(n):
    X = lap_poses(n) + rng.normal(0, [0.05, 0.05, 0.02], (n, 3))
    per_lap = int(11.4/0.5)
    edges = [(i, i+1) for i in range(n-1)] + [(i, i-per_lap) for i in range(per_lap, n, per_lap)]
    rows, cols, vals = [], [], []; b = np.zeros(3*n); W = np.diag([1/0.02**2, 1/0.02**2, 1/0.01**2])
    for (i, j) in edges:
        xi, xj = X[i], X[j]; c, s = math.cos(xi[2]), math.sin(xi[2]); dx, dy = xj[0]-xi[0], xj[1]-xi[1]
        Ai = np.array([[-c, -s, -s*dx + c*dy], [s, -c, -c*dx - s*dy], [0, 0, -1.0]])
        Bj = np.array([[c, s, 0], [-s, c, 0], [0, 0, 1.0]])
        r = rng.normal(0, 0.01, 3)
        for (a, Ja) in ((i, Ai), (j, Bj)):
            for (bb, Jb) in ((i, Ai), (j, Bj)):
                blk = Ja.T @ W @ Jb
                for p in range(3):
                    for q in range(3):
                        rows.append(3*a+p); cols.append(3*bb+q); vals.append(blk[p, q])
            b[3*a:3*a+3] -= Ja.T @ W @ r
    H = sp.coo_matrix((vals, (rows, cols)), shape=(3*n, 3*n)).tocsc()
    H = H + sp.csc_matrix((np.r_[np.full(3, 1e6), np.zeros(3*n-3)], (np.arange(3*n), np.arange(3*n))), shape=(3*n, 3*n))  # prior on x0
    return H, b, len(edges)
def med(f, k=5):
    ts = []
    for _ in range(k):
        t = time.perf_counter(); f(); ts.append(time.perf_counter() - t)
    return sorted(ts)[k//2]
print('poses unknowns edges nnz(%) sparse_ms dense_ms')
for n in (250, 1000, 2000, 4000):
    H, b, ne = system(n)
    ts = med(lambda: spla.spsolve(H, b))
    td = med(lambda: np.linalg.solve(H.toarray(), b), 3) if n <= 2000 else float('nan')
    print(n, 3*n, ne, f'{H.nnz} ({100*H.nnz/(3*n)**2:.3f}%)', f'{ts*1000:.2f}', f'{td*1000:.1f}')
