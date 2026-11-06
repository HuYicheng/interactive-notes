import sys, yaml, json
R = sys.argv[1]
names = ['groovy','hydro','indigo','jade','kinetic','lunar','melodic','noetic','ardent','bouncy','crystal','dashing','eloquent','foxy','galactic','humble','iron','jazzy','kilted','lyrical','rolling']
out = {}
for d in names:
    try:
        y = yaml.safe_load(open(f'{R}/{d}/distribution.yaml'))
    except FileNotFoundError:
        continue
    repos = y.get('repositories', {})
    pk = set(); rel_repos = 0; src_repos = 0
    for rn, r in repos.items():
        rel = r.get('release')
        if r.get('source'): src_repos += 1
        if rel and rel.get('version'):
            rel_repos += 1
            for p in rel.get('packages', [rn]):
                pk.add(p)
    plat = y.get('release_platforms', {})
    out[d] = {'repos': len(repos), 'released_repos': rel_repos, 'packages': len(pk), 'platforms': plat, '_pk': sorted(pk)}
    print(d, len(repos), rel_repos, len(pk), plat)
json.dump(out, open(sys.argv[2], 'w'))
