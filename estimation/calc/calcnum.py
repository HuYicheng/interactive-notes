# Page 16 "our arithmetic": every number quoted as 我们算的 comes from here.
import math, numpy as np
rng = np.random.default_rng(16)
def h(t): print('\n## ' + t)
deg = math.pi / 180

h('1 fuse two readings (step 3)')
z1, s1, z2, s2 = 1.52, 0.03, 1.45, 0.08
w1, w2 = 1 / s1**2, 1 / s2**2
x = (w1 * z1 + w2 * z2) / (w1 + w2); s = 1 / math.sqrt(w1 + w2)
print(f'weights {w1:.1f} {w2:.2f} share {w1/(w1+w2):.3f} {w2/(w1+w2):.3f}; fused {x:.4f} m, sigma {s*1000:.2f} mm')
print(f'Mahalanobis distance between readings: {(z1-z2)/math.sqrt(s1**2+s2**2):.2f} sigma')

h('2 1D Kalman filter steady state (step 5): Q=(3 mm)^2 per step, R=(30 mm)^2, 10 Hz')
Q, R = 0.003**2, 0.03**2
p = (Q + math.sqrt(Q*Q + 4*Q*R)) / 2   # steady-state prior variance
K = p / (p + R); P = (1 - K) * p
print(f'P- {p:.3e} (sigma- {math.sqrt(p)*1000:.2f} mm)  K {K:.4f}  P {P:.3e} (sigma {math.sqrt(P)*1000:.2f} mm)')
# convergence from P0 = (0.5 m)^2
P0 = 0.25; Pk = P0; ks = []
for k in range(1, 31):
    pm = Pk + Q; Kk = pm / (pm + R); Pk = (1 - Kk) * pm; ks.append((k, Kk, math.sqrt(Pk)*1000))
print('first steps (k, K, sigma mm):', [(a, round(b, 3), round(c, 1)) for a, b, c in ks[:5]], '... k=30', [round(v, 3) for v in ks[29][1:]])
# measurements stop for 3 s (30 steps): sigma grows as sqrt(P + nQ)
print(f'after 3 s without lidar: sigma {math.sqrt(P + 30*Q)*1000:.1f} mm; after 30 s: {math.sqrt(P + 300*Q)*1000:.1f} mm')

h('3 2D KF [x, v] steady state (step 6): dt=0.1, sigma_a=0.2 m/s^2, position meas sigma 0.03 m, P0 diag(0.2^2, 0.3^2)')
dt, sa, sr = 0.1, 0.2, 0.03
F = np.array([[1, dt], [0, 1]]); H = np.array([[1.0, 0.0]])
Qm = sa**2 * np.array([[dt**4/4, dt**3/2], [dt**3/2, dt**2]]); Rm = np.array([[sr**2]])
P = np.diag([0.2**2, 0.3**2]); first = []
for k in range(500):
    Pm = F @ P @ F.T + Qm
    S = H @ Pm @ H.T + Rm; Kg = Pm @ H.T @ np.linalg.inv(S); P = (np.eye(2) - Kg @ H) @ Pm
    if k < 5: first.append((round(math.sqrt(P[0,0])*1000, 1), round(math.sqrt(P[1,1])*1000, 1), round(P[0,1]/math.sqrt(P[0,0]*P[1,1]), 3)))
print('first five posteriors (sigma_x mm, sigma_v mm/s, rho):', first)
sx, sv = math.sqrt(P[0, 0]), math.sqrt(P[1, 1]); rho = P[0, 1] / (sx * sv)
print(f'steady posterior: sigma_x {sx*1000:.1f} mm, sigma_v {sv*1000:.1f} mm/s, rho {rho:.3f}; gain K = {Kg.ravel().round(4)}')
print(f'prior: sigma_x {math.sqrt(Pm[0,0])*1000:.1f} mm, sigma_v {math.sqrt(Pm[1,1])*1000:.1f} mm/s, rho {Pm[0,1]/math.sqrt(Pm[0,0]*Pm[1,1]):.3f}')

h('4 banana (step 7): drive d=2 m straight with heading sigma')
for sth in (5, 20, 45):
    th = rng.normal(0, sth*deg, 200000); d = 2.0
    px, py = d*np.cos(th), d*np.sin(th)
    # EKF: mean (d, 0), covariance from linearisation: var_y = (d*sth)^2, var_x = 0
    ekf_sy = d * sth * deg
    inside = np.mean((py/ekf_sy)**2 <= 4)  # 1D in y (EKF has zero x-variance; check y only)
    print(f'sigma_theta {sth} deg: sample mean x {px.mean():.3f} m (EKF says 2.000), sample sigma_y {py.std():.3f} m, EKF sigma_y {ekf_sy:.3f} m, '
          f'mean pulled back {(2-px.mean())*100:.1f} cm, sample sigma_x {px.std()*100:.1f} cm')
