# Page 18 (calibration): every number the text calls "我们算的 / our arithmetic".
# Run:  python3 -I calcnum.py > numbers.txt
import math
import numpy as np

def Phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))

def p_ok(b, s, c=10.0):
    """P(|e| < c) for e ~ N(b, s^2): the gripper's lateral margin is c = 10 mm (page 16)."""
    return Phi((c - b) / s) - Phi((-c - b) / s)

out = []
def say(*a):
    out.append(' '.join(str(x) for x in a))

D_FAR, D_NEAR = 0.80, 0.55          # camera -> cup A: first look, second look (page 16)
S_FAR, S_NEAR = 6.28, 4.49          # sigma of the cup position, mm (page 16)
YAW, SHIFT = 0.5, 1.0               # the story: head camera remounted, yaw off by 0.5 deg, shifted 1.0 mm (illustrative)

say('## 1 story: remounted head camera, bias at the grasp')
bF = D_FAR * 1000 * math.tan(math.radians(YAW)) + SHIFT
bN = D_NEAR * 1000 * math.tan(math.radians(YAW)) + SHIFT
say(f'yaw {YAW} deg at {D_FAR} m -> {D_FAR*1000*math.tan(math.radians(YAW)):.2f} mm; + shift {SHIFT} -> bias {bF:.2f} mm')
say(f'yaw {YAW} deg at {D_NEAR} m -> {D_NEAR*1000*math.tan(math.radians(YAW)):.2f} mm; + shift {SHIFT} -> bias {bN:.2f} mm')
say(f'no bias:  first look P = {p_ok(0, S_FAR):.4f}; second look P = {p_ok(0, S_NEAR):.4f}')
say(f'with bias: first look P = {p_ok(bF, S_FAR):.4f}; second look P = {p_ok(bN, S_NEAR):.4f}')
say(f'failures per 20 grasps: no bias {20*(1-p_ok(0,S_NEAR)):.1f}; with bias {20*(1-p_ok(bN,S_NEAR)):.1f}')
for b in (0, 5.8, 8, 10, 12):
    row = ', '.join(f's={s}: {p_ok(b, s):.3f}' for s in (6.28, 4.49, 3.0, 1.0, 0.1))
    say(f'  bias {b} mm -> {row}')
say(f'RMS error with bias {bN:.2f} and sigma {S_NEAR}: sqrt(b^2+s^2) = {math.hypot(bN, S_NEAR):.2f} mm')

say('\n## 1b looking many times from the same spot (0.55 m): only the per-look part averages away')
rand = math.hypot(1.60*(0.55/0.8)**2, 5.0*0.55/0.8)                 # depth noise + detection centre, new every look
fixed = math.sqrt(2.0**2 + (550*math.tan(math.radians(0.2)))**2 + 0.3**2)  # calibration residuals: fixed for this robot
say(f'per-look random part {rand:.2f} mm; fixed-for-this-robot part {fixed:.2f} mm (sigma over our ignorance)')
for n in (1, 4, 16, 10**9):
    s_n = math.sqrt(fixed**2 + rand**2 / n)
    say(f'  n = {n if n < 10**9 else "inf"}: sigma {s_n:.2f} mm; P(no remount bias) {p_ok(0, s_n):.4f}; P(remount bias {bN:.2f}) {p_ok(bN, s_n):.4f}')

say('\n## 2 ISO 9283: repeatability RP = mean(l) + 3 std(l) for isotropic Gaussian scatter, sigma per axis')
m3, s3 = 2 * math.sqrt(2 / math.pi), math.sqrt(3 - 8 / math.pi)       # Maxwell (3D)
m2, s2 = math.sqrt(math.pi / 2), math.sqrt(2 - math.pi / 2)           # Rayleigh (2D)
say(f'3D: mean l = {m3:.4f} s, std l = {s3:.4f} s -> RP = {m3+3*s3:.4f} s; RP 0.1 mm -> s = {0.1/(m3+3*s3)*1000:.1f} um per axis')
say(f'2D: RP = {m2+3*s2:.4f} s')
rng = np.random.default_rng(9283)
e = rng.normal(0, 0.1 / (m3 + 3 * s3), size=(30, 3))
l = np.linalg.norm(e - e.mean(0), axis=1)
say(f'30 simulated poses (seed 9283): RP = {l.mean() + 3*l.std(ddof=1):.4f} mm')

