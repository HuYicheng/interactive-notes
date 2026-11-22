# Checks behind page 6 · 第 6 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/control/index.html` (needs Node and Playwright; about a quarter of an hour,
  because most interactives are real-time simulations and have to be watched in real time).

  **Part A, the interactives.** Each one is operated the way a reader would, following its "先玩 / Play first"
  prompt literally: pressing buttons, moving sliders, pulling the block with the mouse, and letting the simulations
  and the two trainings run. The readouts are compared with the numbers quoted in the "你会看到 / What you will
  see" lines. Numbers that no readout shows are recomputed inside the page with its own engine (`window.CTL`: the
  arm's dynamics, the integrator, LQR, iLQR, the random number generator) by copies of the interactives' loops, with
  the same constants and seeds: how the on-off swing grows and how long P takes to settle; the torque jitter with
  and without the D filter; the Kalman filter's poles; the size of the catch zone; when the state reaches the
  sliding line; when the safety filter starts editing the command and where the cart is at 1 s and 2 s; how many of
  300 runs of the jittering "learned policy" crash; at which iteration the random search comes within 10% of LQR;
  which of the first 12 batches of data get the arm upright with a learned model. Wherever a readout exists, the
  copy is first compared with it (the same gains after 150 and 300 iterations, the same error RMS, the same catch
  time, and so on). The counts of the method map and the cells of the humanoid timeline are read from the page.

  **Part B, the text.** The numbers quoted in the formula cards, the paragraphs, the quiz and the figures are
  recomputed with the same engine and compared with the text: each check first requires the quoted string to be in
  the page, then the recomputed value to round to it. Constants stated in the legends (limits, noise levels, rates)
  are looked up in the interactives' code.

What the script cannot read, and how those statements are covered:
- Most interactives run in real time, so a readout depends a little on the moment a button is pressed, and readouts
  taken over "the last second" of a noisy signal move from second to second. Such numbers are quoted with
  "约 / about" and checked with a tolerance (the on-off swing after 5 s and 20 s, the speed-estimate error, the
  torque noise, the chattering readouts, the times to reach upright, the force chatter of the admittance mode).
  Numbers quoted without "about" come out the same on every run after "重来 / Restart" (or after reloading the page
  and following the prompt in order): the simulations use fixed time steps and seeded random numbers, and those
  readouts were identical in every run of the script in a Chromium browser. Other browsers may round a few
  mathematical functions differently, and the last digit of some numbers can then differ.
- The time a computation takes per step (iLQR, MPPI) depends on the machine; the script prints what it measured and
  only requires both to be far below the 20 ms control period.
- "推一下 / Push" in three interactives pushes in a random direction (`Math.random`), so what follows is described
  in words and checked loosely (the imagination error jumps, then returns).
- Shapes described from the pictures (the trace circling along the dashed curve, the estimator poles moving right,
  the dashed gravity curve lying on the solid one, the cart coming to rest against the wall) were written from
  screenshots; the script checks the numbers next to them and, where it can, an equivalent computation (the largest
  gap between the learned and the true gravity curve, the poles themselves, the distance to the wall).
- Years, names and the results quoted from the cited papers (the share of PID loops in industry, the 800 Hz of the
  Atlas controller, the rates of Helix, the minutes of demonstration for ACT, and so on) are taken from those
  sources and are not recomputed.
- The statistics of the random search (median of 6 iterations and about 190 episodes; gains near (10.9, 2.5); none
  of 30 trainings holding 2.5 kg; after randomisation all 30 hold it near (18.0, 4.2) at a cost 23% above LQR at
  1 kg) are computed by the script for 30 trainings from the gains (3, 0.6) with the interactive's own seeds 2 to
  31: 60 iterations at 1 kg, then 60 with randomised masses.

Changes to the text and the interactives made in this revision because of the checks:
- The lead of step ① said the on-off swing was "nearly 19° peak to peak". In the interactive the swing grows (each
  reversal waits for the 1.5° dead band, so every swing feeds in a little energy): about 67° after 5 s and about
  90° after 20 s. The sentence and the interactive's status line now say so.
- Ten of the thirteen "Play first" prompts did not lead to what they ask about when followed literally, because a setting from
  the previous question was still in force: anti-windup was switched off without a new step (nothing happens);
  K_i was to be raised with K_d still at 0; differencing was to be tried with the torque cost still at 1 (the card's
  numbers are for 0.01); the energy pump with the torque limit still above 4; the 200 Hz question with k still
  below the model error; γ = 0 without a restart, ADRC with the 3 kg payload, and the payload removal with γ = 5 and
  no word on which controller; the pull by hand with K still at 5 000; "plan once" with MPPI still chosen; the
  learned policy with γ still at 20; and 50 samples with the linear model still chosen. Each prompt now says what
  to set back. One of them also promised that the chattering disappears "at about 3 °/s"; that holds at 1.5× mass,
  while on the prompt's path (2× mass) it is 2 °/s.
