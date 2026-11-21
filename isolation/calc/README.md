# Checks behind page 14 · 第 14 篇里"你会看到"那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser, operates every interactive the way a reader would
  (following each "先玩 / Try first" prompt literally) and compares the readouts with the numbers quoted in the
  "你会看到 / What you will see" lines and the figure captions. A few checks redo the small arithmetic the text does
  itself (VM-exit cycles and microseconds, the (n + 1)(m + 1) − 1 page-table reads, the cgroup quota, layer sizes,
  Nix store paths, the driver rule v ≥ vmin(k)).
  Run: `node check.js /absolute/path/to/isolation/index.html` (needs Node and Playwright; about 3 minutes).

The numbers the page marks "我们测的 / measured" (the cost of a system call, starting a process and a container, the
OverlayFS copy-up, the memory and CPU limits) come from the programs in `../meas/` (see its README).

`check.js` 打开页面，按每一步"先玩"里写的顺序去点、去拖，把读数和正文里"你会看到"、图注里写的数逐个对一遍；另有几条重算正文里
自己做的小算术（VM 退出的周期数和微秒数、两层页表要读的次数、控制组的配额、层的大小、Nix 仓库里的路径数、驱动版本的规则）。
页面里标着"我们测的"的数，测量程序在 `../meas/` 里。
