/* tools/bench.js — solver benchmark. node --stack-size=8000 tools/bench.js [deals] */
global.self = global;
require('../js/solver.js'); require('../js/deal.js');
const S = self.KSolver, D = self.KDeal;
const N = parseInt(process.argv[2] || '150', 10);
for (const [budget, restarts] of [[120000, 6], [250000, 8]]) {
  let win = 0, uns = 0, unk = 0; const t0 = Date.now();
  for (let seed = 1; seed <= N; seed++) {
    const r = S.solve(D.dealFromSeed(seed), { maxNodes: budget, restarts });
    if (r.result === 'win') win++; else if (r.result === 'unsolvable') uns++; else unk++;
  }
  const dt = (Date.now() - t0) / 1000;
  console.log(`budget ${budget} x${restarts}: win ${(100*win/N).toFixed(1)}%  unsolvable ${(100*uns/N).toFixed(1)}%  unknown ${(100*unk/N).toFixed(1)}%  ${(dt/N*1000).toFixed(0)}ms/deal`);
}