say('\n## 3 lever arms and sensitivities (cup A)')
f_depth = 640.0                                  # depth 1280 px wide, HFOV 90 (page 16)
f_rgb = 640.0 / math.tan(math.radians(69 / 2))   # colour 1280 px wide, HFOV 69 deg
say(f'f_rgb = 640/tan(34.5 deg) = {f_rgb:.1f} px; 1 px at 0.80 m = {800/f_rgb:.3f} mm; at 0.55 m = {550/f_rgb:.3f} mm')
for a in (0.05, 0.1, 0.2, 0.5, 1.0):
    say(f'  angle {a} deg: at 0.55 m {550*math.tan(math.radians(a)):.2f} mm, 0.80 m {800*math.tan(math.radians(a)):.2f} mm, 2 m {2000*math.tan(math.radians(a)):.1f} mm, 4 m {4000*math.tan(math.radians(a)):.1f} mm, 10 m {10000*math.tan(math.radians(a)):.1f} mm')
say(f'cx off by 4 px at 0.80 m: {4*800/f_rgb:.2f} mm')
say('focal length 1 % wrong: lateral error = 1 % of the lateral offset x: x = 0 -> 0; x = 0.10 m -> 1.0 mm; x = 0.40 m -> 4.0 mm')
say('depth scale 1 % wrong: 0.80 m -> 8.0 mm along the ray; 0.55 m -> 5.5 mm')
budget = [('depth noise', 1.60), ('detection centre', 5.0), ('extrinsic translation', 2.0), ('extrinsic rotation 0.2 deg at 0.8 m', 800*math.tan(math.radians(0.2))), ('arm absolute', 0.3)]
rss = math.sqrt(sum(v*v for _, v in budget)); wc = sum(v for _, v in budget)
say('page-16 budget at 0.80 m: ' + ', '.join(f'{k} {v:.2f}' for k, v in budget))
say(f'  RSS = {rss:.2f} mm; worst case (all same sign) = {wc:.2f} mm; largest term share of variance = {5.0**2/rss**2*100:.0f} %')
near = [('depth noise', 1.60*(0.55/0.8)**2), ('detection centre', 5.0*0.55/0.8), ('extrinsic translation', 2.0), ('extrinsic rotation', 550*math.tan(math.radians(0.2))), ('arm absolute', 0.3)]
say('  at 0.55 m: ' + ', '.join(f'{k} {v:.2f}' for k, v in near) + f' -> RSS {math.sqrt(sum(v*v for _,v in near)):.2f}')
say('  halve the extrinsic rotation (0.2 -> 0.1 deg) at 0.8 m: RSS ' + f'{math.sqrt(1.6**2+5**2+2**2+(800*math.tan(math.radians(0.1)))**2+0.3**2):.2f}' + '; halve detection (5 -> 2.5): ' + f'{math.sqrt(1.6**2+2.5**2+2**2+(800*math.tan(math.radians(0.2)))**2+0.3**2):.2f}')
for rho in (0, 1, -1, -0.9):
    rr = 800*math.tan(math.radians(0.2)); r5 = 550*math.tan(math.radians(0.2))
    say(f'  correlation rho {rho:+} between extrinsic translation and rotation: budget at 0.8 m {math.sqrt(1.6**2+5**2+0.3**2+2.0**2+rr**2+2*rho*2.0*rr):.2f} mm; the pair alone at 0.55 m {math.sqrt(2.0**2+r5**2+2*rho*2.0*r5):.2f} mm')
say('  averaging n readings with pairwise correlation rho: sigma_mean/sigma = sqrt(rho + (1-rho)/n); rho 0.5, n -> inf: ' + f'{math.sqrt(0.5):.3f}')
say(f'  Phi(1) = {Phi(1):.4f}, Phi(2) = {Phi(2):.4f}')

