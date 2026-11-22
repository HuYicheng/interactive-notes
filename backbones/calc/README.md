# Checks behind page 4 · 第 4 篇里那些数的核对

- `check.js` → `check.txt`: opens the page in a headless browser and checks its numbers against the page itself.
  Run: `node check.js /absolute/path/to/backbones/index.html` (needs Node and Playwright; about five minutes).

  **Part A, the interactives (133 checks).** Each of the 17 interactives is operated the way a reader would, following
  its "先玩 / Try first" prompt literally: pressing buttons, moving sliders, stepping through the walk-throughs, tapping
  the picture of the vision Transformer, walking the rows of the operation table with the keyboard. The readouts are
  compared with the numbers quoted in the "你会看到 / What you will see" lines, and every check first requires the
  quoted string to be in that line. The interactives are step-by-step demonstrations, not real-time simulations, so
  every readout is the same on every run.

  **Part B, the text (90 checks) and the figures (8).** The numbers quoted in the formula cards, the paragraphs, the
  tables, the summary and the quiz are recomputed with arithmetic written out in the script (parameter and
  multiply–add counts of the hand policy, ResNet-18, the recurrent layers, Llama 3.1 8B and 70B, Gemma 2B, SigLIP,
  ViT-B/16, Whisper small, the small U-Net and the π0-like model; the hand-worked examples of the neuron, the layer,
  the MLP, the convolution, the running average, attention and PointNet; number formats; reading times and tokens per
  second). ResNet-18 and the U-Net are counted by functions written independently of the interactives' code. Each
  check requires the quoted string to be in the page and the recomputed value to round to it.

What the script cannot read from the page, and how those statements are covered:
- Three things are drawn on a canvas only. (1) The number of calls of each network on the ten-second timeline: the
  interactive's own list of networks and its counting function `cnt()` are cut out of the page source and run
  unchanged, and compared with the one readout that shows a count. (2) The bars "what is left of an input after t
  steps" of the recurrent interactive: the interactive's own label formatter `fLeft()` is cut out and applied to 0.5¹⁰,
  0.9¹⁰, 0.982²⁰ and 0.5²⁰. (3) The colours of a chain of blocks: the main operation of every block of π0's chain is
  read from the chain's definition in the page source.
- "For the first 5 passes it still looks like pure noise; around passes 6 and 7 the bands begin to show; from pass 8
  on they are clear" (the action model's 10 refinement passes) was written from frames captured during playback. The
  script checks an equivalent quantity: the picture at pass k is k/10 × trajectory + (1 − k/10) × noise (the page's
  own formula and its own seeded data, cut out of the source and run inside the page), and its correlation with the
  finished chunk is 0.05, 0.13, 0.23, 0.35, 0.49, 0.65, 0.80, 0.92, 0.98, 1 for passes 1 to 10.
- "Pick another point and the feature strips look different" (PointNet): the script checks that another point with
  other coordinates is selected, and that the status line says the features are computed from one point alone.
- Numbers quoted from papers and data sheets are not recomputed: the wake-word networks of Hello Edge, the five sizes
  of Whisper, PointNet's table 6, the timings of π0 on an RTX 4090, Mixtral's 47 and 13 billion parameters, ResNet-50,
  the Diffusion Policy timing, the scaling laws, Thor's 2070 TFLOPS and the figures for B200. The chip budget of
  step ⑮ rests on stated assumptions (dense = sparse ÷ 2, each step up in precision halves the speed, half of the
  peak is usable); the script checks the arithmetic that follows from them. The token count of the sentence (about
  32), the synthetic sound, the synthetic kitchen picture and the lines of the attention arrows are illustrative and
  are marked so in the page.

Changes made in this revision because of the checks:
- Two "Try first" prompts did not lead to what they ask about when followed literally. Step ⑨ asked to drag the patch
  side to 8 right after setting the resolution to 896, which gives 12,544 tokens, not the 784 the text discusses: the
  prompt now says to set the resolution back to 224 first. Step ⑫ asked to compare the feature strips of several
  points before anything had been played, when no strips are drawn yet: the prompt now says to press ▶ Play first.
- The ridge points quoted in step ⑮ ("about 560 for B200, about 1900 for Thor") had no inputs on this page. The card
  now gives them (4.5 PFLOPS ÷ 8 TB/s; 517.5 TFLOPS ÷ 273 GB/s) and says that the interactive uses 7.7 TB/s, the
  rating of the 180 GB version of the B200.
