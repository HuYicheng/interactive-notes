# Checks behind page 7 · 第 7 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/generative/index.html` (needs Node and Playwright; about seven minutes,
  because the fits, the samplers and the live GAN are run, and the GAN is trained again step by step inside the page).

  **Part A, the interactives.** Each one is operated the way a reader would, following its "先玩 / Play first"
  prompt literally: pressing buttons, moving sliders, tapping and dragging on the pictures, letting the EM fits and
  the samplers finish and the GAN train for a few thousand steps. The readouts are compared with the numbers quoted
  in the "你会看到 / What you will see" lines. Numbers that no readout shows are recomputed inside the page with its
  own engine (`window.GEN`: the flower, the exact denoiser, score and velocity, the small networks and their
  optimiser, the random number generator), with the same loops and the same seeds as the interactives: the histogram
  of the one-dimensional flow and where its stretch is largest; the codes of the six shipped VAEs and what the point
  between two codes decodes to (the weights are read out of the page's script); the GAN at exact step counts; the
  true conditional distribution of the middle column; which blocks of the picture the noised training samples reach;
  how bent the diffusion routes are and how far the flow-matching and diffusion routes are apart; how many of the 50
  training lines cross; the action distribution at the robot's start. The counts of the method map are read from
  the groups the interactive builds.

  **Part B, the text.** The numbers quoted in the formula cards, the paragraphs, the legends and the figures are
  recomputed and compared with the text: each check first requires the quoted string to be in the page, then the
  recomputed value to round to it. Constants a legend states (learning rates, batch size, numbers of steps and
  particles) are compared with the interactive's own source text.

What the script cannot read, and how those statements are covered:
- Shapes described from the pictures (the blob pulled into a streak and folded back, thin bridges between the petals,
  clouds shrinking to dots, vertical streaks, smooth routes against jittery ones) were written from screenshots; the
  script checks the numbers next to them and, where it can, an equivalent computation (the flow's log p on a bridge
  against the truth; the width of the code clouds; the Gaussian head's mean and width in the middle column; the
  path length of the DDPM routes, about 12 times the straight line, against 1.2 for DDIM).
- All random numbers come from seeded generators, so every number is the same on every run in a Chromium browser,
  provided the buttons are pressed in the order of the prompt after loading the page. Other browsers may round a few
  mathematical functions differently, and the last digit of some numbers can then differ.
- The live GAN refreshes its "on a petal" and "petals that get samples" readouts only every few frames, so a paused
  readout can lag the step count by up to about a hundred steps. The numbers tied to step counts therefore come from
  a re-run inside the page with the same networks, optimiser, seed and order of random draws (its discriminator
  scores at given step counts agree with the interactive's), and the text gives the step counts as "about".
- Near z = ±0.32 the one-dimensional map is so steep that a hair's breadth changes the stretch by tens; the script
  checks that the readout there is large and computes the exact values (70.9 at -0.32, at most 73.3) by a scan.
- With 12 Gaussians the fit depends on the start the reader happens to be on after pressing "Refit" a few times: the
  text gives the range over the nine starts reachable with 0 to 8 presses, and the script runs all nine.
- Figure 1 is a small one-dimensional example whose numbers the script recomputes from the same 14 points. The strip
  of five panels in step ⑦ is a sketch drawn with the noising rule and a seeded generator of its own (not the
  page's). The curves of the figure in step ⑨ are the exact densities of the distance from the centre.
- Years, names and the results quoted from the cited papers (1000 steps for DDPM, 256 bins in RT-2, the default
  guidance of Stable Diffusion, the 16 / 8 action horizon and the 46.9% of Diffusion Policy, the sizes and rates of
  π0 and GR00T N1, and so on) are taken from those papers and are not recomputed.

Changes made in this revision because of the checks:
- The interactive of step ⑨ counted "distinct samples" by rounding to three decimals as text, so -0.000 and 0.000
  were different points: with every sample in the centre it showed 4 instead of 1. It now rounds numerically.
- The status of "Straightened once" quoted "the original 96%", while the readout of the original shows 94% for the
  first batch of noise; the sentence now carries no number.
- The prompt of step ⑪ did not say to press "Run 20 times" for the chunk policy; it does now.
- "In the first few steps every point first moves in towards the centre" is now "in the first step … a little": in
  the same loop as the interactive only the first step moves all 400 points inwards.
- One reference to the previous page was replaced by a sentence that stands on its own.
- Four formula rows that held two formulas separated by a Chinese comma are now one formula per row with a name
  above each; three rows too wide for a phone are set on two lines.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖（拟合和采样让它跑完，GAN 现练几千步），
把读数和"你会看到"里写的数逐个对一遍；读数里没有的数，用页面自己的那套程序（`window.GEN`：这朵花、精确的去噪器、
分数和速度场、小网络和优化器、随机数发生器）在页面里重算，循环和随机种子都和交互一样：一维流的直方图和拉伸倍数的
最大值；六个 VAE 的编码、两团编码之间的点解码到哪（权重是从页面脚本里读出来的）；GAN 在确切步数上的样子；正中那一列
真实的条件分布；加噪的训练样本铺到了画面的哪些块；扩散的路有多弯、Flow Matching 和扩散两种路线相距多远；50 条训练
直线里有多少条相交；机器人在起点的动作分布。方法地图的个数是从交互的分组里数的。第二部分把公式卡片、正文、图例和图里
的数重算一遍，和正文逐条对照；图例里写的常数（学习率、批大小、步数、粒子数）和交互自己的源码对照。

脚本读不到的：照着画面写的形状（圆团被拉成长条再折回来、花瓣之间的细桥、云缩成小点、竖条、光滑的路和抖着走的路）是
对着截图写的，脚本核对的是它们旁边的数，能算的地方再算一个等价的量。随机数都来自固定种子的发生器：刷新页面后照"先玩"
的顺序点，在 Chromium 内核的浏览器里每次结果都一样；别的浏览器算几个数学函数时舍入可能不同，个别数的末位会有出入。
现练的 GAN 每隔几帧才刷新一次"落在花瓣上"和"分到样本的花瓣"，暂停时看到的数可能比步数慢上一百步以内，所以跟步数
挂钩的数来自页面里的重跑（同样的网络、优化器、种子和抽随机数的顺序），正文里的步数都写成"上下"。z = ±0.32 附近那条
曲线陡得厉害，差一丝拉伸倍数就差几十，脚本只核对读数确实很大，确切的数（−0.32 处 70.9，最大 73.3）是扫出来的。
12 个高斯的结果跟停在第几个起点有关，正文写的是按 0 到 8 次"换个起点"能到的九个起点上的范围，脚本九个都跑了。
图 1 是一个一维小例子，脚本用同样的 14 个点重算；第 ⑦ 步那排五个小方格是按加噪规则、用它自己的固定随机数画的示意；
第 ⑨ 步那张图的曲线是"离中心多远"的精确分布。年份、人名和文献里的结果（DDPM 的 1000 步、RT-2 的 256 格、
Stable Diffusion 默认的引导强度、扩散策略的 16 / 8 和 46.9%、π0 和 GR00T N1 的规模和频率等等）出自所引的文献，没有重算。

这次改版因为核对而改的地方：第 ⑨ 步交互数"不同的样本"时把 −0.000 和 0.000 当成了两个点，所有样本都在花心时显示 4
而不是 1，已改；"拉直一次"的说明里写的"原来的 96%"和读数（第一批噪声是 94%）对不上，去掉了这个数；第 ⑪ 步的"先玩"
没说一次抽一段也要连跑 20 次，补上了；"前几步，所有点都先往花心那边缩"改成了"第一步…缩一点"（照交互的循环算，
只有第一步是 400 个点全往里缩）；一处"上一篇"的引用换成了能单独读懂的句子；四行用中文逗号隔开两个式子的公式拆成了
一行一个、上面各带名字，三行在手机上放不下的公式排成了两行。
