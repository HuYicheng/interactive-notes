# msg.py — the same work in Python: decode a small JointState-like message into Python objects, and turn the bytes of
# one 1280x720 RGB image into something Python can use, four ways. Average time per operation.
import struct, time, array
import numpy as np

wire = bytes(range(232)) * 1
fmt = struct.Struct('<iI56s21d')

def decode(b):
    sec, nsec, names, *v = fmt.unpack(b)
    return {'stamp': (sec, nsec),
            'name': [names[8 * j:8 * j + 8].rstrip(b'\0').decode('latin1') for j in range(7)],
            'position': list(v[0:7]), 'velocity': list(v[7:14]), 'effort': list(v[14:21])}

N = 200000
t0 = time.perf_counter()
for i in range(N):
    m = decode(wire)
t1 = time.perf_counter()
print('Python decode JointState (7 joints) into dict/lists: %.0f ns per message' % ((t1 - t0) / N * 1e9))

S = 2764800
img = (bytes(range(256)) * (S // 256 + 1))[:S]   # real, non-zero bytes (an all-zero bytes(S) is backed by the shared zero page and reads unrealistically fast)
def timeit(f, M):
    t0 = time.perf_counter()
    for _ in range(M):
        r = f()
    return (time.perf_counter() - t0) / M
print('Python image -> list of ints (one list slot per byte, pointing to a shared small int): %.1f ms' % (timeit(lambda: list(img), 5) * 1e3))
print('Python image -> array.array("B") (one copy, done in C): %.1f us' % (timeit(lambda: array.array('B', img), 200) * 1e6))
print('Python image -> numpy.frombuffer (no copy, a view): %.2f us' % (timeit(lambda: np.frombuffer(img, dtype=np.uint8), 20000) * 1e6))
print('Python image -> numpy array copy (.copy()): %.1f us' % (timeit(lambda: np.frombuffer(img, dtype=np.uint8).copy(), 200) * 1e6))
