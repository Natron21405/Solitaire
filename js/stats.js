/* stats.js — lifetime statistics, persisted in localStorage. */
(function (root) {
  'use strict';
  var KEY = 'pastel-solitaire-stats-v1';

  function blankBucket() {
    return {
      played: 0, won: 0,
      bestTimeMs: null, fewestMoves: null,
      totalTimeMs: 0, totalMoves: 0,
      currentStreak: 0, bestStreak: 0,
      cardsHome: 0
    };
  }

  function blank() {
    return {
      all: blankBucket(),
      winnable: blankBucket(),
      random: blankBucket(),
      firstPlayed: null,
      lastPlayed: null
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var d = JSON.parse(raw);
      var base = blank();
      ['all', 'winnable', 'random'].forEach(function (k) {
        if (d[k]) for (var f in base[k]) if (d[k][f] !== undefined) base[k][f] = d[k][f];
      });
      base.firstPlayed = d.firstPlayed || null;
      base.lastPlayed = d.lastPlayed || null;
      return base;
    } catch (e) { return blank(); }
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }

  function applyToBucket(b, res) {
    b.played++;
    b.totalTimeMs += res.timeMs;
    b.totalMoves += res.moves;
    b.cardsHome += res.cardsHome;
    if (res.won) {
      b.won++;
      b.currentStreak++;
      if (b.currentStreak > b.bestStreak) b.bestStreak = b.currentStreak;
      if (b.bestTimeMs === null || res.timeMs < b.bestTimeMs) b.bestTimeMs = res.timeMs;
      if (b.fewestMoves === null || res.moves < b.fewestMoves) b.fewestMoves = res.moves;
    } else {
      b.currentStreak = 0;
    }
  }

  /* res = { won, timeMs, moves, cardsHome, mode } */
  function record(res) {
    var d = load();
    var now = new Date().toISOString();
    if (!d.firstPlayed) d.firstPlayed = now;
    d.lastPlayed = now;
    applyToBucket(d.all, res);
    applyToBucket(d[res.mode === 'random' ? 'random' : 'winnable'], res);
    save(d);
    return d;
  }

  function reset() { save(blank()); return blank(); }

  function winRate(b) { return b.played ? (b.won / b.played) : 0; }

  root.KStats = { load: load, record: record, reset: reset, winRate: winRate, blank: blank };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KStats;
})(typeof self !== 'undefined' ? self : this);