say('\n## 4 calibration as least squares: depth scale s and offset b, z_meas = (1+s) z + b + v')
def sig_z(z):  # D435 depth RMS, mm (page 16): z^2 * 0.08 / (640 * 50 mm), z in mm
    zm = z * 1000
    return zm * zm * 0.08 / (640 * 50)
def wls(zs, extra=0.5):
    J = np.array([[z * 1000, 1.0] for z in zs])      # d z_meas / d s (mm per unit s), d / d b
    w = np.array([1 / (sig_z(z)**2 + extra**2) for z in zs])
    A = J.T @ (J * w[:, None])
    C = np.linalg.inv(A)
    ss, sb = math.sqrt(C[0, 0]), math.sqrt(C[1, 1]); rho = C[0, 1] / (ss * sb)
    return ss, sb, rho, np.linalg.cond(A), C
designs = {'all at 0.80 m (x20)': [0.80]*20, '0.75-0.85 m (x20)': list(np.repeat([0.75, 0.775, 0.80, 0.825, 0.85], 4)),
           '0.4-2.0 m (x20)': list(np.repeat([0.4, 0.8, 1.2, 1.6, 2.0], 4)), '0.4 and 2.0 m only (x20)': [0.4]*10 + [2.0]*10,
           '0.4-1.2 m (x20)': list(np.repeat([0.4, 0.6, 0.8, 1.0, 1.2], 4))}
say('noise per reading: sigma_z(z) from the D435 formula plus 0.5 mm for placing the target (illustrative)')
for k, zs in designs.items():
    try:
        ss, sb, rho, cond, C = wls(zs)
        g = lambda z: math.sqrt(np.array([z*1000, 1]) @ C @ np.array([z*1000, 1]))
        say(f'  {k}: sigma_s = {ss*100:.3f} %, sigma_b = {sb:.2f} mm, rho = {rho:.3f}, cond = {cond:.3g} (columns scaled to equal length: {(1+abs(rho))/(1-abs(rho)):.3g}); predicted sigma at 0.55 m {g(0.55):.2f}, 0.8 m {g(0.8):.2f}, 2.0 m {g(2.0):.2f} mm')
    except np.linalg.LinAlgError:
        say(f'  {k}: singular (s and b cannot be separated)')
    if len(set(zs)) == 1:
        say('    (all readings at one distance: J has two proportional columns, the matrix is exactly singular; the numbers above are round-off)')

say('\n## 5 stereo depth: disparity offset dd gives dz = z^2 dd / (f B), f = 640 px, B = 50 mm')
for dd in (0.05, 0.1, 0.32):
    say(f'  dd {dd} px: ' + ', '.join(f'{z} m -> {(z*1000)**2*dd/(640*50):.2f} mm ({(z*1000)*dd/(640*50)*100:.2f} %)' for z in (0.4, 0.55, 0.8, 1.2, 2.0)))
say(f'  2 % at 2 m = 40 mm <-> dd = {40/((2000**2)/(640*50)):.2f} px')
say('  subpixel noise 0.08 px -> sigma_z: ' + ', '.join(f'{z} m {sig_z(z):.2f} mm' for z in (0.4, 0.55, 0.8, 2.0)))
# baseline (scale) error: true B' = B(1+e) -> z_meas = z / (1+e) ~ z(1 - e)
for eB in (0.005, 0.01):
    say(f'  baseline off by {eB*100:.1f} %: depth off by {eB*100:.1f} % -> 0.8 m {800*eB:.1f} mm, 2 m {2000*eB:.1f} mm')
# tare at one distance with both a disparity offset and a scale error: fix the offset only, see the residual elsewhere
dd_true, e_true = 0.1, 0.005
def zmeas(z, dd, e):
    d = 640 * 50 / (z * 1000)               # true disparity, px, with the camera's true baseline (we absorb the scale into e)
    return 640 * 50 / (d + dd) / 1000 * (1 - e)
zt = 0.8
# tare: choose dd_hat so that zmeas corrected at 0.8 m equals 0.8 m, assuming e = 0
d_meas_t = 640 * 50 / (zmeas(zt, dd_true, e_true) * 1000)
dd_hat = d_meas_t - 640 * 50 / (zt * 1000)
def zcorr(zm, dd_hat):
    d = 640 * 50 / (zm * 1000)
    return 640 * 50 / (d - dd_hat) / 1000