# with along-track noise 5 % as well, fraction inside EKF 2-sigma ellipse
for sth in (5, 20, 45):
    n = 200000; th = rng.normal(0, sth*deg, n); dd = 2.0 * (1 + rng.normal(0, 0.05, n))
    px, py = dd*np.cos(th), dd*np.sin(th)
    C = np.diag([(2*0.05)**2, (2*sth*deg)**2]); Ci = np.linalg.inv(C)
    e = np.stack([px-2.0, py], 1); m2 = np.einsum('ij,jk,ik->i', e, Ci, e)
    print(f'  with 5% range noise, sigma_theta {sth}: fraction inside EKF 2-sigma ellipse {np.mean(m2<=4):.3f} (should be 0.865)')
# exact value of the same fraction: for each heading, the ellipse cuts an interval of range; integrate over heading
def inside_exact(sth_deg, d=2.0, rn=0.05, nth=20001):
    st = sth_deg*deg; sr = d*rn; sy = d*st
    th = np.linspace(-8*st, 8*st, nth); c, s_ = np.cos(th), np.sin(th)
    A = c*c/sr**2 + s_*s_/sy**2; B = -2*d*c/sr**2; Cc = d*d/sr**2 - 4
    disc = np.maximum(B*B - 4*A*Cc, 0); r1 = (-B - np.sqrt(disc))/(2*A); r2 = (-B + np.sqrt(disc))/(2*A)
    Phi = lambda u: 0.5*(1 + np.vectorize(math.erf)(u/math.sqrt(2)))
    pr = np.where(B*B - 4*A*Cc > 0, Phi((r2-d)/sr) - Phi((r1-d)/sr), 0.0)
    w = np.exp(-th**2/(2*st*st)); return float(np.sum(pr*w)/np.sum(w))
for sth in (5, 20, 45):
    print(f'  exact (quadrature): sigma_theta {sth}: inside {inside_exact(sth)*100:.1f} %, sample-mean x = 2 exp(-s^2/2) = {2*math.exp(-(sth*deg)**2/2):.3f} m')

h('5 KLD sample count as in nav2_amcl (pop_err 0.05, pop_z 0.99 used directly)')
def kld(k, err=0.05, z=0.99, nmin=500, nmax=2000):
    if k <= 1: return nmax, nmax
    b = 2/(9*(k-1)); x = 1 - b + math.sqrt(b)*z
    n = math.ceil((k-1)/(2*err) * x**3)
    return n, min(max(n, nmin), nmax)
for k in (10, 50, 100, 200, 500, 2000):
    print(f'k={k}: raw {kld(k)[0]}, clamped {kld(k)[1]}')
