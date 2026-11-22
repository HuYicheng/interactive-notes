# Checks behind page 2 · 第 2 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/perception/index.html` (needs Node and Playwright; about two minutes).

  **Part A, the interactives (87 checks).** Each of the 14 interactives is operated the way a reader would, following
  its "先玩 / Play first" prompt literally: dragging the point of the pinhole camera with the mouse, moving the sliders
  of the intrinsics, the distortion and the extrinsics, letting the arm sweep and the dolly zoom run to their ends,
  tapping pixels of the left stereo image and of the toy depth image, taking "another shot" five times, playing the
  two steps of the marker alignment, and running the 2D ICP to the end in each of the six settings of the prompt
  (its first setting also round by round). The readouts are compared with the numbers quoted in the "你会看到 / What
  you will see" lines, and every check first requires the quoted string to be in that line.

  **Part B, the text (24 checks) and the figures (3).** The numbers quoted in the formula cards, the lead paragraphs
  and the figures are recomputed with arithmetic written out in the script (the worked examples of the pinhole, K,
  distortion, extrinsics, projection, stereo, disparity, depth-error, Q, back-projection, covariance and Kabsch
  cards; the rank of the point-to-plane system on a sphere), or with the page's shared matrix helpers (`window.RX`).
  Each check requires the quoted string to be in the page and the recomputed value to round to it. The figure of the
  two triangles is measured in the page: it is drawn to scale, so d ÷ f = B ÷ Z holds for its own coordinates.

What the script cannot read from the page, and how those statements are covered:
- Things that are only drawn. Where the epipolar lines meet is computed with the interactive's own camera numbers:
  the six lines read from the readout all pass, within the rounding of the readout, through the image of the left
  camera's centre in the right camera, which lies outside the picture; the true image of a cube corner lies on its
  line. Which pixels of the toy depth image belong to the kettle, to the wall, or have no measurement comes from the
  interactive's own loop over its 32 × 24 pixels, cut out of the page source and run unchanged; the blank patch on
  the wall of the point cloud is the 204 pixels the kettle and the unmeasured pixels take away from it. That the
  "back" and "side" patches slide is checked through the outline itself: over both patches its radius is constant,
  so they lie on one circle about the centre of the kettle.
- How far each marker pair is off after a wrong label is computed with the interactive's own points and solver (cut
  out of the page source); the same code is first required to reproduce the readout (59.7° and 51.2°, 15.2 mm).
- Shapes described from the pictures (the grid bulging into a barrel or a pincushion, the cube looking exaggerated
  during the dolly zoom, the kettle squeezed or flattened by a wrong focal length) were written from screenshots; the
  script checks the numbers and the status lines next to them.