say(f'  example (illustrative): dd = {dd_true} px and scale -{e_true*100:.1f} %: raw error ' + ', '.join(f'{z} m {1000*(zmeas(z,dd_true,e_true)-z):+.2f}' for z in (0.4, 0.55, 0.8, 1.2, 2.0)) + ' mm')
say(f'    tare at 0.80 m (offset only): dd_hat = {dd_hat:.3f} px; residual ' + ', '.join(f'{z} m {1000*(zcorr(zmeas(z,dd_true,e_true),dd_hat)-z):+.2f}' for z in (0.4, 0.55, 0.8, 1.2, 2.0)) + ' mm')

say('\n## 6 hand-eye: translation from (R_A - I) t_X = R_X t_B - t_A; (R_A - I) has singular values 2 sin(theta/2), 2 sin(theta/2), 0')
for th in (5, 10, 20, 30, 45, 60, 90):
    say(f'  rotation {th} deg between poses: 2 sin(theta/2) = {2*math.sin(math.radians(th)/2):.3f}; noise amplification x{1/(2*math.sin(math.radians(th)/2)):.2f}')

say('\n## 7 arm')
say(f'  independent kinematic parameters 4r + 2p + 6, FR3 r = 7, p = 0: {4*7+6}')
say(f'  joint-1 offset 0.1 deg at 0.60 m from the joint-1 axis (arm base 0.25 m ahead of the base centre, illustrative): {600*math.tan(math.radians(0.1)):.2f} mm; 0.01 deg: {600*math.tan(math.radians(0.01)):.3f} mm')
say(f'  after moving 0.25 m closer the cup is 0.60 m ahead of the base centre, 0.35 m from the joint-1 axis: 0.1 deg -> {350*math.tan(math.radians(0.1)):.2f} mm')
say(f'  aluminium 23e-6 /K x 0.855 m x 10 K = {23e-6*0.855*10*1000:.3f} mm')

say('\n## 8 IMU (BMI055 datasheet values)')
say(f'  gyro noise 0.014 deg/s/sqrt(Hz) = {0.014*60:.2f} deg/sqrt(h) = {math.radians(0.014):.3e} rad/s/sqrt(Hz); x10 for Kalibr = {10*math.radians(0.014):.3e}')
say(f'  accel noise 150 ug/sqrt(Hz) = {150e-6*9.80665:.3e} m/s^2/sqrt(Hz)')
say(f'  gyro offset over temperature 0.015 deg/s/K x 20 K = {0.015*20:.2f} deg/s -> {0.015*20*60:.0f} deg in 60 s if uncorrected')
say(f'  accel offset drift 1 mg/K x 20 K = 20 mg = {0.020*9.80665:.3f} m/s^2 -> 1/2 a t^2 over 10 s = {0.5*0.020*9.80665*100:.1f} m')
say(f'  gyro scale 1 %: one full turn -> {3.6:.1f} deg; cross-axis 1 % at 0.5 rad/s -> {math.degrees(0.005):.2f} deg/s on the other axes')
say(f'  datasheet density is one-sided (0.014 x sqrt(47 Hz) = {0.014*47**0.5:.3f} deg/s rms vs 0.1 listed): std of a T-second average = 0.014/sqrt(2T): 1 s {0.014/2**0.5:.4f}, 100 s {0.014/200**0.5:.5f} deg/s')
say(f'  Allan / IEEE N = 0.014/sqrt(2) = {0.014/2**0.5:.4f} deg/s/sqrt(Hz) = {0.014/2**0.5*60:.2f} deg/sqrt(h) = {math.radians(0.014/2**0.5):.3e} rad/s/sqrt(Hz)')
ap, am, g = 9.95, -9.75, 9.80665
say(f'  six-position example (illustrative): +g reads {ap}, -g reads {am} -> bias (ap+am)/2 = {(ap+am)/2:.3f} m/s^2, scale (ap-am)/(2g) = {(ap-am)/(2*g):.4f}')

