# Page 19 "From Battery to Torque" — every number we computed ourselves.
# Run: python3 -I calc19.py > numbers.txt   (pure Python, no dependencies)
# Datasheet values are from research/facts.md; values marked ILLUSTRATIVE are our design choices for the fictional
# kitchen robot (the parts are real products).
import math

pi = math.pi
g = 9.81
def rpm(w): return w * 60 / (2 * pi)
def rad(n): return n * 2 * pi / 60
def p(*a): print(*a)
def hdr(s): print('\n' + s)

# ---------------------------------------------------------------- datasheet values
# maxon EC 45 flat 70 W, 24 V winding (651614)
V_N, n0_ds, I0, nN, tauN, IN = 24.0, 5600.0, 0.270, 4750.0, 0.134, 3.29
tau_st, I_st, R, Lh, kt, kn, grad, tm, J = 1.690, 41.9, 0.573, 0.301e-3, 0.0404, 236.0, 3.35, 6.35e-3, 181e-7
Rth1, Rth2, tw, tmot, Tmax = 6.64, 2.55, 43.1, 127.0, 125.0
alpha_cu = 0.0039
# maxon GP 42 C
# product pages: 3.5:1 (203113) = 7/2, 1 stage, 3 / 4.5 N·m, 90 %, 0.6°; 74:1 (203123) = 147/2 = 3.5·3.5·6, 3 stages, 15 / 22 N·m, 72 %, 1.0°
gp = {1: dict(cont=3.0, inter=4.5, eta=0.90, bl=0.6), 2: dict(cont=7.5, inter=11.3, eta=0.81, bl=0.8),
      3: dict(cont=15.0, inter=22.0, eta=0.72, bl=1.0)}
# EPOS4 Compact 50/5 CAN
I_cont_drv, I_max_drv, t_peak_drv, vout_frac = 5.0, 15.0, 3.0, 0.9
# battery: 8S EVE LF80
cells, v_nom_c, v_full_c, v_cut_c, Ah, Rac_c = 8, 3.2, 3.65, 2.5, 80.0, 0.5e-3
# screws (Roton)
eta_bs, eta_bs_back = 0.90, 0.80

hdr('§1 motor (EC 45 flat 70 W, 24 V)')
ke = 1 / rad(kn)                       # V per rad/s
p('k_e from speed constant = %.4f V·s/rad (k_t = %.4f N·m/A)' % (ke, kt))
p('ideal no-load speed 24 V × 236 rpm/V = %.0f rpm; datasheet %.0f rpm' % (V_N * kn, n0_ds))
tf = kt * I0
p('no-load friction torque k_t·I0 = %.1f mN·m' % (tf * 1e3))
p('model no-load speed (24 − R·I0)·k_n = %.0f rpm' % ((V_N - R * I0) * kn))
p('stall current V/R = %.1f A; stall torque = %.3f N·m' % (V_N / R, kt * V_N / R))
gr = R / kt**2
p('gradient R/k_t² = %.1f rad/s per N·m = %.2f rpm/mN·m' % (gr, rpm(gr) / 1000))
p('mechanical time constant R·J/k_t² = %.2f ms' % (R * J / kt**2 * 1e3))
p('nominal: k_t × I_N = %.1f mN·m (sheet 134)' % (kt * IN * 1e3))
p('cold line at 134 mN·m: %.0f rpm (sheet nominal speed 4750)' % (n0_ds - grad * 134))
w0 = rad(n0_ds)
p('max mechanical power ≈ τ_stall·ω0/4 = %.0f W (theoretical, cold, short)' % (tau_st * w0 / 4))
# operating points
for name, tau, n in [('lift hold (design 2)', 0.0716, 0), ('lift raise 0.1 m/s', 0.0716, 4200)]:
    I = (tau + (tf if n > 0 else 0)) / kt
    Pcu = I * I * R
    Pm = tau * rad(n)
    Pin = Pcu + ke * rad(n) * I
    p('%-22s τ=%.4f N·m n=%4.0f rpm I=%.2f A P_mech=%.1f W P_cu=%.2f W P_in=%.1f W eff=%.0f%%' %
      (name, tau, n, I, Pm, Pcu, Pin, 100 * Pm / Pin if Pin > 0 else 0))
for V in [24.0, 25.6 * 0.9, 21.0 * 0.9, 20.0 * 0.9]:
    p('voltage %.2f V at motor: no-load ≈ %.0f rpm; at 0.0716 N·m ≈ %.0f rpm' %
      (V, (V - R * I0) * kn, (V - R * I0) * kn - grad * 71.6))

hdr('§2 heat (two-node model: winding C_w = τ_w/R_th1, housing C_h = τ_motor/R_th2)')
Cw, Ch = tw / Rth1, tmot / Rth2
p('C_w = %.2f J/K, C_h = %.1f J/K, R_th total %.2f K/W' % (Cw, Ch, Rth1 + Rth2))
p('allowed loss at 25 °C ambient: 100 K / %.2f = %.2f W' % (Rth1 + Rth2, 100 / (Rth1 + Rth2)))
Rhot = R * (1 + alpha_cu * (Tmax - 25))
p('R at 125 °C = %.3f Ω (+%.0f%%)' % (Rhot, 100 * alpha_cu * 100))
p('copper-only continuous current for 125 °C: %.2f A (sheet 3.29 A)' % math.sqrt(100 / ((Rth1 + Rth2) * Rhot)))
def steady(I, Ta=25.0):
    # ΔT = I² R25 (1 + α ΔT') (Rth1+Rth2), ΔT' = T_w − 25
    T = Ta
    for _ in range(200):
        T = Ta + I * I * R * (1 + alpha_cu * (T - 25)) * (Rth1 + Rth2)
    return T
