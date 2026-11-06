/* Site-wide table of contents for Interactive Notes: a "Contents" button in each page's nav bar opens a panel listing every page and its sections. */
(function(){
var PAGES=[{"slug":"rotation","zh":"旋转的四种写法","en":"Four Ways to Write a Rotation","s":[["s-basics","0 基础","0 Basics"],["s-core","核心逻辑","Core idea"],["s-mat","① 矩阵","① Matrix"],["s-euler","② 欧拉角","② Euler angles"],["s-aa","③ 轴角","③ Axis-angle"],["s-quat","④ 四元数","④ Quaternion"],["s-lie","李群","Lie groups"],["s-conv","转换","Conversions"],["s-interp","插值","Interpolation"],["s-sum","总结","Summary"]]},{"slug":"perception","zh":"从深度到配准","en":"From Depth to Registration","s":[["s-map","0 总览","0 Overview"],["s-pin","① 针孔模型","① Pinhole model"],["s-k","② 内参","② Intrinsics"],["s-rt","③ 外参","③ Extrinsics"],["s-p","④ 大综合","④ Putting it together"],["s-st","⑤ 双目","⑤ Stereo"],["s-pc","⑥ 点云","⑥ Point clouds"],["s-reg","⑦ 配准","⑦ Registration"],["s-icp","⑧ ICP","⑧ ICP"],["s-sum","总结","Summary"]]},{"slug":"robot-learning","zh":"从示范到试错","en":"From Demonstration to Trial and Error","s":[["s-map","0 总览","0 Overview"],["s-mdp","① 基本概念","① Basics"],["s-il","② 模仿学习","② Imitation learning"],["s-var","③ 示范的变体","③ Variants of demos"],["s-rl","④ 强化学习","④ Reinforcement learning"],["s-rw","⑤ 奖励","⑤ Rewards"],["s-sim","⑥ 仿真到现实","⑥ Sim to real"],["s-wm","⑦ 世界模型","⑦ World models"],["s-mix","⑧ 组合","⑧ Combinations"],["s-sum","总结","Summary"]]},{"slug":"backbones","zh":"拆开神经网络","en":"Inside a Neural Network","s":[["k-open","0 开场","0 Opening"],["k-units","单位","Units"],["k-neuron","① 神经元","① Neuron"],["k-layer","② 一层","② One layer"],["k-mlp","③ 叠起来","③ Stacking up"],["k-conv","④ 卷积","④ Convolution"],["k-cnn","⑤ ResNet","⑤ ResNet"],["k-rnn","⑥ 循环","⑥ Recurrence"],["k-attn","⑦ 注意力","⑦ Attention"],["k-xfmr","⑧ Transformer","⑧ Transformer"],["k-vit","⑨ 图像","⑨ Images"],["k-audio","⑩ 声音","⑩ Sound"],["k-unet","⑪ U-Net","⑪ U-Net"],["k-point","⑫ 点云","⑫ Point clouds"],["k-multi","⑬ 多模态","⑬ Multimodal"],["k-combo","⑭ 拼积木","⑭ Building blocks"],["k-size","⑮ 多大","⑮ How big"],["k-sum","小结","Summary"]]},{"slug":"loops","zh":"环环相扣","en":"Loops Within Loops","s":[["s-map","0 开场","0 Opening"],["s-loop","① 一个环","① One loop"],["s-law","② 出力","② How hard"],["s-rate","③ 多快","③ How fast"],["s-cas","④ 环套环","④ Loops in loops"],["s-cur","⑤ 电流","⑤ Current"],["s-run","⑥ 一起跑","⑥ All at once"],["s-layer","⑦ 六层","⑦ Six layers"],["s-stack","⑧ 一台机器人","⑧ One robot"],["s-kinds","⑨ 五种机器人","⑨ Five robots"],["s-wire","⑩ 连线","⑩ Wiring"],["s-sum","总结","Summary"]]},{"slug":"control","zh":"从 PID 到世界模型","en":"From PID to World Models","s":[["k-map","0 开场","0 Opening"],["k-pid","① PID","① PID"],["k-freq","② 频率","② Frequency"],["k-ss","③ 状态空间","③ State space"],["k-nl","④ 非线性","④ Nonlinearity"],["k-unc","⑤ 不确定","⑤ Uncertainty"],["k-con","⑥ 接触","⑥ Contact"],["k-mpc","⑦ 往前看","⑦ Looking ahead"],["k-learn","⑧ 学出来","⑧ Learning it"],["k-model","⑨ 模型","⑨ Models"],["k-all","⑩ 全景","⑩ The map"],["k-hum","⑪ 人形","⑪ Humanoids"],["k-sum","总结","Summary"]]},{"slug":"generative","zh":"从噪声到样本","en":"From Noise to Samples","s":[["k-gen","0 开场","0 Opening"],["k-mle","① 最简单","① Simplest"],["k-flow","② 流模型","② Flows"],["k-vae","③ VAE","③ VAE"],["k-gan","④ GAN","④ GAN"],["k-ar","⑤ 自回归","⑤ Autoregression"],["k-score","⑥ 分数","⑥ Score"],["k-diff","⑦ 扩散","⑦ Diffusion"],["k-fm","⑧ Flow Matching","⑧ Flow Matching"],["k-gauss","⑨ 为什么是高斯","⑨ Why Gaussian"],["k-fast","⑩ 又快又听话","⑩ Fast, and on request"],["k-robot","⑪ 机器人","⑪ Robots"],["k-map","⑫ 光谱","⑫ Spectrum"],["k-sum","总结","Summary"]]},{"slug":"world-models","zh":"在脑子里试一试","en":"Try It in Your Head","s":[["k-intro","0 开场","0 Opening"],["k-one","① 一步预测","① One-step prediction"],["k-unc","② 不确定","② Uncertainty"],["k-pix","③ 画面","③ Images"],["k-lat","④ 潜空间","④ Latent space"],["k-use","⑤ 怎么用","⑤ Using it"],["k-vid","⑥ 视频","⑥ Video"],["k-phys","⑦ 懂物理吗","⑦ Physics?"],["k-robot","⑧ 机器人","⑧ Robots"],["k-map","⑨ 光谱","⑨ Spectrum"],["k-sum","总结","Summary"]]},{"slug":"differentiable","zh":"每个旋钮往哪拧","en":"Which Way to Turn Each Knob","s":[["k-intro","0 开场","0 Opening"],["k-one","① 一个旋钮","① One knob"],["k-many","② 旋钮一多","② Many knobs"],["k-net","③ 神经网络","③ Neural networks"],["k-rim","④ 撞上筐沿","④ Hitting the rim"],["k-render","⑤ 从画面反推","⑤ Working back from images"],["k-disc","⑥ 离散和随机","⑥ Discrete and random"],["k-proxy","⑦ 替身","⑦ Stand-ins"],["k-robot","⑧ 机器人","⑧ Robots"],["k-map","⑨ 光谱","⑨ The spectrum"],["k-sum","总结","Summary"]]},{"slug":"reconstruction","zh":"从照片到场景","en":"From Photos to Scenes","s":[["k-intro","0 开场","0 Opening"],["k-cam","① 相机和射线","① Cameras and rays"],["k-geo","② 从照片算几何","② Geometry from photos"],["k-depth","③ 主动测距","③ Active depth"],["k-field","④ 辐射场","④ Radiance fields"],["k-nerf","⑤ NeRF","⑤ NeRF"],["k-gs","⑥ 高斯泼溅","⑥ Gaussian splatting"],["k-surf","⑦ 表面","⑦ Surfaces"],["k-prior","⑧ 学来的先验","⑧ Learned priors"],["k-map","⑨ 光谱","⑨ The spectrum"],["k-sum","总结","Summary"]]},{"slug":"jacobian","zh":"关节和手之间","en":"Between the Joints and the Hand","s":[["k-task","0 开场","0 Opening"],["k-jac","① 雅可比","① Jacobian"],["k-svd","② SVD","② SVD"],["k-vel","③ 速度椭圆","③ Velocity ellipse"],["k-inv","④ 反过来求","④ Working backwards"],["k-null","⑤ 零空间","⑤ Null space"],["k-force","⑥ 力","⑥ Force"],["k-mass","⑦ 质量","⑦ Mass"],["k-eom","⑧ 拉格朗日","⑧ Lagrange"],["k-ne","⑨ 牛顿–欧拉","⑨ Newton–Euler"],["k-ctrl","⑩ 控制","⑩ Control"],["k-map","⑪ 地图","⑪ Map"],["k-sum","总结","Summary"]]},{"slug":"signals","zh":"两秒钟的录音","en":"Two Seconds of Sound","s":[["k-rec","0 开场","0 Opening"],["k-sine","① 正弦","① Sines"],["k-db","② 分贝","② Decibels"],["k-snr","③ 信噪比","③ SNR"],["k-harm","④ 谐波","④ Harmonics"],["k-ft","⑤ 频谱","⑤ Spectrum"],["k-bw","⑥ 带宽","⑥ Bandwidth"],["k-mod","⑦ 调制","⑦ Modulation"],["k-samp","⑧ 采样","⑧ Sampling"],["k-dft","⑨ DFT","⑨ DFT"],["k-conv","⑩ 卷积","⑩ Convolution"],["k-filt","⑪ 滤波器","⑪ Filters"],["k-lap","⑫ 拉普拉斯","⑫ Laplace"],["k-z","⑬ z 变换","⑬ z-transform"],["k-img","⑭ 图像","⑭ Images"],["k-map","⑮ 地图","⑮ Map"],["k-sum","小结","Summary"]]},{"slug":"silicon","zh":"芯片里的一秒钟","en":"One Second in Silicon","s":[["k-open","0 开场","0 Opening"],["k-chip","① 芯片","① Chips"],["k-prog","② 程序","② Programs"],["k-mem","③ 存储","③ Memory"],["k-mac","④ 算和搬","④ Compute and move"],["k-kinds","⑤ 几类芯片","⑤ Kinds of chip"],["k-cuda","⑥ CUDA","⑥ CUDA"],["k-llm","⑦ 大模型","⑦ Large models"],["k-token","⑧ 一个词","⑧ One token"],["k-dc","⑨ 数据中心","⑨ Data centres"],["k-scale","⑩ 规模","⑩ Scale"],["k-sense","⑪ 机器人的一秒","⑪ One second in the robot"],["k-emb","⑫ 具身","⑫ Embodied AI"],["k-body","⑬ 身体","⑬ The body"],["k-front","⑭ 前沿","⑭ The frontier"],["k-next","⑮ 未来","⑮ The future"],["k-map","⑯ 地图","⑯ Map"],["k-sum","小结","Summary"]]},{"slug":"isolation","zh":"一台机器，几个世界","en":"One Machine, Many Worlds","s":[["k-open","0 开场","0 Opening"],["k-layers","① 几层","① Layers"],["k-process","② 进程","② Processes"],["k-spectrum","③ 全景","③ Overview"],["k-boot","④ 双系统","④ Dual boot"],["k-vm","⑤ 虚拟机","⑤ Virtual machines"],["k-micro","⑥ 轻量和翻译","⑥ Light VMs and translation"],["k-container","⑦ 容器","⑦ Containers"],["k-image","⑧ 镜像","⑧ Images"],["k-family","⑨ 容器一家","⑨ The container family"],["k-sandbox","⑩ 沙箱","⑩ Sandboxes"],["k-env","⑪ 环境","⑪ Environments"],["k-nix","⑫ Nix","⑫ Nix"],["k-gpu","⑬ GPU","⑬ GPU"],["k-hw","⑭ 硬件","⑭ Hardware"],["k-choose","⑮ 怎么选","⑮ How to choose"],["k-sum","总结","Summary"]]},{"slug":"ros","zh":"一台机器人，几十个程序","en":"One Robot, Dozens of Programs","s":[["k-open","0 开场","0 Opening"],["k-bus","① 总线","① Buses"],["k-ipc","② 进程之间","② Between processes"],["k-before","③ ROS 以前","③ Before ROS"],["k-ros1","④ ROS 1","④ ROS 1"],["k-ros2","⑤ ROS 2","⑤ ROS 2"],["k-exec","⑥ 执行器","⑥ Executors"],["k-stack","⑦ 哪一层","⑦ Which layer"],["k-rt","⑧ 实时","⑧ Real-time"],["k-plan","⑨ MoveIt","⑨ MoveIt"],["k-tf","⑩ tf 和 Nav2","⑩ tf and Nav2"],["k-ver","⑪ 版本","⑪ Versions"],["k-lang","⑫ C++ 和 Python","⑫ C++ and Python"],["k-alt","⑬ 别的办法","⑬ Other ways"],["k-build","⑭ 搭起来","⑭ Putting it together"],["k-sum","总结","Summary"]]},{"slug":"estimation","zh":"我在哪，有多确定","en":"Where Am I, and How Sure?","s":[["k-open","0 开场","0 Opening"],["k-noise","① 误差","① Errors"],["k-dead","② 航迹推算","② Dead reckoning"],["k-fuse","③ 合并","③ Fusing"],["k-bayes","④ 贝叶斯","④ Bayes"],["k-kf","⑤ 卡尔曼","⑤ Kalman"],["k-vec","⑥ 向量","⑥ Vectors"],["k-ekf","⑦ 扩展卡尔曼","⑦ Extended Kalman"],["k-pf","⑧ 粒子","⑧ Particles"],["k-time","⑨ 融合","⑨ Fusion"],["k-slam","⑩ SLAM","⑩ SLAM"],["k-graph","⑪ 因子图","⑪ Factor graphs"],["k-track","⑫ 跟踪","⑫ Tracking"],["k-more","⑬ 不只是位置","⑬ More than position"],["k-fail","⑭ 出错","⑭ Going wrong"],["k-map","⑮ 全景","⑮ The big picture"],["k-build","⑯ 搭起来","⑯ Putting it together"],["k-sum","总结","Summary"]]},{"slug":"planning","zh":"接下来做什么，怎么做","en":"What Next, and How?","s":[["k-open","0 开场","0 Opening"],["k-what","① 规划是什么","① What planning is"],["k-cost","② 代价地图","② Costmaps"],["k-grid","③ 格子上搜","③ Searching a grid"],["k-sample","④ 撒点","④ Sampling"],["k-opt","⑤ 拉直","⑤ Straightening"],["k-time","⑥ 配上时间","⑥ Adding time"],["k-local","⑦ 边走边改","⑦ Replanning as it goes"],["k-uncert","⑧ 没把握时","⑧ When unsure"],["k-bt","⑨ 行为树","⑨ Behaviour trees"],["k-sym","⑩ 符号规划","⑩ Symbolic planning"],["k-lang","⑪ 一句话","⑪ One sentence"],["k-learn","⑫ 学出来的技能","⑫ Learned skills"],["k-fail","⑬ 出岔子","⑬ When things go wrong"],["k-map","⑭ 全景","⑭ The landscape"],["k-build","⑮ 搭起来","⑮ Putting it together"],["k-sum","总结","Summary"]]},{"slug":"calibration","zh":"每次都偏一点","en":"A Little Off, Every Time","s":[["k-open","0 开场","0 Opening"],["k-kinds","① 两种误差","① Two kinds of error"],["k-prop","② 误差怎么传","② How errors propagate"],["k-fit","③ 估参数","③ Estimating parameters"],["k-cam","④ 相机","④ Camera"],["k-depth","⑤ 深度","⑤ Depth"],["k-handeye","⑥ 手眼","⑥ Hand–eye"],["k-arm","⑦ 手臂","⑦ Arm"],["k-imu","⑧ IMU","⑧ IMU"],["k-lidar","⑨ 激光雷达","⑨ Lidar"],["k-time","⑩ 时间","⑩ Time"],["k-load","⑪ 负载和工具","⑪ Payload and tools"],["k-check","⑫ 验证","⑫ Validation"],["k-drift","⑬ 会变","⑬ Things change"],["k-map","⑭ 全景","⑭ The landscape"],["k-build","⑮ 搭起来","⑮ Putting it together"],["k-sum","总结","Summary"]]}];
var me=document.currentScript,cur=(me&&me.getAttribute('data-page'))||'';
var SITE='https://huyicheng.github.io/interactive-notes/';
var onSite=/(^|\.)github\.io$/.test(location.hostname)||location.protocol==='file:';
function href(slug,sec){if(slug===cur)return sec?'#'+sec:'#';return (onSite?'../'+slug+'/':SITE+slug+'/')+(sec?'#'+sec:'')}
function bi(zh,en){return '<span class="zh" lang="zh-CN">'+zh+'</span><span class="en" lang="en">'+en+'</span>'}
var CSS='.tocb{flex:none;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:6px 11px 6px 9px;cursor:pointer;font:600 12.5px/1 var(--f-body);color:var(--muted);min-height:32px}'
+'.tocb:hover,.tocb[aria-expanded="true"]{border-color:var(--accent);color:var(--accent-fg)}.tocb svg{display:block}'
+'.nav .bar{position:relative}'
+'.tocp{position:absolute;right:16px;top:calc(100% + 1px);width:min(420px,calc(100vw - 16px));max-height:calc(100vh - 64px);max-height:calc(100dvh - 64px);overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 40px -22px rgba(20,25,34,.55);padding:10px 8px 12px;z-index:30;font:14.5px/1.45 var(--f-body);color:var(--fg);text-align:left}'
+'.tocp[hidden]{display:none}'
+'.toct{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:2px 8px 8px;border-bottom:1px solid var(--line);margin-bottom:6px;font-size:12.5px;color:var(--muted);font-weight:600}'
+'.nav .tocp a{flex:initial;border:0;background:transparent;line-height:1.45;white-space:normal}.nav .tocp a:hover{border:0}'
+'.nav .toct a{color:var(--accent-fg);font-weight:600;text-decoration:none;font-size:12.5px;padding:4px 6px;border-radius:6px}.nav .toct a:hover{text-decoration:underline}'
+'.tocg{border-radius:9px;margin:2px 0}.tocg.cur{background:var(--surface-2)}'
+'.toch{display:flex;align-items:center;gap:4px}'
+'.nav .toch a{flex:1;min-width:0;display:flex;gap:8px;align-items:baseline;padding:8px 6px 8px 8px;color:var(--fg);text-decoration:none;font-weight:600;font-size:14.5px;border-radius:8px}'
+'.nav .toch a:hover{color:var(--accent-fg)}.toch a i{font:600 11.5px/1 var(--f-mono);color:var(--accent-fg);font-style:normal;min-width:1.4em}'
+'.tocx{flex:none;width:34px;height:34px;border:0;background:none;border-radius:8px;cursor:pointer;color:var(--muted);display:grid;place-items:center}'
+'.tocx:hover{background:var(--surface);color:var(--accent-fg)}.tocx svg{transition:transform .15s}.tocx[aria-expanded="true"] svg{transform:rotate(90deg)}'
+'.tocs{list-style:none;margin:0 0 6px;padding:0 6px 0 30px}.tocs[hidden]{display:none}'
+'.nav .tocs a{display:block;padding:6px 8px;border-radius:7px;color:var(--muted);text-decoration:none;font-size:13.5px}'
+'.nav .tocs a:hover{color:var(--accent-fg);background:var(--surface)}.nav .tocs a.on{color:var(--accent-fg);font-weight:600;background:var(--accent-soft)}'
+'@media (max-width:480px){.tocp{left:8px;right:8px;width:auto}.tocb .tl{display:none}.tocb{padding:6px 8px}}'
+'@media (prefers-reduced-motion:reduce){.tocx svg{transition:none}}';
/* The section bar scrolls sideways. Touch screens swipe it natively; for a mouse, add wheel scrolling, drag to scroll,
   arrow buttons at the clipped edges, and keep the section being read highlighted and in view. */
function navScroll(){
var nav=document.querySelector('.nav'),inn=nav&&nav.querySelector('.bar .in');if(!inn||inn.getAttribute('data-ns'))return;inn.setAttribute('data-ns','1');
var st=document.createElement('style');st.id='ns-css';st.textContent='.nsw{position:relative;flex:1;min-width:0;display:flex}.nsw>.in{flex:1;min-width:0}'
+'.nav .in{-webkit-user-select:none;user-select:none}.nav .in a{-webkit-user-drag:none}.nsw.drag .in,.nsw.drag .in a{cursor:grabbing}'
+'.nsa{position:absolute;top:0;bottom:0;width:44px;border:0;padding:0;margin:0;display:none;align-items:center;cursor:pointer;color:var(--muted);z-index:2;background:none}'
+'.nsl{left:0;justify-content:flex-start;background:linear-gradient(90deg,var(--bg) 40%,rgba(0,0,0,0))}.nsr{right:0;justify-content:flex-end;background:linear-gradient(270deg,var(--bg) 40%,rgba(0,0,0,0))}'
+'.nsa span{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;border:1px solid var(--line);background:var(--surface);box-shadow:0 1px 4px -2px rgba(20,25,34,.35)}'
+'.nsa:hover span{color:var(--fg);border-color:var(--faint)}.nsa svg{display:block}'
+'.nsw.cl .nsl,.nsw.cr .nsr{display:flex}'
+'.nav .in a.ns-on{color:var(--accent-fg);border-color:var(--accent);background:var(--accent-soft)}'
+'@media (hover:none),(pointer:coarse){.nsa{pointer-events:none;width:26px}.nsa span{display:none}}';
document.head.appendChild(st);
var w=document.createElement('div');w.className='nsw';inn.parentNode.insertBefore(w,inn);w.appendChild(inn);
function arrow(cls,d,lab){var b=document.createElement('button');b.type='button';b.className='nsa '+cls;b.tabIndex=-1;b.setAttribute('aria-hidden','true');b.setAttribute('data-noi18n','');b.title=lab;
b.innerHTML='<span><svg width="14" height="14" viewBox="0 0 16 16"><path d="'+d+'" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';w.appendChild(b);return b}
var L=arrow('nsl','M10 3.5 5.5 8 10 12.5','向左 / Scroll left'),R=arrow('nsr','M6 3.5 10.5 8 6 12.5','向右 / Scroll right');
var calm=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function max(){return inn.scrollWidth-inn.clientWidth}
function upd(){var m=max(),x=inn.scrollLeft;w.classList.toggle('cl',m>1&&x>2);w.classList.toggle('cr',m>1&&x<m-2)}
var goal=null,gt=0;function now(){return(goal!==null&&Date.now()-gt<900)?goal:inn.scrollLeft}
function to(t){t=Math.max(0,Math.min(max(),t));goal=t;gt=Date.now();try{inn.scrollTo({left:t,behavior:calm?'auto':'smooth'})}catch(e){inn.scrollLeft=t}}
function by(d){to(now()+d)}
L.addEventListener('click',function(){by(-Math.max(120,inn.clientWidth*.7))});R.addEventListener('click',function(){by(Math.max(120,inn.clientWidth*.7))});
inn.addEventListener('scroll',function(){if(goal!==null&&Math.abs(inn.scrollLeft-goal)<1.5)goal=null;upd()},{passive:true});inn.addEventListener('touchstart',function(){goal=null},{passive:true});inn.addEventListener('focusin',function(){goal=null});addEventListener('resize',upd);upd();setTimeout(upd,400);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(upd);
inn.addEventListener('wheel',function(e){var m=max();if(m<=1||e.ctrlKey||Math.abs(e.deltaX)>=Math.abs(e.deltaY))return;
var d=e.deltaY*(e.deltaMode===1?20:e.deltaMode===2?inn.clientWidth:1);if((d<0&&inn.scrollLeft<=0)||(d>0&&inn.scrollLeft>=m-1))return;
goal=null;inn.scrollLeft+=d;e.preventDefault()},{passive:false});
var down=false,moved=false,sx=0,sl=0;
inn.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'||e.button!==0||max()<=1)return;goal=null;down=true;moved=false;sx=e.clientX;sl=inn.scrollLeft});
addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx;if(!moved&&Math.abs(dx)>5){moved=true;w.classList.add('drag')}if(moved)inn.scrollLeft=sl-dx});
addEventListener('pointerup',function(){if(!down)return;down=false;w.classList.remove('drag');if(moved)setTimeout(function(){moved=false},0)});
addEventListener('pointercancel',function(){down=false;moved=false;w.classList.remove('drag')});
inn.addEventListener('click',function(e){if(moved){e.preventDefault();e.stopPropagation();moved=false}},true);
inn.addEventListener('dragstart',function(e){e.preventDefault()});
var links=[].slice.call(inn.querySelectorAll('a[href^="#"]')),ids=links.map(function(a){return decodeURIComponent(a.getAttribute('href').slice(1))}),cur=null;
function show(a){var c=inn.getBoundingClientRect(),r=a.getBoundingClientRect(),l=r.left-c.left+inn.scrollLeft,x=now(),v=inn.clientWidth,p=48,t=x;if(l-p<x)t=l-p;else if(l+r.width+p>x+v)t=l+r.width+p-v;if(Math.abs(t-x)>=1)to(t)}
var hold=0,holdId='';
function mark(on){cur=on;links.forEach(function(a,i){var m=ids[i]===on;a.classList.toggle('ns-on',m);if(m)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});var i=ids.indexOf(on);if(i>=0&&!down)show(links[i])}
function act(){var nb=nav.getBoundingClientRect().bottom+12,on='';ids.forEach(function(id){var e=id&&document.getElementById(id);if(e&&e.getBoundingClientRect().top<=nb)on=id});
if(hold){if(on===holdId||Date.now()>hold)hold=0;else return}if(on!==cur)mark(on)}
links.forEach(function(a,i){a.addEventListener('click',function(){if(moved)return;hold=Date.now()+2500;holdId=ids[i];mark(ids[i])})});
var raf=0;addEventListener('scroll',function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;act()})},{passive:true});act();
try{new MutationObserver(function(){requestAnimationFrame(function(){upd();var i=ids.indexOf(cur);if(i>=0){goal=null;show(links[i])}})}).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']})}catch(e){}
}
/* Sharp canvases at any zoom. Each widget sizes its canvas bitmap as CSS size x devicePixelRatio, rounded. At scales
   such as 110%, 125% or 150% that leaves the bitmap a fraction of a pixel off the box the browser paints it into, and the
   browser resamples it, which looks blurry. Nudge the canvas's CSS size (by under one screen pixel) so the bitmap maps
   1:1 onto screen pixels; canvases that fill their container stay fluid (calc(100% + d)). When the zoom or the screen
   changes, briefly narrow each canvas's container so every widget re-fits at the new scale. */
