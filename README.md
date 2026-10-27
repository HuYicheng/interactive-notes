# Interactive Notes · 交互笔记

Interactive, bilingual (中文 / English) explainers on computer vision, robotics and learning. Each page is a single self-contained HTML file: every formula comes with a symbol guide, a plain-words explanation and a small worked example you can check by hand, and the interactive demos run in the browser.

计算机视觉、机器人和机器学习方面的交互讲解，中英双语。每篇都是一个独立的 HTML 文件：每个公式都配了符号说明、白话解释和能手算的小例子，交互演示直接在浏览器里运行。

**Site · 网站: https://huyicheng.github.io/interactive-notes/**

The home page lists the explainers side by side, and each one lives in its own folder.

首页把各篇并排列出来，每篇各占一个文件夹。

| | Page · 页面 | Live page · 在线网页 | File · 文件 |
|---|---|---|---|
| 1 | Four Ways to Write a Rotation · 旋转的四种写法 | https://huyicheng.github.io/interactive-notes/rotation/ | `rotation/index.html` |
| 2 | From Depth to Registration · 从深度到配准 | https://huyicheng.github.io/interactive-notes/perception/ | `perception/index.html` |
| 3 | From Demonstration to Trial and Error · 从示范到试错 | https://huyicheng.github.io/interactive-notes/robot-learning/ | `robot-learning/index.html` |
| 4 | From Fully Connected to Attention · 从全连接到注意力 | https://huyicheng.github.io/interactive-notes/backbones/ | `backbones/index.html` |
| 5 | Loops Within Loops · 环环相扣 | https://huyicheng.github.io/interactive-notes/loops/ | `loops/index.html` |

Add `#en` to any address to open it in English, for example https://huyicheng.github.io/interactive-notes/perception/#en.

在网址后面加 `#en` 直接打开英文版。

## Layout · 目录结构

```
index.html                 home page, the explainers side by side · 首页，各篇并排
rotation/index.html        Four Ways to Write a Rotation · 旋转的四种写法
perception/index.html      From Depth to Registration · 从深度到配准
robot-learning/index.html  From Demonstration to Trial and Error · 从示范到试错
backbones/index.html       From Fully Connected to Attention · 从全连接到注意力
loops/index.html           Loops Within Loops · 环环相扣
```

## Open it · 打开方式

Open the live pages above in any browser, on a phone or a computer. There is no build step, so you can also download a page's `index.html` and open it offline.

直接打开上面的网址即可，手机和电脑都能用。页面不需要编译，下载对应的 `index.html` 后离线打开也行。

- **Language / 语言**: the 中 / EN button at the top right switches language and keeps your place on the page, and the choice carries over between the home page and every explainer. 右上角的「中 / EN」按钮一键切换，并停留在你正在读的位置；选好的语言在首页和各篇之间通用。
- **Cross-links / 互相链接**: each explainer links to the previous and next one at the top and at the bottom. 每篇的开头和结尾都有到上一篇、下一篇的链接。

## 1. Four Ways to Write a Rotation · 旋转的四种写法

Rotation representations in robotics: rotation matrices, Euler angles, axis-angle, quaternions, and the Lie groups and Lie algebras that tie them together.

机器人里的旋转表示：旋转矩阵、欧拉角、轴角、四元数，以及把它们串起来的李群和李代数。

0. Basics: ℝ³, dot and cross products, matrices, SO(3), the circle-and-tangent picture
1. Rotation matrix
2. Euler angles and gimbal lock
3. Axis-angle, rotation vectors, Rodrigues' formula, exp and log
4. Unit quaternions and the double cover
5. Lie groups and Lie algebras: so(3), kinematics, optimization on manifolds
6. Conversions between every pair of representations
7. Interpolation: SLERP versus Euler-angle lerp
8. Summary, how to choose, common pitfalls, symbol reference, a check question

Interactive demos: the circle and its tangent line, matrix columns and drift correction, a three-ring gimbal, Rodrigues' formula term by term, a drag-to-rotate comparison of all four representations, naive versus exp integration, and interpolation paths.

