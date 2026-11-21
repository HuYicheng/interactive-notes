# Checks behind page 10 · 第 10 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/reconstruction/index.html` (needs Node and Playwright; about 8 minutes,
  because the four training widgets are run to the end and then run again inside the page).

  **Part A, the widgets.** Each widget is operated the way a reader would, following its "先玩 / Try first" prompt
  literally: pressing buttons, moving sliders, picking pixels on the photo strips with the mouse, and letting the
  training widgets run until they stop. The readouts are compared with the numbers quoted in the "你会看到 / What
  you will see" lines. Numbers that no readout shows are recomputed inside the page with its own engine
  (`window.TB`: the scene, the cameras, the photos, the network, the grid and the Gaussian trainer), with the same
  loops and the same seeds as the widgets: how wide the stripes are in photo 13 and where the highlight sits in
  photos 1 and 10; which pixels of the plane sweep touch a stripe boundary; on which half the red rings lie (plane
  sweep and Gaussian depths); how far in the fused surface sits when the depth noise is 5 mm; how many samples fall in
  the fog and how much light is left behind it; the step at which the grid, the network and the Gaussians first pass
  25 or 35 dB; the errors at the handle, the highlight and the stripes when Gaussians cannot be added or carry a single
  colour; where the randomly scattered Gaussians start and end. The counts of the method map are read from the
  widget's groups and from its own list of 104 methods. The numbers stated in the six figures are recomputed too.

  **Part B, the text.** The numbers quoted in the formula cards and the paragraphs are recomputed with the same engine
  and compared with the text: each check first requires the quoted string to be in the page, then the recomputed value
  to round to it.

What the script cannot read, and how those statements are covered:
- Shapes described from the pictures (the network's field growing from a haze into a solid disc, the even pale disc
  without positional encoding, the coloured specks of the grid, the ragged curve at 5 mm of noise) were written from
  screenshots of the widgets; the script checks the numbers that stand next to them. That the visual hull keeps the
  hollow of the mug is checked with the engine (every sample point of the hollow survives the carving).
- Training is seeded, so every PSNR and every count is the same on every run in a Chromium browser. Other browsers may
  round a few mathematical functions differently, and the last digit of some numbers can then differ.
- Seconds and milliseconds per step depend on the machine. The text quotes them as measured on the machine that ran
  this script (a grid step seven or eight milliseconds, a network step about twenty, a Gaussian step about half a
  millisecond); `check.txt` prints the measured values and the script checks only their ratios, with wide bounds.
- Years, names and the results quoted from the cited papers (the training set-up of the NeRF paper, the table of the
  3DGS paper on the Mip-NeRF 360 dataset, and so on) are taken from those papers and are not recomputed.

Changes to the text made in this revision because of the checks:
- The worked example of the pinhole formula read "48 − 10.0 = 38.0"; 140 × 0.0181 / 0.252 is 10.06, so it now reads
  "48 − 10.06 = 37.94" (the exact value is 37.95).
- Durations "on an ordinary laptop" (two or three seconds, twenty-odd seconds, a second or so, nearly a minute) could
  not be checked and were replaced by the per-step times measured by this script.
- Four "Try first" prompts left a setting switched in a way that hid the comparison they ask for (too few samples
  when the fog is added; positional encoding still off when the grid is compared with the network; the two toggles of
  the Gaussian widget still off for the later questions; the prior on when switching to 7 photos). They now say when
  to switch things back.
- "Most bad points lie on the plain half, especially around the highlight" is now the checked count: 120 of the 166
  red rings are on the plain half.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖（照片条上的像素是用鼠标点的，
四个训练类的交互都让它训到自己停下），把读数和"你会看到"里写的数逐个对一遍；读数里没有的数，用页面自己的那套程序
（`window.TB`）在页面里重算，循环和随机种子都和交互一样：第 13 张照片里条纹各有多宽、第 1 张和第 10 张里高光在哪；
平面扫描里哪些像素挨着条纹的交界；红圈落在哪一半（平面扫描和高斯深度各算一次）；深度噪声 5 mm 时融合出的表面往里偏了多少；
有多少个采样点落在雾里、雾后面还剩多少光；格子、网络和高斯各在第几步第一次过 25 dB 或 35 dB；
不许增减高斯、或者高斯只有一种颜色时，把手、高光和条纹上的误差；随机撒的高斯开始和最后各在哪。
方法地图的个数是从交互的分组和它自带的 104 条方法清单里数的。六张图上写的数也这样重算。
第二部分把公式卡片和正文里的数用同一套程序重算，和正文逐条对照。

脚本读不到的：照着画面写的形状（网络的场从一团雾长成实心的圆盘、关掉位置编码后均匀的一片淡色、格子边上的彩色杂点、
噪声 5 mm 时坑坑洼洼的曲线）是对着交互的截图写的，脚本核对的是它们旁边的数；"视觉外壳削不掉空心"是用同一套程序核对的
（空心里取的每个点都没被削掉）。训练用的是固定的随机种子，在 Chromium 内核的浏览器里每次结果都一样；
别的浏览器算几个数学函数时舍入可能不同，个别数的末位会有出入。秒数和每一步的毫秒数随机器变：
正文里写的是跑这个脚本的那台机器上量到的（格子一步七八毫秒，网络一步二十毫秒左右，高斯一步约半毫秒），
`check.txt` 里印着实测值，脚本只用很宽的范围核对它们的比值。年份、人名和文献里的结果出自所引的文献，没有重算。

这次改版因为核对而改的地方：针孔公式的算例原来写"48 − 10.0 = 38.0"，可 140 × 0.0181 / 0.252 是 10.06，现在写
"48 − 10.06 = 37.94"（精确值是 37.95）；"在一台普通笔记本上"的几个时长没法核对，换成了这个脚本量到的每一步的时间；
四条"先玩"的提示照字面做下去，会停在一个看不出它要比较什么的设置上（加雾时采样点太少；格子和网络比的时候位置编码还关着；
高斯交互后面几问时两个开关还关着；换成 7 张时先验开着），现在都写明了什么时候把开关拨回去；
"坏点大多在素色的那一半，尤其是高光附近"换成了核对过的数：166 个红圈里有 120 个在素色那一半。