- All random numbers come from seeded generators (the script checks that no interactive uses the browser's own), so
  every number is the same on every run, provided the controls are used in the order of the prompt after loading the
  page. One readout depends on the speed of the browser: after "扫一遍 / Sweep" the hand-eye interactive keeps the
  purple points of the last 60 poses the animation happened to show, so their "spread" differs from machine to
  machine. The text therefore quotes the spread before the sweep (16.8 mm, four fixed poses) and, for the sweep, the
  error of each single pose (14.7 mm), which the script reads at eight poses.
- The focal length and the pixel size of the RealSense D435 (1.93 mm; OV9282 sensor with 3 µm pixels; depth up to
  1280 × 720) are taken from the manufacturer's data sheet and the sensor maker's product page, both linked in the
  card. Names of algorithms, OpenCV functions and the cited papers are not recomputed.

Changes to the text made in this revision because of the checks:
- Every "Play first" prompt now names the values to set, so that the numbers of its "What you will see" line can be
  reproduced. The hand-eye prompt says to press "Reset" before setting the angle error: the spread of the purple
  points depends on the poses visited before.
- The epipolar lines near the bottom of the picture make 4.3° to 4.8° with the horizontal: "less than 5°", not
  "about 5°".
- With 2.0 mm of noise the normal estimate on the back of the kettle reads λ₂ = 3.17 and 0.056 on the path of the
  prompt. (Pressing the "Back" button again while the noise is high selects a neighbouring point with 2.81 and 0.051:
  the button looks for the point nearest to its direction among the noisy points.)
- One wrong marker label does not pull all five pairs away, as the text and the status line said: one pair still
  fits within 1.3 mm. The text now says that the mislabelled pair is 25.0 mm apart and three of the other four more
  than 10 mm; the status line says that other points are pulled away with it.
- The 2D ICP does not "stop after about 60 rounds" because it has converged: 60 rounds is its limit. Its RMSE is
  2.5 mm, not "about 1 mm", when the true error is still 9.7 mm (round 12).
- The worked example of K used the focal length of the D435 with the principal point of a 640 × 480 picture; it now
  uses the centre of that camera's 1280 × 720 picture (u = 704.3, v = 321.4).
- References to other pages were replaced by sentences that stand on their own (rotation matrices, the 4×4
  transform and its subscripts, the cross-product matrix, the SVD, the small-rotation approximation).

`check.js` 打开页面，分两部分核对。第一部分（87 条）照每个交互"先玩"里写的顺序去操作：用鼠标拖针孔相机的那个点，
拖内参、畸变、外参的滑块，让机械臂"扫一遍"、让"推拉变焦"走完，在左图和玩具深度图上点像素，"重拍一张"按 5 次，
把标记点对齐的两步走一遍，再把二维 ICP 照提示里的六种设置各跑到停（第一种还一轮一轮地走了前 12 轮），然后把读数
和"你会看到"里写的数逐个对一遍。第二部分（24 条正文，3 条图）把公式卡片、引子和图里的数重新算一遍：算式直接
写在脚本里，要用到旋转矩阵的地方用的是页面自己的那套矩阵函数（`window.RX`）；两个相似三角形那张图是在页面里
量的，它按比例画，所以图上的 d ÷ f 等于 B ÷ Z。

脚本读不到的：只画在图上的东西，是用交互自己的数重算的（对极线交在哪：从读数里读出的六条线，都穿过左相机光心在
右图里的像，这个点在画面之外；玩具深度图里哪些像素是水壶、哪些是墙、哪些没测到：把交互自己那段循环从页面里剪出来
原样跑一遍；"背面""侧面"两块为什么会滑：轮廓在这两段上半径不变，是同一个圆）。标错一个点以后每一对差多少，用的
是交互自己的点和解法，先要它算出和读数一样的 59.7°、51.2° 和 15.2 mm。照着画面写的形状（网格鼓成桶形或凹成枕形、
推拉变焦时立方体越来越夸张、焦距调错时水壶被挤窄或压扁）是对着截图写的，脚本核对的是旁边的数和状态栏。随机数都
来自固定种子的发生器（脚本检查了没有哪个交互用浏览器自己的随机数），刷新页面后照"先玩"的顺序操作，每次结果都
一样。只有一个读数和浏览器的快慢有关：手眼标定"扫一遍"以后，交互只留着动画恰好经过的最后 60 个姿态的紫点，
"最远相差"因机器而异，所以正文写的是扫之前的 16.8 mm（四个固定的姿态）和每个姿态各自的误差 14.7 mm（脚本读了
八个姿态）。RealSense D435 的镜头焦距和像素尺寸出自厂商的数据手册和传感器厂商的产品页（卡片里有链接），算法、
OpenCV 函数和文献的名字没有重算。

这次改版因为核对而改的地方：每条"先玩"都写明了要调到的数，"你会看到"里的数才对得上；手眼标定的提示加了先按
"复位"（紫点散开多少，和之前经过哪些姿态有关）；画面靠下处的对极线是 4.3° 到 4.8°，"5° 左右"改成了"不到 5°"；
噪声 2.0 mm 时照提示的走法读到的是 λ₂ = 3.17、0.056；标错一个点并不会把五对点全带偏（有一对还在 1.3 mm 以内），
正文和状态栏都改了；二维 ICP"60 轮左右才停"其实是跑满了 60 轮的上限，"RMSE 很快降到 1 mm 左右"在第 12 轮是
2.5 mm；K 的算例把 D435 的焦距和 640 × 480 画面的主点配在一起，现在用的是它 1280 × 720 画面的正中；"上一篇"的
引用都换成了能单独读懂的句子。