Conventions: `v′ = R · v`, so the columns of `R` are the body axes expressed in the world frame. Quaternions follow the Hamilton convention and are written `(w, x, y, z)`.

约定：矩阵作用方式是 `v′ = R · v`，`R` 的三列是物体三根轴在世界系里的方向；四元数按 Hamilton 约定，写成 `(w, x, y, z)`。

## 2. From Depth to Registration · 从深度到配准

How a depth camera measures distance, how a depth image becomes a point cloud, and how that point cloud is aligned with a pre-operative MRI, with the camera's intrinsics, extrinsics and every matrix along the way defined explicitly.

深度相机怎么测出距离，深度图怎么变成点云，点云又怎么和术前 MRI 对齐；重点讲清相机的内参、外参，以及沿途出现的每个矩阵。

0. Overview: one pipeline, a handful of matrices
1. The pinhole camera and homogeneous coordinates
2. Intrinsics `K` (fx, fy, cx, cy, skew), lens distortion, calibration
3. Extrinsics `[R | t]`, the camera centre `C = −Rᵀt`, `T_cam_world` versus `T_world_cam`, PnP, hand-eye calibration `AX = XB`
4. Putting it together: the projection matrix `P = K [R | t]` and the full camera playground
5. Depth and stereo: stereo extrinsics, the essential and fundamental matrices `E` and `F`, rectification, `Z = f·B / d`, block matching, the `Q` matrix
6. Back-projection with `K⁻¹`, moving the cloud into the robot base frame, normals from the covariance matrix
7. Registration and the Kabsch / SVD solution
8. ICP: point-to-point and point-to-plane, the 6×6 system `AᵀA` and how its eigenvalues reveal sliding
9. Summary: matrix cheat sheet, common pitfalls, a check question

Every matrix gets its own small interactive before its formula: dragging a point through a pinhole, the normalized grid that `K` stretches and shifts, lens distortion, the same scene drawn on world and camera grid paper (why `t` is not the camera position), hand-eye calibration with a deliberately wrong `X`, epipolar lines before and after rectification, the `Q` matrix with iso-disparity lines, normals from the covariance ellipse, the Kabsch vote dial, and the eigenvalues of `AᵀA` showing where ICP slides. A full camera playground then ties the intrinsics and extrinsics together (sliders for fx, fy, cx, cy, k1 and the camera pose, with `K`, `[R | t]` and `P` updating live, plus a dolly zoom), followed by stereo block matching, depth image to point cloud, and 2D ICP with outliers, pair rejection, point-to-plane and the sliding failure.

每个矩阵都先配一个只动它自己的小交互，再看公式；相机部分最后用一台完整的相机做大综合。

Conventions: the camera frame has x right, y down, z forward (the OpenCV and RealSense optical frame). The extrinsics `[R | t]` map world coordinates into camera coordinates, and `T_ab` is the pose of frame b in frame a.

约定：相机坐标系 x 向右、y 向下、z 朝前（OpenCV 和 RealSense 的光学坐标系）；外参 `[R | t]` 把世界坐标换算成相机坐标；`T_ab` 表示 b 坐标系在 a 坐标系里的位姿。

## 3. From Demonstration to Trial and Error · 从示范到试错

Robot-learning paradigms laid out along one spectrum of where the learning signal comes from: demonstrations, video, preferences, rewards, and no labels at all. For each stop: what problem it solves, its key ideas, what it is good at and where it breaks, with the representative papers linked inline.

机器人学习的几大范式，按"学习信号从哪来"排成一条光谱：示范、视频、偏好、奖励、无标签。每一站讲清它解决什么问题、核心概念、好在哪、坑在哪，代表性论文直接链到原文。

0. Overview: the spectrum, and what one piece of data looks like at each stop
1. Basics: state, action, policy, transition, reward, return, discount, value
2. Imitation learning: behaviour cloning, distribution shift, DAgger, noisy demonstrations, multimodality, action chunking
3. Variants of demonstration: learning from video with inverse dynamics, inverse RL and GAIL, preference learning and RLHF
4. Reinforcement learning: values, the Bellman equation, value iteration versus Q-learning, exploration, policy gradients and baselines, PPO and SAC
5. Rewards: reward hacking, potential-based shaping, sparse rewards, HER, curiosity
6. Sim to real: domain randomization, teacher-student training with privileged information
7. Self-supervision and world models: forward and inverse models, planning, Dreamer, play data
8. Combining them: imitation then RL, offline RL, vision-language-action models, and real systems placed on the spectrum
9. Summary: comparison table, rules of thumb, check questions, further reading

