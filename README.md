# Four Ways to Write a Rotation · 旋转的四种写法

**Live page · 在线网页: https://huyicheng.github.io/rotation-representations/**
(English version · 英文版: https://huyicheng.github.io/rotation-representations/#en)

An interactive, bilingual (中文 / English) explainer of rotation representations in robotics: rotation matrices, Euler angles, axis-angle, quaternions, and the Lie groups and Lie algebras that tie them together. Every formula comes with a symbol guide, a plain-words explanation and a small worked example you can check by hand.

一个中英双语的交互讲解页：机器人里的旋转表示，包括旋转矩阵、欧拉角、轴角、四元数，以及把它们串起来的李群和李代数。每个公式都配了符号说明、白话解释和能手算的小例子。

## Open it · 打开方式

Open the live page above in any browser, on a phone or a computer. The whole page is also a single file, `index.html`, with no build step, so you can download it and open it offline.

直接打开上面的网址即可，手机和电脑都能用。整个页面也就是一个 `index.html`，不需要编译，下载后离线打开也行。

- **Language / 语言**: the 中 / EN button at the top right switches language and keeps your place on the page. `index.html#en` opens in English. 右上角的「中 / EN」按钮一键切换，并停留在你正在读的位置；`index.html#en` 直接打开英文版。

## Contents · 内容

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

## Conventions · 约定

`v′ = R · v`, so the columns of `R` are the body axes expressed in the world frame. Quaternions follow the Hamilton convention and are written `(w, x, y, z)`.

矩阵作用方式是 `v′ = R · v`，`R` 的三列是物体三根轴在世界系里的方向；四元数按 Hamilton 约定，写成 `(w, x, y, z)`。

## Publishing · 发布

GitHub Pages serves the `gh-pages` branch, which mirrors `main`. After changing the page, push to both branches.

网页由 `gh-pages` 分支发布，内容和 `main` 一致；改了页面后，两个分支都要推。
