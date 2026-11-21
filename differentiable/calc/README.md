# Checks behind page 9 · 第 9 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/differentiable/index.html` (needs Node and Playwright; several minutes,
  because the learning and fitting interactives are run to the end and the learning one is run again inside the page).

  **Part A, the interactives.** Each one is operated the way a reader would, following its "先玩 / Play first"
  prompt literally: pressing buttons, moving sliders, dragging the arm's target with the mouse, and letting the
  learning, fitting and stepping interactives run until they stop. The readouts are compared with the numbers quoted
  in the "你会看到 / What you will see" lines. Numbers that no readout shows are recomputed inside the page with
  its own engine (`window.TB`: the projectile, the collisions with the bin, the small network and its optimiser, the
  random number generator), with the same loops and the same seeds as the interactives: how far the ball rises in
  each 0.1 s; what the boxes of the computational graph hold; the three learners at about 100 and about 10 000
  throws and for the next five sets of starting weights; which of 751 speeds end in which fate at the bin; the
  counts of "Draw 1 000 times" and the bars of the following single draws (they are drawn on a canvas only); how
  many steps each inverse-kinematics method needs from several targets. The counts of the method map are read from
  the interactive's groups. The five paths of figure F3 were computed with the same collision code,
  and the script checks the fate of each of the five speeds.

  **Part B, the text.** The numbers quoted in the formula cards and the paragraphs are recomputed with the same
  engine and compared with the text: each check first requires the quoted string to be in the page, then the
  recomputed value to round to it.

What the script cannot read, and how those statements are covered:
- Shapes described from the pictures (the curve and its tangent merging at 100× zoom, the red arrow crossing the
  contours at right angles, blurred colour patches first and thin ellipses along the edges in the Gaussian fit, the
  orange curve hugging the step at a low temperature, dots clustering or spreading in the estimator rows) were
  written from screenshots; the script checks the numbers next to them and, where it can, an equivalent computation
  (the curve and the tangent differ by less than a thousandth of the zoomed window; the gradient is perpendicular to
  the contour of the miss).
- All random numbers come from seeded generators, so every number is the same on every run in a Chromium browser,
  provided the buttons are pressed in the order of the prompt after loading the page. Other browsers may round a few
  mathematical functions differently, and the last digit of some numbers can then differ.
- Two sliders are finer than their readouts: three positions of the step-size slider read "1.5" and five positions
  of the temperature slider read "0.10". The text gives ranges or "about" for the numbers that depend on the exact
  position, and the script runs every such position.
- Years, names and the results quoted from the cited papers (training times of NeRF, Plenoxels, Instant NGP and
  3D Gaussian splatting, the speed-up of SHAC over PPO, the GPU-days of architecture search, the numbers of
  TossingBot, PILCO and SuperMimic, and so on) are taken from those papers and are not recomputed.

Changes to the text made in this revision because of the checks:
- Three "Play first" prompts did not lead to what they ask about when followed literally. The large step size was
  to be tried from wherever the dot happened to be (after the first small step it is already in the valley, and
  nothing dramatic happens): the prompt now says to go back to 4.1 m/s, 45° first. "Set the noise to 0.04 and try
  again" did not say from where: it now says to go back to 3.55. "One throw each at 3.8, 4.1 and 4.4" came right
  after a throw at 4.1: it now says one more throw each at 3.8 and 4.4, three in all.
- "With the target half as far away all three methods need only a few steps" is now "gradient descent gets there in
  ten steps or so and the other two in a few" (9 to 15 steps from the pose Newton's method ended in, for seven
  sample targets).
- Six references to other pages were replaced by a sentence that stands on its own.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖（机械臂的目标是用鼠标拖的，
学习、拟合和一步一步走的交互都让它跑到自己停下），把读数和"你会看到"里写的数逐个对一遍；读数里没有的数，用页面
自己的那套程序（`window.TB`：抛体、球和筐的碰撞、小网络和它的优化器、随机数发生器）在页面里重算，循环和随机种子
都和交互一样：每 0.1 秒球升了多少；计算图每一格里是什么数；三种学法在 100 次上下、1 万次上下各在哪，换 5 个开头
以后又在哪；751 个出手速度各是哪一种下场；"抽 1000 次"各抽中多少、接着几次"抽一次"的柱子有多高（这些只画在
画布上）；逆运动学的几种走法从几个目标出发各要几步。方法地图的个数是从交互的分组里数的。图 F3 的五条轨迹用的是
同一套碰撞程序。第二部分把公式卡片和正文里的数用同一套程序重算，和正文逐条对照。

脚本读不到的：照着画面写的形状（放大 100 倍后曲线和切线叠成一条线、红箭头垂直穿过等高线、高斯拟合时先出现糊的
大色块、边界处的椭圆又细又长、低温时橙色曲线贴着台阶、估计值挤成一撮或散开）是对着截图写的，脚本核对的是它们
旁边的数，能算的地方再算一个等价的量（放大的窗口里曲线和切线的差不到窗口高度的千分之一；梯度和落点差的等高线
垂直）。随机数都来自固定种子的发生器：刷新页面后照"先玩"的顺序点，在 Chromium 内核的浏览器里每次结果都一样；
别的浏览器算几个数学函数时舍入可能不同，个别数的末位会有出入。有两个滑块比读数细：步长滑块上读数是 1.5 的有三格，
温度滑块上读数是 0.10 的有五格；跟具体哪一格有关的数，正文写的是范围或"约"，脚本把每一格都跑了。年份、人名和
文献里的结果（NeRF、Plenoxels、Instant NGP、三维高斯泼溅的训练时间，SHAC 比 PPO 快多少，结构搜索用的 GPU 天数，
TossingBot、PILCO、SuperMimic 的数，等等）出自所引的文献，没有重算。

这次改版因为核对而改的地方：三条"先玩"的提示照字面做下去看不到它问的东西（大步长那一问没说从哪出发，走过一小步
以后圆点已经在谷底附近，什么也不会发生，现在写明先回到 4.1 m/s、45°；"把噪声调到 0.04 再试一次"没说从哪试，
现在写明回到 3.55；"在 3.8、4.1、4.4 各扔一次"紧跟在 4.1 的那一扔后面，现在写的是再在 3.8 和 4.4 各扔一次、
一共 3 次）；"目标近一半时三种办法都只要几步"改成了"梯度下降十步上下，另外两种只要几步"（七个试点上，从牛顿法
停下的姿态出发是 9 到 15 步）；六处"上一篇""第七篇"的引用换成了能单独读懂的句子。
