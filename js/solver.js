/* =====================================================================
   solver.js — Klondike (draw 3, unlimited redeals) solver.

   Card encoding: integer 0..51.
       suit  = (c / 13) | 0      0=Spades 1=Hearts 2=Clubs 3=Diamonds
       rank  = (c % 13) + 1      1=Ace ... 13=King
       color = suit & 1          0 = black (S,C), 1 = red (H,D)

   Runs on the tableau: face-up cards in a pile are ALWAYS a valid
   descending, alternating-colour run, because that is the only way a
   card can ever be placed there. We rely on that invariant throughout.

   Key theorem used for pruning (and for the Autocomplete feature):
       If no face-down cards remain, the deal is guaranteed winnable.
   Proof sketch: face-up cards in a pile form a strictly descending run,
   so nothing can ever sit on top of an Ace -> every Ace is exposed.
   By induction, once all ranks < r are on the foundations, no card of
   rank r can be covered. Unlimited redeals make the stock fully
   reachable. Therefore the position is solvable.
   ===================================================================== */

(function (root) {
  'use strict';

  /* Move-ordering weights. These are pure search heuristics -- they change
     how fast a solution is found, never whether one exists. Tuned empirically
     against a 300-deal benchmark; see tools/tune.js. */
  var W = {
    tfExpose: 160,  // tableau->foundation that turns over a face-down card
    tfPlain: 100,   // tableau->foundation, exposes nothing
    ttReveal: 90,   // move a run off a pile, turning over a face-down card
    ttWhole: 55,    // move a whole pile, freeing a column
    ttPart: 40,     // relocate part of a run
    wt: 50,         // waste->tableau
    wf: 85,         // waste->foundation
    ft: 5,          // foundation->tableau
    drawPenalty: 8  // subtracted per stock press needed
  };

  /* Randomised tie-breaking, used for multi-restart search (see solve()).
     DFS on Klondike is heavy-tailed: a single deep dive either finds a
     solution quickly or thrashes. Several short, differently-ordered dives
     beat one long one for the same total node budget. */
  var JITTER = 0;
  var _rs = 1;
  function rnd() {
    _rs |= 0; _rs = (_rs + 0x6D2B79F5) | 0;
    var t = Math.imul(_rs ^ (_rs >>> 15), 1 | _rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  var SUIT = function (c) { return (c / 13) | 0; };
  var RANK = function (c) { return (c % 13) + 1; };
  var COLOR = function (c) { return ((c / 13) | 0) & 1; };

  /* ---------- state ---------------------------------------------------
     s = {
       down : [7] arrays of card ids, index 0 = bottom of pile
       up   : [7] arrays of card ids, index 0 = deepest face-up card
       fnd  : [4] highest rank placed per suit, 0 = empty
       stock: array, NEXT card to be drawn is stock[stock.length - 1]
       waste: array, top of waste is waste[waste.length - 1]
     }
  -------------------------------------------------------------------- */

  function cloneState(s) {
    var d = new Array(7), u = new Array(7), i;
    for (i = 0; i < 7; i++) { d[i] = s.down[i].slice(); u[i] = s.up[i].slice(); }
    return {
      down: d, up: u,
      fnd: [s.fnd[0], s.fnd[1], s.fnd[2], s.fnd[3]],
      stock: s.stock.slice(),
      waste: s.waste.slice()
    };
  }

  function downCount(s) {
    var n = 0;
    for (var i = 0; i < 7; i++) n += s.down[i].length;
    return n;
  }

  function foundationTotal(s) {
    return s.fnd[0] + s.fnd[1] + s.fnd[2] + s.fnd[3];
  }

  /* Compact, collision-free state key.
     The remaining stock+waste cards are fully implied by everything else
     (each of the 52 cards lives in exactly one place), and their ORDER is
     invariant for the whole deal — drawing, redealing and playing off the
     waste all preserve relative order. So the only extra information we
     need is the split point, i.e. waste.length. */
  function stateKey(s) {
    var k = String.fromCharCode(
      s.fnd[0], s.fnd[1], s.fnd[2], s.fnd[3], s.waste.length
    );
    for (var i = 0; i < 7; i++) {
      k += String.fromCharCode(64 + s.down[i].length);
      var u = s.up[i];
      for (var j = 0; j < u.length; j++) k += String.fromCharCode(128 + u[j]);
    }
    return k;
  }

  /* ---------- rules --------------------------------------------------- */

  function canStackOnTableau(card, target) {   // target = card currently on top, or -1 for empty column
    if (target < 0) return RANK(card) === 13;
    return RANK(card) === RANK(target) - 1 && COLOR(card) !== COLOR(target);
  }

  function canGoToFoundation(s, card) {
    return s.fnd[SUIT(card)] === RANK(card) - 1;
  }

  /* A card is SAFE to send to the foundation when it can never again be
     needed on the tableau. Its only tableau job is holding a card one rank
     lower of the opposite colour; if both such cards are already home, the
     card is dead weight. Aces and twos are always safe (an Ace never needs
     holding). This is a sound pruning rule, not a heuristic. */
  function isSafeToFoundation(s, card) {
    var r = RANK(card);
    if (r <= 2) return true;
    var color = COLOR(card);
    // opposite-colour suits: black = 0,2 ; red = 1,3
    var o1 = color === 0 ? 1 : 0;
    var o2 = color === 0 ? 3 : 2;
    return s.fnd[o1] >= r - 1 && s.fnd[o2] >= r - 1;
  }

  /* ---------- primitive mutations (used by both solver and game) ------- */

  function drawStep(s) {
    // one press of the stock: deal 3 (or redeal if stock is empty)
    if (s.stock.length === 0) {
      if (s.waste.length === 0) return false;
      s.stock = s.waste.slice().reverse();
      s.waste = [];
      return true;
    }
    var n = Math.min(3, s.stock.length);
    for (var i = 0; i < n; i++) s.waste.push(s.stock.pop());
    return true;
  }

  /* Every waste card reachable by pressing the stock repeatedly, together
     with how many presses it costs. Collapsing "press, press, press, play"
     into ONE compound move is what keeps the branching factor sane. */
  function reachableWaste(s) {
    var out = [];
    var stock = s.stock.slice(), waste = s.waste.slice();
    var seen = Object.create(null);
    var draws = 0;

    if (waste.length) out.push({ draws: 0, card: waste[waste.length - 1] });

    while (draws < 60) {
      var sig = stock.length + ':' + waste.length;
      if (seen[sig]) break;
      seen[sig] = 1;
      if (stock.length === 0) {
        if (waste.length === 0) break;
        stock = waste.slice().reverse();
        waste = [];
      } else {
        var n = Math.min(3, stock.length);
        for (var i = 0; i < n; i++) waste.push(stock.pop());
      }
      draws++;
      if (waste.length) {
        var top = waste[waste.length - 1];
        var dup = false;
        for (var k = 0; k < out.length; k++) if (out[k].card === top) { dup = true; break; }
        if (!dup) out.push({ draws: draws, card: top });
      }
    }
    return out;
  }

  /* ---------- move application ---------------------------------------- */
  // move = { t:'wf'|'wt'|'tf'|'tt'|'ft', ... }

  function applyMove(s, m) {
    var i, card;
    if (m.t === 'wf' || m.t === 'wt') {
      for (i = 0; i < m.draws; i++) drawStep(s);
      card = s.waste.pop();
      if (m.t === 'wf') s.fnd[SUIT(card)] = RANK(card);
      else s.up[m.to].push(card);
    } else if (m.t === 'tf') {
      card = s.up[m.from].pop();
      s.fnd[SUIT(card)] = RANK(card);
      flip(s, m.from);
    } else if (m.t === 'tt') {
      var run = s.up[m.from].splice(m.idx);
      for (i = 0; i < run.length; i++) s.up[m.to].push(run[i]);
      flip(s, m.from);
    } else if (m.t === 'ft') {
      var rank = s.fnd[m.suit];
      card = m.suit * 13 + (rank - 1);
      s.fnd[m.suit] = rank - 1;
      s.up[m.to].push(card);
    }
    return s;
  }

  function flip(s, pile) {
    if (s.up[pile].length === 0 && s.down[pile].length > 0) {
      s.up[pile].push(s.down[pile].pop());
    }
  }

  /* Repeatedly send provably-safe cards home. Sound: these cards can never
     be wanted back on the tableau, so we lose no solutions. */
  function autoplaySafe(s, log) {
    var moved = true;
    while (moved) {
      moved = false;
      for (var p = 0; p < 7; p++) {
        var u = s.up[p];
        if (!u.length) continue;
        var c = u[u.length - 1];
        if (canGoToFoundation(s, c) && isSafeToFoundation(s, c)) {
          applyMove(s, { t: 'tf', from: p });
          if (log) log.push({ t: 'tf', from: p, auto: true });
          moved = true;
        }
      }
      if (s.waste.length) {
        var w = s.waste[s.waste.length - 1];
        if (canGoToFoundation(s, w) && isSafeToFoundation(s, w)) {
          applyMove(s, { t: 'wf', draws: 0 });
          if (log) log.push({ t: 'wf', draws: 0, auto: true });
          moved = true;
        }
      }
    }
    return s;
  }

  /* ---------- move generation ----------------------------------------- */

  function topOf(s, p) {
    var u = s.up[p];
    return u.length ? u[u.length - 1] : -1;
  }

  function generateMoves(s) {
    var moves = [], p, q, i;

    // All empty columns are interchangeable — placing a King in column 2 or
    // column 5 gives identical positions. Considering only the first one
    // collapses a large amount of duplicate branching.
    var firstEmpty = -1;
    for (p = 0; p < 7; p++) {
      if (s.up[p].length === 0 && s.down[p].length === 0) { firstEmpty = p; break; }
    }

    /* --- tableau -> foundation ---
       NOTE: every foundation move reaching this point is an UNSAFE one --
       provably-safe cards were already auto-played before generation. Unsafe
       foundation moves are the classic way to lose Klondike, so they are
       ranked LOW unless they expose a face-down card. */
    for (p = 0; p < 7; p++) {
      var c = topOf(s, p);
      if (c >= 0 && canGoToFoundation(s, c)) {
        var exposes = (s.up[p].length === 1 && s.down[p].length > 0);
        moves.push({ t: 'tf', from: p, score: exposes ? W.tfExpose : W.tfPlain });
      }
    }

    /* --- tableau -> tableau (whole valid sub-run) --- */
    for (p = 0; p < 7; p++) {
      var u = s.up[p];
      if (!u.length) continue;
      for (i = 0; i < u.length; i++) {
        var head = u[i];
        var wholePile = (i === 0);
        var revealsCard = wholePile && s.down[p].length > 0;
        // Moving an entire King-headed column that sits on nothing achieves
        // nothing: same column count, same exposure. Prune it.
        if (wholePile && !revealsCard && RANK(head) === 13) continue;

        for (q = 0; q < 7; q++) {
          if (q === p) continue;
          var tgt = topOf(s, q);
          var qEmpty = (s.up[q].length === 0 && s.down[q].length === 0);
          if (qEmpty) {
            if (q !== firstEmpty) continue;            // interchangeable target
            if (RANK(head) !== 13) continue;
            if (wholePile && !revealsCard) continue;   // shuffling a king between empties
          } else if (!canStackOnTableau(head, tgt)) continue;

          var sc;
          if (revealsCard) sc = W.ttReveal;
          else if (wholePile) sc = W.ttWhole;
          else sc = W.ttPart;
          moves.push({ t: 'tt', from: p, idx: i, to: q, score: sc });
        }
      }
    }

    /* --- waste -> anywhere (compound: N stock presses, then play) --- */
    var reach = reachableWaste(s);
    for (i = 0; i < reach.length; i++) {
      var r = reach[i];
      if (canGoToFoundation(s, r.card)) {
        moves.push({ t: 'wf', draws: r.draws, score: W.wf - r.draws * W.drawPenalty });
      }
      for (q = 0; q < 7; q++) {
        var t2 = topOf(s, q);
        var qE = (s.up[q].length === 0 && s.down[q].length === 0);
        if (qE && q !== firstEmpty) continue;          // interchangeable target
        if (qE ? RANK(r.card) === 13 : canStackOnTableau(r.card, t2)) {
          moves.push({ t: 'wt', draws: r.draws, to: q, score: W.wt - r.draws * W.drawPenalty });
        }
      }
    }

    /* --- foundation -> tableau (allowed by house rules) ---
       Only for cards that are NOT provably safe; a safe card would just be
       auto-played straight back, so those branches are pure waste. */
    for (var st = 0; st < 4; st++) {
      var rank = s.fnd[st];
      if (rank === 0) continue;
      var fc = st * 13 + (rank - 1);
      if (isSafeToFoundation(s, fc)) continue;
      for (q = 0; q < 7; q++) {
        var t3 = topOf(s, q);
        if (t3 < 0) continue;                       // never dump onto an empty column
        if (canStackOnTableau(fc, t3)) moves.push({ t: 'ft', suit: st, to: q, score: W.ft });
      }
    }

    if (JITTER > 0) {
      for (i = 0; i < moves.length; i++) moves[i].score += (rnd() - 0.5) * JITTER;
    }
    moves.sort(function (a, b) { return b.score - a.score; });
    return moves;
  }

  /* ---------- search --------------------------------------------------- */

  /* Returns { result: 'win' | 'unsolvable' | 'unknown', moves: [...], nodes }
     'unsolvable' is only reported when the search space was fully
     exhausted, so it is a proof, not a guess. 'unknown' means we ran out
     of budget. */
  function solveOnce(startState, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || 400000;
    var maxDepth = opts.maxDepth || 400;

    var visited = Object.create(null);
    var nodes = 0;
    var budgetHit = false;
    var solution = null;

    var root = cloneState(startState);
    var rootLog = [];
    autoplaySafe(root, rootLog);

    function dfs(s, path, depth) {
      if (solution) return true;
      if (nodes >= maxNodes) { budgetHit = true; return false; }
      nodes++;

      if (foundationTotal(s) === 52) { solution = path.slice(); return true; }

      /* Guaranteed-win shortcut.
         Requires the stock AND waste to be empty as well as every tableau
         card being face up. With everything on the tableau, nothing can ever
         cover the next card the foundations need (anything sitting on it has
         a lower rank, and all lower ranks are already home), so greedy play
         finishes. The "all face up" part ALONE is not sufficient under draw
         three: cycling the stock only ever exposes every third card, so a
         needed card can sit permanently out of reach. */
      if (downCount(s) === 0 && s.stock.length === 0 && s.waste.length === 0) {
        solution = path.slice(); return true;
      }

      if (depth >= maxDepth) { budgetHit = true; return false; }

      var k = stateKey(s);
      if (visited[k]) return false;
      visited[k] = 1;

      var moves = generateMoves(s);
      for (var i = 0; i < moves.length; i++) {
        var next = cloneState(s);
        applyMove(next, moves[i]);
        var autoLog = [];
        autoplaySafe(next, autoLog);
        path.push(moves[i]);
        for (var a = 0; a < autoLog.length; a++) path.push(autoLog[a]);
        if (dfs(next, path, depth + 1)) return true;
        path.length -= (1 + autoLog.length);
        if (nodes >= maxNodes) { budgetHit = true; return false; }
      }
      return false;
    }

    dfs(root, [], 0);

    if (solution) return { result: 'win', moves: rootLog.concat(solution), nodes: nodes };
    if (budgetHit) return { result: 'unknown', moves: null, nodes: nodes };
    return { result: 'unsolvable', moves: null, nodes: nodes };
  }

  /* ---------- "is the player actually stuck?" -----------------------------

     Distinct from "can this be won". A game can be unwinnable and still be
     perfectly playable — cards to turn over, cards to send home. Interrupting
     then would spoil it. What deserves an interruption is a position where
     nothing can EVER happen again: every legal line just shuffles cards
     between piles.

     So: explore the whole reachable space and ask whether any position in it
     turns over a face-down card, or puts more cards on the foundations than
     you have now. The moment one does, we stop and report progress — which is
     why this is cheap in an ordinary position. Only a genuinely closed
     position runs to exhaustion, and a closed position is small by definition.

     Returns { stuck, exhausted, nodes }. `stuck` is only ever true when the
     search finished on its own; running out of budget reports stuck:false, so
     a hard position is never mistaken for a dead one. */

  /* Complete move generation — no search heuristics.
     generateMoves() drops legal-but-pointless moves to keep the search fast.
     That is right for solving and wrong here: a move this function skipped
     could be the one that leads somewhere. The only things omitted are moves
     into a second empty column (all empty columns are the same column) and
     sliding an already-exposed King-headed column sideways, which produces a
     position identical to the one you left. */
  function allLegalMoves(s) {
    var moves = [], p, q, i, st;

    var firstEmpty = -1;
    for (p = 0; p < 7; p++) {
      if (s.up[p].length === 0 && s.down[p].length === 0) { firstEmpty = p; break; }
    }

    for (p = 0; p < 7; p++) {
      var c = topOf(s, p);
      if (c >= 0 && canGoToFoundation(s, c)) moves.push({ t: 'tf', from: p });
    }

    for (p = 0; p < 7; p++) {
      var u = s.up[p];
      for (i = 0; i < u.length; i++) {
        var head = u[i];
        var wholeColumn = (i === 0 && s.down[p].length === 0);
        for (q = 0; q < 7; q++) {
          if (q === p) continue;
          var qEmpty = (s.up[q].length === 0 && s.down[q].length === 0);
          if (qEmpty) {
            if (q !== firstEmpty) continue;
            if (RANK(head) !== 13 || wholeColumn) continue;
          } else if (!canStackOnTableau(head, topOf(s, q))) continue;
          moves.push({ t: 'tt', from: p, idx: i, to: q });
        }
      }
    }

    var reach = reachableWaste(s);
    for (i = 0; i < reach.length; i++) {
      var r = reach[i];
      if (canGoToFoundation(s, r.card)) moves.push({ t: 'wf', draws: r.draws });
      for (q = 0; q < 7; q++) {
        var qE = (s.up[q].length === 0 && s.down[q].length === 0);
        if (qE && q !== firstEmpty) continue;
        if (qE ? RANK(r.card) === 13 : canStackOnTableau(r.card, topOf(s, q))) {
          moves.push({ t: 'wt', draws: r.draws, to: q });
        }
      }
    }

    for (st = 0; st < 4; st++) {
      if (!s.fnd[st]) continue;
      var fc = st * 13 + (s.fnd[st] - 1);
      for (q = 0; q < 7; q++) {
        var e = (s.up[q].length === 0 && s.down[q].length === 0);
        if (e) {
          if (q === firstEmpty && RANK(fc) === 13) moves.push({ t: 'ft', suit: st, to: q });
        } else if (canStackOnTableau(fc, topOf(s, q))) {
          moves.push({ t: 'ft', suit: st, to: q });
        }
      }
    }
    return moves;
  }

  function analyzeStuck(state, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || 250000;

    var baseFnd = foundationTotal(state);
    var baseDown = downCount(state);
    if (baseFnd === 52) return { stuck: false, exhausted: true, nodes: 0 };

    var visited = Object.create(null);
    var stack = [cloneState(state)];
    var nodes = 0;

    while (stack.length) {
      if (nodes >= maxNodes) return { stuck: false, exhausted: false, nodes: nodes };
      var s = stack.pop();
      var k = stateKey(s);
      if (visited[k]) continue;
      visited[k] = 1;
      nodes++;

      // any turned-over card, or any net gain on the foundations, is progress
      if (foundationTotal(s) > baseFnd || downCount(s) < baseDown) {
        return { stuck: false, exhausted: false, nodes: nodes };
      }

      var ms = allLegalMoves(s);
      for (var i = 0; i < ms.length; i++) {
        var next = cloneState(s);
        applyMove(next, ms[i]);
        if (!visited[stateKey(next)]) stack.push(next);
      }
    }
    return { stuck: true, exhausted: true, nodes: nodes };
  }

  /* Public entry point.
       maxNodes  total node budget across all restarts
       restarts  number of randomised dives (1 = deterministic, exhaustive-capable)
     An 'unsolvable' verdict is only ever returned by a single exhaustive dive
     that emptied its search space, so it remains a proof, never a guess. */
  function solve(startState, opts) {
    opts = opts || {};
    var restarts = opts.restarts || 1;
    var total = opts.maxNodes || 400000;

    if (restarts <= 1) {
      JITTER = 0;
      return solveOnce(startState, opts);
    }

    var per = Math.max(2000, Math.floor(total / restarts));
    var nodes = 0, sawUnknown = false;
    for (var i = 0; i < restarts; i++) {
      JITTER = i === 0 ? 0 : 45;          // first dive is the tuned ordering
      _rs = 0x9E3779B9 ^ (i * 2654435761);
      var r = solveOnce(startState, { maxNodes: per, maxDepth: opts.maxDepth });
      nodes += r.nodes;
      if (r.result === 'win') { JITTER = 0; return { result: 'win', moves: r.moves, nodes: nodes }; }
      if (r.result === 'unsolvable' && i === 0) { JITTER = 0; return { result: 'unsolvable', moves: null, nodes: nodes }; }
      if (r.result === 'unknown') sawUnknown = true;
    }
    JITTER = 0;
    return { result: sawUnknown ? 'unknown' : 'unsolvable', moves: null, nodes: nodes };
  }

  var API = {
    SUIT: SUIT, RANK: RANK, COLOR: COLOR,
    cloneState: cloneState, stateKey: stateKey, downCount: downCount,
    foundationTotal: foundationTotal,
    canStackOnTableau: canStackOnTableau, canGoToFoundation: canGoToFoundation,
    isSafeToFoundation: isSafeToFoundation,
    drawStep: drawStep, reachableWaste: reachableWaste,
    applyMove: applyMove, generateMoves: generateMoves,
    autoplaySafe: autoplaySafe, solve: solve, solveOnce: solveOnce, weights: W,
    allLegalMoves: allLegalMoves, analyzeStuck: analyzeStuck
  };

  root.KSolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : this);
