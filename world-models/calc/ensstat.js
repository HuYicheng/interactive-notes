// Step ② of "Try It in Your Head": how do the four ways of choosing the push strength compare?
// For each rule, press "Start over" 12 times; each time keep pressing "Try once" until the puck stops within 1 cm
// of the 16 cm goal, and record the first try (strength, predicted and actual distance) and the number of tries.
// The interactive reseeds its five networks on every "Start over", so the sequence below is reproducible.
//   usage: node ensstat.js /absolute/path/to/world-models/index.html
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2], N = 12;
  if (!file) { console.log('usage: node ensstat.js /absolute/path/to/world-models/index.html'); process.exit(2); }
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  await p.goto('file://' + file); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('ens').scrollIntoView({ block: 'start' })); await p.waitForTimeout(1800);
  const click = l => p.evaluate(l => { [...document.getElementById('ens').querySelectorAll('button')].find(x => x.innerText.trim().startsWith(l)).click() }, l);
  const read = () => p.evaluate(() => document.querySelector('#ens .met').innerText.replace(/\s+/g, ' '));
  const num = (s, re) => { const m = s.match(re); return m ? +m[1] : NaN; };
  let bad = 0; const f1 = x => x.toFixed(1);
  for (const [zh, en] of [['一个模型', 'one model'], ['五个取平均', 'mean of five'], ['五个，悲观', 'five, pessimistic'], ['五个，乐观', 'five, optimistic']]) {
    const first = [], tries = [];
    for (let k = 0; k < N; k++) {
      await click('从头再来'); await p.waitForTimeout(450); await click(zh); await p.waitForTimeout(350);
      let t = 0, done = false;
      while (t < 8 && !done) {
        const r0 = await read(); const u = num(r0, /力度 ([\d.]+)/), pred = num(r0, /滑出去 ([\d.]+) cm/);
        await click('试一次'); await p.waitForTimeout(450); t++;
        const act = num(await read(), /上次滑了 ([\d.]+) cm/);
        if (t === 1) first.push({ u, pred, act });
        done = Math.abs(act - 16) <= 1.0;
      }
      tries.push(done ? t : 99);
    }
    const miss = first.map(f => Math.abs(f.pred - f.act));
    console.log('\n' + en + ' (goal 16 cm, ' + N + ' restarts)');
    console.log('  first try, strength:           ' + first.map(f => f.u.toFixed(2)).join(' '));
    console.log('  first try, predicted / actual: ' + first.map(f => f1(f.pred) + '/' + f1(f.act)).join('  '));
    console.log('  first try, |predicted - actual|: mean ' + f1(miss.reduce((a, c) => a + c, 0) / N) + ' cm, max ' + f1(Math.max(...miss)) + ' cm;  |actual - 16|: mean ' + f1(first.reduce((a, f) => a + Math.abs(f.act - 16), 0) / N) + ' cm');
    console.log('  tries needed to stop within 1 cm of the goal: ' + tries.join(' ') + '   (max ' + Math.max(...tries) + ')');
    if (Math.max(...tries) > 4) { bad++; console.log('  CLAIM FAILED: more than 4 tries'); }
    if (en === 'five, optimistic' && !first.every(f => f.u === 1)) { bad++; console.log('  CLAIM FAILED: optimistic does not always start at full strength'); }
  }
  console.log(bad ? '\nCLAIMS FAILED: ' + bad : '\nclaims hold: every rule reaches the goal in 1 to 4 tries; "optimistic" always tries full strength first');
  await b.close(); process.exit(bad ? 1 : 0);
})();
