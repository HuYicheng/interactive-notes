# Measurements and counts quoted on page 15 · 第 15 篇里"我们测的""我们数的"那些数

Machine: a cloud VM with 2 vCPUs and 8 GB RAM, Ubuntu 24.04, Linux 6.18 (PREEMPT_DYNAMIC, not a real-time kernel), running under a hypervisor, gcc 13.3 `-O2`, Python 3.13.16, measured on 6 November 2026. This VM is not a real-time machine: the multi-millisecond tails in the loop measurements come from the VM being paused by its host. Numbers will differ on another machine; the orders of magnitude will not.

测量环境：一台 2 个虚拟 CPU、8 GB 内存的云虚拟机，Ubuntu 24.04，Linux 6.18（PREEMPT_DYNAMIC，不是实时内核），跑在虚拟化平台上，gcc 13.3 `-O2`，Python 3.13.16，2026 年 11 月 6 日测。这台虚拟机不是实时机器：循环测量里好几毫秒的长尾，来自虚拟机被宿主机暂停。换一台机器数会变，量级不会变。

| File | What it measures | Result |
|---|---|---|
| `ipc.c` | median round trip: send S bytes to another process, it reads them (one byte per cache line), answers with 1 byte; pipe, Unix socket, TCP loopback, shared memory with a copy in, shared memory handed over in place (`gcc -O2 ipc.c -o ipc`) | 64 B: 22.5 / 21.7 / 31.1 / 24.1 / 22.0 µs; 2,764,800 B (one 1280×720 RGB image): 2,069 / 526 / 1,085 / 501 / 107 µs |
| `msg.c`, `msg.py` | decode a 7-joint JointState-like message from bytes; turn one 1280×720 RGB image (real, non-zero bytes) into something usable | C 9.8 ns vs Python 2,523 ns; C memcpy 224 µs; Python list 18.7 ms, array.array 226 µs, numpy view 0.46 µs, numpy copy 219 µs |
| `gcpause.py` | one full `gc.collect()` with 10k / 100k / 1M live message-like objects | 1.6 / 21.6 / 335 ms |
| `loop.c`, `loop.py` | a 1 kHz loop with absolute deadlines, 20,000 cycles, lateness of every wake-up; idle, under load (two CPU-bound background processes), with `SCHED_FIFO` 80 + `mlockall`, and in Python with and without garbage | median / p99 / p99.9 / max, e.g. C under load 69.4 / 138 / 3,693 / 6,625 µs; C FIFO under load 18.3 / 50.1 / 1,367 / 8,486 µs; Python under load 70.1 / 1,923 / 3,998 / 18,227 µs |
| `budget.py` | the Franka FCI budget applied to the loop data: lateness + 0.1 ms control code + 0.2 ms round trip > 1 ms counts as an overrun; also the longest run of consecutive overruns | e.g. C FIFO under load 30 of 20,000 (0.15 %), longest run 8; C idle longest run 24 (≥ 20 stops the arm) |
| `pkgcount.py`, `overlap.py` | released packages per distribution in `ros/rosdistro` (`distribution.yaml`, commit f761fbe, 5 November 2026) and how many survive from one distribution to the next | Humble 2,401, Jazzy 2,495, Lyrical 1,829; 396 of Humble's packages (16.5 %) have no Jazzy release |
| `loc2.py` | non-blank source lines per language, excluding tests, examples and docs, in shallow clones of the main repositories (5–6 November 2026) | rcl 100 % C, rclcpp 100 % C++, rclpy 54 % Python, MoveIt 2 98 % C++, launch 100 % Python |

Usage: `python3 pkgcount.py <rosdistro clone>`, `python3 loc2.py <folder of clones>`, `python3 budget.py <folder with the loop outputs>`; the C programs print their results to the terminal.
