/* tools/test-game.js — headless correctness tests for the game layer.
   Usage: node --stack-size=8000 tools/test-game.js [deals]                */
global.self = global;
require('../js/solver.js'); require('../js/deal.js'); require('../js/game.js');
const S = self.KSolver, D = self.KDeal, G = self.KGame;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  FAIL:', msg); } }

/* --- invariant: face-up portion of every tableau pile is a valid run --- */
function checkInvariants(g, where) {
  const s = g.s;
  const seen = new Set();
  for (let p = 0; p < 7; p++) {
    const u = s.up[p];
    for (let i = 0; i + 1 < u.length; i++) {
      if (S.RANK(u[i+1]) !== S.RANK(u[i]) - 1 || S.COLOR(u[i+1]) === S.COLOR(u[i]))
        { ok(false, `run invariant broken in pile ${p} @${where}`); return false; }
    }
    if (u.length === 0 && s.down[p].length > 0)
      { ok(false, `unflipped face-down card left exposed in pile ${p} @${where}`); return false; }
    for (const c of u) seen.add(c);
    for (const c of s.down[p]) seen.add(c);
  }
  for (const c of s.stock) seen.add(c);
  for (const c of s.waste) seen.add(c);
  let fnd = 0;
  for (let st = 0; st < 4; st++) for (let r = 1; r <= s.fnd[st]; r++) { seen.add(st*13 + r-1); fnd++; }
  if (seen.size !== 52) { ok(false, `card conservation broken: ${seen.size}/52 @${where}`); return false; }
  return true;
}

const N = parseInt(process.argv[2] || '40', 10);
console.log(`--- game-layer tests over ${N} deals ---`);

let completed = 0, autoOK = 0;
for (let seed = 1; seed <= N; seed++) {
  const deal = D.dealFromSeed(seed);
  const g = new G.Game(deal, { mode: 'winnable' });
  if (!checkInvariants(g, 'deal')) continue;

  // 1) A fresh deal must have 28 tableau cards, 24 in stock, 21 face-down.
  ok(S.downCount(g.s) === 21, `seed ${seed}: expected 21 face-down, got ${S.downCount(g.s)}`);
  ok(g.s.stock.length === 24, `seed ${seed}: expected 24 in stock`);

  // 2) Undo restores exactly.
  const before = S.stateKey(g.s);
  g.draw();
  ok(S.stateKey(g.s) !== before, `seed ${seed}: draw changed nothing`);
  g.undo();
  ok(S.stateKey(g.s) === before, `seed ${seed}: undo did not restore state`);
  ok(!g.canUndo(), `seed ${seed}: history not empty after full undo`);

  // 3) Drive the game with the solver's own solution, translated into the
  //    same primitives the UI calls, and confirm it finishes.
  const sol = S.solve(deal, { maxNodes: 120000, restarts: 6 });
  if (sol.result !== 'win') continue;
  completed++;

  const g2 = new G.Game(deal, { mode: 'winnable' });
  let step = 0, hitAllFaceUp = false;
  for (const m of sol.moves) {
    // NOTE: applyMove performs a 'wf'/'wt' move's own stock presses. Do not
    // pre-draw here or the draws happen twice.
    g2.snapshot();
    S.applyMove(g2.s, m);
    g2.moveCount++;
    step++;
    if (!checkInvariants(g2, `seed ${seed} step ${step} (${m.t})`)) break;
    if (S.downCount(g2.s) === 0) { hitAllFaceUp = true; break; }
  }

  // 4) Autocomplete must be OFFERED whenever nothing is face-down, and the
  //    greedy path must always reach 52 whenever it claims to be safe.
  if (hitAllFaceUp) {
    ok(g2.canAutocomplete() || S.foundationTotal(g2.s) === 52, `seed ${seed}: autocomplete not offered`);
    if (g2.greedyFinishIsSafe()) {
      let guard = 0;
      while (S.foundationTotal(g2.s) < 52 && guard++ < 4000) if (!g2.autocompleteStep()) break;
      if (S.foundationTotal(g2.s) === 52) autoOK++;
      else ok(false, `seed ${seed}: SAFE greedy finish stalled at ${S.foundationTotal(g2.s)}/52`);
      ok(g2.checkWon(), `seed ${seed}: checkWon false at 52`);
    } else {
      // Not provably safe -> the solver must be able to finish it instead.
      const r = S.solve(g2.s, { maxNodes: 400000, restarts: 6 });
      ok(r.result === 'win', `seed ${seed}: solver could not finish an all-face-up position (${r.result})`);
      if (r.result === 'win') {
        for (const m of r.moves) S.applyMove(g2.s, m);
        let guard = 0;
        while (S.foundationTotal(g2.s) < 52 && guard++ < 4000) if (!g2.autocompleteStep()) break;
        ok(S.foundationTotal(g2.s) === 52, `seed ${seed}: solver finish left ${S.foundationTotal(g2.s)}/52`);
        if (S.foundationTotal(g2.s) === 52) autoOK++;
      }
    }
  }

  // 5) Unlimited undo winds a long game all the way back to the deal.
  const target = S.stateKey(new G.Game(deal, {}).s);
  let guard2 = 0;
  while (g2.canUndo() && guard2++ < 5000) g2.undo();
  ok(S.stateKey(g2.s) === target, `seed ${seed}: could not undo back to the original deal`);
}

console.log(`solved deals driven to completion: ${completed}, autocomplete reached 52 on ${autoOK}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