function sharpCanvas(){
if(window.__sharpCv)return;window.__sharpCv=1;window.__sharpCvN=0;
var pro=window.ResizeObserver?new ResizeObserver(function(es){es.forEach(function(e){[].forEach.call(e.target.children,function(c){if(c.tagName==='CANVAS')adj(c,1)})})}):null;
function adj(c,force){var bw=c.width,bh=c.height,d=window.devicePixelRatio||1;if(!bw||!bh||!c.isConnected)return;
if(!force&&c.__bw===bw&&c.__bh===bh&&c.__d===d&&c.style.width===c.__sw&&c.style.height===c.__sh)return;
var r=c.getBoundingClientRect();if(!r.width||!r.height)return;
var own=c.style.width!==''&&!c.__fl,base=r.width-(c.__fl?(c.__dw||0):0),ew=base*d,eh=r.height*d;
if(Math.abs(r.width*d-bw)>2.5||Math.abs(eh-bh)>2.5)return;
if(own){if(Math.abs(ew-bw)>0.01)c.style.width=(bw/d)+'px'}
else{var dw=bw/d-base;if(Math.abs(dw)<0.002){if(c.__fl){c.style.width='';c.__fl=0;c.__dw=0}}else{if(!c.__fl&&pro&&c.parentElement)pro.observe(c.parentElement);c.__fl=1;c.__dw=dw;c.style.width='calc(100% + '+dw.toFixed(6)+'px)'}}
if(Math.abs(eh-bh)>0.01&&c.style.height!=='')c.style.height=(bh/d)+'px';
c.__bw=bw;c.__bh=bh;c.__d=d;c.__sw=c.style.width;c.__sh=c.style.height}
function all(){[].forEach.call(document.querySelectorAll('canvas'),function(c){adj(c,1)})}
try{new MutationObserver(function(ms){ms.forEach(function(m){var t=m.target;if(m.type==='attributes'){if(t.tagName==='CANVAS')adj(t)}else m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.tagName==='CANVAS')adj(n);else if(n.querySelectorAll)[].forEach.call(n.querySelectorAll('canvas'),adj)})})})
.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['width','height']})}catch(e){}
all();addEventListener('load',all);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(all);
var mq=null;function arm(){try{if(mq)mq.removeEventListener('change',onDpr);mq=matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)');mq.addEventListener('change',onDpr)}catch(e){}}
function onDpr(){arm();window.__sharpCvN++;var ps=[];[].forEach.call(document.querySelectorAll('canvas'),function(c){var p=c.parentElement;if(c.offsetParent&&p&&p.clientWidth>2&&ps.indexOf(p)<0)ps.push(p)});
var keep=ps.map(function(p){return p.style.maxWidth});ps.forEach(function(p){p.style.maxWidth=(p.clientWidth-1)+'px'});
dispatchEvent(new Event('resize'));
requestAnimationFrame(function(){requestAnimationFrame(function(){ps.forEach(function(p,i){p.style.maxWidth=keep[i]});dispatchEvent(new Event('resize'));setTimeout(all,80)})})}
arm();
}
function init(){
try{sharpCanvas()}catch(e){}
try{navScroll()}catch(e){}
var bar=document.querySelector('.nav .bar');if(!bar||document.getElementById('tocBtn'))return;
var st=document.createElement('style');st.id='toc-css';st.textContent=CSS;document.head.appendChild(st);
var b=document.createElement('button');b.type='button';b.className='tocb';b.id='tocBtn';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','tocP');b.setAttribute('data-noi18n','');
b.innerHTML='<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg><span class="tl">'+bi('目录','Contents')+'</span>';
b.setAttribute('aria-label','目录 / Contents');
var lb=document.getElementById('langBtn');if(lb&&lb.parentNode===bar)bar.insertBefore(b,lb);else bar.appendChild(b);
var p=document.createElement('div');p.className='tocp';p.id='tocP';p.hidden=true;p.setAttribute('data-noi18n','');
var h='<div class="toct"><span>'+bi('全部笔记','All notes')+'</span><a href="'+(onSite?'../':SITE)+'">'+bi('首页','Home')+'</a></div>';
PAGES.forEach(function(pg,i){var c=pg.slug===cur;h+='<div class="tocg'+(c?' cur':'')+'"><div class="toch"><a href="'+href(pg.slug)+'"'+(c?' aria-current="page"':'')+'><i>'+(i+1)+'</i><span>'+bi(pg.zh,pg.en)+'</span></a>'
+'<button type="button" class="tocx" aria-expanded="'+(c?'true':'false')+'" aria-controls="tocs'+i+'" aria-label="'+pg.zh+'：章节 / '+pg.en+': sections"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'
+'<ol class="tocs" id="tocs'+i+'"'+(c?'':' hidden')+'>'+pg.s.map(function(s){return '<li><a href="'+href(pg.slug,s[0])+'" data-sec="'+(c?s[0]:'')+'">'+bi(s[1],s[2])+'</a></li>'}).join('')+'</ol></div>'});
p.innerHTML=h;bar.appendChild(p);
if(!onSite)p.querySelectorAll('a').forEach(function(a){if(!/^#/.test(a.getAttribute('href'))){a.target='_blank';a.rel='noopener'}});
p.querySelectorAll('.tocx').forEach(function(x){x.addEventListener('click',function(){var o=document.getElementById(x.getAttribute('aria-controls')),on=x.getAttribute('aria-expanded')!=='true';x.setAttribute('aria-expanded',on?'true':'false');o.hidden=!on})});
var secs=[];PAGES.forEach(function(pg){if(pg.slug===cur)secs=pg.s.map(function(s){return s[0]})});
function mark(){var nb=bar.getBoundingClientRect().bottom+12,on='';secs.forEach(function(id){var e=document.getElementById(id);if(e&&e.getBoundingClientRect().top<=nb)on=id});p.querySelectorAll('a[data-sec]').forEach(function(a){var m=a.getAttribute('data-sec')&&a.getAttribute('data-sec')===on;a.classList.toggle('on',!!m);if(m)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}
function open(){p.hidden=false;b.setAttribute('aria-expanded','true');mark();var a=p.querySelector('a.on')||p.querySelector('.tocg.cur a');if(a&&a.scrollIntoView)try{a.scrollIntoView({block:'nearest'})}catch(e){}}
function close(f){if(p.hidden)return;p.hidden=true;b.setAttribute('aria-expanded','false');if(f)b.focus()}
b.addEventListener('click',function(e){e.stopPropagation();if(p.hidden)open();else close()});
document.addEventListener('click',function(e){if(!p.hidden&&!p.contains(e.target)&&e.target!==b)close()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!p.hidden)close(true)});
p.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a)close()});
var raf=0;addEventListener('scroll',function(){if(p.hidden||raf)return;raf=requestAnimationFrame(function(){raf=0;mark()})},{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