say('\n## 9 lidar on the base')
say(f'  lidar 0.20 m ahead in the URDF but really 0.22 m: turn 90 deg in place -> scans disagree by 2 sin(45 deg) x 20 mm = {2*math.sin(math.radians(45))*20:.1f} mm; 180 deg -> {2*20:.0f} mm')

say('\n## 10 time offsets: error = v dt (driving) or r w dt (turning)')
for dt in (0.2e-3, 5e-3, 30e-3, 80e-3):
    say(f'  dt {dt*1000:g} ms: 0.3 m/s -> {0.3*dt*1000:.2f} mm; turning 0.5 rad/s, cup at 0.80 m -> {0.8*0.5*dt*1000:.2f} mm; arm tip 0.25 m/s -> {0.25*dt*1000:.2f} mm')

say('\n## 11 load and tool')
for m in (0.15, 0.5):
    say(f'  load of {m} kg not configured -> fake external force {m*9.80665:.2f} N')
say(f'  centre of mass 2 cm off with 0.15 kg -> {0.15*9.80665*0.02:.3f} N m')
# pivot calibration: tip p (flange frame), pivot q (base frame): R_i p - q = -t_i ; flange position noise sigma per axis
def pivot_cov(half_deg, n=8, sigma=0.1):
    rows = []
    for i in range(n):
        az = 2 * math.pi * i / n
        a = math.radians(half_deg)
        # tool axis tilted by a from vertical towards azimuth az, no extra roll: R = Rz(az) Ry(a) Rz(-az)
        cz, sz, ca, sa = math.cos(az), math.sin(az), math.cos(a), math.sin(a)
        Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]); Ry = np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]])
        R = Rz @ Ry @ Rz.T
        rows.append(np.hstack([R, -np.eye(3)]))
    A = np.vstack(rows)
    C = np.linalg.inv(A.T @ A) * sigma**2
    return np.sqrt(np.diag(C))
for h in (5, 15, 30, 45):
    sd = pivot_cov(h)
    say(f'  pivot, 8 poses on a cone of half-angle {h} deg, 0.1 mm noise: sigma tip (x, y, z along the tool) = {sd[0]:.3f}, {sd[1]:.3f}, {sd[2]:.3f} mm')

say('\n## 15 the budget after calibration (second look, 0.55 m)')
after = [('depth noise', 1.60*(0.55/0.8)**2), ('detection centre', 5.0*0.55/0.8), ('extrinsic translation', 0.5), ('extrinsic rotation 0.05 deg', 550*math.tan(math.radians(0.05))), ('arm absolute', 0.3)]
sa = math.sqrt(sum(v*v for _, v in after))
say('  ' + ', '.join(f'{k} {v:.2f}' for k, v in after) + f' -> sigma {sa:.2f} mm, P = {p_ok(0, sa):.4f}; with 1 mm residual bias P = {p_ok(1.0, sa):.4f}')
say(f'  page-16 assumptions (2.0 mm, 0.2 deg) at 0.55 m: sigma {S_NEAR} -> P = {p_ok(0, S_NEAR):.4f}')
say(f'  skip the hand-eye recalibration after the remount: bias {bN:.2f} mm, sigma {S_NEAR} -> P = {p_ok(bN, S_NEAR):.4f}')
say(f'  arm left on the nominal model, everything else calibrated: b = 5 mm -> P = {p_ok(5, sa):.3f}; b = 3 mm -> {p_ok(3, sa):.3f}')
say('  largest residual bias that keeps P >= 0.99 with sigma ' + f'{sa:.2f}: ' + ', '.join(f'b {b} -> {p_ok(b, sa):.4f}' for b in (1.0, 1.5, 1.53, 2.0)))
say(f'  skip the hand-eye: bias {bN:.2f} and the old extrinsic sigma (2.0 mm, 0.2 deg) -> sigma {S_NEAR} -> P = {p_ok(bN, S_NEAR):.4f}; with sigma {sa:.2f} it would be {p_ok(bN, sa):.4f}')

print('\n'.join(out))
