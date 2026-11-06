# budget.py — for each lateness dataset (20,000 wake-ups at 1 kHz, µs), count cycles where
# lateness + control code + round trip > 1000 µs (Franka FCI budget), and the longest run of consecutive overruns.
import sys, os, statistics
d = sys.argv[1]
for name in ['c_idle', 'c_load', 'c_load_fifo', 'py_idle', 'py_load', 'py_garbage_idle']:
    xs = []
    for line in open(os.path.join(d, name + '.txt')):
        line = line.strip()
        if not line or line[0] in '#abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ': continue
        try: xs.append(float(line.split()[0]))
        except ValueError: pass
    for tc, trt in [(100, 200), (300, 300)]:
        lim = 1000 - tc - trt
        over = [x > lim for x in xs]
        n = sum(over); run = best = 0
        for o in over:
            run = run + 1 if o else 0; best = max(best, run)
        print(f'{name:16s} N={len(xs)} tc={tc} trt={trt} lim={lim}us over={n} ({n/len(xs)*100:.3f}%) per_min={n/len(xs)*60000:.0f} longest_run={best} median={statistics.median(xs):.1f}')
