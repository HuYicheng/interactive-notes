# Numbers quoted on page 8 · 第 8 篇正文里引用的数

- `check.js` → the first part of `numbers.txt`. It opens `world-models/index.html` in a headless browser, operates the
  interactives the way a reader would, and compares their readouts with the numbers the text quotes in the
  "你会看到 / What you will see" lines and in the formula cards: the planned pushes of step 0; one-step and multi-step
  errors of the three one-step models (step ①); what each way of choosing the push strength picks in the opening state
  (step ②); the pixel errors of the blurry prediction and of one sample, and how the guess narrows (step ③); what the
  three latents keep and how the small JEPA collapses (step ④); calls per step and success rates of MPC, tree search and
  the imagination-trained policy with a good and a poor model (step ⑤); the drifting video model (step ⑥); the
  counterfactual tests (step ⑦); the rank correlations, the score table and the worked example of Spearman's formula
  (step ⑧); and the number of methods on the map (step ⑨).
  It also recomputes, with the page's own simulated world (`WM.step`) and the 10 000-step model that ships with the
  page, the two statistics quoted in step ①: the finger touches the puck in 36% of the steps of the 24 held-out
  episodes, and those steps carry 67% of the growth of the open-loop error; and a push whose starting point is 1 mm
  off centre drifts sideways by 4.2, 10.4, 23.9 and 51.2 mm after 8, 12, 16 and 20 steps and ends 6.4 cm off, with the
  offset growing by about 1 + d/R = 1.23 per step (d = 2.5 cm per step, R = 11 cm, the two radii added).
- `ensstat.js` → the second part of `numbers.txt`: step ②'s comparison of the four ways of choosing the push strength.
  For each rule it presses "Start over" 12 times and keeps pressing "Try once" until the puck stops within 1 cm of the
  16 cm goal. Every rule gets there in 1 to 4 tries.

Run (Node with Playwright and its Chromium: `npm i playwright`, `npx playwright install chromium`):

```
node check.js   /absolute/path/to/world-models/index.html
node ensstat.js /absolute/path/to/world-models/index.html
```

What these scripts do not cover: the networks that ship with the page (the three one-step models, the policy practised
in imagination, the two models of the counterfactual test and the two frame models) were trained before the page was
written and are embedded in `index.html` as weights (`window.P8M`), together with the success rates over 200 starts
shown in step ⑤. Their training scripts are not in this repository, so the scripts above check that the text agrees
with the page as shipped; they do not retrain anything. The sizes and results quoted for published systems are the
figures given in the linked papers and official pages.

这两个脚本做的事：`check.js` 用无头浏览器打开页面，像读者一样操作各个交互，把读数和正文（每个交互后面的"你会看到"、
公式卡片里的算例）引用的数字逐个对照；另外用页面自己的"真实世界"和随页面发布的 1 万步模型，重算第 ① 步引用的两处统计
（手指贴着圆盘的步子占 36%，却贡献了 67% 的偏差增长；手指起点偏 1 mm 的那次推）。`ensstat.js` 重做第 ② 步里
"从头再来 12 次，四种挑法各要试几次"的统计。输出都在 `numbers.txt` 里。

脚本不管的部分：随页面发布的那些小网络是写页面之前训练好的，权重直接嵌在 `index.html` 里（`window.P8M`），第 ⑤ 步
"200 个开局"的成功率也存在一起；仓库里没有它们的训练脚本。所以这里核对的是"正文和页面对得上"，不是重新训练。
