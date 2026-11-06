# gcpause.py — how long does one full garbage-collection pass take when a program holds many live Python objects?
# (e.g. a buffer of decoded messages). gc.collect() walks every container object that is still alive.
import gc, time, sys
for n in (10_000, 100_000, 1_000_000):
    keep = [{'position': [0.1, 0.2, 0.3], 'stamp': (i, i)} for i in range(n)]   # n dicts, each with a list and a tuple
    gc.collect()
    t0 = time.perf_counter(); gc.collect(); dt = time.perf_counter() - t0
    print('%9d live messages: one full gc.collect() %.1f ms' % (n, dt * 1e3))
    del keep
print(sys.version.split()[0])
