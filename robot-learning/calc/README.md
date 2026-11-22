# Checks behind page 3 · 第 3 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/robot-learning/index.html` (needs Node and Playwright; about three minutes).

  **Part A, the interactives (57 checks).** Each of the 10 interactives is operated the way a reader would, following
  its "先玩 / Play first" prompt literally: tapping the five stops of the spectrum, turning the knob step by step under
  each scoring, walking the mouse to both cheeses, moving the sliders, running value iteration sweep by sweep and
  Q-learning for hundreds of episodes, throwing 40 rounds of darts with and without the baseline, letting the dog walk
  the corridor, and moving the "real ice" slider through every one of its positions for each way of training. The
  readouts are compared with the numbers quoted in the "你会看到 / What you will see" lines, and every check first
  requires the quoted string to be in that line.

  **Part B, the text (34 checks) and the figures (9).** The numbers quoted in the formula cards, the lead paragraphs,
  the legends and the figures are recomputed with arithmetic written out in the script (discounted returns of the
  two routes, the geometric series, the squared errors, T²ε against Tε, the sigmoid and the log losses of the
  preference card, the Q-learning update, the dart example of the policy-gradient card, the corridor returns in
  closed form, the curling distances, the expected maximum of five noisy guesses by numerical integration). The
  values of the grid world come from the page's own engine (`window.GW`). Each check requires the quoted string to
  be in the page and the recomputed value to round to it.

What the script cannot read from the page, and how those statements are covered:
- Things that are only drawn. Where the student leaves the race track, how straight the averaged drone flies and
  how the demonstrated directions are distributed at the small circle are recomputed inside the page with the
  interactive's own code (track, expert, nearest-5 student, roll-outs; demonstrations, the three ways of producing
  an action, the flights), cut out of the page source and run unchanged; the same code is first required to
  reproduce a number the page does show (5 of 20 laps from 1235 pairs; 0, 2 and 8 of 8 flights).
- Ranges over many runs. "Averaging mostly gets none past and never more than 2; sampling every step 1 to 6; a
  whole chunk 5 to 8, usually 7 or 8" is taken over 40 batches for each way, with the interactive's own code and
  the seeds the "Fly 8 more times" button would use. "Optimistic Q-learning first reaches the big cheese between
  episode 7 and 14" is taken over 18 different histories (0 to 1000 plain episodes before the switch), because the
  interactive's random generator is never reset; "ε = 0.1 never reaches it" is checked for 5000 episodes and
  ε = 0.2, 0.3 and 0.4 for 5000 each.
