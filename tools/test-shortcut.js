/* Was the old "all face up => won" shortcut actually sound?
   For each deal, reach an all-face-up position, then ask the (now strict)
   solver whether a real win exists from there. */
global.self = global;
require('../js/solver.js'); require('../js/deal.js');
const S = self.KSolver, D = self.KDeal;

let reached = 0, provenWin = 0, provenLoss = 0, unknown = 0, stockEmpty = 0;
for (let seed = 1; seed <= 60; seed++) {
  const deal = D.dealFromSeed(seed);
  const sol = S.solve(deal, { maxNodes: 200000, restarts: 8 });
  if (sol.result !== 'win') continue;
  const s = S.cloneState(deal);
  for (const m of sol.moves) {
    S.applyMove(s, m);
    if (S.downCount(s) === 0) break;
  }
  if (S.downCount(s) !== 0) continue;
  reached++;
  if (!s.stock.length && !s.waste.length) { stockEmpty++; provenWin++; continue; }
  const r = S.solve(s, { maxNodes: 400000, restarts: 4 });
  if (r.result === 'win') provenWin++;
  else if (r.result === 'unsolvable') { provenLoss++; console.log(`  seed ${seed}: all face up but PROVABLY LOST (stock+waste=${s.stock.length + s.waste.length})`); }
  else unknown++;
}
console.log(`all-face-up positions reached: ${reached}`);
console.log(`  stock+waste already empty : ${stockEmpty}  (greedy autocomplete provably safe)`);
console.log(`  proven winnable           : ${provenWin}`);
console.log(`  PROVEN UNWINNABLE         : ${provenLoss}   <-- old shortcut would have lied here`);
console.log(`  unknown                   : ${unknown}`);
