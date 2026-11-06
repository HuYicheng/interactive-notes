# Measurements quoted on page 14 · 第 14 篇里"我们测的"那些数

Machine: a cloud VM with 2 vCPUs and 8 GB RAM, Ubuntu 24.04.5, Linux 6.18, Docker 29.8 (runc, overlayfs, cgroup v1), measured on 5 November 2026. Numbers will differ on another machine; the orders of magnitude will not.

测量环境：一台 2 个虚拟 CPU、8 GB 内存的云虚拟机，Ubuntu 24.04.5，Linux 6.18，Docker 29.8（runc、overlayfs、旧版控制组），2026 年 11 月 5 日测。换一台机器数会变，量级不会变。

| File | What it measures | Result |
|---|---|---|
| `sc.c` | a plain function call vs the system call `getppid()`, 5,000,000 each (`gcc -O2 sc.c -o sc`) | 1.57 ns vs 123 ns |
| `hello.c` + `Dockerfile` | a static program printing its PID, hostname and the number of entries in `/`; run directly and as `docker run --rm --network none hello:1` (FROM scratch) | outside: pid=771, hostname=vm, 28 entries; inside: pid=1, hostname=d0d4cabe519e, 8 entries |
| start-up | median wall time: `./hello` (fork + exec), `unshare --pid --fork --mount-proc --uts --ipc --net ./hello`, `docker run --rm --network none hello:1` | 0.83 ms; 2.7 ms; about 200 ms |
| `app.c` + `Dockerfile.big` | append 1 byte to a 200 MB file that lives in an image layer (OverlayFS copy-up), three times; then create a new small file | 353 ms, 0.01 ms, 0.00 ms; 0.1 ms |
| `mem.c` + `Dockerfile.mem` | allocate 16 MiB at a time under `--memory 128m --memory-swap 128m` | last line "allocated 112 MiB", exit code 137 |
| `mem.c c` | a busy loop, unrestricted vs `--cpus 0.5` | 1.17 s vs 2.27 s |

The image digest shared by `hello:1` and `big:1` was `sha256:bbbcace29482…` (one layer reused).