- Text numbers: the differencing readings were said to lie "between 80 and 90 °/s" (over two minutes of the loop
  they range from about 70 to 100, mean 88); the ADRC torque noise at ω_o = 150 is 0.21, not 0.20 N·m; the gains
  after domain randomisation are near (18.0, 4.2), not (18.4, 4.2), and the cost at 1 kg is about 23% above LQR, not
  25%; the one-step error of the default learned model is about 6%, not "6–8%".
- Interactives: the impedance status said "force ≈ K × 3 cm ≈ … N, almost regardless of the wall" for every wall,
  which for a soft wall printed lines like "5000 × 3 cm ≈ 43 N"; it now names the series stiffness and says when
  the wall matters. The safety-filter status kept the time of the last crash across runs and so reported "it still
  crashed" in clean runs; the time is now cleared at the start of each run.
- Nine formula rows contained Chinese words; they are now separate rows with a name above each, and the wall, the
  series stiffness and the target angle have Latin symbols (k_w, K_s, r).
- Twelve references to other pages (ten in the text, two in labels of the method map) were replaced by sentences
  that stand on their own.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖（方块是用鼠标拉的，仿真和两次
训练都让它跑完），把读数和"你会看到"里写的数逐个对一遍；读数里没有的数，用页面自己的那套程序（`window.CTL`：
杆的动力学、积分器、LQR、iLQR、随机数发生器）把交互的循环照抄一遍在页面里重算，常数和随机种子都一样：开关
控制的晃动怎么变大、P 要多久才停，有没有微分滤波时力矩各抖多大，卡尔曼滤波的极点，接住区有多大，状态什么时候
到滑模面，安全滤波从哪一刻开始改命令、1 秒和 2 秒时小车在哪，"学出来的策略"跑 300 回合撞几回，随机搜索第几轮
进入 LQR 的 10% 以内，用学出来的模型时前 12 批数据里哪几批立得住。凡是有读数的地方，先拿这份照抄的循环和读数
对一遍（150 轮和 300 轮后的增益、误差均方根、接住的时刻等都一样）。方法地图的个数和人形时间线的格子是从页面
里数的。第二部分把公式卡片、正文、小测验和图里的数用同一套程序重算，和原文逐条对照；图例里写的常数（上限、
噪声、频率）在交互的代码里核对。

脚本读不到、或者不该读死的：大多数交互是实时仿真，读数会随按下按钮的时刻有一点出入，"近 1 秒"的读数还会一秒
一变，这类数在文中都带"约"，核对时留了容差（开关控制 5 秒和 20 秒后的晃动、速度估计误差、力矩噪声、颤振时的
读数、到达竖直的时间、导纳模式的力抖动）。不带"约"的数，是点"重来"以后（或者刷新页面后照"先玩"的顺序做）
每次都一样的：仿真用固定步长和固定种子的随机数，在 Chromium 内核的浏览器里每次运行脚本这些读数都相同；别的
浏览器算几个数学函数时舍入可能不同，个别数的末位会有出入。每步计算花几毫秒和机器有关，脚本只打印测到的值，
并要求它远小于 20 ms 的周期。三个交互里的"推一下"方向是随机的，只做了文字描述和宽松的核对。照着画面写的
形状（轨迹贴着虚线绕圈、估计器极点往右走、学到的重力虚线压在实线上、小车贴着墙停住）是对着截图写的，脚本
核对的是旁边的数和等价的计算。年份、人名和文献里的结果没有重算。随机搜索的统计数（中位数 6 轮、约 190 个
回合；(10.9, 2.5)；30 次训练都撑不住 2.5 kg；随机化以后 30 次都撑得住，增益在 (18.0, 4.2) 附近，1 kg 时代价
比 LQR 高 23%）是脚本用交互自己的种子 2 到 31、从 (3, 0.6) 出发各训练 60 轮（1 kg）再 60 轮（随机质量）算出来的。

这次改版因为核对而改的地方：第 ① 步原来说开关控制"晃动的峰峰值将近 19°"，实际上它越晃越大（5 秒后约 67°，
20 秒后约 90°），正文和交互的状态说明都改了；十三条"先玩"里有十条照字面做下去看不到它问的东西（上一问的设置还留着），
现在每条都写明要调回什么；四处正文的数改了（差分的读数范围、ADRC 的力矩噪声、域随机化后的增益和代价、默认
模型的单步误差）；阻抗的状态说明在墙软时会写出"5000 × 3 cm ≈ 43 N"这样的式子，现在改成按串联刚度说；安全
滤波的状态说明会把上一回合的撞墙记到下一回合，现在每回合开始时清掉；九行带汉字的公式拆成了带名字的行；十二处
"上一篇"的引用（正文十处，方法地图的标注两处）换成了能单独读懂的句子。