Interactive demos: the spectrum with a pancake-flipping data strip; a one-knob experiment comparing three ways of scoring; a grid world where you are the policy (discount and a slippery floor); behaviour cloning on a race track with DAgger and noisy demonstrations; a drone passing a tree (averaging versus sampling versus action chunks); value iteration versus Q-learning with ε-greedy and optimistic initial values; REINFORCE on a dartboard with and without a baseline; a robot dog that learns to pace instead of entering the door, fixed by potential shaping; curling with domain randomization; and seven real systems placed on the spectrum.

交互：光谱和翻煎饼的数据条；只有一个旋钮、比较三种打分的小实验；你来当策略的格子世界（折扣、地板打滑）；赛道上的行为克隆、DAgger 和加噪声示范；无人机绕树（取平均、逐步采样、动作块）；价值迭代和 Q 学习（ε-贪心、乐观初值）；飞镖靶上的 REINFORCE（有无基线）；只想刷分、在门口踱步的机器狗和势能塑形；冰壶和域随机化；七个真实系统在光谱上的位置。

Conventions: s state, a action, π policy, r reward, G return, γ discount factor; V and Q are values.

约定：s 状态，a 动作，π 策略，r 奖励，G 回报，γ 折扣因子，V 和 Q 是价值。

## 4. From Fully Connected to Attention · 从全连接到注意力

Neural-network backbones from scratch: what fully connected layers, convolutional networks, recurrent networks, U-Nets and Transformers look like, why they look that way, and what each is good and bad at. Every backbone mixes numbers and then bends them; they differ only in which positions get mixed and whether the weights are shared, and that choice is an assumption about the data. Also covers backpropagation, and why a diffusion model is not a backbone but a training objective plus a way of generating.

神经网络的主干结构从零讲起：全连接、卷积、循环、U-Net、Transformer 长什么样，为什么长这样，各有什么优劣。每种结构都是"混合，再弯一下"，区别只在混合哪些位置、权重共不共享，而这个选择就是对数据的假设。还讲了反向传播，以及扩散模型为什么不是一种主干，而是一种训练目标加一种生成方式。

0. Overview: four ways to connect a layer, and the inductive bias each one encodes
1. One layer: weighted sums and ReLU, universal approximation, backpropagation and the chain rule, why fully connected layers are not enough
2. Convolution: kernels, channels and parameter counts, receptive fields and stride, residual connections and vanishing gradients
3. Recurrence: hidden state, backpropagation through time, LSTM gates
4. U-Net: encoder, decoder and skip connections
5. Attention and Transformers: queries, keys and values, positional encoding, the Transformer block, ViT and GPT
6. Diffusion is not a backbone: the forward process, the noise-prediction loss, why one step collapses to the mean, backbone versus objective versus sampling
7. Putting it together: ResNet, ViT, GPT, Stable Diffusion, ACT, Diffusion Policy, π0 and Dreamer, block by block
8. Summary: comparison table, check questions, further reading

Interactive demos: the connectivity of each backbone and what one output can see; fitting curves with ReLU neurons (including one you draw); backpropagation through a three-layer network, step by step, with a check against a small nudge; a sliding convolution kernel with translation equivariance; receptive fields with and without stride; gradients through a deep plain versus residual network; memory fading in an RNN versus a gated memory; a simplified U-Net with skip connections off, copied or filtered; attention heads on a table of objects, with positional encoding and shuffling; diffusion on 2D data, noising and step-by-step generation; and eight real systems taken apart.