for I in [1.77, 3.29, 3.70, 5.0]:
    p('steady winding temperature at %.2f A (copper only, 25 °C ambient): %.1f °C' % (I, steady(I)))
for Ta in [25, 35, 45]:
    p('derating: ambient %d °C → I_cont ≈ 3.29 × sqrt((125−%d)/100) = %.2f A' % (Ta, Ta, 3.29 * math.sqrt((125 - Ta) / 100)))
def sim_heat(Ifun, T_end, dt=0.01, Ta=25.0):
    Tw = Th = Ta; t = 0.0; hit = None
    while t < T_end:
        I = Ifun(t)
        P = I * I * R * (1 + alpha_cu * (Tw - 25))
        dTw = (P - (Tw - Th) / Rth1) / Cw
        dTh = ((Tw - Th) / Rth1 - (Th - Ta) / Rth2) / Ch
        Tw += dTw * dt; Th += dTh * dt; t += dt
        if hit is None and Tw >= Tmax: hit = t
    return Tw, Th, hit
Tw, Th, hit = sim_heat(lambda t: 11.17, 120)
p('first design holding at 11.17 A (if the drive allowed it): winding reaches 125 °C after %.1f s' % hit)
Tw, Th, hit = sim_heat(lambda t: 3.29, 3000)
p('3.29 A for 3000 s: T_w %.1f °C, T_h %.1f °C' % (Tw, Th))
Tw, Th, hit = sim_heat(lambda t: 1.77, 3000)
p('1.77 A (design-2 hold) for 3000 s: T_w %.1f °C' % Tw)
# duty cycle of design 2: raise 4.2 s at ~2.04 A (incl. accel 0.2 s at 2.96 A), hold 30 s at 1.77 A, lower 4.2 s at ~0.9 A, idle 20 s
seg = [(0.2, 2.96), (4.0, 2.04), (0.2, 1.0), (30.0, 1.77), (4.2, 0.9), (20.0, 0.0)]
T = sum(s[0] for s in seg); Irms = math.sqrt(sum(s[0] * s[1]**2 for s in seg) / T)
p('design-2 duty cycle %.1f s: RMS current %.2f A (motor continuous 3.29 A)' % (T, Irms))

hdr('§3 battery and power budget (8S EVE LF80, ILLUSTRATIVE pack)')
p('pack: nominal %.1f V, full %.1f V, cut-off %.1f V, %.0f Ah → %.0f Wh' %
  (cells * v_nom_c, cells * v_full_c, cells * v_cut_c, Ah, cells * v_nom_c * Ah))
p('cells AC resistance 8 × 0.5 mΩ = %.1f mΩ; pack incl. BMS, fuse, cables 30 mΩ (ILLUSTRATIVE)' % (cells * Rac_c * 1e3))
p('1C = 80 A, 3C = 240 A (cells); mass of cells %.1f kg' % (cells * 1.63))
budget = [('Jetson AGX Thor (40–130 W; take 100 W)', 100), ('real-time PC (ILLUSTRATIVE)', 35),
          ('FR3 controller ~80 W via inverter η 0.90', 80 / 0.90), ('sensors, switch, MCU (ILLUSTRATIVE)', 15),
          ('wheels, average (ours)', 10), ('lift, average (ours)', 2)]
tot = sum(b[1] for b in budget)
for b in budget: p('  %-44s %5.1f W  (%2.0f%%)' % (b[0], b[1], 100 * b[1] / tot))
p('  total %.0f W → %.1f A at 25.6 V; runtime 2048 Wh / %.0f W = %.1f h' % (tot, tot / 25.6, tot, 2048 / tot))
tot2 = tot + 30
p('  with Thor at 130 W: %.0f W → %.1f h' % (tot2, 2048 / tot2))
p('  motors (wheels + lift) share of the average: %.0f%%' % (100 * 12 / tot))
for I in [10, 30, 60]:
    p('sag at %d A × 30 mΩ = %.2f V' % (I, I * 0.030))
# rolling and wheels
m_robot = 100.0; crr = 0.015; r_w = 0.08; b_w = 0.40
Frr = m_robot * g * crr
p('rolling resistance (100 kg, c_rr 0.015, ILLUSTRATIVE): %.1f N; at 0.3 m/s %.1f W' % (Frr, Frr * 0.3))

