# Arithmetic quoted on page 19 · 第 19 篇里"我们算的"那些数

- `calc19.py` → `numbers.txt`: every number the page marks as "我们算的 / our arithmetic": consistency checks of the
  maxon EC 45 flat 70 W (24 V) datasheet (k_e vs k_t, stall current and torque, speed/torque gradient, mechanical time
  constant) and operating points of the lift motor; a two-node thermal model (winding and housing, copper loss only) with
  temperature-dependent resistance: steady temperatures, time to 125 °C, runaway current, an RMS duty cycle; the battery
  pack and power budget, sag and the voltage limit at an empty battery; gear ratios, reflected inertia and the rotor's
  equivalent mass on the lift (350 kg), inertia matching; screw efficiencies and self-locking, back-torque on the lift
  motor, how fast the lift slides without a brake and how far it sags with one; backlash at the wheel, strain-wave twist
  from the three-segment stiffness; encoder resolution at the carriage, wheel and joint; torque from current and a strain
  bridge; drive voltage and current limits (including the wheel's limit while braking); stopping distances for the E-stop,
  also while the lift is lowering; the exact 147/2 wheel ratio in the odometry; the average power and pack voltage quoted
  for other robots.
  Run: `python3 calc19.py > numbers.txt` (pure Python, no dependencies).

The kitchen and the robot are fictional; the parts and their datasheet values are real (maxon EC 45 flat, GP 42 C,
EPOS4 Compact 50/5 CAN; Harmonic Drive CSD-20-80 / CSG-2UH; EVE LF80; Franka Research 3). Numbers marked "示意 /
illustrative" on the page (the lift's load and speed, the pack resistance, the brake's engagement time, the E-stop
design) are design choices made for explanation; the script uses them as inputs where the page does.

厨房和机器人是虚构的，零件和规格书上的数是真实的（maxon EC 45 flat、GP 42 C、EPOS4 Compact 50/5 CAN，Harmonic Drive
CSD-20-80 / CSG-2UH，EVE LF80，Franka Research 3）。页面上标"示意"的数（升降柱的负载和速度、电池的内阻、制动器合上要多久、
急停回路的设计）是为了讲清楚而定的；页面用到它们的地方，脚本也拿它们当输入。
