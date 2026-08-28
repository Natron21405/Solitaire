/* tools/test-naive-play.js
   Verified-winnable deals can still be LOST — by playing them badly. This
   quantifies how badly, because "winnable" describes the deal, not the game.

   The app's tap sends a card to the foundation whenever that is legal
   (foundation-first, by design). Doing that eagerly is the classic way to lose
   Klondike: a card sent home early is no longer available to hold the run that
   needed it. This simulates a plausible eager player and measures how often a
   provably winnable deal is provably dead after a short while.

   Usage: node --stack-size=8000 tools/test-naive-play.js [deals]             */
global.self = global;
require('../js/solver.js'); require('../js/deal.js'); require('../js/game.js');
const S = self.KSolver, D = self.KDeal, G = self.KGame;
const GEN = { maxNodes: 120000, restarts: 6 };
const CHECK = { maxNodes: 400000, restarts: 6 };

function winnableDeal(seed) {
  for (;;) {
    const st = D.dealFromSeed(seed);
    if (S.solve(st, GEN).result === 'win') return seed;
    seed = (seed + 1) >>> 0;
  }
}

/* An eager but not stupid player: take any foundation move offered (which is
   exactly what a tap does), otherwise uncover a face-down card, otherwise
   park the waste card, otherwise press the stock. */
function playNaively(g, maxMoves) {
  for (let n = 0; n < maxMoves; n++) {
    if (S.foundationTotal(g.s) === 52) return 'won';
    let did = false;

    for (let p = 0; p < 7 && !did; p++) {
      const u = g.s.up[p];
      if (u.length && S.canGoToFoundation(g.s, u[u.length - 1])) {
        did = g.doMove({ kind: 'tableau', pile: p, idx: u.length - 1 },
                       { kind: 'foundation', suit: S.SUIT(u[u.length - 1]) });
      }
    }
    if (!did && g.s.waste.length) {
      const w = g.s.waste[g.s.waste.length - 1];
      if (S.canGoToFoundation(g.s, w))
        did = g.doMove({ kind: 'waste' }, { kind: 'foundation', suit: S.SUIT(w) });
    }
    for (let p = 0; p < 7 && !did; p++) {           // uncover a face-down card
      const u = g.s.up[p];
      if (!u.length || g.s.down[p].length === 0) continue;
      for (let q = 0; q < 7 && !did; q++) {
        if (q === p) continue;
        did = g.doMove({ kind: 'tableau', pile: p, idx: 0 }, { kind: 'tableau', pile: q });
      }
    }
    if (!did && g.s.waste.length) {                 // park the waste card
      for (let q = 0; q < 7 && !did; q++)
        did = g.doMove({ kind: 'waste' }, { kind: 'tableau', pile: q });
    }
    if (!did) { if (!g.draw()) return 'stuck'; }
  }
  return 'ongoing';
}

const N = parseInt(process.argv[2] || '60', 10);
let seed = 7000, dead = 0, alive = 0, unknown = 0, won = 0, stuckFlag = 0;

for (let n = 0; n < N; n++) {
  seed = winnableDeal(seed);
  const g = new G.Game(D.dealFromSeed(seed), { mode: 'winnable' });
  const how = playNaively(g, 70);
  if (how === 'won') { won++; seed = (seed + 1) >>> 0; continue; }
  if (how === 'stuck') stuckFlag++;

  const r = S.solve(g.plainState(), CHECK);
  if (r.result === 'unsolvable') dead++;
  else if (r.result === 'win') alive++;
  else unknown++;
  seed = (seed + 1) >>> 0;
}

console.log(`verified-winnable deals played eagerly for up to 70 moves: ${N}`);
console.log(`  already won outright          : ${won}`);
console.log(`  still winnable                : ${alive}`);
console.log(`  PROVABLY DEAD (player's doing): ${dead}   <-- ${(100*dead/N).toFixed(0)}% of winnable deals`);
console.log(`  solver ran out of budget      : ${unknown}`);
console.log(`  board completely frozen       : ${stuckFlag}`);