hdr('§4 gear ratio, reflected inertia')
N_wh = 74; eta_wh = gp[3]['eta']   # wheel gearhead: GP 42 C 74:1, three stages
Jref_wheel = J * N_wh**2
m_ref_wheel = 2 * Jref_wheel / r_w**2
p('wheel: J_m × 74² = %.4f kg·m² per wheel; both wheels as mass at the rim: %.1f kg' % (Jref_wheel, m_ref_wheel))
p('wheel continuous torque from the motor: 0.134 × 74 × 0.72 = %.2f N·m (gearhead continuous 15 N·m → the motor limits)' % (tauN * N_wh * eta_wh))
Ilim = gp[3]['inter'] / (N_wh * eta_wh * kt)
p('current limit to protect the gearhead (22 N·m intermittent): %.2f A' % Ilim)
p('motor peak with drive 15 A: %.3f N·m → at wheel %.1f N·m (would exceed 22)' % (kt * 15, kt * 15 * N_wh * eta_wh))
v_top = rad(n0_ds - grad * 50) / N_wh * r_w
p('wheel top speed at light load (5432 rpm /74, r 0.08): %.3f m/s' % v_top)
F2 = 2 * gp[3]['inter'] / r_w
p('base: 2 × 22 N·m / 0.08 = %.1f N → accel (100 kg + %.0f kg reflected) %.2f m/s²' % (F2, m_ref_wheel, (F2 - Frr) / (m_robot + m_ref_wheel)))
F05 = (m_robot + m_ref_wheel) * 0.5 + Frr
tw05 = F05 / 2 * r_w
p('0.5 m/s²: force %.1f N, wheel torque %.2f N·m each, motor current %.2f A' % (F05, tw05, tw05 / (N_wh * eta_wh * kt)))
# lift
F_lift = 26.0 * g
p('lift load 26 kg (FR3 18.3 + Hand 0.73 + payload 3 + carriage ~4, ILLUSTRATIVE): F = %.1f N' % F_lift)
for name, L, N, eta_g in [('design 1: lead 10 mm, direct', 0.010, 1.0, 1.0), ('design 2: lead 5 mm + 3.5:1', 0.005, 3.5, 0.90)]:
    k = 2 * pi * N / L
    tau_hold = F_lift * L / (2 * pi * eta_bs * N * eta_g)
    p('%s: rad of motor per m = %.0f; holding torque %.4f N·m = %.2f A; motor speed at 0.1 m/s %.0f rpm' %
      (name, k, tau_hold, tau_hold / kt, rpm(0.1 * k)))
    m_rot = J * k**2
    p('   rotor seen as mass at the carriage J_m·k² = %.1f kg' % m_rot)
J_screw = 0.5 * (pi * 0.008**2 * 0.5 * 7850) * 0.008**2
p('ball screw 16 mm × 0.5 m steel: m = %.3f kg, J = %.2e kg·m²; as mass: lead 5 mm %.1f kg, lead 10 mm %.1f kg' %
  (pi * 0.008**2 * 0.5 * 7850, J_screw, J_screw * (2 * pi / 0.005)**2, J_screw * (2 * pi / 0.010)**2))
k_opt = math.sqrt(26.0 / J)
p('inertia-matching ratio sqrt(m/J_m) = %.0f rad/m → with a 5 mm lead N = %.2f; design 2 is %.2f × that' %
  (k_opt, k_opt * 0.005 / (2 * pi), (2 * pi * 3.5 / 0.005) / k_opt))
# arm-joint example: EC45 + CSD-20-80
for Nj in [6, 80, 100, 160]:
    p('joint example J_m × N²: N = %3d → %.4f kg·m²' % (Nj, J * Nj**2))
p('Mini Cheetah rotor 7.2e−5 × 36 = %.5f kg·m² (thesis output inertia 0.0023); same rotor ×100² = %.2f' % (7.2e-5 * 36, 7.2e-5 * 1e4))

hdr('§5 gears')
p('planetary: sun 12, ring 30 → 1 + 30/12 = %.2f; wheel 74:1 = 147/2 = 3.5 × 3.5 × 6 = %.1f (three stages, maxon 203123)' % (1 + 30 / 12, 3.5 * 3.5 * 6))
p('harmonic: flexspline 200, circular 202 → %d:1 (output opposite); 160/162 → %d:1' % (200 / 2, 160 / 2))
p('stage efficiencies 0.9^1..4 = %s (GP 42 C 90/81/72/64)' % ', '.join('%.3f' % 0.9**i for i in range(1, 5)))
p('CSD-20-80 joint with EC45: continuous 0.134 × 80 × 0.76 = %.2f N·m; drive peak 0.606 × 80 × 0.76 = %.1f N·m' %
  (tauN * 80 * 0.76, kt * 15 * 80 * 0.76))

hdr('§6 screws')
def eta_f(lam, phi): return math.tan(lam) / math.tan(lam + phi)
def eta_b(lam, phi): return math.tan(lam - phi) / math.tan(lam)
phi_r = math.radians(9.34)
for d in [8, 20]:
    p('Roton check φ 9.34°: λ %d° → forward %.0f%%, backdrive %.0f%%' % (d, 100 * eta_f(math.radians(d), phi_r), 100 * eta_b(math.radians(d), phi_r)))
for name, L, dm in [('ball screw 16×5', 5, 16), ('ball screw 16×10', 10, 16), ('lead screw Tr16×4 (pitch dia 14)', 4, 14)]:
    lam = math.degrees(math.atan(L / (pi * dm)))
    p('%s: lead angle %.2f°' % (name, lam))
lam = math.atan(4 / (pi * 14)); phi = math.atan(0.10)
p('Tr16×4, μ 0.10 (φ %.2f°): forward %.0f%%, backdrive %.0f%% → self-locking' % (math.degrees(phi), 100 * eta_f(lam, phi), 100 * eta_b(lam, phi)))
ef_tr = eta_f(lam, phi)
tau_tr = F_lift * 0.004 / (2 * pi * ef_tr * 3.5 * 0.9)
p('lift with Tr16×4 + 3.5:1: raising torque %.4f N·m = %.2f A without motor friction (ball screw design: 1.77 A); copper loss ratio %.1f× (with friction: §16)' %
  (tau_tr, tau_tr / kt, (tau_tr / kt / 1.773)**2))
