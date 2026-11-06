# loop.py — the same 1 kHz loop in Python: wake up every 1 ms (absolute deadlines), record how late each wake-up was.
# Usage: python3 loop.py N [garbage]   ("garbage" = also build and drop some Python objects each cycle, like
# decoding a message into Python objects, so the garbage collector has work to do)
# Output: one lateness value per line in microseconds (stdout), summary on stderr.
import sys, time, gc
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
garbage = len(sys.argv) > 2 and sys.argv[2] == 'garbage'
late = [0.0] * N
period = 1_000_000  # ns
nxt = time.monotonic_ns()
keep = []
for i in range(N):
    nxt += period
    d = nxt - time.monotonic_ns()
    if d > 0:
        time.sleep(d / 1e9)
    t = time.monotonic_ns()
    late[i] = (t - nxt) / 1000.0
    acc = 0.0
    for k in range(200):          # the same 200 multiply-adds as the C loop
        acc += k * 0.5
    if garbage:                   # a JointState-like message decoded into Python objects (7 joints)
        msg = {'name': ['j%d' % j for j in range(7)], 'position': [0.1 * j for j in range(7)],
               'velocity': [0.0] * 7, 'effort': [0.0] * 7, 'stamp': (i, t)}
        keep.append(msg)
        if len(keep) > 2000:      # keep a window of recent messages alive, as a buffer would
            keep = keep[-1000:]
print('\n'.join('%.2f' % x for x in late))
s = sorted(late)
sys.stderr.write('Python loop%s: N=%d median %.1f us, p99 %.1f us, p99.9 %.1f us, max %.1f us\n' %
                 (' (garbage)' if garbage else '', N, s[N // 2], s[int(N * 0.99)], s[int(N * 0.999)], s[-1]))
