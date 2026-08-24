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
    var rh = S.solve(msg.state, HINT);
    self.postMessage({ kind: 'hint', id: msg.id, result: rh.result, move: rh.moves && rh.moves.length ? rh.moves[0] : null });
    return;
  }

  if (msg.cmd === 'solve') {
    var rs = S.solve(msg.state, { maxNodes: 600000, restarts: 8 });
    self.postMessage({ kind: 'solve', id: msg.id, result: rs.result, moves: rs.moves || null });
    return;
  }

};
