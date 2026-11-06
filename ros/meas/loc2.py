# non-blank source lines by language, excluding tests/examples/docs (our measurement)
import os, sys, json, subprocess, re
D = sys.argv[1]
EXT = {'.c':'C','.h':'H','.cpp':'C++','.cc':'C++','.cxx':'C++','.hpp':'C++','.hh':'C++','.py':'Python','.rs':'Rust','.java':'Java','.cs':'C#','.go':'Go'}
SKIP = re.compile(r'/(test|tests|testing|test_[^/]*|examples?|demos?|docs?|benchmarks?|third_party|vendor)(/|$)', re.I)
out = {}
for repo in sorted(os.listdir(D)):
    root = os.path.join(D, repo); cnt = {}
    for dp, dn, fn in os.walk(root):
        rel = dp[len(root):]
        if '/.git' in rel or SKIP.search(rel + '/'): continue
        for f in fn:
            e = os.path.splitext(f)[1].lower()
            if e not in EXT or f.startswith('test_'): continue
            try: n = sum(1 for l in open(os.path.join(dp, f), encoding='utf-8', errors='ignore') if l.strip())
            except Exception: continue
            cnt[EXT[e]] = cnt.get(EXT[e], 0) + n
    h = cnt.pop('H', 0)
    k = 'C++' if cnt.get('C++', 0) >= cnt.get('C', 0) else 'C'
    cnt[k] = cnt.get(k, 0) + h
    tot = sum(cnt.values()) or 1
    out[repo] = {'lines': cnt, 'total': tot, 'headers_to': k}
    top = sorted(cnt.items(), key=lambda x: -x[1])
    print(f'{repo:32s} {tot:8d}  ' + ', '.join(f'{a} {100*b/tot:.0f}%' for a, b in top[:4]) + f'  (.h→{k})')
json.dump(out, open(sys.argv[2], 'w'), indent=1)