print('UST-10LX beams used by AMCL max_beams 60: step', (1081-1)//(60-1), 'count', len(range(0, 1081, (1081-1)//(60-1))))

h('6 D435 depth RMS error: sigma_z = z^2 * subpixel / (f_px * B)')
for xres, hfov in ((848, 90), (1280, 90)):
    f = 0.5*xres/math.tan(hfov/2*deg)
    print(f'xres {xres} f {f:.0f} px:', ', '.join(f'z={z} m -> {z*z*0.08/(f*0.050)*1000:.2f} mm' for z in (0.4, 0.8, 1.0, 2.0, 4.0)))

h('7 IMU dead reckoning (BMI055 numbers)')
print(f'gyro bias 1 deg/s -> {1*60:.0f} deg after 60 s; 0.01 deg/s -> {0.01*60:.2f} deg/min')
print(f'gyro ARW 0.014 deg/sqrt(s): 60 s -> {0.014*math.sqrt(60):.3f} deg, 1 h -> {0.014*60:.2f} deg')
g = 9.80665
for b_mg in (70, 1):
    ba = b_mg*1e-3*g
    print(f'accel bias {b_mg} mg = {ba:.4f} m/s^2: 1 s -> {0.5*ba:.3f} m, 10 s -> {0.5*ba*100:.2f} m, 60 s -> {0.5*ba*3600:.1f} m')
ga = g*math.sin(1*deg); print(f'tilt 1 deg leaks {ga:.4f} m/s^2: 10 s -> {0.5*ga*100:.2f} m')
svr = 150e-6*g; print(f'VRW {svr*1000:.3f} mm/s/sqrt(s): position sigma after 10 s {svr*10**1.5/math.sqrt(3)*1000:.1f} mm, 60 s {svr*60**1.5/math.sqrt(3)*1000:.0f} mm')
v = 0.3; bg = 0.01*deg
print(f'heading-bias lateral error, v=0.3 m/s, bias 0.01 deg/s: 60 s -> {0.5*v*bg*60**2*100:.1f} cm')

h('8 wheel odometry systematic errors (b = 0.40 m)')
b = 0.40
print(f'wheelbase 1% error: per lap (2 pi) heading error {2*math.pi*0.01:.4f} rad = {360*0.01:.1f} deg; lateral after 6 m {6*2*math.pi*0.01:.3f} m')
eps, s_ = 0.005, 4.0
print(f'wheel radius mismatch 0.5%: over 4 m heading {s_*eps/b:.3f} rad = {s_*eps/b/deg:.2f} deg, lateral {s_*s_*eps/(2*b):.3f} m')

h('9 time offsets')
print(f'80 ms latency, rotating 0.5 rad/s, cup 0.85 m from the base centre: {0.85*0.5*0.08*100:.1f} cm; driving 0.5 m/s: {0.5*0.08*100:.1f} cm')
ts = 0.025*270/360
print(f'lidar sweep 25 ms, the 270 deg field takes {ts*1000:.2f} ms: at 0.5 m/s {0.5*ts*1000:.1f} mm; rotating 0.5 rad/s {0.5*ts/deg:.2f} deg -> at 5 m {5*math.tan(0.5*ts)*100:.1f} cm')

h('10 chi-square quantiles')
try:
    from scipy.stats import chi2
    for m in (1, 2, 3):
        print(m, 'dof: 95%', round(chi2.ppf(0.95, m), 3), '99%', round(chi2.ppf(0.99, m), 3))
    for N in (10, 20):
        q = chi2.ppf(0.95, 2*N); print(f'mean of N={N} NIS values with m=2: 95% line = chi2(0.95, {2*N}) / {N} = {q:.2f} / {N} = {q/N:.2f}')
except Exception as e:
    print('scipy missing', e)

h('11 momentum observer delay')
KO, tau, thr = 50.0, 5.0, 2.0
print(f'K_O {KO}/s (time constant {1000/KO:.0f} ms): step {tau} N m crosses {thr} N m after {-math.log(1-thr/tau)/KO*1000:.1f} ms; 63% after {1000/KO:.0f} ms')

h('12 error budget for the cup (sigma, mm)')
src = {'depth noise at 0.8 m (1280 px)': 0.8**2*0.08/(640*0.05)*1000, 'detection centroid (illustrative)': 5.0,
       'camera extrinsic translation (illustrative)': 2.0, 'camera extrinsic rotation 0.2 deg at 0.8 m': 800*math.tan(0.2*deg),
       'arm absolute accuracy after kinematic calibration (assumed; datasheet <0.1 mm is repeatability)': 0.3}
tot = math.sqrt(sum(v*v for v in src.values()))
for k_, v_ in src.items(): print(f'  {k_}: {v_:.2f}')
print(f'base_link chain total {tot:.2f} mm (2 sigma {2*tot:.1f})')
mp = math.sqrt(tot**2 + 2*30.0**2); print(f'map chain (+ 2 x 30 mm localisation, illustrative) {mp:.1f} mm')
# second look: base moves 0.25 m closer (camera 0.55 m from the cup); centroid error scales with distance
z2 = 0.55
src2 = dict(src); src2['depth noise at 0.8 m (1280 px)'] = z2**2*0.08/(640*0.05)*1000; src2['detection centroid (illustrative)'] = 5.0*z2/0.8
src2['camera extrinsic rotation 0.2 deg at 0.8 m'] = z2*1000*math.tan(0.2*deg)
for k_, v_ in src2.items(): print(f'  second look {k_}: {v_:.2f}')
t2 = math.sqrt(sum(v*v for v in src2.values())); print(f'second look at {z2} m: {t2:.2f} mm (2 sigma {2*t2:.2f})')
# ellipse example of step 1 and other small numbers
S = np.array([[25.0, 6.0], [6.0, 4.0]]); w, _ = np.linalg.eigh(S)
print('ellipse sx 5 cm, sy 2 cm, rho 0.6: eigen', w.round(3), 'axes', np.sqrt(w).round(3), 'angle', round(0.5*math.degrees(math.atan2(12, 21)), 2))
print('grid cells 120*90*360 =', 120*90*360, '; lidar 2 deg at 5 m', round(5*math.tan(2*deg), 4), 'm')

h('13 occupancy log-odds')
for p_ in (0.7, 0.4):
    print(p_, round(math.log(p_/(1-p_)), 3))
l = 3*math.log(0.7/0.3); print('3 hits ->', round(l, 3), 'p', round(1-1/(1+math.exp(l)), 3))

h('14 Stanley without GPS'); print(f'1.7 m / 1300 m = {1.7/1300*100:.2f} %')

h('15 extra: small numbers in the figures and in the "what you will see" lines')
print(f'step 1: averaging 100 readings, 30/sqrt(100) = {30/math.sqrt(100):.1f} mm; depth sigma 0.8 m -> 4 m: (4/0.8)^2 = {(4/0.8)**2:.0f} times')
B_ = 0.40
print(f'step 2: wheelbase 1 % over four 90 deg corners: {360*0.01:.1f} deg; wheel-radius mismatch 0.2 % over 11.4 m of straights: {math.degrees(0.002/B_*11.4):.1f} deg; '
      f'wet patch, left wheel +10 % over 0.6 m: {math.degrees(0.1*0.6/B_):.1f} deg; gyro bias 0.05 deg/s x 50.57 s = {0.05*50.57:.1f} deg')
print(f'step 2 figure: 3.6 deg = {math.radians(3.6):.3f} rad; then 6 m straight: {6*math.radians(3.6):.2f} m sideways')
s_eq = 30/math.sqrt(2); s_tw = 1/math.sqrt(3/30**2)
print(f'step 3: two readings of 30 mm: sigma {s_eq:.1f} mm = {s_eq/30:.2f} of one; gap 270 mm / sqrt(30^2+30^2) = {270/math.hypot(30, 30):.2f}; '
      f'same reading twice: sigma {s_tw:.1f} mm, {100*(1-s_tw/s_eq):.0f} % narrower; value (2*1.52+1.25)/3 = {(2*1.52+1.25)/3:.3f} m')
print(f'step 4: 1/108 = {100/108:.2f} % per bin')
print(f'step 5 figure: K = 17.7^2/(17.7^2+30^2) = {17.7**2/(17.7**2+30**2):.3f}')
print(f'step 8: one cluster from update 62: 10.32 m of 11.40 m = {100*10.32/11.40:.0f} % of the lap (pfupdates.js)')
print(f'step 9: 0.5 rad/s x 80 ms = {math.degrees(0.5*0.080):.1f} deg; 0.50 x 0.85 x 0.080 = {100*0.5*0.85*0.080:.1f} cm; clock offset 30 ms: 0.50 x 0.85 x 0.030 = {100*0.5*0.85*0.030:.1f} cm')
g_ = math.sqrt(9.21)
print(f'step 12 figure: sqrt(9.21) = {g_:.2f}; gate radius {g_*5:.1f} mm for sigma 5 mm, {g_*21:.1f} mm for sigma 21 mm; 20 mm is {20/5:.0f} sigma and {20/21:.2f} sigma')
for KO, thr, tgt, r0, lab in ((50, 2.0, 5.0, 0.0, 'K_O 50'), (200, 2.0, 5.0, 0.0, 'K_O 200'), (5, 2.0, 5.0, 0.0, 'K_O 5'),
                              (50, 0.5, 4.7, -0.3, 'wrong model (r rests at -0.3), threshold 0.5'), (50, 2.0, 4.5, 0.0, 'motor current only (friction 0.5)')):
    print(f'step 13: {lab}: delay {-1000*math.log(1-(thr-r0)/(tgt-r0))/KO:.2f} ms')
print(f'step 13: K_O 5, after the 0.2 s push r = 5(1 - e^-1) = {5*(1-math.exp(-1)):.2f} N.m')
half = math.sqrt(1.60**2 + 2.5**2 + 2.0**2 + (800*math.tan(0.2*deg))**2 + 0.3**2)
not_ = math.sqrt(1.60**2 + 5.0**2 + (800*math.tan(0.2*deg))**2 + 0.3**2)
print(f'step 16: detection centre halved: sigma {half:.2f} mm (2 sigma {2*half:.2f}); extrinsic translation 0: sigma {not_:.2f} mm; centre share {100*25/tot**2:.0f} %')
mp2 = math.sqrt(t2**2 + 2*30.0**2)
print(f'step 16: map chain after the second look: {mp2:.1f} mm, localisation share {100*2*900/mp2**2:.0f} %; for 2 sigma < 10 mm each localisation < {math.sqrt((25-t2**2)/2):.1f} mm')
