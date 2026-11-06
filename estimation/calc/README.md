# Arithmetic and measurements quoted on page 16 · 第 16 篇里"我们算的""我们测的"那些数

- `calcnum.py` → `numbers.txt`: every number the page marks as "我们算的 / our arithmetic" (fusing two readings, Kalman
  gains and steady states, the EKF "banana" with 200,000 Monte-Carlo samples and the exact fractions by quadrature,
  nav2_amcl's KLD sample counts, RealSense D435 depth error, BMI055 and wheel-odometry drift, time-offset and lidar-skew
  errors, χ² quantiles and the 95 % line for an average of NIS values, the momentum-observer delay, the cup error
  budget, log-odds). Run: `python3 calcnum.py` (needs numpy; scipy only for the χ² table).
- `meas/amcl.c`, `meas/ekf.c`, `meas/posegraph.py` → `meas/results.txt`: the "我们测的 / measured" costs — one
  AMCL-style likelihood-field update (500 / 2000 / 5000 particles × 61 beams), one 15-state EKF cycle, and one
  Gauss–Newton step of a 2D pose graph solved sparse vs dense (250–4000 poses).
  Build: `gcc -O2 amcl.c -o amcl -lm`, `gcc -O2 ekf.c -o ekf -lm`; run `python3 posegraph.py` (numpy, scipy).

Machine: a cloud VM with 2 vCPUs and 8 GB RAM, Linux 6.18 (not a real-time kernel), gcc 13.3 `-O2`, Python 3.13,
measured on 6 November 2026. Numbers will differ on another machine; the orders of magnitude will not.

测量环境：一台 2 个虚拟 CPU、8 GB 内存的云虚拟机，Linux 6.18（不是实时内核），gcc 13.3 `-O2`，Python 3.13，2026 年 11 月 6 日。
换一台机器数会变，量级不会变。
