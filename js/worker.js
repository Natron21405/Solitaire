/* worker.js — runs the solver off the main thread so the UI never janks. */
'use strict';
importScripts('solver.js', 'deal.js');

var S = self.KSolver, D = self.KDeal;

// Budgets. Generation favours "try another deal" over "think harder about
// this one" -- a fresh deal is far cheaper than the tail of a hard search.
var GEN = { maxNodes: 120000, restarts: 6 };
var HINT = { maxNodes: 250000, restarts: 8 };

self.onmessage = function (e) {
  var msg = e.data, t0 = Date.now();

  if (msg.cmd === 'winnableDeal') {
    var seed = msg.seed >>> 0, tried = 0;
    for (;;) {
      var st = D.dealFromSeed(seed);
      var r = S.solve(st, GEN);
      tried++;
      if (r.result === 'win') {
        self.postMessage({ kind: 'deal', id: msg.id, ok: true, seed: seed, tried: tried, ms: Date.now() - t0 });
        return;
      }
      seed = (seed + 1) >>> 0;
      if (tried > 400) {   // never happens in practice; fail open rather than hang
        self.postMessage({ kind: 'deal', id: msg.id, ok: false, seed: seed, tried: tried });
        return;
      }
    }
  }

  if (msg.cmd === 'hint') {
    // Return the WHOLE winning line, not just its first move. The UI keeps it
    // as a plan keyed by position, so following a hint yields the next step of
    // the same line instead of a freshly-computed one -- which is what made
    // hints oscillate, shuffling a card back and forth between two equivalent
    // piles forever.
    var rh = S.solve(msg.state, HINT);
    self.postMessage({ kind: 'hint', id: msg.id, result: rh.result, moves: rh.moves || null });
    return;
  }

  if (msg.cmd === 'stuck') {
    // Real frozen positions are tiny -- measured across thousands of played
    // positions, the largest needed 80 nodes and the median 8, because a
    // position with no progress available is a closed little space. Ordinary
    // positions can run to 150k before they stumble on progress, so the cap
    // is set at 20000: 250x the margin any genuine stuck position has ever
    // needed, and a hard bound on the work. Anything hitting the cap reports
    // not-stuck, so the player is never interrupted on a guess.
    var rk = S.analyzeStuck(msg.state, { maxNodes: 20000 });
    self.postMessage({ kind: 'stuck', id: msg.id, stuck: rk.stuck && rk.exhausted, nodes: rk.nodes });
    return;
  }

  if (msg.cmd === 'solve') {
    var rs = S.solve(msg.state, { maxNodes: 600000, restarts: 8 });
    self.postMessage({ kind: 'solve', id: msg.id, result: rs.result, moves: rs.moves || null });
    return;
  }

};
