# Checks behind page 15 · 第 15 篇里"你会看到"那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser, operates every interactive the way a reader would
  (following each "先玩 / Try it" prompt literally) and compares the readouts with the numbers quoted in the
  "你会看到 / What you will see" lines and the figure captions. The last few checks redo the small arithmetic the text
  does itself (message rates, the 1 ms budget, the trapezoid and triangle velocity profiles, P = p^k, 27 vs 28 programs).
  Run: `node check.js /absolute/path/to/ros/index.html` (needs Node and Playwright; about 5 minutes).

The measurements the page marks "我们测的 / measured" and the counts it marks "我们数的 / counted" are in `../meas/`
(see its README): the IPC round trips, the 1 kHz wake-up latencies, message decoding in C and Python, the Python
garbage-collection pauses, the package counts per distribution and the lines of code per repository.

`check.js` 打开页面，按每一步"先玩"里写的顺序去点、去拖，把读数和正文里"你会看到"、图注里写的数逐个对一遍；最后几条重算正文里
自己做的那几笔小算术。页面里标着"我们测的""我们数的"的数，测量程序和计数脚本在 `../meas/` 里。