- Thirteen interactives grouped long numbers with a thin space in Chinese ("131 072") while the text and the other
  four wrote a comma ("131,072"); all now write a comma, and so do the legend and the prompt of step ⑦.
- 23 references to other pages in the text and 5 inside interactives were replaced by a sentence that stands on its
  own or by a pointer to a step of this page.
- Five terms are now explained at their first use (token, tensor, inference, overfitting; softmax and sigmoid get a
  pointer to the steps that define them).

`check.js` 打开页面，分两部分核对。第一部分（133 条）照每一步"先玩"里写的顺序去操作 17 个交互：点按钮、拖滑块、
一步一步走完演示、点视觉 Transformer 的那张图、用键盘在积木表里一行一行走；把读数和"你会看到"里写的数逐个对一遍，
每一条都先确认这个数确实写在"你会看到"里。这一页的交互都是一步一步算给你看的演示，不是实时模拟，读数每次都一样。
第二部分把公式卡片、正文、表格、总结和小测验里的数用脚本里写明的算式重算（90 条），再核对 7 张图（8 条）：手的小策略、
ResNet-18、循环层、Llama 3.1 8B 和 70B、Gemma 2B、SigLIP、ViT-B/16、Whisper small、小 U-Net、π0 类模型的参数和
乘加；神经元、全连接层、多层感知机、卷积、滑动平均、注意力、PointNet 的手算例子；几种数的格式；读一遍权重的时间和
每秒几个词元。其中 ResNet-18 和 U-Net 是用和交互无关、另写的函数数的。

脚本读不到的：有三样只画在画布上。十秒时间轴上每个网络算了几次：把交互自己的网络清单和计数函数 `cnt()` 从页面
源码里原样取出来算，再和唯一显示次数的那个读数对一遍。循环网络那排"过 t 步还剩多少"的柱子：把交互自己写标签的函数
`fLeft()` 取出来，代入 0.5¹⁰、0.9¹⁰、0.982²⁰、0.5²⁰。积木链的颜色：从页面源码里 π0 那条链的定义读出每一块的主要运算。
"动作专家那 10 遍，前 5 遍还是一片噪点，第 6、7 遍前后色带开始显出来，第 8 遍以后已经很清楚"是对着播放时截下的画面
写的；脚本核对的是一个等价的量：第 k 遍的画面是 k/10 × 轨迹 + (1 − k/10) × 噪声（页面自己的公式和固定种子的数据），
它和最后那张动作块的相关系数，10 遍依次是 0.05、0.13、0.23、0.35、0.49、0.65、0.80、0.92、0.98、1。PointNet 那句
"换一个点，色带就换一个样"：脚本核对的是选中的点和它的坐标确实换了，以及状态栏写明特征只由这一个点算出。
出自论文和规格书的数没有重算：Hello Edge 的唤醒词网络、Whisper 的五种大小、PointNet 的表 6、π0 在 RTX 4090 上的
时间、Mixtral 的 470 亿和 130 亿、ResNet-50、Diffusion Policy 的时间、几条经验规律、Thor 的 2070 TFLOPS 和 B200 的数。
第 ⑮ 步的芯片预算建立在写明的假设上（稠密是稀疏的一半，精度每高一级速度减半，能用上峰值的一半），脚本核对的是
由这些假设推出来的算术。那句话的词元数（约 32 个）、合成的声音、合成的厨房照片、注意力箭头的粗细是示意，页面上
都标了。

这次改版因为核对而改的地方：两条"先玩"的提示照字面做下去看不到它问的东西（第 ⑨ 步刚把分辨率换成 896 就让你把块的
边长拖到 8，得到的是 12,544 个词元，不是正文讲的 784 个，现在写明先换回 224；第 ⑫ 步一上来就让你比几个点的特征条，
可那时还什么都没画，现在写明先 ▶ 播放一遍）；第 ⑮ 步的拐点（B200 约 560、Thor 约 1900）在这一页里没有出处，现在
卡片里写明了怎么算（4.5 PFLOPS ÷ 8 TB/s；517.5 TFLOPS ÷ 273 GB/s），并说明交互用的是单卖的 180 GB 版本标的
7.7 TB/s；13 个交互在中文里用空格给长数分组（131 072），正文和另外 4 个交互用逗号（131,072），现在统一成逗号，
第 ⑦ 步的图例和提示也跟着改了；正文里 23 处、交互里 5 处指向别的篇的地方，换成了能单独读懂的句子或者本篇里的某一步；
五个词在第一次出现时加了解释（词元、张量、推理、过拟合；softmax 和 S 形函数加了指向定义它们的那一步）。