p('   … but a self-locking screw needs no torque to hold: 0 A at rest')
tau_back_screw = F_lift * 0.005 * eta_bs_back / (2 * pi)
tau_back_motor = tau_back_screw / 3.5 * 0.9
p('design 2 power off: load torque on the screw %.4f N·m; at the motor (planetary backdrive η 0.9, ILLUSTRATIVE) %.4f N·m' % (tau_back_screw, tau_back_motor))
p('   motor friction %.4f N·m < %.4f → it slides; (old sizing WITH friction, superseded by §16:) 2× → %.3f N·m; 0.24 N·m = %.1f×' %
  (tf, tau_back_motor, 2 * tau_back_motor, 0.24 / tau_back_motor))
tb1 = F_lift * 0.010 * eta_bs_back / (2 * pi)
p('design 1 power off: load torque on screw/motor %.4f N·m' % tb1)

def slide(L, N, eta_g_back, I_help=0.0, T=3.0, dt=1e-4):
    # carriage falls; effective mass m + J_m k² + J_screw (2π/L)²; driving force F·η'_bs·η'_g − friction − motor help
    k = 2 * pi * N / L
    m_eff = 26.0 + J * k**2 + J_screw * (2 * pi / L)**2
    F_drive = F_lift * eta_bs_back * eta_g_back - tf * k - kt * I_help * k
    x = v = t = 0.0
    while x < 0.40 and t < T:
        a = F_drive / m_eff
        v += a * dt; x += v * dt; t += dt
    return m_eff, F_drive, t, v
for name, args in [('design 1, drive at 5 A', (0.010, 1.0, 1.0, 5.0)), ('design 1, torque off', (0.010, 1.0, 1.0, 0.0)),
                   ('design 2, torque off, no brake', (0.005, 3.5, 0.9, 0.0))]:
    m_eff, Fd, t, v = slide(*args)
    p('slide %-32s m_eff %.1f kg, net force %.1f N → 0.40 m in %.2f s, %.2f m/s at the bottom' % (name, m_eff, Fd, t, v))
m_eff2, Fd2, _, _ = slide(0.005, 3.5, 0.9, 0.0)
a2 = Fd2 / m_eff2
for te in [0.010, 0.020, 0.050]:
    p('design 2 with brake engaging after %.0f ms: sag %.3f mm' % (te * 1e3, 0.5 * a2 * te**2 * 1e3))
p('kinetic energy of the lift at 0.1 m/s incl. reflected inertia: %.2f J (= %.2f kg falling 10 cm)' % (0.5 * m_eff2 * 0.01, 0.5 * m_eff2 * 0.01 / (g * 0.1)))
# accel torque design 2
k2 = 2 * pi * 3.5 / 0.005
a_m = 0.5 * k2
t_acc = J * a_m + J_screw / 3.5**2 * a_m + 26.0 * 0.5 * 0.005 / (2 * pi * 0.9 * 3.5 * 0.9)
p('design 2 accelerating at 0.5 m/s²: rotor %.4f N·m, screw %.4f, load %.4f; total with gravity %.4f N·m = %.2f A' %
  (J * a_m, J_screw / 3.5**2 * a_m, 26.0 * 0.5 * 0.005 / (2 * pi * 0.9 * 3.5 * 0.9), t_acc + 0.0716, (t_acc + 0.0716 + tf) / kt))
# power chain while raising at 0.1 m/s
P_load = F_lift * 0.1
P_screw_in = P_load / eta_bs
P_motor_out = P_screw_in / 0.9
w_m = rad(4200)
I_r = (0.0716 + tf) / kt
P_cu = I_r**2 * R
P_emf = ke * w_m * I_r
P_mot_in = P_emf + P_cu
P_bus = P_mot_in / 0.95
p('power chain raising 26 kg at 0.1 m/s: load %.1f W ← screw in %.1f W ← motor shaft %.1f W; motor I %.2f A, '
  'P_cu %.2f W, friction %.2f W, motor in %.1f W; drive η 0.95 (ILLUSTRATIVE) → bus %.1f W = %.2f A at 25.6 V; overall %.0f%%' %
  (P_load, P_screw_in, P_motor_out, I_r, P_cu, tf * w_m, P_mot_in, P_bus, P_bus / 25.6, 100 * P_load / P_bus))
p('holding: %.2f A, %.2f W of heat, 0 W of work' % (0.0716 / kt, (0.0716 / kt)**2 * R))
P_back = F_lift * 0.1 * eta_bs_back * 0.9 - tf * w_m
p('lowering at 0.1 m/s: mechanical power into the motor %.1f W (before copper loss) → roughly %.0f W back to the bus' %
  (P_back, P_back - ((P_back / (ke * w_m)))**2 * R))
p('energy: lifting 26 kg by 0.40 m = %.0f J; braking 100 kg from 0.3 m/s = %.1f J' % (F_lift * 0.4, 0.5 * 100 * 0.3**2))

hdr('§7 backlash, compliance')
for st in [1, 2, 3]:
    p('GP 42 C %d stage backlash %.1f° → wheel arc %.2f mm' % (st, gp[st]['bl'], r_w * math.radians(gp[st]['bl']) * 1e3))
