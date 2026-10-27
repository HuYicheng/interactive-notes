# Rotations, Cameras and Registration · 旋转、相机与配准

Interactive, bilingual (中文 / English) explainers for robotics. Each page is a single self-contained HTML file: every formula comes with a symbol guide, a plain-words explanation and a small worked example you can check by hand, and the interactive demos run in the browser.

一组中英双语的机器人学交互讲解页。每篇都是一个独立的 HTML 文件：每个公式都配了符号说明、白话解释和能手算的小例子，交互演示直接在浏览器里运行。

**Site · 网站: https://huyicheng.github.io/rotation-representations/**

The home page lists the two explainers side by side, and each one lives in its own folder.

首页把两篇并排列出来，每篇各占一个文件夹。

| | Page · 页面 | Live page · 在线网页 | File · 文件 |
|---|---|---|---|
| 1 | Four Ways to Write a Rotation · 旋转的四种写法 | https://huyicheng.github.io/rotation-representations/rotation/ | `rotation/index.html` |
| 2 | From Depth to Registration · 从深度到配准 | https://huyicheng.github.io/rotation-representations/perception/ | `perception/index.html` |

Add `#en` to any address to open it in English, for example https://huyicheng.github.io/rotation-representations/perception/#en.

在网址后面加 `#en` 直接打开英文版。

## Layout · 目录结构

```
index.html               home page, the two explainers side by side · 首页，两篇并排
rotation/index.html      Four Ways to Write a Rotation · 旋转的四种写法
perception/index.html    From Depth to Registration · 从深度到配准
```

## Open it · 打开方式

Open the live pages above in any browser, on a phone or a computer. There is no build step, so you can also download a page's `index.html` and open it offline.

直接打开上面的网址即可，手机和电脑都能用。页面不需要编译，下载对应的 `index.html` 后离线打开也行。

- **Language / 语言**: the 中 / EN button at the top right switches language and keeps your place on the page, and the choice carries over between the home page and both explainers. 右上角的「中 / EN」按钮一键切换，并停留在你正在读的位置；选好的语言在首页和两篇之间通用。
- **Cross-links / 互相链接**: each explainer links to the other at the top and at the bottom. 每篇的开头和结尾都有到另一篇的链接。

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

## Publishing · 发布

GitHub Pages serves the `gh-pages` branch, which mirrors `main`. After changing a page, push to both branches.

网页由 `gh-pages` 分支发布，内容和 `main` 一致；改了页面后，两个分支都要推。
