/* deal.js — deterministic, seedable Klondike deal. */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dealFromSeed(seed) {
    var rnd = mulberry32(seed);
    var deck = [], i, j, tmp;
    for (i = 0; i < 52; i++) deck.push(i);
    for (i = 51; i > 0; i--) {                 // Fisher-Yates
      j = Math.floor(rnd() * (i + 1));
      tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    var down = [], up = [], k = 0;
    for (i = 0; i < 7; i++) {
      var d = [];
      for (j = 0; j < i; j++) d.push(deck[k++]);
      down.push(d);
      up.push([deck[k++]]);
    }
    return {
      down: down, up: up,
      fnd: [0, 0, 0, 0],
      stock: deck.slice(k).reverse(),   // next card to draw is stock[len-1]
      waste: [],
      seed: seed
    };
  }

  var API = { mulberry32: mulberry32, dealFromSeed: dealFromSeed };
  root.KDeal = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
