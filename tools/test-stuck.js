/* tools/test-stuck.js — is the "no useful moves left" detector trustworthy?

   Two failure modes matter, and they are not symmetric:
     * firing when the player could still make progress   -> spoils the game
     * failing to fire in a truly frozen position         -> mild annoyance
   So this leans hard on the first. Every position reached during a long
   simulated game is checked, and any "stuck" verdict is cross-examined.

   Usage: node --stack-size=8000 tools/test-stuck.js [deals]                  */
global.self = global;
require('../js/solver.js'); require('../js/deal.js'); require('../js/game.js');
const S = self.KSolver, D = self.KDeal, G = self.KGame;

let pass = 0, fail = 0;
const ok = (c, m) => c ? pass++ : (fail++, console.log('  FAIL:', m));

/* ---- 1. a genuinely frozen position must be recognised ----
   Building one is harder than it looks, which is itself reassuring.
   My first attempt parked every Ace at a stock index draw-three never
   surfaces — but playing any OTHER reachable stock card shifts the alignment
   by one, so the Aces become reachable after all. The detector caught that;
   the fixture was wrong, not the code.

   A truly frozen position therefore needs an empty stock (no alignment left
   to shift) and face-down cards (an empty stock with everything face up is
   always winnable). Here every exposed card is a 5 or a 7 — no two ranks
   adjacent, so nothing stacks on anything — with no empty column to drop a
   King into and no Ace exposed to start a foundation. */
function frozenPosition() {
  const R = r => r - 1;                        // rank -> offset within a suit
  const tops = [ 0 * 13 + R(5), 1 * 13 + R(5), 2 * 13 + R(5), 3 * 13 + R(5),
                 0 * 13 + R(7), 1 * 13 + R(7), 2 * 13 + R(7) ];
  const rest = []; for (let i = 0; i < 52; i++) if (!tops.includes(i)) rest.push(i);
  const up = [], down = [];
  let k = 0;
  for (let i = 0; i < 7; i++) {
    const n = i < 6 ? 6 : rest.length - k;     // every pile keeps face-down cards
    down.push(rest.slice(k, k + n)); k += n;
    up.push([tops[i]]);
  }
  return { down, up, fnd: [0, 0, 0, 0], stock: [], waste: [], seed: 1 };
}
{
  const f = frozenPosition();
  const t0 = Date.now();
  const r = S.analyzeStuck(f, { maxNodes: 20000 });
  console.log(`frozen position -> stuck=${r.stuck} exhausted=${r.exhausted} nodes=${r.nodes} (${Date.now() - t0}ms)`);
  console.log(`  legal moves available: ${S.allLegalMoves(f).length}`);
  ok(r.stuck === true, 'frozen position not detected as stuck');
  ok(r.exhausted === true, 'frozen verdict was not a completed search');
}

/* ---- 2. a fresh deal must never be called stuck ---- */
{
  let bad = 0;
  for (let seed = 1; seed <= 200; seed++) if (S.analyzeStuck(D.dealFromSeed(seed)).stuck) bad++;
  ok(bad === 0, `${bad}/200 fresh deals wrongly called stuck`);
  console.log(`fresh deals wrongly called stuck: ${bad}/200`);
}

/* ---- 3. sweep every position of many simulated games ---- */
function naiveStep(g) {                       // an eager, tap-like player
  for (let p = 0; p < 7; p++) {
    const u = g.s.up[p];
    if (u.length && S.canGoToFoundation(g.s, u[u.length - 1]))
      if (g.doMove({ kind: 'tableau', pile: p, idx: u.length - 1 },
                   { kind: 'foundation', suit: S.SUIT(u[u.length - 1]) })) return true;
  }
  if (g.s.waste.length) {
    const w = g.s.waste[g.s.waste.length - 1];
    if (S.canGoToFoundation(g.s, w) &&
        g.doMove({ kind: 'waste' }, { kind: 'foundation', suit: S.SUIT(w) })) return true;
  }
  for (let p = 0; p < 7; p++) {
    if (!g.s.up[p].length || !g.s.down[p].length) continue;
    for (let q = 0; q < 7; q++) {
      if (q === p) continue;
      if (g.doMove({ kind: 'tableau', pile: p, idx: 0 }, { kind: 'tableau', pile: q })) return true;
    }
  }
  if (g.s.waste.length)
    for (let q = 0; q < 7; q++)
      if (g.doMove({ kind: 'waste' }, { kind: 'tableau', pile: q })) return true;
  return g.draw();
}

/* Independent cross-check: brute-force every line up to `plies` deep and see
   whether ANY of them makes progress. Slow, so only used on stuck verdicts. */
function progressWithin(state, plies) {
  const baseF = S.foundationTotal(state), baseD = S.downCount(state);
  let frontier = [S.cloneState(state)];
  const seen = new Set([S.stateKey(state)]);
  for (let d = 0; d < plies; d++) {
    const next = [];
    for (const s of frontier) {
      for (const m of S.allLegalMoves(s)) {
        const c = S.cloneState(s); S.applyMove(c, m);
        if (S.foundationTotal(c) > baseF || S.downCount(c) < baseD) return true;
        const k = S.stateKey(c);
        if (!seen.has(k)) { seen.add(k); next.push(c); }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return false;
}

const N = parseInt(process.argv[2] || '40', 10);
let positions = 0, gated = 0, stuckHits = 0, falsePositives = 0, maxNodes = 0, maxMs = 0;
let stillWinnableWhenStuck = 0;

for (let seed = 1; seed <= N; seed++) {
  const g = new G.Game(D.dealFromSeed(seed), { mode: 'random' });
  for (let step = 0; step < 220; step++) {
    if (S.foundationTotal(g.s) === 52) break;
    positions++;
    // the app's own gate: skip the search when progress is plainly available
    if (g.canProgressNow()) { if (!naiveStep(g)) break; continue; }
    gated++;
    const t0 = Date.now();
    const r = S.analyzeStuck(g.s, { maxNodes: 20000 });   // the budget the app ships
    const ms = Date.now() - t0;
    if (ms > maxMs) maxMs = ms;
    if (r.nodes > maxNodes) maxNodes = r.nodes;

    if (r.stuck) {
      stuckHits++;
      // (a) nothing may make progress within 4 plies of brute force
      if (progressWithin(g.s, 4)) { falsePositives++; console.log(`  FAIL seed ${seed} step ${step}: called stuck but progress exists`); }
      // (b) a stuck position can never still be winnable
      const w = S.solve(g.plainState(), { maxNodes: 200000, restarts: 4 });
      if (w.result === 'win') { stillWinnableWhenStuck++; console.log(`  FAIL seed ${seed} step ${step}: called stuck but solver still wins`); }
      break;
    }
    if (!naiveStep(g)) break;
  }
}
ok(falsePositives === 0, `${falsePositives} false "stuck" verdicts`);
ok(stillWinnableWhenStuck === 0, `${stillWinnableWhenStuck} stuck verdicts on still-winnable positions`);

console.log(`\npositions checked across ${N} simulated games: ${positions}`);
console.log(`  needed the deep search    : ${gated}  (${(100*gated/positions).toFixed(1)}% — the rest were screened out cheaply)`);
console.log(`  reported stuck            : ${stuckHits}`);
console.log(`  false positives           : ${falsePositives}`);
console.log(`  stuck-but-actually-winnable: ${stillWinnableWhenStuck}`);
console.log(`  worst case                : ${maxNodes} nodes, ${maxMs}ms`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