交互：四种连法和一个输出能看到哪些输入；用 ReLU 神经元拟合曲线（可以自己画）；三层小网络上一步步做反向传播，并真的拧一下来验证；滑动的卷积核和平移等变；有无步长时的感受野；普通深网络和残差网络里的梯度；循环网络的记忆衰减和加了门的记忆；可以关掉、原样抄或过滤跳连的简化 U-Net；桌上物体的注意力头，加上位置编码和打乱顺序；二维数据上的加噪和一步步去噪生成；拆开来看的八个真实系统。

Conventions: x input, h hidden output, y output, W and b weights and biases, ℓ loss.

约定：x 输入，h 中间层的输出，y 输出，W 和 b 是权重和偏置，ℓ 是损失。

## 5. Loops Within Loops · 环环相扣

The layers of an autonomous robot, from the task layer down to the motor's current loop, and the nested control loops that tie them together: how a loop closes, how fast each loop must run, why loops sit inside loops, how a drive turns a switch into a current, what each layer hands to the next, how five kinds of robot share the same skeleton, and how the hardware is wired together and kept in time. Examples come from robot arms, legged robots, self-driving cars, drones and robot vacuums.

自主机器人从任务层一直到电机电流环的层次，以及把它们串起来、一层套一层的闭环：一个环怎么闭上，每层要跑多快，环为什么套着环，驱动器怎么用开关控制电流，每层交给下一层什么，五种机器人怎么共用同一副骨架，硬件之间怎么连线、怎么对齐时间。例子来自机械臂、四足机器人、自动驾驶汽车、无人机和扫地机器人。

0. Overview: the 0.3 s after a robot is pushed, and the six layers
1. One loop: open versus closed loop, PD control as a spring and a damper, feedforward plus feedback
2. How fast: the falling time scale `T = √(l/g)`, sampling rate, delay, bandwidth, real-time and jitter
3. Loops within loops: a drone's position → velocity → attitude → rate cascade
4. The innermost loop: torque is current, PWM and ripple, the current loop, FOC, gearboxes and backdrivability
5. One robot from task to motor: a robot vacuum's layers and the interfaces between them, periodic versus event-driven layers, the watchdog and the bumper
6. Five robots, one skeleton: arm, quadruped, car, drone and vacuum; where learned policies sit; the data loop
7. Wiring: SPI, CAN, EtherCAT, Ethernet and ROS 2; time synchronisation; real-time computers; the safety circuit
8. Summary: table of layers, check questions, further reading

Interactive demos: a time magnifier that zooms from 100 s to 0.1 ms through every layer of a legged robot; a joint holding a weight in open loop, PD, and PD with gravity compensation; balancing a stick against sampling rate and delay; a drone cascade with the rate loop slowed down or switched off; PWM switching and a current loop riding out a supply sag; a robot vacuum whose layers you can switch off one by one, with a watchdog and a bumper; the loop rates of five kinds of robot; CAN arbitration bit by bit and an EtherCAT frame passing through the drives; and a camera and lidar whose clocks drift apart.

交互：从 100 秒拉近到 0.1 毫秒、看四足机器人每一层节拍的时间放大镜；托着重物的关节（开环、PD、PD 加重力补偿）；随采样频率和延迟变化的立杆；可以让角速度环变慢或关掉的无人机级联；PWM 开关和顶住电源波动的电流环；可以一层层关掉、带看门狗和碰撞开关的扫地机器人；五种机器人各层的频率；一位一位比的 CAN 仲裁和穿过驱动器的 EtherCAT 帧；时钟慢慢对不齐的相机和激光雷达。

Conventions: q joint angle, τ torque, a star marks a target handed down by the layer above; Hz means times per second.

约定：q 关节角，τ 力矩，带星号的是上一层给的目标；Hz 是每秒几次。

## Adding a page · 新加一篇

Put each new explainer in its own folder as `name/index.html`, link to other pages with relative paths such as `../rotation/`, and add a card for it on the home page.

每篇新的讲解放进自己的文件夹，写成 `name/index.html`；链接别的篇目用相对路径，比如 `../rotation/`；再在首页加一张卡片。

## Publishing · 发布

GitHub Pages serves the `gh-pages` branch, which mirrors `main`. After changing a page, push to both branches.

网页由 `gh-pages` 分支发布，内容和 `main` 一致；改了页面后，两个分支都要推。
