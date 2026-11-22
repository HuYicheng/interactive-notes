# Checks behind page 5 · 第 5 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/loops/index.html` (needs Node and Playwright; about three minutes).

  **Part A, the interactives.** Each one is operated the way a reader would, following its "先玩 / Play first"
  prompt: pressing buttons, moving sliders, tapping the scenes. The readouts are compared with the numbers quoted
  in the "你会看到 / What you will see" lines. What no readout shows is recomputed with the interactives' own
  simulation code. Every interactive of this page is a self-contained script, so the functions that advance its
  simulation are cut out of the page's HTML by name, together with the declarations in front of them, and run
  unchanged in Node (the "harness" at the top of `check.js`): how far the wheel speed dips on the carpet and how it
  swings after a change of target with a long speed window; how often the voltage sits at its limit with a 2 ms
  window; how long the arm swings without damping and where it ends in open loop; at which slider steps the stick
  falls; the largest values each loop of the drone asks for during a move, how far a gust blows it, how far it
  tilts and whether it flips at each slider step of the rate loop, and how far it overshoots with a large position
  gain; how long the current takes to rise with and without the current loop; how often each program of the vacuum
  has run after one lap, what happens to a box with perception on and off, with global planning off, with the wheel
  loop off and with the main computer frozen. Wherever a readout exists the copy is compared with it (for example
  the count of the wheel loop when the vacuum reaches its first goal). The tables behind three interactives (the
  layers × levels table, the five robots, the rows of the time zoom) are read from the page source.

  **Part B, the text.** The numbers quoted in the formula cards, the paragraphs, the quiz and the figures are
  recomputed and compared with the text: each check first requires the quoted string to be in the page, then the
  recomputed value to round to it.

What the script cannot read, and how those statements are covered:
- Five interactives are real-time simulations (the wheel, the arm, the stick, the drone, the vacuum), so a readout
  depends a little on the moment a button is pressed. Such numbers are quoted with "约 / about" and checked with a
  tolerance. Numbers quoted without it are steady-state readouts or come from interactives that compute rather
  than simulate in real time (PWM, the time zoom, the buses, the clocks), and were identical in every run of the
  script in a Chromium browser. Other browsers may round a few mathematical functions differently, and the last
  digit of some numbers can then differ.
- The stick and the drone are disturbed by small pseudo-random pushes whose sequence advances with the time the
  interactive has been running, so the moment at which a marginal setting fails differs from visit to visit. The
  text therefore gives the settings at which they fail as "about" and the times as "ten seconds or so", "a while";
  the script runs every slider step in the neighbourhood (the drone's rate loop between 12 and 14 Hz flips after
  anything from a few seconds to more than half a minute, and at one of the eight steps not within 40 s).
- The scenario cards of step ⑥ are narrated examples; their numbers are checked only where they can be recomputed
  (the voltage for 0.25 m/s, the extra torque and current of the heavier cup, the distance a car covers in 0.3 s).
- Shapes described from the pictures and the eight figures were checked by looking at screenshots.
- Rates, sizes and dates quoted from sources (Mini Cheetah, PX4, Betaflight, the real-time interfaces of Franka
  and UR arms, CAN and EtherCAT, PTP, Linux 6.12, and so on) are taken from those sources and are not recomputed.

Changes to the text and the interactives made in this revision because of the checks:
- Five "Play first" prompts did not lead to what they ask about when followed literally. Step ①: the window
  extremes were to be tried "moving the target a little", which at a 2 ms window and a target of exactly 0.30 m/s
  happens to look steady (one pulse per window); the prompt now names the targets to try, and says to take the
  carpet away and return the target to 0.30 before removing the integral, so that the reader sees the 0.24 m/s of
  the card. Step ②: open loop was selected with the arm already sagging 5°, so it fell to the mirror position at
  once; the prompt now says to press "Back to target" first, to return the weight to 1 kg before the PD loop, and
  to set K_d back to 4 before gravity compensation. Step ④: the drone flies to the right by itself as soon as it
  appears, so "tap far off to the right" changed nothing; the prompt now says to tap far left, to reset before
  raising k_x, and to set k_x back before turning the rate loop off. Step ⑤: the voltage drop was compared with
  the switching frequency still at 1 kHz. Step ⑧: the order of the switches is spelled out.
