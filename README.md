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
| 6 | From PID to World Models · 从 PID 到世界模型 | https://huyicheng.github.io/interactive-notes/control/ | `control/index.html` |
| 7 | From Noise to Samples · 从噪声到样本 | https://huyicheng.github.io/interactive-notes/generative/ | `generative/index.html` |
| 8 | Try It in Your Head · 在脑子里试一试 | https://huyicheng.github.io/interactive-notes/world-models/ | `world-models/index.html` |
| 9 | Which Way to Turn Each Knob · 每个旋钮往哪拧 | https://huyicheng.github.io/interactive-notes/differentiable/ | `differentiable/index.html` |

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
control/index.html         From PID to World Models · 从 PID 到世界模型
generative/index.html      From Noise to Samples · 从噪声到样本
world-models/index.html    Try It in Your Head · 在脑子里试一试
differentiable/index.html  Which Way to Turn Each Knob · 每个旋钮往哪拧
toc.js                     the Contents panel shared by every page · 各篇共用的目录面板
```

## Open it · 打开方式

Open the live pages above in any browser, on a phone or a computer. There is no build step, so you can also download a page's `index.html` and open it offline.

直接打开上面的网址即可，手机和电脑都能用。页面不需要编译，下载对应的 `index.html` 后离线打开也行。

- **Language / 语言**: the 中 / EN button at the top right switches language and keeps your place on the page, and the choice carries over between the home page and every explainer. 右上角的「中 / EN」按钮一键切换，并停留在你正在读的位置；选好的语言在首页和各篇之间通用。
- **Contents / 目录**: the 目录 / Contents button in each page's top bar opens a list of every explainer and its sections; the current page is expanded. 每篇顶栏的「目录」按钮展开全部篇目和各篇的小节，当前这篇默认展开。
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

The two hierarchies every robot shares: six functional layers divided by job (sensing, perception and estimation, decision, planning, control, actuation), and nested loop levels divided by speed, from the task loop down to the motor's current loop; how the two line up and where they differ, how a loop closes, how fast each loop must run, why loops sit inside loops, how a drive turns a switch into a current, what a robot's programs hand to one another, how five kinds of robot share the same skeleton, and how the hardware is wired together and kept in time. Examples come from robot arms, legged robots, self-driving cars, drones and robot vacuums.

每台机器人都有的两套层次：按分工分的六层（传感、感知与估计、决策、规划、控制、执行），和按快慢分、从任务环一直套到电机电流环的几级环；两者怎么对应、哪里不同，一个环怎么闭上，每一级要跑多快，环为什么套着环，驱动器怎么用开关控制电流，各个程序之间交什么，五种机器人怎么共用同一副骨架，硬件之间怎么连线、怎么对齐时间。例子来自机械臂、四足机器人、自动驾驶汽车、无人机和扫地机器人。

0. Overview: the six functional layers every robot has; one complete textbook control loop (target, comparator, error, controller, actuator, plant, sensor, measurement, disturbance, noise) on a robot vacuum's wheel; how feedback is built; the vacuum's three nested loop levels; layers versus levels, and a grid of loop levels by layers for five robots; five robots moment by moment
1. One loop: open versus closed loop, PD control as a spring and a damper, feedforward plus feedback
2. How fast: the falling time scale `T = √(l/g)`, sampling rate, delay, bandwidth, real-time and jitter; the 0.3 s after a robot is pushed
3. Loops within loops: a drone's position → velocity → attitude → rate cascade
4. The innermost loop: torque is current, PWM and ripple, the current loop, FOC, gearboxes and backdrivability
5. One robot from task to motor: a robot vacuum's seven programs and the interfaces between them, periodic versus event-driven programs, the watchdog and the bumper
6. Five robots, one skeleton: arm, quadruped, car, drone and vacuum; where learned policies sit; the data loop
7. Wiring: SPI, CAN, EtherCAT, Ethernet and ROS 2; time synchronisation; real-time computers; the safety circuit
8. Summary: a table of layers and a table of loop levels, check questions, further reading

Interactive demos: a textbook loop on a vacuum's wheel where you can roll onto carpet, cut or reverse the feedback, drop the integral term and change the encoder window; the vacuum's task, route and wheel loops drawn as three complete loops, each outer loop using the next as its actuator; a grid of loop levels by functional layers for five robots, with each level's rate, chip and algorithms; five scenarios (a robot vacuum cleaning a kitchen, an arm putting a cup on a shelf, a car meeting a pedestrian, a drone delivering a parcel, a quadruped climbing stairs) that show, at each key moment, what each loop wants, measures, its error and its output, and which loop reacts first; a time magnifier that zooms from 100 s to 0.1 ms through every program of a legged robot; a joint holding a weight in open loop, PD, and PD with gravity compensation; balancing a stick against sampling rate and delay; a drone cascade with the rate loop slowed down or switched off; PWM switching and a current loop riding out a supply sag; a robot vacuum whose programs you can switch off one by one, with a watchdog and a bumper; the loop rates of five kinds of robot; CAN arbitration bit by bit and an EtherCAT frame passing through the drives; and a camera and lidar whose clocks drift apart.

交互：扫地机器人一个轮子的教科书式控制环，可以压上地毯、断开或接反反馈、去掉积分、改编码器的测速窗口；画成三个完整环的任务环、路线环、轮速环，外面的环把里面的环当执行器；五台机器人的几级环乘六层的大表，写着每一级的频率、芯片和算法；五个场景（扫地机器人扫厨房、机械臂把杯子放上架子、汽车遇到行人横穿、无人机送包裹、四足机器人上楼梯），在每个关键时刻看每个环想要什么、测到什么、误差多少、交出什么，哪个环先反应；从 100 秒拉近到 0.1 毫秒、看四足机器人每个程序节拍的时间放大镜；托着重物的关节（开环、PD、PD 加重力补偿）；随采样频率和延迟变化的立杆；可以让角速度环变慢或关掉的无人机级联；PWM 开关和顶住电源波动的电流环；可以一个个关掉程序、带看门狗和碰撞开关的扫地机器人；五种机器人各级的频率；一位一位比的 CAN 仲裁和穿过驱动器的 EtherCAT 帧；时钟慢慢对不齐的相机和激光雷达。

Conventions: r a loop's target, y its output, e its error, u its command; q joint angle, τ torque, a star also marks a target handed down by the layer above; Hz means times per second.

约定：r 是一个环的目标，y 是输出，e 是误差，u 是命令；q 关节角，τ 力矩，带星号的也是上一层给的目标；Hz 是每秒几次。

## 6. From PID to World Models · 从 PID 到世界模型

The whole spectrum of control methods, told on one motor-driven pendulum arm. Every controller is an approximate answer to the same problem (choose commands that minimise a cost, subject to the physics, noisy measurements and limits); methods differ in where the model comes from, when the work is done, how far ahead they look and how they handle uncertainty. The page places each method in the six functional layers and loop levels of page 5, answers why PID still dominates the fastest loops, where the model sits in model-based and model-free control, why reinforcement learning is what carried humanoid robots to where they are now, and what world models add.

控制方法的全景，全篇用同一根电机带动的摆杆来讲。每种控制器都是在近似地解同一道题（在物理规律、带噪声的测量和各种限制之内，选出让代价最小的命令）；方法之间的区别在于模型从哪来、什么时候算、往前看多远、怎么对付不确定。还讲了每种方法坐在上一篇"六层、几级环"里的什么位置，PID 为什么至今统治着最快的那几级环，model-based 和 model-free 里的"模型"到底放在哪，为什么是强化学习把人形机器人带到了今天，以及世界模型带来了什么。

0. Overview: the optimal control problem every controller attempts, four questions that tell methods apart, a map of 51 methods, where control sits among the layers and loop levels, and why methods merge layers but rarely levels
1. PID: P, I and D as spring, memory and damper, steady-state error, integrator windup, derivative noise, feedforward; why PID is still king, and why PI for first-order plants and PD for second-order ones
2. Frequency: open-loop frequency response, crossover and bandwidth, phase margin, how delay eats phase, the Smith predictor, the waterbed effect
3. State space: the inverted pendulum's linear model, LQR as optimal state feedback (and as a PD law), the value function `xᵀPx`, the Kalman filter, LQG and the separation principle
4. Nonlinear: gain scheduling, computed torque and feedback linearisation, energy-based (Lyapunov) swing-up, switching to LQR in a verified catch region
5. Uncertainty: sliding mode and H∞ (overpower it), disturbance observers, ADRC and adaptive control (estimate it), iterative learning control (learn it)
6. Contact: impedance, admittance and force control; whole-body control as a quadratic program
7. Looking ahead: model predictive control, receding horizon and constraints, iLQR versus MPPI, open-loop plans versus re-planning, MPC in industry and legged robots
8. Learning: reinforcement learning as approximate dynamic programming, random search finding the LQR gains, domain randomisation, what deep networks do in control, imitation learning, safety filters with control barrier functions
9. Models: the five places a model can sit, what model-based and model-free each buy and need, world models for planning, imagination and data
10. Humanoids: eight waves from static walking to world models, why reinforcement learning won, the current VLA-plus-RL stack, the role of world models
11. Summary: a lineage table, answers to the opening questions, check questions, further reading

Interactive demos: a map of 51 control methods by model source and timing, colourable by era, look-ahead, uncertainty handling and loop level, with each method's relatives; on-off, P, PI, PD and PID holding the arm against gravity, with anti-windup, feedforward, sensor noise and derivative filtering; Bode plots and step responses with delay; LQR balancing with cost-to-go ellipses, poles, and velocity from differencing versus a Kalman filter; energy swing-up with an LQR catch region; sliding mode versus PD under model error, with chattering and a boundary layer; PD, PID, adaptive control and ADRC when a payload is attached; position, impedance, admittance and force control against walls of different stiffness; MPC swing-up with iLQR or MPPI, horizon, torque limit, model error and open-loop playback; random search learning the balancing gains on a cost landscape, with domain randomisation; a safety filter in front of an aggressive or noisy controller; learning a model from data and planning with it; and a table of humanoid control waves showing which layers were hand-written, optimised online or learned.

交互：按"模型从哪来"和"什么时候算"排开的 51 种控制方法地图，可以按年代、往前看多远、怎么对付不确定、常在哪一级环上色，并查看每种方法的"亲戚"；托着重物的摆杆，比较开关、P、PI、PD、PID，带抗积分饱和、重力前馈、测量噪声和微分滤波；带延迟的伯德图和阶跃响应；倒立摆的 LQR，画出剩余代价的椭圆、极点，以及差分和卡尔曼滤波估出的速度；能量泵摆起加 LQR 接住区；模型有误差时的滑模和 PD，颤振和边界层；突然挂上负载时的 PD、PID、自适应控制和 ADRC；位置、阻抗、导纳、力控碰到不同硬度的墙；用 iLQR 或 MPPI 做摆起的 MPC，可以调预测时长、力矩上限、模型误差，或者只规划一次；在代价地图上用随机搜索学平衡增益，加上域随机化；挡在激进或抖动的控制器前面的安全滤波；从数据里学模型再用它做 MPC；以及人形机器人一波又一波的控制，每一层是人写的、在线优化的还是学出来的。

Conventions: θ is the arm's angle (0 hanging, 180° upright), φ the angle from upright, ω the angular velocity, τ or u the motor torque; x state, r target, e error, J total cost, V(x) the value function.

约定：θ 是摆杆的角度（0 垂下，180° 竖直），φ 是偏离竖直的角度，ω 是角速度，τ 或 u 是电机力矩；x 是状态，r 是目标，e 是误差，J 是总代价，V(x) 是价值函数。

## 7. From Noise to Samples · 从噪声到样本

The whole spectrum of generative models, told on one small example: an eight-petal "flower" of points in the plane. Every generative model answers the same question (how to turn a handful of random numbers into a new sample that looks like the data without copying it), and each step starts from the problem the previous method ran into. The page then takes the questions that cut across all methods: what a generative model actually learns, why sampling almost always starts from a Gaussian and whether it has to, how to make generation fast and controllable, and how robots use generative models for actions, rewards, planning and world models.

生成模型的全景，全篇只用一个小例子：平面上一朵由点组成的八瓣"花"。所有生成模型都在回答同一个问题（怎样把一把随机数，变成一个像数据、又不是照抄的新样本），每一步都从上一种方法撞上的毛病讲起。走完一圈，再回答几个横跨所有方法的问题：生成模型到底学了什么，为什么总从高斯出发、是不是非它不可，怎样让生成又快又听话，以及机器人怎样用生成模型来出动作、给奖励、做规划、当世界模型。

0. What generation is: looking right, varied and new at once; how copying, scattering at random and averaging each fall short; why "the average" keeps coming back
1. The simplest models: one Gaussian, Gaussian mixtures fitted by EM, maximum likelihood, kernel density estimation and memorising, training versus test scores
2. Flows: matching by rank in one dimension (change of variables), invertible layers in two (normalizing flows), and the bridge they cannot cut between petals
3. VAE: encoder, decoder and the evidence lower bound, the KL weight β, blurry samples and posterior collapse
4. GAN: a generator against a discriminator, trained live, mode collapse and oscillation
5. Autoregression: one coordinate at a time, numbers as tokens, temperature
6. Energy and score: unnormalised densities, the score, Langevin dynamics, annealing over noise levels
7. Diffusion: adding noise, the best denoising guess (Tweedie), DDPM and DDIM sampling, why a single step lands on the average
8. Flow matching: straight-line pairs, the learned velocity field, why the paths still bend, reflow
9. Why a Gaussian: randomness has to come from somewhere, what makes the Gaussian convenient, the soap-bubble shape of high-dimensional noise, and the alternatives (uniform noise, masks, a single point with randomness along the way, a rough answer close to the data, non-Gaussian noise)
10. Fast, and on request: better solvers, straighter paths, distillation and one-step models, latent spaces, conditions and classifier-free guidance
11. Robots: demonstrations with several right answers, regression versus generative policies, action chunks, VLAs, imitation and style rewards, planning, grasps, inverse kinematics and world models
12. The spectrum: a map of 64 methods, grouped by what is learned, whether the probability can be computed, steps to generate, training, era and use in robots
13. Summary: what a generative model learns, a comparison table of the families, how they relate, answers to the opening questions, a quiz, further reading

Interactive demos: four kinds of "generation" on the flower (draw new points, copy, scatter, average) with readouts for realistic, diverse and new; one Gaussian, a Gaussian mixture fitted by EM and a small Gaussian on every point, with training and test scores; a one-dimensional change of variables from a Gaussian to the three-peaked shadow of the flower; a ten-layer normalizing flow played layer by layer at three stages of training; a VAE with its code space and the KL weight β; a GAN trained live in the browser, with matched or mismatched learning rates and a discriminator that looks at pairs; autoregressive sampling one coordinate at a time, with temperature; score fields and Langevin sampling at one or many noise levels; adding noise and the best denoising guess with petal probabilities; diffusion sampling with DDPM or DDIM and different numbers of steps; flow matching with its training pairs, curved paths, reflow and a diffusion overlay; flow matching from different starting points; conditional generation with classifier-free guidance; a small robot going round an obstacle with a regression policy, a generative policy redrawn every step and one that generates a chunk at a time; and a map of 64 generative models with each method's relatives.

交互：在花上比较四种"生成"（抽新的、照抄、乱撒、取平均），读出像不像、多不多样、新不新；一个高斯、用 EM 拟合的混合高斯和每个点一个小高斯，比较训练分和测试分；从高斯到花在横轴上的三峰影子的一维变形；十层标准化流一层层播放，看三个训练阶段；VAE 和它的编码空间、KL 权重 β；在浏览器里现场训练的 GAN，比较两种学习速度的搭配和一次看两个样本的判别器；自回归一次抽一个坐标，带温度；单一噪声级别和多个噪声级别下的分数场与朗之万采样；加噪和最好的去噪猜测，以及来自每片花瓣的概率；DDPM 或 DDIM 的扩散采样，不同步数；Flow Matching 的训练配对、弯曲的路线、Reflow 和扩散路线的对照；从不同起点出发的 Flow Matching；无分类器引导的条件生成；绕障碍物的小机器人，比较回归策略、每步重新抽样的生成策略和一次生成一段的生成策略；以及 64 种生成模型的地图和每种方法的"亲戚"。

Conventions: x is a data point, z and ε are noise, σ is the size of the noise, and in flow matching t runs from 0 (noise) to 1 (data); p(x) is a probability density, s(x) = ∇ log p(x) the score, v(x, t) a velocity.

约定：x 是数据点，z、ε 是噪声，σ 是噪声的大小，t 在 Flow Matching 里从 0（噪声）走到 1（数据）；p(x) 是概率密度，s(x) = ∇ log p(x) 是分数，v(x, t) 是速度。

## 8. Try It in Your Head · 在脑子里试一试

World models from the ground up, told on one small task: a robot finger and a puck on a table, and a goal to push the puck into. A world model answers "if I do this, what happens next?", so a robot can try things in its head before acting. The page starts from the simplest learned model; in the first four steps, each one starts from the problem the previous one ran into. It then looks at how to use a model and how to scale it up to video, and asks the questions that cut across all of them: does a world model understand physics, and how do robots actually use one.

世界模型从头讲，全篇只用一个小任务：机器人用一根手指，把桌上的一个圆盘推进一个圈里。世界模型回答"我这样做，接下来会怎样"，让机器人先在脑子里试一试，再动手。从最简单的学出来的模型讲起，前四步，每一步都从上一种办法撞上的毛病讲起；再看学好了怎么用、怎样放大到视频；最后回答几个横跨所有方法的问题：它懂不懂物理，机器人到底怎么用它。

0. What a world model is: predicting what an action leads to; how it differs from a simulator, from video generation and from the model inside MPC; try a push in your head before doing it for real
1. The simplest world model: read the state, regress the next step; one step is accurate, many steps drift (compounding error)
2. Uncertainty and exploitation: a model talks nonsense where it has no data, and a planner seeks out exactly those places; ensembles, pessimism, optimism, short rollouts (PETS, MBPO, MOPO)
3. From pixels: predicting the next frame by squared error gives a blur when the future is uncertain; compress first, sample a latent, keep a memory (World Models, PlaNet's RSSM, Dreamer)
4. What the latent should keep: reconstruction keeps whatever fills the picture; predicting only the value (MuZero); predicting in representation space (JEPA, TD-MPC2) and how to stop it collapsing (VICReg, EMA targets, reward and value)
5. How to use a world model: plan as you go (MPC, MPPI), search ahead (tree search), practise a policy in imagination (Dreamer-style), and what each costs
6. Scaling up to video: action-conditioned video generation (GAIA, Genie, GameNGen, DIAMOND, Cosmos), latent actions from unlabelled video, real time, memory, and drift with noise augmentation
7. Does it understand physics: looking right is not being right; counterfactual tests, rare events, and how to evaluate a world model
8. Robots: planning (V-JEPA 2), practising in imagination (DayDreamer, WMPO), evaluating policies (1X, WorldGym, a Veo-based simulator), generating data (DreamGen) and world models as policies (UniPi, GR-2, world action models)
9. The spectrum: a map of 49 world models, grouped by approach, where they predict, what they are used for, where the actions come from, how they are trained, and era
10. Summary: the answer to the opening question, a comparison table, a quiz, further reading

Interactive demos: one push animated from the side and from above, then taken apart frame by frame, one frame per 0.1 s step; plan a push, imagine it with a learned model and then do it for real, or let a planner imagine 160 pushes; one-step models trained on 1 000, 10 000 and 100 000 transitions, rolled out open-loop against reality; an ensemble of five networks trained live in the browser, choosing a push strength alone, on average, pessimistically or optimistically; pixel prediction with a hidden friction, the blurry least-squares prediction against a latent model's sharp samples, with an exact posterior that narrows as frames arrive; what three kinds of 4-number latent keep (reconstruction, next-step prediction, value) under flickering or drifting distractors; a tiny JEPA trained live, collapsing or held up by variance terms or by predicting the value; MPC, tree search and an imagination-trained policy pushing a real puck with the same learned model; a small convolutional video model dreaming next to the real world, trained plainly or with noise augmentation; counterfactual tests of an action-blind model and a model that never saw the rim; ranking eight policies inside a world model against the real world; and a map of 49 world models with each method's relatives.

交互：推一次的动画（侧面看和从上往下看），再拆成一帧一帧，每一帧是 0.1 秒的一步；先定一个推法，用学出来的模型在脑子里试，再真的推一次，或者让规划器在脑子里试 160 种推法；用 1000、1 万、10 万步数据学出的一步模型，开环推演和真实对比；在浏览器里现场训练的五个网络组成的集成，一个模型、取平均、悲观、乐观四种挑法；摩擦看不见时的画面预测，均方误差最小的糊糊预测对比潜变量模型清楚的样本，精确的后验随着帧数收窄；三种只有 4 个数的潜变量（重建、预测下一步、只预测价值）在闪烁或漂移的背景下各装了什么；现场训练的小 JEPA，坍塌，或者被方差项、被预测价值撑住；用同一个学出来的模型推真实圆盘的 MPC、树搜索和在想象里练出的策略；和真实世界并排"做梦"的小卷积视频模型，普通训练对比加噪训练；不看动作的模型和没见过桌边的模型的反事实测试；在世界模型里给八种策略排名，对比真实世界；以及 49 种世界模型的地图和每种方法的"亲戚"。

Conventions: s is the state, a the action, o an observation, z a latent, h a memory, and t counts steps of 0.1 s; f is the world model.

约定：s 是状态，a 是动作，o 是观测，z 是潜变量，h 是记忆，t 是第几步（每步 0.1 秒）；f 是世界模型。

## 9. Which Way to Turn Each Knob · 每个旋钮往哪拧

Differentiability from the ground up. The first seven steps use one task: a robot arm throws a ball into a bin 2 m away, and the throw lands 25 cm too far. Which way should each knob turn, and by how much? Each step starts from the problem the previous one ran into. The last steps look at how robots use the same trick, put dozens of "differentiable X" side by side, and answer the opening question: when people in different fields say "differentiable", do they want the same thing?

可微从头讲。前七步只用一个任务：机械臂把球扔进两米外的筐里，远了 25 厘米。每个旋钮该往哪拧、拧多少？每一步都从上一步撞上的问题讲起。最后几步看机器人里怎样用同一招，把几十种"可微 X"放在一起，回答开头的问题：在不同的地方说"可微"，图的是同一件事吗？

0. The task, animated and taken apart frame by frame; the landing-point formula; what "differentiable" means (zoom in until it looks like a straight line)
1. One knob: bisection against the derivative; measuring (finite differences) against computing; Newton's method; the loss and gradient descent
2. Many knobs: the gradient on a contour map; finite differences cost N + 1 runs; the chain rule on a computational graph; forward and reverse mode (backpropagation) and the cheap-gradient principle
3. Neural networks: a network and the physics chained together, trained by backpropagating through the throw, against two trial-and-error learners (REINFORCE with a miss distance or a hit/miss reward); vanishing and exploding gradients
4. Hitting the rim: collisions bring jumps and chaos, and gradients lie; smoothing with noise, sampling, truncation (SHAC; Suh et al. 2022; Metz et al. 2021)
5. Working back from images: render and compare; hard edges have no gradient, soft edges do; coarse to fine; Soft Rasterizer, edge sampling, NeRF and Gaussian splatting fitted live
6. Discrete and random: softmax and temperature, attention, DARTS; Gumbel-max, Gumbel-softmax, straight-through; reparameterisation against REINFORCE, with a baseline
7. The real world gives no derivatives: learned stand-ins (a black box, textbook physics plus a learned residual, system identification); TossingBot, Dreamer, PILCO, DDPG, SuperMimic
8. Robots: differentiable simulators (Brax, MJX, Warp, DiffTaichi), trajectory optimisation (DDP, iLQR, differentiable MPC), localisation and mapping (iNeRF, Gaussian Splatting SLAM, DROID-SLAM), registration and calibration (ICP, DiffDRR); then two classic problems in depth: inverse kinematics with the Jacobian (gradient descent, Newton's method via the pseudoinverse, damped least squares, singularities) and pose-graph SLAM (loop closure, Gauss–Newton against gradient descent, sparsity)
9. The spectrum: a map of 61 differentiable methods, grouped by why a gradient is wanted, what is tuned, where the gradient comes from, where it breaks, step on this page and era
10. Summary: the answer to the opening question, a comparison table, a quiz, further reading

Interactive demos: the throw animated from the side and taken apart frame by frame; one knob (speed or angle) with its tangent, Newton steps and a zoom that shows local linearity; a contour map of the loss over speed and angle with gradient descent; a computational graph run forwards and backwards; a 321-weight network trained live through the physics against two trial-and-error learners; throws near the rim with local gradients, a noise-smoothed hit rate and truncation; a 1D render with hard and soft edges and coarse to fine; 2D Gaussian splatting fitted live to a picture; softmax with temperature and Gumbel samples; pathwise and REINFORCE gradient estimates and their spread; four learned stand-ins aiming a throw in a world with slip and drag; a three-link arm reaching a draggable target by gradient descent, Newton's method or damped least squares, including a target out of reach; a robot driving a loop whose odometry drift is pulled straight by pose-graph optimisation after loop closure; and a map of 61 methods with each method's relatives.

交互：侧面看一次扔球的动画，再拆成一帧一帧；一个旋钮（速度或角度）的切线、牛顿法和放大镜，看"放大就像直线"；速度和角度两个旋钮的损失等高线图和梯度下降；一张计算图的正向和反向；在浏览器里现场训练的 321 个权重的网络，穿过物理求导，和两种试错学习比；筐沿附近的局部梯度、加噪声后的进筐率和截断；硬边缘和软边缘的一维渲染，由粗到细；现场拟合一张照片的二维高斯泼溅；softmax 的温度和 Gumbel 抽样；重参数化和 REINFORCE 两种梯度估计有多散；在有打滑和空气阻力的世界里，用四种学出来的替身瞄准；三节机械臂去够一个可以拖动的目标，用梯度下降、牛顿法或阻尼最小二乘，也可以把目标放到够不着的地方；机器人绕一圈，里程计越走越歪，闭环以后用位姿图优化把整条路拉直；以及 61 种方法的地图和每种方法的"亲戚"。

Conventions: θ is all the knobs, L the loss, ∇L the gradient; the throw: release 1.0 m above the floor, the bin centre D = 2.0 m away, the miss e = x − D.

约定：θ 是所有旋钮，L 是损失，∇L 是梯度；扔球：出手点离地 1.0 m，筐中心 D = 2.0 m，差 e = x − D。

## Adding a page · 新加一篇

Put each new explainer in its own folder as `name/index.html`, link to other pages with relative paths such as `../rotation/`, add a card for it on the home page, load `../toc.js` with its `data-page` set to the folder name, and add the page to the list at the top of `toc.js`.

每篇新的讲解放进自己的文件夹，写成 `name/index.html`；链接别的篇目用相对路径，比如 `../rotation/`；在首页加一张卡片；页面里加载 `../toc.js`（`data-page` 写文件夹名），再把这一篇加进 `toc.js` 开头的列表。

## Publishing · 发布

GitHub Pages serves the `gh-pages` branch, which mirrors `main`. After changing a page, push to both branches.

网页由 `gh-pages` 分支发布，内容和 `main` 一致；改了页面后，两个分支都要推。