arc = r_w * math.radians(1.0)
p('wheel 1.0° per reversal: %.2f mm; worst-case heading 2×arc/0.40 = %.2f mrad = %.2f°; at 1 m ahead %.1f mm' %
  (arc * 1e3, 2 * arc / b_w * 1e3, math.degrees(2 * arc / b_w), 2 * arc / b_w * 1e3))
p('lift planetary 0.6° at the screw → %.1f µm of carriage travel' % (0.005 * 0.6 / 360 * 1e6))
def twist(T, T1=7.0, K1=1.3e4, T2=25.0, K2=1.7e4, K3=2.5e4):
    if T <= T1: return T / K1
    if T <= T2: return T1 / K1 + (T - T1) / K2
    return T1 / K1 + (T2 - T1) / K2 + (T - T2) / K3
for T in [7, 22, 25, 36.8, 51]:
    th = twist(T)
    p('CSD-20-80 twist at %.1f N·m: %.2f mrad = %.1f arcmin; at 0.6 m %.2f mm, 0.8 m %.2f mm' %
      (T, th * 1e3, math.degrees(th) * 60, th * 0.6 * 1e3, th * 0.8 * 1e3))
p('accuracy 1 arcmin = %.3f mrad → %.2f mm at 0.8 m' % (math.radians(1 / 60) * 1e3, math.radians(1 / 60) * 0.8 * 1e3))
p('CSG-20-100 backdriving 5.6 N·m: push at 0.5 m lever = %.1f N; CSD-20-80 4.9 N·m → %.1f N' % (5.6 / 0.5, 4.9 / 0.5))
p('CSD-20-80 starting torque 4.8 N·cm at the input × 80 = %.2f N·m at the output' % (0.048 * 80))

hdr('§8 backdrive (push it by hand)')
for name, tau_f_m, N, etab, r in [('wheel 74:1 (3-stage planetary, backdrive η 0.72 ILLUSTRATIVE)', tf, 74, 0.72, r_w)]:
    tau_w = tau_f_m * N / etab
    p('%s: %.2f N·m at the wheel → %.1f N per wheel at the rim; both + rolling %.1f N → %.0f N to push the robot' %
      (name, tau_w, tau_w / r, Frr, 2 * tau_w / r + Frr))
p('Dynamixel XM430: 353.5:1; stall 4.1 N·m; output encoder 4096/rev = %.3f°' % (360 / 4096))
p('Mini Cheetah 6:1, peak 17 N·m, continuous 6.9 N·m, 480 g: peak torque per kg %.1f N·m/kg' % (17 / 0.48))
p('Dynamixel 4.1 N·m / 0.082 kg = %.1f N·m/kg (stall)' % (4.1 / 0.082))

hdr('§9 encoders')
cpt = 1024
p('lift motor encoder %d counts/turn ×4 = %d; per carriage µm: %.3f; Hall only (8 pole pairs × 6 = 48/rev): %.1f µm' %
  (cpt, 4 * cpt, 0.005 / (3.5 * 4 * cpt) * 1e6, 0.005 / (3.5 * 48) * 1e6))
p('wheel: %d × 74 = %d counts per wheel turn → %.2f µm at the rim; Hall: 48 × 74 = %d → %.3f mm' %
  (4 * cpt, 4 * cpt * 74, 2 * pi * r_w / (4 * cpt * 74) * 1e6, 48 * 74, 2 * pi * r_w / (48 * 74) * 1e3))
for bits in [12, 14, 17, 20]:
    step = 360 / 2**bits
    p('%d bit: %.5f° = %.2f arcsec; at 0.8 m %.1f µm' % (bits, step, step * 3600, math.radians(step) * 0.8 * 1e6))
p('Mini Cheetah: 14 bit on the motor × 6 = %d counts per output turn = %.4f°' % (2**14 * 6, 360 / (2**14 * 6)))

hdr('§10 torque sensing')
gain = 80 * 0.76 * kt
p('joint example EC45 + CSD-20-80: τ_out ≈ N·η·k_t·I = %.3f N·m per A' % gain)
p('friction scale: backdriving 4.9 N·m, starting 3.84 N·m vs rated 22 N·m → %.0f–%.0f%%' % (100 * 3.84 / 22, 100 * 4.9 / 22))
p('a 4.9 N·m blind spot at 0.6 m lever = %.1f N at the hand' % (4.9 / 0.6))
p('strain bridge: 2 mV/V at 1000 µε; 5 V excitation → %.0f mV full scale; 16-bit over ±FS → %.2f µV/count' % (2 * 5, 2 * 10 / 2**16 * 1e3))
p('page 18: 0.15 kg cup not configured → %.2f N phantom force' % (0.15 * g))

hdr('§11 drive')
for V in [20.0, 25.6, 29.2]:
    Vm = vout_frac * V
    p('bus %.1f V → max motor voltage %.2f V → no-load %.0f rpm' % (V, Vm, (Vm - R * I0) * kn))
p('drive peak 15 A × k_t = %.3f N·m (36 %% of the 1.69 N·m stall torque); continuous 5 A × k_t = %.3f N·m' % (15 * kt, 5 * kt))
p('PWM 50 kHz = %.0f µs period; current loop 25 kHz = %.0f µs; speed/position 2.5 kHz = %.0f µs; FR3 FCI 1 kHz = 1000 µs' % (20, 40, 400))
p('FR3 τ̇_max 1000 N·m/s: 0 → 87 N·m takes at least %.0f ms' % (87 / 1000 * 1e3))