- Text: "below about 15 runs a second the drone flips" was too early (at 15 it swings to about 50° and stays up;
  it flips at 13 or 14 after a while), in the step and in the quiz; "the arm just keeps swinging" (it stops after
  several seconds); two worked numbers that did not follow from their own operands (4.2 ÷ 50 ≈ 0.085, now 0.084;
  4.2 ÷ 0.0175 ≈ 241, now = 240).
- Interactives: with a time offset of 1 or 2 ms the clock interactive said "aligned, the fused distance equals the
  true one" next to a readout of 6.2 m; the message now appears only while no point has left the car. The stick's
  status announced a fall between 56% and about 62% of T although the motor-controller case stands there; it now
  says the limit has been reached. The joint's status said the undamped arm "keeps swinging".
- One formula row held two formulas joined by a Chinese comma; the card of step ④ now has five named rows. Three
  cards gained rows for formulas that were only in the running text (the sag, feedforward, torque = K_t · i).
- Two references to other pages were replaced by sentences that stand on their own.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖，把读数和"你会看到"里写的数逐个
对一遍；读数里没有的数，用交互自己的仿真程序重算：这一页的每个交互都是一段独立的脚本，脚本把推进仿真的那几个
函数连同前面的声明按名字从页面的 HTML 里取出来，原样放到 Node 里运行（`check.js` 开头的 harness）。这样算了：
压上地毯时轮速掉到多少、测速窗口很长时改目标会晃几下，窗口只有 2 ms 时电压有多少时间顶在上限；没有阻尼时手臂
晃多久、开环时停在哪；杆在滑块的哪一格开始倒；无人机飞一段时各个环最多要多少、一阵风把它吹开多远、角速度环
每一格摆多大、翻不翻、位置环增益太大时冲过多少；有没有电流环时电流各爬多久；扫地机器人跑完一圈各个程序跑了
多少次，感知开着和关掉时放箱子、关掉全局规划、关掉轮速环、主电脑卡住时各会怎样。凡是有读数的地方，先拿这份
程序和读数对一遍。三个交互背后的表（层 × 级的大表、五种机器人、时间放大镜的各行）是从页面源码里读的。第二部分
把公式卡片、正文、小测验和图里的数重算，和原文逐条对照。

脚本读不到、或者不该读死的：五个交互是实时仿真（轮子、手臂、杆、无人机、扫地机器人），读数会随按下按钮的时刻
有一点出入，这类数在文中都带"约"，核对时留了容差；不带"约"的数是稳定后的读数，或者来自不是实时仿真的交互，
在 Chromium 内核的浏览器里每次运行脚本都相同。杆和无人机受到很小的伪随机扰动，扰动的序列随交互已经运行的时间
往前走，所以临界的设置下"什么时候倒、什么时候翻"每次不一样；正文写的是"约""十来秒""晃上一阵"，脚本把附近的
每一格滑块都跑了（无人机的角速度环在 12 到 14 Hz 之间，有的几秒就翻，有的半分钟以上，八格里有一格 40 秒内没翻）。
第 ⑥ 步的情景卡片是讲出来的例子，只核对了能重算的几处。照着画面写的形状和八张图是对着截图检查的。出自文献和
文档的频率、尺寸、年份没有重算。

这次改版因为核对而改的地方：五条"先玩"照字面做下去看不到它问的东西（第 ① 步在 2 ms 的窗口、目标正好 0.30 时
每个窗口差不多一个脉冲，看着是稳的，现在写明把目标拖到 0.20；去掉积分之前先取下地毯、目标调回 0.30。第 ② 步
选开环时手臂已经下垂了 5°，会立刻掉到对称的位置，现在先点"回到目标"；换 PD 前把重物调回 1 kg，重力补偿前把
K_d 调回 4。第 ④ 步无人机一出现就自己飞到右边，"点右边远处"什么也不发生，现在改成点左边；k_x 之前先复位，关
角速度环之前把 k_x 调回 1。第 ⑤ 步对比电压掉落时频率还停在 1 kHz。第 ⑧ 步把开关的顺序写清楚了）；正文三处
（"每秒 15 次以下就会翻"说早了，"手臂晃个不停"其实几秒就停，两个算例的数和自己的算式对不上）；三个交互的状态
说明（时间差 1、2 ms 时写着"对齐了，和真值一样"，旁边的读数已经是 6.2 m；杆在 56% 到 62% 之间写"扶不住"，
电机控制器那种情况其实立得住；没有阻尼的手臂写"晃个不停"）；一行用中文逗号连着两个公式的公式行拆开了，三张
卡片补上了原来只写在正文里的公式；两处对别的页面的引用换成了能单独读懂的句子。
