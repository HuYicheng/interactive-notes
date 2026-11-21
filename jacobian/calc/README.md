# Checks behind page 11 · 第 11 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/jacobian/index.html` (needs Node and Playwright; about 4 minutes).

  **Part A, the widgets.** Each widget is operated the way a reader would, following its "先玩 / Try first" prompt
  literally: pressing buttons, moving sliders, dragging the hand along the table and a dot of the SVD widget with the
  mouse. The readouts are compared with the numbers quoted in the "你会看到 / What you will see" lines. Numbers that
  no readout shows are recomputed inside the page with its own engine (`window.TB`: forward kinematics, Jacobian, SVD,
  mass matrix, recursive Newton–Euler, the integrator, the controllers): the torques in the four frames of the opening,
  when the fastest joint passes 1 rad/s and hits its cap under the pseudoinverse, how far the hand lags for each
  damping, the largest press a joint limit allows, the three terms of the equation of motion at release and at the
  moment of fastest swing, the angle the shoulder turns in 0.6 s, the accuracy of the hand while wiping under the
  shelf, and what the method map reaches from the pseudoinverse. The numbers drawn in the five figures (the arm and
  its angles, the SVD of J at 0.55 m, the lever arms, the two passes of Newton–Euler, the stiffness under computed
  torque) are recomputed in the same way.

  **Part B, the text.** The numbers quoted in the formula cards, the paragraphs, the table of results and the quiz
  are recomputed with the same engine and compared with the text: each check first requires the quoted string to be
  in the page, then the recomputed value to round to it. The table of the four controllers is rebuilt cell by cell
  with the page's simulation (`TB.wipeSim`) and the widget's own statistics.

What the script cannot read, and how those statements are covered:
- The three steps of the SVD animation are labelled on the canvas only. That the ellipse appears in step 2 is read
  from the widget's source (rotate by Vᵀ, stretch along the axes, rotate into U), which the script checks is unchanged.
- The bars of the equation-of-motion widget carry no numbers. The values quoted for them are computed with the
  page's own equations, integrated with the same 1 ms steps as the widget.
- The equation-of-motion and control widgets run in real time, so their readouts depend a little on when they are
  read. The script waits for the statistics to stop changing; the drift of T + V is checked as "below 0.02 mJ".
- "One SVD of J takes a few microseconds" is a timing on the machine that runs the check (about 1 µs in the browser).
- Years, names, and results quoted from the cited papers (for example 4.5 ms per evaluation on a PDP 11/45, or the
  factor of ten thousand for LoRA) are taken from those papers and are not recomputed.

Four numbers of the text were corrected in this revision because the recomputation disagreed with them:
the wrist's acceleration in the Newton–Euler example (9.63, not 9.64 m/s²); the lower end of the force range of
operational-space control at twice the speed (7.3, not 7.4 N: the widget shows 7.3); "gravity is more than twenty
times inertia" (at the shoulder the ratio is never below 19.8, so the text now says "nearly twenty"); and the drift
of the pseudoinverse round a circle, which the text gave without saying where the circle was. That example is now
fully specified (radius 8 cm, anticlockwise about (0.55, 0.10) m, starting at the rightmost point with the last link
pointing down, 2000 steps per lap): 0.32° after one lap, 32.7° after a hundred.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖（手沿桌面的位置和 SVD 交互里的圆点是用鼠标拖的），
把读数和"你会看到"里写的数逐个对一遍；读数里没有的数（开场四帧的力矩、伪逆下最快的关节什么时候过 1 rad/s 和顶到上限、
不同阻尼下手落后多少、关节上限允许的最大压力、放手那一刻和甩得最快那一刻运动方程的三项、0.6 秒里肩转过的角度、
在搁板下擦桌子时手有多准、方法地图里从"伪逆"能走到多少块），都用页面自己的那套程序（`window.TB`）在页面里重算。
五张图上的数也这样重算。第二部分把公式卡片、正文、结果表和小测验里的数用同一套程序重算，和正文逐条对照；
四种控制的那张表，是用页面的仿真和交互自己的统计办法一格一格重算的。

脚本读不到的：SVD 动画三步的名字只画在画布上，"椭圆在第 2 步出现"是照交互的源码写的（脚本会检查这段源码没变）；
运动方程交互里的条不标数，正文里那几个数是用同一套方程、同样的 1 ms 步长另算的；这个交互和控制交互是按真实时间跑的，
读数和读的时刻略有关系，脚本等统计稳定以后再读。"算一次 SVD 只要几微秒"是在跑脚本的机器上量的。
年份、人名和文献里的结果（比如 PDP 11/45 上每次 4.5 毫秒）出自所引的文献，没有重算。

这次改版改了正文里的四个数，因为重算对不上：牛顿–欧拉算例里腕的加速度（9.63，不是 9.64 m/s²）；
擦快一倍时操作空间控制的压力下限（7.3，不是 7.4 N，交互显示的是 7.3）；"重力比惯性大二十倍以上"
（肩上这个比值最小是 19.8，现在写成"近二十倍"）；还有伪逆绕圈的漂移，原来没说圆在哪。
现在把这个例子说全了（半径 8 cm，绕 (0.55, 0.10) m 逆时针，从最右边那一点、最后一节竖直朝下开始，每圈 2000 步）：
一圈漂 0.32°，一百圈 32.7°。