hdr('§12 E-stop (ILLUSTRATIVE design)')
decel = 1.0
v0 = 0.3
p('wheels Category 1 at %.1f m/s² from %.1f m/s: %.2f s, %.0f mm' % (decel, v0, v0 / decel, v0**2 / (2 * decel) * 1e3))
a_coast = Frr / (m_robot + m_ref_wheel)
p('wheels Category 0, no brakes (coast on rolling resistance + reflected inertia): %.3f m/s² → %.1f s, %.2f m' %
  (a_coast, v0 / a_coast, v0**2 / (2 * a_coast)))
p('lift: Category 0 + spring brake (engage 20 ms) → sag %.3f mm; without brake → 0.40 m in about 1.6 s' % (0.5 * a2 * 0.02**2 * 1e3))

hdr('§13 datasheet checks (see §1) and weakest links')
p('wheel: motor continuous at the wheel %.2f N·m < gearhead 15 N·m (motor limits); drive current limit for the 22 N·m intermittent rating %.2f A' % (tauN * N_wh * eta_wh, Ilim))
p('lift gearhead 1 stage: continuous 3.0 N·m vs screw torque while holding %.3f N·m' % (F_lift * 0.005 / (2 * pi * eta_bs)))
p('first design: required 0.451 N·m = %.0f%% of stall torque (looks fine) = %.1f× the continuous torque' % (100 * 0.451 / 1.69, 0.451 / 0.134))

hdr('§15 sizing summary, design 2 (lift)')
p('force 255.1 N; lead 5 mm; screw torque 0.2255 N·m; motor 0.0716 N·m (1.77 A hold), 4200 rpm at 0.1 m/s; '
  'accel peak ~0.120 N·m; RMS over the duty cycle ≈ %.2f A < 3.29 A (3.23 A accel: §16); drive 5/15 A OK; brake 0.24 N·m = 4.1× the frictionless 0.058 N·m (§16)' % Irms)

hdr('§1b motor widget states (model: I = (τ + τ_f)/k_t, ω = (V − R·I)/k_e, τ_f = k_t·I0 when turning)')
def state(V, tau, Rr=R):
    I = (tau + tf) / kt
    w = (V - Rr * I) / ke
    if w <= 0:
        I = V / Rr; w = 0.0
    Pm = tau * w; Pcu = I * I * Rr; Pin = V * I
    return w, I, Pm, Pcu, Pin
for name, V, tau in [('24 V, 0.0716 N·m', 24.0, 0.0716), ('24 V, no load', 24.0, 0.0), ('24 V, 0.134 N·m (nominal)', 24.0, 0.134),
                     ('24 V, 0.451 N·m (design 1 hold torque)', 24.0, 0.451)]:
    w, I, Pm, Pcu, Pin = state(V, tau)
    p('%-40s n %5.0f rpm  I %5.2f A  P_mech %5.1f W  P_cu %5.2f W  friction %4.2f W  P_in %5.1f W  η %4.1f%%' %
      (name, rpm(w), I, Pm, Pcu, tf * w, Pin, 100 * Pm / Pin if Pin else 0))
I_r = (0.0716 + tf) / kt
V_r = R * I_r + ke * rad(4200)
p('voltage that gives 4200 rpm at 0.0716 N·m: %.2f V' % V_r)
V_1 = R * ((0.451 + tf) / kt) + ke * rad(600)
p('voltage that gives 600 rpm at 0.451 N·m (design 1 raising): %.2f V; current %.2f A' % (V_1, (0.451 + tf) / kt))
w, I, Pm, Pcu, Pin = state(24.0, 0.0716, R * (1 + alpha_cu * 100))
p('hot winding (R ×1.39) at 24 V, 0.0716 N·m: n %.0f rpm, I %.2f A' % (rpm(w), I))
tau_half = (kt * 24 / R - tf) / 2
w, I, Pm, Pcu, Pin = state(24.0, tau_half)
p('max power point at 24 V: τ %.3f N·m, n %.0f rpm, P_mech %.0f W, I %.1f A' % (tau_half, rpm(w), Pm, I))
# max efficiency point
best = max(((state(24.0, t / 1000)[2] / state(24.0, t / 1000)[4], t / 1000) for t in range(1, 1600)))
p('max efficiency at 24 V (model): %.1f%% at %.3f N·m (sheet 85%%)' % (100 * best[0], best[1]))

hdr('§2b heat widget profiles (25 °C ambient)')
def drive_limited(t): return 11.17 if t < 3.0 else 5.0
Tw, Th, hit = sim_heat(drive_limited, 600)
p('11.17 A for 3 s then 5 A: after 600 s T_w %.0f °C; 125 °C reached at %s s' % (Tw, '%.1f' % hit if hit else 'never'))
def duty(t):
    tt = t % 58.6
    acc = 0
    for d, I in seg:
        if tt < acc + d: return I
        acc += d
    return 0.0
Tw, Th, hit = sim_heat(duty, 3600)
p('design-2 duty cycle for 1 h: T_w %.1f °C (end), hit %s' % (Tw, hit))
for I in [1.77, 3.29, 11.17]:
    for Ta in [25.0, 45.0]:
        Tw, Th, hit = sim_heat(lambda t, I=I: I, 1200, Ta=Ta)
        p('I %.2f A, ambient %.0f °C: T_w after 20 min %s; 125 °C at %s' % (I, Ta, ('%.1f °C' % Tw) if Tw < 300 else '> 300 °C (runaway)', ('%.1f s' % hit) if hit else 'never'))
