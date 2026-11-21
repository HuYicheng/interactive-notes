# Numbers quoted on page 18 · 第 18 篇里引用的数

- `calcnum.py` → `numbers.txt`: every number the page marks as "我们算的 / our arithmetic": the bias the remounted head
  camera puts on cup A and the grasp success rates with and without it (P(|e| < 10 mm) for a Gaussian error with a bias);
  how much looking many times can help; ISO 9283 repeatability for Gaussian scatter; lever arms, pixel and focal-length
  sensitivities and the page-16 error budget (root-sum-square vs worst case); the depth scale/offset least-squares
  example (standard deviations, correlation, condition number, prediction errors); stereo depth noise and the bias from a
  disparity offset, and a tare at one distance; hand–eye translation-noise amplification 1/(2 sin(θ/2)); the number of
  identifiable kinematic parameters and joint-offset lever arms; IMU consequences of the BMI055 datasheet values and a
  six-position example; lidar mount errors; time-offset errors; phantom external forces and pivot-calibration
  uncertainty; and the residual budget after calibration.
  Run: `python3 calcnum.py > numbers.txt` (needs numpy).
- `check.js` → `check.txt`: the numbers quoted in the "你会看到 / What you will see" line under each interactive. It opens
  `calibration/index.html` in a headless browser, operates each interactive the way a reader would (the buttons and
  sliders the "先玩 / Try first" prompt names) and compares the readouts with what the text says: the grasp counts and
  success rates of the error chain, bias against scatter on the target, the error field before and after zeroing it at
  cup A, the scale/offset fit for each choice of distances, the board photographed four ways, depth bias against distance
  and the tare, the hand–eye pose sets, the three-joint arm, the six faces and the Allan curve, the stacked lidar scans,
  the time offset, pivot calibration and payload, over-fitting, drift and monitoring, and the calibration plan.
  Run: `node check.js /absolute/path/to/calibration/index.html > check.txt` (needs Node and Playwright).

The kitchen and the robot are fictional; the parts and their datasheet values are real (RealSense D435i with a BMI055
IMU, Franka Research 3, ROS 2 Humble). Numbers marked "示意 / illustrative" on the page (for example the 0.5° and 1 mm of
the remounted camera) are made up for explanation; the script uses them as inputs where the page does.

厨房和机器人是虚构的，零件和规格书上的数是真实的（带 BMI055 IMU 的 RealSense D435i、Franka Research 3、ROS 2 Humble）。
页面上标"示意"的数（比如重装相机的 0.5° 和 1 mm）是为了讲清楚而编的；页面用到它们的地方，脚本也拿它们当输入。

`check.js` 用无头浏览器打开页面，照着每个交互前面"先玩"里说的去点、去拉，把读数和交互后面"你会看到"里写的数逐个对照，
结果在 `check.txt` 里。它核对的是"正文和页面对得上"；交互里的模拟是页面自己的程序算的。
