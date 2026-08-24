/* =====================================================================
   ui.js — rendering, input, overlays, worker plumbing.
   ===================================================================== */
(function () {
  'use strict';

  var S = window.KSolver, D = window.KDeal, G = window.KGame, ST = window.KStats;
  var ART = window.KCardArt;
  var RANK = S.RANK, SUIT = S.SUIT;

  var SUIT_CH = ['♠', '♥', '♣', '♦'];       // S H C D
  var RANK_CH = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var PREF_KEY = 'pastel-solitaire-mode';

  var board  = document.getElementById('board');
  var overlay = document.getElementById('overlay');
  var sheet  = document.getElementById('sheet');
  var elTime = document.getElementById('hud-time');
  var elMoves = document.getElementById('hud-moves');
  var elMode = document.getElementById('hud-mode');
  var elSeed = document.getElementById('hud-seed');
  var btnUndo = document.getElementById('btn-undo');
  var btnNew  = document.getElementById('btn-new');
  var btnStats = document.getElementById('btn-stats');
  var btnHint = document.getElementById('btn-hint');

  var cardEls = [], slots = {}, M = {}, lastPos = [], dropZone = null;
  var game = null;
  var mode = localStorage.getItem(PREF_KEY) || 'winnable';
  var worker = null, reqId = 0;
  var workerBusy = false;
  var deadFlagged = false, autoRunning = false, tickHandle = null;

  /* ---------- DOM construction (once) ---------------------------------- */

  function mkSlot(cls, txt) {
    var d = document.createElement('div');
    d.className = 'slot ' + (cls || '');
    if (txt) d.textContent = txt;
    board.appendChild(d);
    return d;
  }

  function mkCard(c) {
    var el = document.createElement('div');
    el.className = 'card down ' + ((SUIT(c) & 1) ? 'red' : 'black');
    el.dataset.c = c;
    el.innerHTML =
      '<div class="inner">' +
        '<div class="face">' + ART.faceSVG(SUIT(c), RANK(c)) + '</div>' +
        '<div class="back">' + ART.backSVG() + '</div>' +
      '</div>';
    board.appendChild(el);
    return el;
  }

  /* Column assignment for the top row. The stock sits on the RIGHT: it is the
     most-tapped thing on the board, and the top-left corner is the hardest
     place to reach with a thumb on a tall phone. The waste therefore fans
     leftwards, away from it. */
  var COL_FND = 0, COL_WASTE = 5, COL_STOCK = 6, WASTE_DIR = -1;

  function buildBoard() {
    board.insertAdjacentHTML('afterbegin', ART.defsSVG());
    for (var i = 0; i < 4; i++) slots['f' + i] = mkSlot('foundation-slot', SUIT_CH[i]);
    slots.waste = mkSlot('waste-slot');
    slots.stock = mkSlot('stock-slot');
    for (var p = 0; p < 7; p++) slots['t' + p] = mkSlot('tableau-slot');
    for (var c = 0; c < 52; c++) cardEls.push(mkCard(c));
    dropZone = document.createElement('div');
    dropZone.id = 'dropzone';
    board.appendChild(dropZone);
  }

  /* ---------- geometry -------------------------------------------------- */

  function layout() {
    var bw = board.clientWidth, bh = board.clientHeight;
    M.gapX = Math.max(3, Math.min(bw * 0.009, 10));

    /* Card size is constrained by BOTH axes.
       Width: seven columns must fit side by side.
       Height: the top row, the gap, and a tableau pile deep enough to hold the
       opening staircase must all fit above the toolbar. Sizing on width alone
       works in portrait but blows out in landscape, where the cards end up
       taller than the board. */
    var byWidth  = (bw - 6 * M.gapX - 8) / 7;
    var byHeight = bh / (1.48 * 3.55);      // topRow + gap + a 7-deep pile
    M.cardW = Math.max(26, Math.min(byWidth, byHeight, 108));
    M.cardH = M.cardW * 1.48;

    // Centre the whole board; on a wide screen this keeps it from stretching.
    M.padX = Math.max(3, (bw - (7 * M.cardW + 6 * M.gapX)) / 2);
    M.topY = Math.max(4, Math.min(14, (bh - M.cardH * 3.55) * 0.12));
    M.tabY = M.topY + M.cardH + Math.max(12, M.cardH * 0.18);
    M.tabH = Math.max(M.cardH + 10, bh - M.tabY - 6);
    /* Adaptive fan. A phone is width-bound — seven columns fix the card size —
       but vertical room is plentiful, so piles spread out as far as they can
       and only tighten when a pile actually gets long. That keeps the exposed
       strip of a covered card (the tap target) as large as the board allows. */
    M.stepUMax = M.cardH * 0.52;
    M.stepDMax = M.cardH * 0.22;
    M.wasteFan = M.cardW * 0.34;

    var i, el;
    for (i = 0; i < 52; i++) {
      el = cardEls[i];
      el.style.width = M.cardW + 'px';
      el.style.height = M.cardH + 'px';
    }
    for (var k in slots) {
      slots[k].style.width = M.cardW + 'px';
      slots[k].style.height = M.cardH + 'px';
    }
    place(slots.stock, colX(COL_STOCK), M.topY);
    place(slots.waste, colX(COL_WASTE), M.topY);
    for (i = 0; i < 4; i++) place(slots['f' + i], colX(COL_FND + i), M.topY);
    for (i = 0; i < 7; i++) place(slots['t' + i], colX(i), M.tabY);
  }

  function colX(i) { return M.padX + i * (M.cardW + M.gapX); }
  function place(el, x, y) { el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }

  /* ---------- rendering -------------------------------------------------- */

  function computePositions() {
    var s = game.s, pos = new Array(52), i, p, st;

    var nStock = s.stock.length;
    for (i = 0; i < nStock; i++) {
      pos[s.stock[i]] = { x: colX(COL_STOCK), y: M.topY, z: i, down: true, kind: 'stock',
                          hidden: i < nStock - 2 };
    }

    var w = s.waste, n = w.length, showFrom = Math.max(0, n - 3);
    for (i = 0; i < n; i++) {
      var off = i < showFrom ? 0 : (i - showFrom) * M.wasteFan * WASTE_DIR;
      pos[w[i]] = { x: colX(COL_WASTE) + off, y: M.topY, z: i, down: false, kind: 'waste',
                    hidden: i < showFrom - 1 };
    }

    for (st = 0; st < 4; st++) {
      for (var r = 1; r <= s.fnd[st]; r++) {
        pos[st * 13 + (r - 1)] = { x: colX(COL_FND + st), y: M.topY, z: r, down: false,
                                   kind: 'foundation', suit: st, hidden: r < s.fnd[st] - 1 };
      }
    }

    for (p = 0; p < 7; p++) {
      var d = s.down[p], u = s.up[p];
      var stepU = M.stepUMax, stepD = M.stepDMax;
      var need = d.length * stepD + Math.max(0, u.length - 1) * stepU + M.cardH;
      if (need > M.tabH) {                     // squeeze a tall pile so it always fits
        var f = (M.tabH - M.cardH) / Math.max(1, need - M.cardH);
        stepD *= f; stepU *= f;
      }
      var y = M.tabY, z = 0;
      for (i = 0; i < d.length; i++) {
        pos[d[i]] = { x: colX(p), y: y, z: z++, down: true, kind: 'tableau', pile: p, idx: -1 };
        y += stepD;
      }
      for (i = 0; i < u.length; i++) {
        pos[u[i]] = { x: colX(p), y: y, z: z++, down: false, kind: 'tableau', pile: p, idx: i };
        y += stepU;
      }
    }
    return pos;
  }

  function render(noAnim) {
    var pos = computePositions(), s = game.s;
    lastPos = pos;
    for (var c = 0; c < 52; c++) {
      var pInfo = pos[c], el = cardEls[c];
      if (!pInfo || pInfo.hidden) { el.style.display = 'none'; continue; }
      el.style.display = '';
      if (noAnim) el.classList.add('no-anim');
      place(el, pInfo.x, pInfo.y);
      el.style.zIndex = 100 + pInfo.z + (pInfo.kind === 'tableau' ? 0 : 40);
      el.classList.toggle('down', !!pInfo.down);
      el.dataset.kind = pInfo.kind;
      el.dataset.pile = pInfo.pile === undefined ? '' : pInfo.pile;
      el.dataset.idx  = pInfo.idx === undefined ? '' : pInfo.idx;
      el.dataset.suit = pInfo.suit === undefined ? '' : pInfo.suit;
      if (noAnim) { void el.offsetWidth; el.classList.remove('no-anim'); }
    }
    slots.stock.className = 'slot stock-slot ' +
      (s.stock.length ? '' : (s.waste.length ? 'stock-recycle' : 'stock-empty'));
    updateHud();
  }

  function updateHud() {
    elMoves.textContent = game.moveCount;
    elTime.textContent = fmtTime(game.elapsedMs());
    elMode.textContent = game.mode === 'random' ? 'Random' : 'Winnable';
    elMode.className = game.mode === 'random' ? 'random' : '';
    elSeed.textContent = '#' + game.seed.toString(36).toUpperCase();
    btnUndo.disabled = !game.canUndo();

    if (game.canAutocomplete()) {
      btnHint.classList.add('accent');
      btnHint.innerHTML = '<span class="ic">&#9654;</span>Finish';
    } else {
      btnHint.classList.remove('accent');
      btnHint.innerHTML = '<span class="ic">&#9788;</span>Hint';
    }
  }

  function fmtTime(ms) {
    var t = Math.floor(ms / 1000);
    var m = Math.floor(t / 60), sec = t % 60;
    if (m >= 60) return Math.floor(m / 60) + ':' + pad(m % 60) + ':' + pad(sec);
    return m + ':' + pad(sec);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- input ------------------------------------------------------ */

  function clearHints() {
    for (var i = 0; i < 52; i++) cardEls[i].classList.remove('playable-hint', 'dest-hint');
    for (var k in slots) slots[k].classList.remove('dest-hint');
  }

  function nudge(el) {
    el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
  }

  /* ---------- input: tap and drag share one pointer pipeline --------------
     A press becomes a drag only once it travels past a small threshold, so a
     tap is never swallowed by an accidental wobble, and a drag never fires a
     stray tap on release. */

  var drag = null;
  var DRAG_THRESHOLD = 7;   // px of travel before a press counts as a drag

  function srcFromEl(el) {
    var kind = el.dataset.kind;
    if (kind === 'waste') {
      var w = game.s.waste;
      if (!w.length || +el.dataset.c !== w[w.length - 1]) return null;   // only the top card
      return { kind: 'waste' };
    }
    if (kind === 'foundation') {
      var st = +el.dataset.suit;
      if (game.s.fnd[st] === 0) return null;
      if (+el.dataset.c !== st * 13 + (game.s.fnd[st] - 1)) return null;
      return { kind: 'foundation', suit: st };
    }
    if (kind === 'tableau') {
      var idx = +el.dataset.idx;
      if (idx < 0) return null;                                          // face down
      return { kind: 'tableau', pile: +el.dataset.pile, idx: idx };
    }
    return null;
  }

  function dropTargets() {
    var out = [], s = game.s, i, p;
    for (i = 0; i < 4; i++) {
      out.push({ rect: { x: colX(COL_FND + i), y: M.topY, w: M.cardW, h: M.cardH },
                 dest: { kind: 'foundation', suit: i } });
    }
    for (p = 0; p < 7; p++) {
      var u = s.up[p], d = s.down[p];
      var top = u.length ? u[u.length - 1] : (d.length ? d[d.length - 1] : -1);
      var h = M.cardH;
      if (top >= 0 && lastPos[top]) h = (lastPos[top].y - M.tabY) + M.cardH;
      out.push({ rect: { x: colX(p), y: M.tabY, w: M.cardW, h: Math.max(M.cardH, h) },
                 dest: { kind: 'tableau', pile: p } });
    }
    return out;
  }

  function overlap(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return (w > 0 && h > 0) ? w * h : 0;
  }

  /* The legal target the dragged card physically covers most.
     Takes the drag explicitly: endDrag clears the module-level `drag` before
     resolving the drop, so reading it here would always come back null. */
  function bestTarget(dx, dy, d) {
    d = d || drag;
    if (!d || !d.origin || !d.origin.length) return null;
    var lead = { x: d.origin[0].x + dx, y: d.origin[0].y + dy, w: M.cardW, h: M.cardH };
    var targets = dropTargets(), best = null, bestArea = 0;
    for (var i = 0; i < targets.length; i++) {
      if (!game.canMove(d.src, targets[i].dest)) continue;
      var a = overlap(lead, targets[i].rect);
      if (a > bestArea) { bestArea = a; best = targets[i]; }
    }
    return bestArea > 0 ? best : null;
  }

  function showDropZone(t) {
    if (!t) { dropZone.classList.remove('on'); return; }
    dropZone.classList.add('on');
    dropZone.style.width = t.rect.w + 'px';
    dropZone.style.height = t.rect.h + 'px';
    place(dropZone, t.rect.x, t.rect.y);
  }

  board.addEventListener('pointerdown', function (e) {
    if (autoRunning || !game || game.won) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearHints();

    var el = e.target.closest('.card');
    if (!el) {
      var slotEl = e.target.closest('.slot');
      drag = slotEl ? { tapSlot: slotEl, moved: false, x0: e.clientX, y0: e.clientY,
                        cards: [], pointerId: e.pointerId } : null;
      return;
    }

    var src = srcFromEl(el);
    var cards = src ? game.srcRun(src) : [];
    drag = {
      el: el, src: src, cards: cards, moved: false,
      x0: e.clientX, y0: e.clientY, pointerId: e.pointerId,
      origin: cards.map(function (c) { return { x: lastPos[c].x, y: lastPos[c].y }; })
    };
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* older webkit */ }
  });

  board.addEventListener('pointermove', function (e) {
    if (!drag || !drag.cards.length) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;

    if (!drag.moved) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      for (var i = 0; i < drag.cards.length; i++) {
        var el = cardEls[drag.cards[i]];
        el.classList.add('dragging');
        el.style.zIndex = 9000 + i;
      }
    }
    for (var j = 0; j < drag.cards.length; j++) {
      place(cardEls[drag.cards[j]], drag.origin[j].x + dx, drag.origin[j].y + dy);
    }
    showDropZone(bestTarget(dx, dy));
  });

  function endDrag(e, cancelled) {
    if (!drag) return;
    var d = drag; drag = null;
    try { board.releasePointerCapture(d.pointerId); } catch (err) { /* ignore */ }
    showDropZone(null);

    if (!d.moved) {                       // it was a tap
      if (d.tapSlot) { if (d.tapSlot === slots.stock && game.draw()) afterMove(); return; }
      handleTap(d.el);
      return;
    }

    for (var i = 0; i < d.cards.length; i++) {
      var el = cardEls[d.cards[i]];
      el.classList.remove('dragging');
      void el.offsetWidth;                // restore the transition before we move it back
    }
    var t = cancelled ? null : bestTarget(e.clientX - d.x0, e.clientY - d.y0, d);
    if (t && game.doMove(d.src, t.dest)) afterMove();
    else { render(); if (!cancelled) nudge(d.el); }
  }

  board.addEventListener('pointerup', function (e) { endDrag(e, false); });
  board.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  /* Tap: send the card to the first legal home, foundation first. */
  function handleTap(el) {
    if (!el) return;
    var kind = el.dataset.kind, ok = false;
    if (kind === 'stock') {
      ok = game.draw();
    } else if (kind === 'waste') {
      ok = game.playWaste();
    } else if (kind === 'foundation') {
      ok = game.playFoundation(+el.dataset.suit);
    } else if (kind === 'tableau') {
      var idx = +el.dataset.idx;
      if (idx >= 0) ok = game.playTableau(+el.dataset.pile, idx);
    }
    if (ok) afterMove(); else nudge(el);
  }

  function afterMove() {
    render();
    if (game.checkWon()) { finish(true); return; }
    if (!game.hasAnyMove()) { showDeadEnd(); return; }
  }

  /* ---------- solver worker ---------------------------------------------- */

  function startWorker() {
    try {
      worker = new Worker('js/worker.js');
      worker.onmessage = onWorkerMessage;
      worker.onerror = function () { worker = null; };
    } catch (e) { worker = null; }
  }

  function onWorkerMessage(e) {
    var m = e.data;
    workerBusy = false;

    if (m.kind === 'deal') {
      if (dealResolve) { var f = dealResolve; dealResolve = null; f(m); }
      return;
    }
    if (m.kind === 'hint') {
      if (m.result === 'win' && m.move) showHint(m.move);
      else toast(m.result === 'unsolvable'
        ? "There's no winning line left from here."
        : "Couldn't find a line in the time available.");
      return;
    }
    if (m.kind === 'solve') {
      autoRunning = false;
      if (m.result === 'win' && m.moves) playSolution(m.moves);
      else { toast('No finish found — playing what I can.'); greedyFinish(); }
      return;
    }

  }

  var dealResolve = null;

  /* NOTE: there is deliberately no background winnability check.
     An earlier build ran the solver after every move and interrupted you the
     moment the position became unwinnable. That is not wanted: a game you
     cannot win is still a game you can play, and the interruption ends it for
     you. The only automatic stop is a hard dead end -- no legal move of any
     kind remains -- which is a fact about the board, not a verdict on it.
     The solver still answers when YOU ask, via Hint. */

  function requestHint() {
    if (!worker) { toast('Solver unavailable.'); return; }
    if (workerBusy) { toast('Thinking…'); return; }
    workerBusy = true;
    worker.postMessage({ cmd: 'hint', id: ++reqId, state: game.plainState() });
    toast('Thinking…', 900);
  }

  function showHint(mv) {
    clearHints();
    var s = game.s, srcCard = -1, dest = null;
    if (mv.t === 'tf') { srcCard = game.topOf(mv.from); dest = slots['f' + SUIT(srcCard)]; }
    else if (mv.t === 'tt') { srcCard = s.up[mv.from][mv.idx]; dest = s.up[mv.to].length ? cardEls[game.topOf(mv.to)] : slots['t' + mv.to]; }
    else if (mv.t === 'wf' || mv.t === 'wt') {
      if (mv.draws > 0) { srcCard = s.stock.length ? s.stock[s.stock.length - 1] : -1; if (srcCard < 0) slots.stock.classList.add('dest-hint'); }
      else srcCard = s.waste[s.waste.length - 1];
      if (mv.t === 'wt') dest = s.up[mv.to].length ? cardEls[game.topOf(mv.to)] : slots['t' + mv.to];
      else if (srcCard >= 0 && mv.draws === 0) dest = slots['f' + SUIT(srcCard)];
    } else if (mv.t === 'ft') {
      srcCard = mv.suit * 13 + (s.fnd[mv.suit] - 1);
      dest = s.up[mv.to].length ? cardEls[game.topOf(mv.to)] : slots['t' + mv.to];
    }
    if (srcCard >= 0) cardEls[srcCard].classList.add('playable-hint');
    if (dest) dest.classList.add('dest-hint');
    setTimeout(clearHints, 3200);
  }

  /* ---------- overlays ---------------------------------------------------- */

  function openSheet(html) { sheet.innerHTML = html; overlay.classList.add('show'); }
  function closeSheet() { overlay.classList.remove('show'); }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom));' +
        'transform:translateX(-50%);background:rgba(60,75,83,.92);color:#fff;padding:9px 15px;' +
        'border-radius:999px;font:600 13px/1 -apple-system,sans-serif;z-index:9500;pointer-events:none;' +
        'transition:opacity .2s;max-width:80vw;text-align:center;';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, ms || 2000);
  }

  function showNewGameSheet(firstRun) {
    openSheet(
      '<h1>' + (firstRun ? 'Pastel Solitaire' : 'New game') + '</h1>' +
      '<p>Klondike, three-card draw.</p>' +
      '<h2>Deal</h2>' +
      '<button class="choice' + (mode === 'winnable' ? ' sel' : '') + '" data-mode="winnable">' +
        '<span class="t">Winnable only</span>' +
        '<span class="d">Every deal is checked by the solver before you see it, so a loss is always yours to own. Takes a moment to deal.</span>' +
      '</button>' +
      '<button class="choice' + (mode === 'random' ? ' sel' : '') + '" data-mode="random">' +
        '<span class="t">Random deal</span>' +
        '<span class="d">A straight shuffle, like a real deck. Roughly one deal in five simply cannot be won.</span>' +
      '</button>' +
      '<button class="btn primary" id="go">Deal</button>' +
      (firstRun ? '' : '<button class="btn" id="cancel">Cancel</button>')
    );
    sheet.querySelectorAll('.choice').forEach(function (b) {
      b.onclick = function () {
        mode = b.dataset.mode;
        localStorage.setItem(PREF_KEY, mode);
        sheet.querySelectorAll('.choice').forEach(function (x) { x.classList.toggle('sel', x === b); });
      };
    });
    sheet.querySelector('#go').onclick = function () { startNewGame(); };
    var c = sheet.querySelector('#cancel');
    if (c) c.onclick = closeSheet;
  }

  /* Fires only when the board is genuinely frozen: no legal move remains
     anywhere, including pressing the stock. */
  function showDeadEnd() {
    deadFlagged = true;
    openSheet(
      '<h1>No moves left</h1>' +
      '<p>There is no legal move anywhere on the board — nothing to play, and nothing left in the stock.</p>' +
      '<button class="btn primary" id="dn">New game</button>' +
      (game.canUndo() ? '<button class="btn" id="du">Undo last move</button>' : '')
    );
    sheet.querySelector('#dn').onclick = function () { recordAbandon(); closeSheet(); showNewGameSheet(false); };
    var u = sheet.querySelector('#du');
    if (u) u.onclick = function () {
      game.undo(); deadFlagged = false; closeSheet(); render();
    };
  }

  function statRow(b) {
    var rate = b.played ? Math.round(100 * b.won / b.played) : 0;
    return '<div class="stat-grid">' +
      st('Games', b.played) + st('Won', b.won) +
      st('Win rate', rate + '%') + st('Best streak', b.bestStreak) +
      st('Current streak', b.currentStreak) + st('Fastest win', b.bestTimeMs === null ? '—' : fmtTime(b.bestTimeMs)) +
      st('Fewest moves', b.fewestMoves === null ? '—' : b.fewestMoves) +
      st('Avg. game', b.played ? fmtTime(b.totalTimeMs / b.played) : '—') +
      st('Time played', fmtTime(b.totalTimeMs)) + st('Cards home', b.cardsHome) +
      '</div>';
  }
  function st(k, v) { return '<div class="stat"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; }

  function showStats(which) {
    var d = ST.load();
    which = which || 'all';
    openSheet(
      '<h1>Statistics</h1>' +
      '<div class="seg">' +
        '<button data-w="all" class="' + (which === 'all' ? 'sel' : '') + '">All</button>' +
        '<button data-w="winnable" class="' + (which === 'winnable' ? 'sel' : '') + '">Winnable</button>' +
        '<button data-w="random" class="' + (which === 'random' ? 'sel' : '') + '">Random</button>' +
      '</div>' +
      statRow(d[which]) +
      '<p class="tiny">Started ' + (d.firstPlayed ? new Date(d.firstPlayed).toLocaleDateString() : '—') + '</p>' +
      '<button class="btn primary" id="close">Done</button>' +
      '<button class="btn" id="reset">Reset statistics</button>'
    );
    sheet.querySelectorAll('.seg button').forEach(function (b) {
      b.onclick = function () { showStats(b.dataset.w); };
    });
    sheet.querySelector('#close').onclick = closeSheet;
    sheet.querySelector('#reset').onclick = function () {
      openSheet('<h1>Reset statistics?</h1><p>Every lifetime figure goes back to zero. This cannot be undone.</p>' +
        '<button class="btn pink" id="yes">Reset everything</button><button class="btn" id="no">Keep them</button>');
      sheet.querySelector('#yes').onclick = function () { ST.reset(); showStats('all'); };
      sheet.querySelector('#no').onclick = function () { showStats('all'); };
    };
  }

  /* ---------- game lifecycle ---------------------------------------------- */

  function randSeed() { return (Math.random() * 0xFFFFFFFF) >>> 0; }

  function startNewGame() {
    recordAbandon();
    if (mode === 'random' || !worker) {
      begin(D.dealFromSeed(randSeed()), mode === 'random' ? 'random' : 'winnable');
      return;
    }
    openSheet('<h1>Dealing</h1><p>Checking the shuffle is winnable…</p><div class="spinner"></div>');
    var t0 = Date.now();
    dealResolve = function (m) {
      var wait = Math.max(0, 320 - (Date.now() - t0));   // avoid a jarring flash
      setTimeout(function () { begin(D.dealFromSeed(m.seed), 'winnable'); }, wait);
    };
    workerBusy = true;
    worker.postMessage({ cmd: 'winnableDeal', id: ++reqId, seed: randSeed() });
  }

  function begin(dealState, m) {
    game = new G.Game(dealState, { mode: m });
    deadFlagged = false;
    autoRunning = false;
    clearHints();
    closeSheet();
    layout();
    render(true);
  }

  /* A game you walk away from mid-play counts as a loss — otherwise the win
     rate would only ever count games you chose to finish. */
  function recordAbandon() {
    if (game && !game.won && game.moveCount > 0) {
      ST.record({ won: false, timeMs: game.elapsedMs(), moves: game.moveCount,
                  cardsHome: S.foundationTotal(game.s), mode: game.mode });
    }
    game = null;
  }

  function finish(won) {
    var d = ST.record({ won: true, timeMs: game.elapsedMs(), moves: game.moveCount,
                        cardsHome: 52, mode: game.mode });
    var b = d[game.mode === 'random' ? 'random' : 'winnable'];
    var g = game; game = null;
    openSheet(
      '<h1>You won</h1>' +
      '<p>' + fmtTime(g.elapsedMs()) + ' · ' + g.moveCount + ' moves · game #' + g.seed + '</p>' +
      '<div class="stat-grid" style="margin-top:14px">' +
        st('Streak', b.currentStreak) + st('Win rate', Math.round(100 * b.won / b.played) + '%') +
      '</div>' +
      '<button class="btn primary" id="again">Deal another</button>' +
      '<button class="btn" id="stats">Statistics</button>'
    );
    sheet.querySelector('#again').onclick = function () { startNewGame(); };
    sheet.querySelector('#stats').onclick = function () { showStats('all'); };
  }

  function runAutocomplete() {
    if (autoRunning || !game) return;
    if (game.greedyFinishIsSafe() || !worker) { greedyFinish(); return; }
    // Stock still in play: let the solver pick the order, since naive greedy
    // play can strand a card that only every third stock press exposes.
    toast('Finishing…', 1200);
    workerBusy = true;
    autoRunning = true;
    worker.postMessage({ cmd: 'solve', id: ++reqId, state: game.plainState() });
  }

  function greedyFinish() {
    autoRunning = true;
    (function step() {
      if (!game) { autoRunning = false; return; }
      if (game.checkWon()) { autoRunning = false; render(); finish(true); return; }
      if (!game.autocompleteStep()) {
        autoRunning = false; render();
        toast('Could not finish automatically from here.');
        return;
      }
      render();
      setTimeout(step, 70);
    })();
  }

  function playSolution(moves) {
    // Expand each move's stock presses into their own steps so the finish
    // reads as a sequence of real plays rather than cards teleporting.
    var queue = [], i;
    for (i = 0; i < moves.length; i++) {
      var m = moves[i];
      if ((m.t === 'wf' || m.t === 'wt') && m.draws > 0) {
        for (var k = 0; k < m.draws; k++) queue.push({ t: 'draw' });
        queue.push({ t: m.t, draws: 0, to: m.to });
      } else queue.push(m);
    }
    autoRunning = true;
    var n = 0;
    (function step() {
      if (!game) { autoRunning = false; return; }
      if (game.checkWon()) { autoRunning = false; render(); finish(true); return; }
      if (n >= queue.length) { autoRunning = false; render(); greedyFinish(); return; }
      var mv = queue[n++];
      if (mv.t === 'draw') game.draw(); else game.applyEngineMove(mv);
      render();
      setTimeout(step, 60);
    })();
  }

  /* ---------- wiring ------------------------------------------------------- */

  btnUndo.onclick = function () {
    if (!game || autoRunning) return;
    clearHints();
    if (game.undo()) { deadFlagged = false; render(); }
  };
  btnNew.onclick = function () { if (!autoRunning) showNewGameSheet(false); };
  btnStats.onclick = function () { if (!autoRunning) showStats('all'); };
  btnHint.onclick = function () {
    if (!game || autoRunning) return;
    if (game.canAutocomplete()) runAutocomplete(); else requestHint();
  };

  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSheet(); });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (game) { layout(); render(true); } }, 120);
  });

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  tickHandle = setInterval(function () {
    if (game && !game.won) elTime.textContent = fmtTime(game.elapsedMs());
  }, 500);

  /* ---------- boot --------------------------------------------------------- */

  buildBoard();
  layout();
  startWorker();
  showNewGameSheet(true);

  /* Debug handle — used by the automated browser tests, harmless in play. */
  window.__solitaire = {
    get game() { return game; },
    metrics: function () { return M; },
    cardEl: function (c) { return cardEls[c]; },
    act: function (kind, a, b) {
      var ok = false;
      if (kind === 'draw') ok = game.draw();
      else if (kind === 'waste') ok = game.playWaste();
      else if (kind === 'tableau') ok = game.playTableau(a, b);
      else if (kind === 'foundation') ok = game.playFoundation(a);
      if (ok) afterMove();
      return ok;
    },
    begin: begin, render: render, autocomplete: runAutocomplete
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
