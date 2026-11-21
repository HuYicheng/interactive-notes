# Checks behind page 13 · 第 13 篇里"你会看到"那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser, operates every interactive the way a reader would
  (following each "先玩 / Try first" prompt literally) and compares the readouts with the numbers quoted in the
  "你会看到 / What you will see" lines and the figure captions. Where the text does a small sum itself, the script
  redoes it: the 1 / 350 ps clock limit, blocks and waves of a CUDA launch, the ridge point of the roofline, the time
  of one token on one and on eight GPUs, the 6ND training cost and the size of the data centre, the bytes a second
  from the sensors, clock drift in ppm, the latency budget, the reflex path. The fourteen answers of the quiz at
  the end of the page are recomputed as well.
  Run: `node check.js /absolute/path/to/silicon/index.html` (needs Node and Playwright; about 2 minutes).

What the script does not check: the figures the page takes from its sources (energy per operation, peak FLOPS, memory
bandwidth, prices and dates). Each of those has its link next to it on the page. Values the interactives assume are
marked "假设 / assumed" or "示意 / illustrative" on the page itself (for example the voltage in the clock tab, 8 blocks
per SM, 5 µs per all-reduce, 6 optical transceivers per GPU).

`check.js` 打开页面，按每一步"先玩"里写的顺序去点、去拖，把读数和正文里"你会看到"、图注里写的数逐个对一遍；正文里自己做的
小算术也重算一遍（时钟的上限 1 / 350 ps、CUDA 的块数和批数、屋顶线的拐点、一块和八块 GPU 上一个词元的时间、训练要的 6ND
次运算和数据中心的规模、传感器每秒的字节数、晶振的 ppm 漂移、延迟预算、递水那一下的反射路径），页面最后小测验的十四个答案
也都重算。页面从文献里引的数（每种操作的能量、峰值算力、内存带宽、价格和年份）不在这里核对，它们旁边都有出处链接；交互里
假设的数，页面上都标了"假设"或"示意"。
