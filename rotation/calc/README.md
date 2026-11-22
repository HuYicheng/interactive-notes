# Checks behind page 1 · 第 1 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers and formulas against the page itself.
  Run: `node check.js /absolute/path/to/rotation/index.html` (needs Node and Playwright; about a minute).

  **Part A, the interactives.** Each one is operated the way a reader would, following its "先玩 / Play first" prompt
  literally: pressing buttons, moving sliders, dragging the pictures with the mouse one pixel at a time, and letting the
  animations finish. The readouts are compared with the numbers quoted in the "你会看到 / What you will see" lines; every
  check first requires the quoted string to be in that line. What no readout shows is recomputed inside the page, either
  with the interactive's own code, cut out of the page source and run unchanged, or with the page's shared helpers
  (`window.RX`): that numbers on the tangent which differ by 2π land on the same point of the circle; that the matrix shown
  after "Project back to SO(3)" equals U Vᵀ (computed in the script from an eigen-decomposition) and is nearer to the
  perturbed matrix than the starting matrix and than 3 000 other rotations; where the axes of the gimbal point at 90° of
  pitch; the totals and the speeds of the three interpolations.

  **Part B, the text.** The worked examples of the formula cards, the numbers in the paragraphs and in the figures are
  recomputed, and the formulas of the cards are written out again in the script and tested on a few hundred random
  orientations against the page's own conversion routines (Rodrigues' formula against the rotation by quaternion, the
  matrix exponential series, the nine entries of the Euler-angle matrix and of the quaternion matrix, all conversions
  there and back, the quaternion product and the sandwich, SLERP against R₀ · exp(t · log(R₀ᵀR₁)), the formula for the
  yaw rate against a finite difference, and so on). Rows that only define or name something (the set SO(3), the maps
  exp and log) have nothing to compute. Each check requires the quoted strings to be in the page.

What the script cannot read, and how those statements are covered:
- Shapes described from the pictures (the string wrapping round the circle, which ring moves, the arrows of different
  lengths after "Add a little error", the paths of the nose on the sphere) were written from screenshots; the script checks
  the numbers next to them and, where it can, the code that draws them (the arrow of the first interactive is drawn at
  angle φ, the dashed circle of the fourth with the radius of the part of v at right angles to the axis).
- Two interactives use chance: "Add a little error" in step 2 and "Random" in step 8. Before this revision they called
  the browser's random number generator; they now draw from a small seeded generator, so that the numbers quoted in the
  text appear on every reload when the buttons are pressed in the order of the prompt. The script checks that no
  interactive calls `Math.random`.
- In step 5 the numbers at the two jumps depend on the path of the drag. The text quotes a drag that is exactly vertical
  and one that is exactly horizontal, which is what the script does with the mouse, one pixel at a time; a hand-held drag
  strays a little, and the fold under the interactive says what is seen then (the script tries a drag that strays by one
  pixel in twenty).
- Names, years and the theorem of Stuelpnagel (1964) are taken from the cited sources and are not recomputed.

Changes to the text made in this revision because of the checks:
- Two worked examples whose printed steps did not chain: "10 / cos 89° ≈ 10 / 0.0175 ≈ 573" (10 / 0.0175 is 571; the card
  now prints 0.01745) and "0.541 × (1.707, 0, 0, 0.707) = (0.924, 0, 0, 0.383)" (0.541 × 1.707 is 0.923; the card now prints
  0.5412 and 1.7071).
- Ten formula rows contained Chinese words; they were split into rows with a name above each. "Degrees of freedom =
  numbers − constraints" became the three sums 3 − 0, 4 − 1, 9 − 6.
- The example of step 1 said the nose ends up pointing "left"; in the pictures of this page the plane is seen from the
  front and its y axis points to the right of the screen, so it now says "along the y axis (where its left wing used to point)".
- Twelve references to "the … section" and to "step 0" were renumbered: the page now has steps 0 to 8, and the
  circle-and-tangent interactive moved from step 0 to step 1.

`check.js` 打开页面，分两部分核对。第一部分照每一步"先玩"里写的顺序去点、去拖（拖动画面时鼠标一次挪一个像素，
动画都等它放完），把读数和"你会看到"里写的数逐个对一遍；读数里没有的，用交互自己的那段程序（从页面源码里原样
取出来运行）或页面共用的那套函数（`window.RX`）在页面里重算：切线上差 2π 的数落在圆上同一点；"投影回 SO(3)"
之后的矩阵等于 U Vᵀ（脚本自己用特征分解算的），而且比原来的矩阵、比另外 3000 个旋转都更靠近那个坏矩阵；pitch
到 90° 时万向节的几根轴各指向哪；三种插值的总转角和转速。第二部分把公式卡片里的算例、正文和图里的数重算一遍，
并且把卡片上的公式在脚本里重新写出来，拿几百个随机姿态和页面自己的换算函数对照（罗德里格斯公式、矩阵指数的
级数、欧拉角矩阵和四元数矩阵的九格、各种来回换算、四元数乘法和三明治、SLERP 和矩阵版本的插值、yaw 变化率公式
和差分，等等）；只是在下定义、起名字的那几行（SO(3) 这个集合、exp 和 log 两个映射）没有可算的。每条核对都先要求
引用的那句话确实在页面里。

脚本读不到的：照着画面写的形状（绳子怎样缠到圆上、哪个环在动、加了误差以后三根箭头长短不一、机头在球面上走的
路）是对着截图写的，脚本核对的是它们旁边的数，能查的地方再查一下画它们的那段程序。有两个交互用到随机（第 2 步的
"加一点误差"和第 8 步的"随机"）：这次改成了固定的随机数序列，刷新页面后照"先玩"的顺序按，每次看到的数都
一样；脚本也检查了没有交互再调用浏览器自己的随机数。第 5 步两处跳变时的数和拖动的路线有关：正文写的是正好竖直、
正好水平地拖，脚本就是这样一个像素一个像素拖的；手拖总会歪一点，交互下面的折叠块写了那时会看到什么（脚本也试了
每 20 个像素歪 1 个像素的拖法）。人名、年份和 Stuelpnagel（1964）的定理出自所引的文献，没有重算。

这次改版因为核对而改的地方：两个算例里印出来的步骤接不上（"10 / 0.0175 ≈ 573"其实是 571，现在写的是 0.01745；
"0.541 × 1.707 = 0.924"其实是 0.923，现在写的是 0.5412 和 1.7071）；十处公式里夹着汉字，拆成了一行一个、上面
带名字的式子，"自由度 = 数字个数 − 约束个数"换成了 3 − 0、4 − 1、9 − 6 三个算式；第 1 步的算例说机头最后"朝左"，
而这一页的图是从飞机前方看的，y 轴指向画面右边，现在写的是"指向 y 轴（它原来左翼的方向）"；十二处"某某一节""第 0 步"的引用按新的
步骤编号改过（现在是第 0 到第 8 步，"圆和切线"的交互从第 0 步挪到了第 1 步）。