for I in [3.70, 5.0]:
    Tw, Th, hit = sim_heat(lambda t, I=I: I, 3000)
    p('I %.2f A constant: 125 °C at %s' % (I, ('%.0f s' % hit) if hit else 'never'))
p('runaway when α·I²·R25·R_th > 1: I > %.2f A' % math.sqrt(1 / (alpha_cu * R * (Rth1 + Rth2))))

hdr('§1c windings of the same frame (catalog): k_t, R, k_m = k_t/sqrt(R) (torque per sqrt(watt) of copper loss)')
for V, k, Rr, Inom, tnom in [(24, 0.0404, 0.573, 3.29, 0.134), (36, 0.057, 1.560, 1.97, 0.110), (48, 0.0808, 3.070, 1.41, 0.112), (60, 0.152, 7.370, 0.92, 0.143)]:
    p('%d V winding: k_t %.1f mN·m/A, R %.3f Ω, k_m %.4f N·m/√W; holding 0.0716 N·m needs %.2f A and %.2f W of copper loss; no-load ≈ %.0f rpm at its voltage' %
      (V, k * 1e3, Rr, k / math.sqrt(Rr), 0.0716 / k, (0.0716 / k)**2 * Rr, V / k * 60 / (2 * pi)))
p('stall current at 24 V: P = 41.9² × 0.573 = %.0f W of heat' % (41.9**2 * 0.573))
p('nominal current cold: 3.29² × 0.573 = %.2f W' % (3.29**2 * 0.573))

hdr('§16 after fact-check (holding band, brake without friction, lead screw, inertia matching with the screw, battery current)')
# holding band: least torque that holds = backdrive torque (friction helps); most = raising torque
for name, L, N, eg_f, eg_b in [('design 1 (10 mm, direct)', 0.010, 1.0, 1.0, 1.0), ('design 2 (5 mm, 3.5:1)', 0.005, 3.5, 0.9, 0.9)]:
    t_raise = F_lift * L / (2 * pi * eta_bs * N * eg_f)
    t_hold_min = F_lift * L * eta_bs_back * eg_b / (2 * pi * N)
    t_nofric = F_lift * L / (2 * pi * N)
    p('%s: raise %.4f N·m (%.2f A), hold at least %.4f N·m (%.2f A), frictionless %.4f N·m' %
      (name, t_raise, t_raise / kt, t_hold_min, t_hold_min / kt, t_nofric))
t0 = F_lift * 0.005 / (2 * pi * 3.5)
p('brake sizing without friction: %.4f N·m; 2× = %.3f; 0.24 N·m = %.2f×' % (t0, 2 * t0, 0.24 / t0))
# lead screw Tr16×4 raising current incl. motor friction, speed
tau_tr_m = F_lift * 0.004 / (2 * pi * ef_tr * 3.5 * 0.9)
I_tr = (tau_tr_m + tf) / kt; I_ball = (0.0716 + tf) / kt
p('Tr16×4 raising: %.4f N·m + friction → %.2f A; ball screw %.2f A; copper ratio %.2f' % (tau_tr_m, I_tr, I_ball, (I_tr / I_ball)**2))
n_need = 0.10 / 0.004 * 3.5 * 60
V_need = R * I_tr + ke * rad(n_need)
p('Tr16×4 at 0.10 m/s: motor %.0f rpm, needs %.2f V' % (n_need, V_need))
for Vb in [25.6, 20.0]:
    Vm = 0.9 * Vb
    n_max = (Vm - R * I_tr) / ke * 60 / (2 * pi)
    p('   bus %.1f V → %.2f V → %.0f rpm → %.4f m/s' % (Vb, Vm, n_max, n_max / 60 / 3.5 * 0.004))
lam = math.atan(4 / (pi * 14))
p('Tr16×4 self-locking lost below μ = %.3f (square thread); with 15° flank μ/cos15: %.3f' % (math.tan(lam), math.tan(lam) * math.cos(math.radians(15))))
# inertia matching including the screw (load seen at the gearhead output = screw + carriage)
J_load_out = 26.0 * (0.005 / (2 * pi))**2 + J_screw
Nstar = math.sqrt(J_load_out / J)
p('inertia matching with the screw: J_load at the screw %.3e kg·m² → N* = %.2f; design 2 (3.5) = %.2f× N*' % (J_load_out, Nstar, 3.5 / Nstar))
Nstar0 = math.sqrt(26.0 * (0.005 / (2 * pi))**2 / J)
p('   (carriage only: N* = %.2f)' % Nstar0)
# wheel: battery current while accelerating hard at speed, and at 0.5 m/s²
for v in [0.0, 0.3, 0.5]:
    w_m = v / r_w * N_wh
    for Im, lab in [(Ilim, 'current limit'), (1.49, '0.5 m/s² (1.49 A)')]:
        Vm = R * Im + ke * w_m
        Pe = Vm * Im
        p('wheel at %.1f m/s, %s: motor %.2f V × %.2f A = %.1f W per wheel → both %.1f W → %.2f A from a 25.6 V bus (drive losses ignored)' %
          (v, lab, Vm, Im, Pe, 2 * Pe, 2 * Pe / 25.6))