- Colours and shapes ("all the lines from the darts are green", "wobbly paths", "the top right corner stays
  hatched") were written from screenshots; the script checks the status sentence beside them, which says the same.
- All random numbers come from seeded generators, so the readouts are the same on every run in a Chromium browser as
  long as the buttons are pressed in the order of the prompt after loading the page. The two exceptions are the
  "Slippery floor" of the grid world and the "Random θ" button of the knob experiment, which use the browser's own
  random numbers; the page says so, the script checks that no other interactive does, and no number in the text
  depends on them (the slippery floor is checked through the optimal policy, which is computed, not sampled).
- Numbers quoted from papers are not recomputed: VPT's 2,000 and 70,000 hours, the hour of comparisons of
  Christiano et al., the 49 Atari games of DQN, the 20 to 50 m circles of the bicycle agent, the 4 and 20 minutes of
  Rudin et al., the 1.5 cm of Tobin et al., the grasping data of Pinto and Gupta and of Levine et al., DayDreamer's
  hour, V-JEPA 2's hours of video, DAPG's 24 degrees of freedom, AlphaGo's 30 million positions, Open X-Embodiment's
  counts, and so on. They are linked to their sources in the page.
- The costs written beside the three imagined futures of figure 7 and the five guesses of figure 8 are
  illustrative, and the captions say so.

Changes made in this revision because of the checks:
- One "Play first" prompt did not lead to what it asks about when followed literally. In step 2, after "Let the
  expert drive" the noise slider acts on the expert, so "try σ at 0 and at 0.5" showed the expert, not the student:
  the prompt now says to tap "Back to the student" first.
- The Bellman card said that with a slippery floor "the optimal policy takes the long way round". At γ = 0.9, the
  value the page uses, it gives up the big cheese and takes the small one; the long way round is optimal only from
  γ = 0.93 up. The sentence now says exactly that.
- "With ±40% only 0.009 to 0.012 still ends in the house" came from a coarse probe; running every slider position
  gives 0.0085 to 0.0125, and the text now says so.
- Seven formula rows contained Chinese words or two formulas in one row ("训练：…", "规划：…", "想象：…",
  "更新：…", "高斯策略：…", the DAgger set with a condition in words, two formulas joined by a comma). Each row now
  holds one formula with its name above it, and the DAgger update is written with symbols that the card defines.
- The Q-learning update was 18 px wider than a 390 px phone screen; it is now set slightly smaller and fits.
- Behaviour cloning, simulation, potential, episode and the Bellman equation are now explained where they are first
  used (in two cases this was inside an interactive's status line or before a card).

`check.js` 打开页面，分两部分核对。第一部分（57 条）照每一步"先玩"里写的顺序去操作 10 个交互：点光谱上的五站；
三种打分各把旋钮一步一步拧过去；带老鼠走到两块奶酪；拖滑块；价值迭代一次一次地迭代，Q 学习跑几百个回合；
飞镖关着、开着基线各扔 40 轮；让狗把走廊走完；"真实冰面"的滑块在每一种练法下把每一格都拖一遍。读数和"你会看到"
里写的数逐个对一遍，每一条都先确认这个数确实写在"你会看到"里。第二部分把公式卡片、引子、图例和图里的数用脚本里
写明的算式重算（正文 34 条，图 9 条）：两条路线打完折的回报、等比数列、平方误差、T²ε 和 Tε、偏好卡片里的 σ 和
对数损失、Q 学习的一次更新、策略梯度卡片里那支镖、走廊上几种走法的回报（闭式）、冰壶滑的距离、5 个带误差的猜测里
最大那个的平均值（数值积分）。格子世界的价值用的是页面自己的那套程序（`window.GW`）。

脚本读不到的：只画在画布上的东西（学生在赛道哪里冲出去、取平均的无人机飞得有多直、小圆圈处示范方向怎么分布），
是把交互自己的代码从页面源码里原样取出来、在页面里重算的；这份代码先要算出页面上显示的那个数（20 圈跑完 5 圈、
1235 对；8 次里过去 0、2、8 次），才用它算别的。跨很多次的范围：三种出动作的办法各算 40 批；乐观初值"第 7 到 14
回合第一次碰到大奶酪"是在 18 种不同的点法（打开之前先跑 0 到 1000 个回合）上算的，因为这个交互的随机数序列从不
重置；"ε = 0.1 永远碰不到"跑了 5000 个回合，ε = 0.2、0.3、0.4 也各跑了 5000 个。颜色和形状（"线全是绿的""路线
歪歪扭扭""右上角一直是斜线"）是对着截图写的，脚本核对的是旁边那句说着同一件事的状态文字。随机数都来自固定种子
的发生器：刷新页面后照"先玩"的顺序点，在 Chromium 内核的浏览器里每次结果都一样；例外只有格子世界的"地板打滑"
和旋钮实验的"随机换一个 θ"，页面上写明了，脚本也核对了别的交互都不用浏览器自己的随机数，正文里没有哪个数依赖
它们。出自论文的数没有重算，页面上都链到了原文。图 7 里三串想象的代价、图 8 里五个猜测的数是示意，图注里写明了。

这次改版因为核对而改的地方：第 2 步的"先玩"照字面做，点了"专家亲自开"以后噪声滑块调的是专家，看不到学生，
现在写明先点"回到学生"；贝尔曼卡片里"打滑后最优策略改走远路"不准确，γ = 0.9 时它其实改拿小奶酪，0.93 以上才
绕远路，现在照实写了；"±40% 时只有 0.009 到 0.012 还进"是粗查的结果，逐格查是 0.0085 到 0.0125，已改；七行公式里
夹着中文或一行挤两条，现在一行一条、上面带名字，DAgger 的更新改用卡片里定义的符号来写；Q 学习的更新在 390 px
宽的手机上超出 18 px，现在字号略小、放得下；行为克隆、仿真、势能、回合、贝尔曼方程在第一次出现的地方加了解释。
