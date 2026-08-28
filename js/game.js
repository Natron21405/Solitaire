/* =====================================================================
   game.js — the playable game layer.

   House rules (as specified):
     * draw 3 from the stock
     * unlimited passes through the stock
     * NO "turn the last few face up" rule
     * cards may come back off the foundations onto the tableau
     * unlimited undo
   ===================================================================== */
(function (root) {
  'use strict';

  var S = root.KSolver, D = root.KDeal;
  var RANK = S.RANK, COLOR = S.COLOR, SUIT = S.SUIT;

  function Game(state, meta) {
    this.s = S.cloneState(state);
    this.deal = S.cloneState(state);      // pristine copy, for Replay
    this.deal.seed = state.seed;
    this.seed = state.seed;
    this.mode = (meta && meta.mode) || 'winnable';
    this.history = [];          // full snapshots — unlimited undo
    this.moveCount = 0;
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.won = false;
    this.lastMoved = [];        // card ids touched by the last action (for highlight)
  }

  Game.prototype.snapshot = function () {
    this.history.push({ s: S.cloneState(this.s), moveCount: this.moveCount });
  };

  Game.prototype.undo = function () {
    if (!this.history.length) return false;
    var h = this.history.pop();
    this.s = h.s;
    this.moveCount = h.moveCount;
    this.won = false;
    this.finishedAt = null;
    this.lastMoved = [];
    return true;
  };

  Game.prototype.canUndo = function () { return this.history.length > 0; };

  Game.prototype.checkWon = function () {
    if (S.foundationTotal(this.s) === 52) {
      if (!this.won) { this.won = true; this.finishedAt = Date.now(); }
      return true;
    }
    return false;
  };

  /* Autocomplete is offered once no face-down cards remain.
     How it then finishes depends on the position:
       * stock AND waste empty  -> plain greedy play is provably enough
         (every card is on the tableau in a descending run, so the next card
         the foundations want can never be covered).
       * otherwise               -> the position is still almost always won,
         but greedy play can stall: under draw three, cycling the stock only
         ever exposes every third card, so a needed card can be unreachable
         until something else is played first. Those finishes are handed to
         the solver instead. */
  Game.prototype.canAutocomplete = function () {
    return S.downCount(this.s) === 0 && S.foundationTotal(this.s) < 52;
  };

  Game.prototype.greedyFinishIsSafe = function () {
    return this.s.stock.length === 0 && this.s.waste.length === 0;
  };

  /* Apply a raw engine move (used when replaying a solver solution). */
  Game.prototype.applyEngineMove = function (m) {
    this.snapshot();
    S.applyMove(this.s, m);
    this.moveCount++;
    this.checkWon();
  };

  Game.prototype.topOf = function (p) {
    var u = this.s.up[p];
    return u.length ? u[u.length - 1] : -1;
  };

  /* ---------- actions ------------------------------------------------- */

  Game.prototype.draw = function () {
    if (!this.s.stock.length && !this.s.waste.length) return false;
    this.snapshot();
    S.drawStep(this.s);
    this.moveCount++;
    this.lastMoved = this.s.waste.slice(-3);
    return true;
  };

  /* Where could this card legally go? Foundation first, per house preference. */
  Game.prototype.findDestination = function (card, fromPile) {
    var s = this.s;
    if (S.canGoToFoundation(s, card)) return { kind: 'foundation', index: SUIT(card) };

    // Prefer a real pile over breaking open an empty column: dumping a King
    // into an empty column is usually right, but only once nothing else fits.
    var firstEmpty = -1, p;
    for (p = 0; p < 7; p++) {
      if (p === fromPile) continue;
      if (s.up[p].length === 0 && s.down[p].length === 0) { if (firstEmpty < 0) firstEmpty = p; continue; }
      if (S.canStackOnTableau(card, this.topOf(p))) return { kind: 'tableau', index: p };
    }
    if (firstEmpty >= 0 && RANK(card) === 13) return { kind: 'tableau', index: firstEmpty };
    return null;
  };

  /* Tap the waste. */
  Game.prototype.playWaste = function () {
    var s = this.s;
    if (!s.waste.length) return false;
    var card = s.waste[s.waste.length - 1];
    var dest = this.findDestination(card, -1);
    if (!dest) return false;
    this.snapshot();
    if (dest.kind === 'foundation') S.applyMove(s, { t: 'wf', draws: 0 });
    else S.applyMove(s, { t: 'wt', draws: 0, to: dest.index });
    this.moveCount++;
    this.lastMoved = [card];
    this.checkWon();
    return true;
  };

  /* Tap a face-up tableau card. Tapping a buried card moves the whole run
     sitting on it, which is always a valid descending alternating sequence. */
  Game.prototype.playTableau = function (pile, idx) {
    var s = this.s, u = s.up[pile];
    if (idx < 0 || idx >= u.length) return false;
    var card = u[idx];
    var isTop = (idx === u.length - 1);

    var dest;
    if (isTop) {
      dest = this.findDestination(card, pile);
    } else {
      // a multi-card run can only go to the tableau
      dest = null;
      var firstEmpty = -1, p;
      for (p = 0; p < 7; p++) {
        if (p === pile) continue;
        if (s.up[p].length === 0 && s.down[p].length === 0) { if (firstEmpty < 0) firstEmpty = p; continue; }
        if (S.canStackOnTableau(card, this.topOf(p))) { dest = { kind: 'tableau', index: p }; break; }
      }
      if (!dest && firstEmpty >= 0 && RANK(card) === 13) dest = { kind: 'tableau', index: firstEmpty };
    }
    if (!dest) return false;

    this.snapshot();
    if (dest.kind === 'foundation') S.applyMove(s, { t: 'tf', from: pile });
    else S.applyMove(s, { t: 'tt', from: pile, idx: idx, to: dest.index });
    this.moveCount++;
    this.lastMoved = u.slice(idx);
    this.checkWon();
    return true;
  };

  /* Tap a foundation to pull its top card back down. */
  Game.prototype.playFoundation = function (suit) {
    var s = this.s;
    if (!s.fnd[suit]) return false;
    var card = suit * 13 + (s.fnd[suit] - 1);
    var p, target = -1;
    for (p = 0; p < 7; p++) {
      if (s.up[p].length === 0 && s.down[p].length === 0) continue;
      if (S.canStackOnTableau(card, this.topOf(p))) { target = p; break; }
    }
    if (target < 0 && RANK(card) === 13) {
      for (p = 0; p < 7; p++) if (!s.up[p].length && !s.down[p].length) { target = p; break; }
    }
    if (target < 0) return false;
    this.snapshot();
    S.applyMove(s, { t: 'ft', suit: suit, to: target });
    this.moveCount++;
    this.lastMoved = [card];
    return true;
  };

  /* ---------- generic move interface (used by drag, and by hints) --------
     src  = {kind:'waste'} | {kind:'tableau', pile, idx} | {kind:'foundation', suit}
     dest = {kind:'tableau', pile} | {kind:'foundation', suit}                */

  Game.prototype.srcCard = function (src) {
    var s = this.s;
    if (src.kind === 'waste') return s.waste.length ? s.waste[s.waste.length - 1] : -1;
    if (src.kind === 'foundation') return s.fnd[src.suit] ? src.suit * 13 + (s.fnd[src.suit] - 1) : -1;
    if (src.kind === 'tableau') {
      var u = s.up[src.pile];
      return (src.idx >= 0 && src.idx < u.length) ? u[src.idx] : -1;
    }
    return -1;
  };

  /* The cards that travel together — a tableau run moves as a unit. */
  Game.prototype.srcRun = function (src) {
    if (src.kind !== 'tableau') {
      var c = this.srcCard(src);
      return c < 0 ? [] : [c];
    }
    return this.s.up[src.pile].slice(src.idx);
  };

  Game.prototype.canMove = function (src, dest) {
    var s = this.s, card = this.srcCard(src);
    if (card < 0) return false;

    if (dest.kind === 'foundation') {
      if (src.kind === 'foundation') return false;
      // only a single, fully exposed card may go to a foundation
      if (src.kind === 'tableau' && src.idx !== s.up[src.pile].length - 1) return false;
      return SUIT(card) === dest.suit && S.canGoToFoundation(s, card);
    }
    if (src.kind === 'tableau' && src.pile === dest.pile) return false;
    return S.canStackOnTableau(card, this.topOf(dest.pile));
  };

  Game.prototype.doMove = function (src, dest) {
    if (!this.canMove(src, dest)) return false;
    var s = this.s, moved = this.srcRun(src);
    this.snapshot();
    if (src.kind === 'waste') {
      S.applyMove(s, dest.kind === 'foundation' ? { t: 'wf', draws: 0 }
                                                : { t: 'wt', draws: 0, to: dest.pile });
    } else if (src.kind === 'foundation') {
      S.applyMove(s, { t: 'ft', suit: src.suit, to: dest.pile });
    } else if (dest.kind === 'foundation') {
      S.applyMove(s, { t: 'tf', from: src.pile });
    } else {
      S.applyMove(s, { t: 'tt', from: src.pile, idx: src.idx, to: dest.pile });
    }
    this.moveCount++;
    this.lastMoved = moved;
    this.checkWon();
    return true;
  };

  /* One step of autocomplete: send the lowest available card home. Called
     repeatedly by the UI so the finish animates card by card. */
  Game.prototype.autocompleteStep = function () {
    var s = this.s, p;
    for (p = 0; p < 7; p++) {
      var c = this.topOf(p);
      if (c >= 0 && S.canGoToFoundation(s, c)) {
        this.snapshot();
        S.applyMove(s, { t: 'tf', from: p });
        this.moveCount++; this.lastMoved = [c]; this.checkWon();
        return true;
      }
    }
    if (s.waste.length && S.canGoToFoundation(s, s.waste[s.waste.length - 1])) {
      var w = s.waste[s.waste.length - 1];
      this.snapshot();
      S.applyMove(s, { t: 'wf', draws: 0 });
      this.moveCount++; this.lastMoved = [w]; this.checkWon();
      return true;
    }
    if (s.stock.length || s.waste.length) {   // nothing playable: cycle the stock
      this.snapshot();
      S.drawStep(s);
      this.moveCount++;
      return true;
    }
    return false;
  };

  /* Cheap one-ply screen: is there a move available RIGHT NOW that plainly
     makes progress — a card that goes home, or a move that turns one over?
     If so the player is obviously not stuck and the expensive reachability
     analysis can be skipped entirely. This is what keeps the stuck check from
     running a search after every single move. */
  Game.prototype.canProgressNow = function () {
    var s = this.s, p, i;

    for (p = 0; p < 7; p++) {
      var c = this.topOf(p);
      if (c >= 0 && S.canGoToFoundation(s, c)) return true;
      // moving the whole face-up run off a pile turns over the card beneath
      if (s.up[p].length && s.down[p].length) {
        var head = s.up[p][0];
        for (var q = 0; q < 7; q++) {
          if (q === p) continue;
          var qEmpty = (s.up[q].length === 0 && s.down[q].length === 0);
          if (qEmpty ? RANK(head) === 13 : S.canStackOnTableau(head, this.topOf(q))) return true;
        }
      }
    }
    var reach = S.reachableWaste(s);
    for (i = 0; i < reach.length; i++) {
      if (S.canGoToFoundation(s, reach[i].card)) return true;
    }
    return false;
  };

  /* True only when the position is completely frozen.

     The old version answered "yes" whenever the stock held anything, on the
     assumption that you can always press it. That is wrong for draw three:
     cycling the stock exposes only every third card, so a full pass can
     surface nothing playable at all. It also cannot use the solver's
     generateMoves, which prunes legal-but-pointless moves for search speed —
     fine for searching, wrong for deciding whether a player is stuck. So this
     enumerates real legality, including every card the stock can actually
     reach and the house rule that foundation cards may come back down. */
  Game.prototype.hasAnyMove = function () {
    var s = this.s, p, q, i, st;

    for (p = 0; p < 7; p++) {
      var c = this.topOf(p);
      if (c >= 0 && S.canGoToFoundation(s, c)) return true;
    }

    for (p = 0; p < 7; p++) {
      var u = s.up[p];
      if (!u.length) continue;
      for (i = 0; i < u.length; i++) {
        var head = u[i];
        var wholeColumn = (i === 0 && s.down[p].length === 0);
        for (q = 0; q < 7; q++) {
          if (q === p) continue;
          var qEmpty = (s.up[q].length === 0 && s.down[q].length === 0);
          if (qEmpty) {
            // sliding a whole column into an empty one changes nothing
            if (RANK(head) === 13 && !wholeColumn) return true;
          } else if (S.canStackOnTableau(head, this.topOf(q))) return true;
        }
      }
    }

    var reach = S.reachableWaste(s);
    for (i = 0; i < reach.length; i++) {
      var card = reach[i].card;
      if (S.canGoToFoundation(s, card)) return true;
      for (q = 0; q < 7; q++) {
        var qE = (s.up[q].length === 0 && s.down[q].length === 0);
        if (qE ? RANK(card) === 13 : S.canStackOnTableau(card, this.topOf(q))) return true;
      }
    }

    for (st = 0; st < 4; st++) {
      if (!s.fnd[st]) continue;
      var fc = st * 13 + (s.fnd[st] - 1);
      for (q = 0; q < 7; q++) {
        if (!s.up[q].length) continue;
        if (S.canStackOnTableau(fc, this.topOf(q))) return true;
      }
    }
    return false;
  };

  Game.prototype.elapsedMs = function () {
    return (this.finishedAt || Date.now()) - this.startedAt;
  };

  /* Plain-object copy for postMessage to the solver worker. */
  Game.prototype.plainState = function () {
    var s = this.s;
    return {
      down: s.down.map(function (a) { return a.slice(); }),
      up: s.up.map(function (a) { return a.slice(); }),
      fnd: s.fnd.slice(),
      stock: s.stock.slice(),
      waste: s.waste.slice()
    };
  };

  root.KGame = { Game: Game };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KGame;
})(typeof self !== 'undefined' ? self : this);
