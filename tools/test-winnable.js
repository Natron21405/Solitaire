/* tools/test-winnable.js
   Does a deal accepted by "Winnable only" actually get won under the rules the
   player plays by?

   The generator and the game are two different pieces of code. The solver
   could be right about its own model and still hand over a deal the game will
   not let you finish. So this reproduces the worker's generation loop exactly,
   then replays the winning line through the Game class's PUBLIC move API --
   the same draw() / doMove() the taps and drags call -- and asserts every
   single move is accepted and the foundations reach 52.

   Usage: node --stack-size=8000 tools/test-winnable.js [deals] [startSeed]   */
global.self = global;
require('../js/solver.js'); require('../js/deal.js'); require('../js/game.js');
const S = self.KSolver, D = self.KDeal, G = self.KGame;

// identical to js/worker.js
const GEN = { maxNodes: 120000, restarts: 6 };

function generate(seed) {                       // mirrors worker 'winnableDeal'
  let tried = 0;
  for (;;) {
    const st = D.dealFromSeed(seed);
    const r = S.solve(st, GEN);
    tried++;
    if (r.result === 'win') return { seed, moves: r.moves, tried };
    seed = (seed + 1) >>> 0;
    if (tried > 400) return null;
  }
}

/* Replay a solver line using only the game's public moves. */
function playThroughGameApi(seed, moves) {
  const g = new G.Game(D.dealFromSeed(seed), { mode: 'winnable' });

  // the UI rebuilds the deal from the seed the worker returned — verify identical
  if (S.stateKey(g.s) !== S.stateKey(D.dealFromSeed(seed)))
    return 'deal mismatch between generator and game';

  for (const m of moves) {
    if (m.t === 'wf' || m.t === 'wt') {
      for (let i = 0; i < m.draws; i++) if (!g.draw()) return 'draw refused';
      const card = g.s.waste[g.s.waste.length - 1];
      if (card === undefined) return 'waste empty where a card was expected';
      const dest = m.t === 'wf' ? { kind: 'foundation', suit: S.SUIT(card) }
                                : { kind: 'tableau', pile: m.to };
      if (!g.doMove({ kind: 'waste' }, dest)) return `game refused ${m.t}`;
    } else if (m.t === 'tf') {
      const u = g.s.up[m.from];
      if (!u.length) return 'tf from empty pile';
      const card = u[u.length - 1];
      if (!g.doMove({ kind: 'tableau', pile: m.from, idx: u.length - 1 },
                    { kind: 'foundation', suit: S.SUIT(card) })) return 'game refused tf';
    } else if (m.t === 'tt') {
      if (!g.doMove({ kind: 'tableau', pile: m.from, idx: m.idx },
                    { kind: 'tableau', pile: m.to })) return 'game refused tt';
    } else if (m.t === 'ft') {
      if (!g.doMove({ kind: 'foundation', suit: m.suit },
                    { kind: 'tableau', pile: m.to })) return 'game refused ft';
    } else return 'unknown move ' + m.t;
  }

  // the line may stop at the provably-won position; finish it the way the
  // Finish button does, and demand all 52
  let guard = 0;
  while (S.foundationTotal(g.s) < 52 && guard++ < 5000) if (!g.autocompleteStep()) break;
  if (S.foundationTotal(g.s) !== 52) return `stalled at ${S.foundationTotal(g.s)}/52`;
  if (!g.checkWon()) return 'checkWon false at 52';
  return null;
}

const N = parseInt(process.argv[2] || '150', 10);
const START = parseInt(process.argv[3] || '1', 10);

let seed = START, verified = 0, failures = 0, totalTried = 0;
const t0 = Date.now();
for (let n = 0; n < N; n++) {
  const gen = generate(seed);
  if (!gen) { console.log('generator gave up — should never happen'); break; }
  totalTried += gen.tried;
  const err = playThroughGameApi(gen.seed, gen.moves);
  if (err) { failures++; console.log(`  FAIL seed ${gen.seed}: ${err}`); }
  else verified++;
  seed = (gen.seed + 1) >>> 0;
}
const dt = (Date.now() - t0) / 1000;
console.log(`\ndeals offered as "winnable": ${N}`);
console.log(`  played to 52 through the game's own rules: ${verified}`);
console.log(`  FAILED: ${failures}`);
console.log(`  shuffles examined per accepted deal: ${(totalTried / N).toFixed(2)}`);
console.log(`  ${dt.toFixed(1)}s (${(dt / N * 1000).toFixed(0)}ms per accepted deal)`);
process.exit(failures ? 1 : 0);