p('sag at 14 A × 30 mΩ = %.2f V' % (14 * 0.030))
v_top_nom = rad((23.04 - R * I0) * kn - grad * 50) / N_wh * r_w
p('wheel top speed at 25.6 V bus (23.04 V at the motor), light load: %.3f m/s; at 0.3 m/s the wheel turns %.1f rpm' % (v_top_nom, 0.3 / r_w * 60 / (2 * pi)))
# duty cycle with the accel current incl. friction (3.23 A)
seg2 = [(0.2, 3.23), (4.0, 2.04), (0.2, 1.0), (30.0, 1.77), (4.2, 0.9), (20.0, 0.0)]
T2 = sum(s[0] for s in seg2); Irms2 = math.sqrt(sum(s[0] * s[1]**2 for s in seg2) / T2)
p('duty cycle with 3.23 A accel: RMS %.3f A' % Irms2)
p('regen 13 W vs other loads ~240 W: the other loads absorb it (bus does not rise)')
p('design 1 hold minimum 8.04 A > drive 5 A: still slides')

hdr('§17 after fact-check, part 2 (wheel braking limit, coasting with friction, E-stop while lowering, exact 147/2, other robots)')
eta_wh_back = 0.72   # ILLUSTRATIVE: backdrive efficiency of the 3-stage gearhead taken equal to the forward 72 %
p('wheel driving: 10.22 A × k_t × 74 × 0.72 = %.1f N·m; braking (power flows back, friction adds at the output): '
  '10.22 A × k_t × 74 / 0.72 = %.1f N·m (gearhead intermittent 22 N·m)' % (Ilim * kt * N_wh * eta_wh, Ilim * kt * N_wh / eta_wh_back))
I_brk = 22.0 * eta_wh_back / (N_wh * kt)
p('current limit that keeps braking under 22 N·m: 22 × 0.72 / (74 × k_t) = %.2f A; normal 0.5 m/s² needs 1.49 A' % I_brk)
F_coast = 2 * tf * N_wh / eta_wh_back / r_w + Frr
a_c = F_coast / (m_robot + m_ref_wheel)
p('wheels Category 0 coasting with gear + motor friction: %.1f N / %.0f kg = %.3f m/s² → %.2f s, %.3f m from %.1f m/s '
  '(rolling only, worst case: %.3f m/s² → %.1f s, %.2f m)' %
  (F_coast, m_robot + m_ref_wheel, a_c, v0 / a_c, v0**2 / (2 * a_c), v0, a_coast, v0 / a_coast, v0**2 / (2 * a_coast)))
# lift E-stop while lowering at 0.10 m/s: torque lost at t = 0, spring brake engages after 20 ms (ILLUSTRATIVE)
v_l = 0.10; t_e = 0.020
x1 = v_l * t_e + 0.5 * a2 * t_e**2
v1 = v_l + a2 * t_e
F_br = 0.24 + tf                      # brake + motor friction at the motor shaft
a_br = (Fd2 + tf * k2 - F_br * k2) / m_eff2   # Fd2 already subtracts friction; add it back, then subtract brake + friction
x2 = v1**2 / (2 * -a_br)
p('lift E-stop while lowering at 0.10 m/s (Category 0, brake after 20 ms): %.2f mm in the 20 ms, reaching %.4f m/s = %.0f rpm at the motor;'
  ' brake decel %.2f m/s² → %.2f mm more; total %.1f mm; brake absorbs %.2f J' %
  (x1 * 1e3, v1, rpm(v1 * k2), -a_br, x2 * 1e3, (x1 + x2) * 1e3, 0.24 * x2 * k2))
p('lift E-stop at standstill: sag %.3f mm (brake after 20 ms)' % (0.5 * a2 * t_e**2 * 1e3))
p('lift sliding without brake: motor speed at the bottom (design 2) %.0f rpm (max 10000 rpm)' % rpm(slide(0.005, 3.5, 0.9, 0.0)[3] * k2))
# exact wheel ratio
N_ex = 147 / 2
cnt = 4 * cpt * N_ex
p('wheel with the exact ratio 147/2 = %.1f: %d × %.1f = %d counts per wheel turn → %.2f µm at the rim; Hall 48 × %.1f = %d → %.3f mm' %
  (N_ex, 4 * cpt, N_ex, cnt, 2 * pi * r_w / cnt * 1e6, N_ex, 48 * N_ex, 2 * pi * r_w / (48 * N_ex) * 1e3))
p('odometry that divides by 74 instead of 73.5 reads %.2f %% short: %.1f mm per metre' % (100 * (74 - N_ex) / 74, (74 - N_ex) / 74 * 1000))
# other robots
p('1X NEO: 842 Wh / 4 h = %.1f W average' % (842 / 4))
p('Unitree H1: 16 cells × 4.2 V = %.1f V (matches the 67.2 V maximum on the product page)' % (16 * 4.2))
p('kitchen robot: 2048 Wh / 251 W = %.1f h' % (2048 / 251))
tau_rr_m = Frr / 2 * r_w / (N_wh * eta_wh)       # rolling resistance per wheel, at the motor
I_rr = (tau_rr_m + tf) / kt
n_rr = (23.04 - R * I_rr) * kn
p('wheel top speed at 23.04 V (25.6 V bus), rolling resistance only: motor %.4f N·m, %.2f A, %.0f rpm → wheel %.1f rpm → %.3f m/s (ratio widget)' %
  (tau_rr_m, I_rr, n_rr, n_rr / N_wh, rad(n_rr) / N_wh * r_w))
