/* =====================================================================
   cardart.js — the card faces.

   Every face is an inline SVG on a 100 x 148 grid, so the same artwork is
   crisp at 50px on a phone and at 200px on a tablet. Suits are drawn as
   paths rather than Unicode glyphs: ♠♥♣♦ render as colour emoji on some
   iOS versions, and their proportions drift between platforms.
   ===================================================================== */
(function (root) {
  'use strict';

  var RANK_CH = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* Suit marks, drawn inside a 0..100 box, centred on (50,50). */
  var SUIT_ART = [
    /* 0 spades */
    '<path d="M50 8C36 29 13 44 13 62c0 12 9 21 21 21 7 0 13-4 16-10 0 0 1 1 0 3-2 9-7 17-13 21h26c-6-4-11-12-13-21-1-2 0-3 0-3 3 6 9 10 16 10 12 0 21-9 21-21 0-18-23-33-37-54z"/>',
    /* 1 hearts */
    '<path d="M50 92C36 79 12 61 12 39 12 25 23 14 36 14c7 0 12 3 14 7 2-4 7-7 14-7 13 0 24 11 24 25 0 22-24 40-38 53z"/>',
    /* 2 clubs */
    '<path d="M50 8c-10 0-18 8-18 18 0 3 1 6 2 9-3-2-6-3-10-3-10 0-18 8-18 18s8 18 18 18c7 0 13-4 16-10 0 1 1 2 0 4-2 9-7 17-13 21h26c-6-4-11-12-13-21-1-2 0-3 0-4 3 6 9 10 16 10 10 0 18-8 18-18s-8-18-18-18c-4 0-7 1-10 3 1-3 2-6 2-9 0-10-8-18-18-18z"/>',
    /* 3 diamonds */
    '<path d="M50 4 82 50 50 96 18 50z"/>'
  ];

  /* Classic pip layouts. x is 32 / 50 / 68; y runs 26 -> 122.
     Pips below the middle are rotated 180 degrees, as on a real card. */
  var L = 33, C = 50, R = 67;
  var LAYOUT = {
    1:  [[C, 74]],
    2:  [[C, 28], [C, 120]],
    3:  [[C, 28], [C, 74], [C, 120]],
    4:  [[L, 28], [R, 28], [L, 120], [R, 120]],
    5:  [[L, 28], [R, 28], [C, 74], [L, 120], [R, 120]],
    6:  [[L, 28], [R, 28], [L, 74], [R, 74], [L, 120], [R, 120]],
    7:  [[L, 28], [R, 28], [C, 51], [L, 74], [R, 74], [L, 120], [R, 120]],
    8:  [[L, 28], [R, 28], [C, 51], [L, 74], [R, 74], [C, 97], [L, 120], [R, 120]],
    9:  [[L, 28], [R, 28], [L, 59], [R, 59], [C, 74], [L, 89], [R, 89], [L, 120], [R, 120]],
    10: [[L, 28], [R, 28], [L, 59], [R, 59], [C, 44], [C, 104], [L, 89], [R, 89], [L, 120], [R, 120]]
  };

  function suitMark(suit, cx, cy, size, rotate) {
    var s = size / 100;
    var t = 'translate(' + cx + ',' + cy + ') scale(' + s + ')' +
            (rotate ? ' rotate(180)' : '') + ' translate(-50,-50)';
    return '<g transform="' + t + '">' + SUIT_ART[suit] + '</g>';
  }

  /* Court cards get a framed panel, a monogram and a rank device rather than
     a portrait: at 50px wide a figure turns to mud, but a frame reads. */
  function court(rank, suit) {
    var letter = RANK_CH[rank - 1];
    var device =
      rank === 13 ? '<path d="M34 40l5 11 6-13 5 13 6-11 3 15H31z" class="dev"/>' :          /* crown  */
      rank === 12 ? '<path d="M50 36l4 9 9 2-6 7 1 9-8-4-8 4 1-9-6-7 9-2z" class="dev"/>' :  /* star   */
                    '<path d="M41 32h3.4v30H41z M44.4 33l17 6.5-17 6.5z" class="dev"/>';      /* pennant */
    return (
      '<rect class="panel" x="21" y="27" width="58" height="94" rx="7"/>' +
      '<rect class="panel-in" x="25.5" y="31.5" width="49" height="85" rx="4.5"/>' +
      '<g class="dev-g" transform="translate(0,4)">' + device + '</g>' +
      '<text class="court" x="50" y="86" text-anchor="middle">' + letter + '</text>' +
      suitMark(suit, 50, 104, 20, false)
    );
  }

  function centre(rank, suit) {
    if (rank >= 11) return court(rank, suit);
    if (rank === 1) return suitMark(suit, 50, 74, 52, false);
    var pts = LAYOUT[rank], out = '', i;
    var size = rank >= 9 ? 19 : 22;
    for (i = 0; i < pts.length; i++) {
      out += suitMark(suit, pts[i][0], pts[i][1], size, pts[i][1] > 74);
    }
    return out;
  }

  function corner(rank, suit, flip) {
    var t = flip ? 'translate(100,148) rotate(180)' : '';
    return '<g transform="' + t + '">' +
             '<text class="idx" x="12.5" y="24" text-anchor="middle">' + RANK_CH[rank - 1] + '</text>' +
             suitMark(suit, 12.5, 35, 15, false) +
           '</g>';
  }

  /* suit: 0..3, rank: 1..13 */
  function faceSVG(suit, rank) {
    return '<svg class="art" viewBox="0 0 100 148" preserveAspectRatio="none" aria-hidden="true">' +
             '<rect class="bg" x="0.6" y="0.6" width="98.8" height="146.8" rx="13"/>' +
             centre(rank, suit) +
             corner(rank, suit, false) +
             corner(rank, suit, true) +
           '</svg>';
  }

  /* The lattice patterns are declared ONCE for the document (52 cards each
     carrying their own <defs> would mean 52 elements sharing an id). */
  function defsSVG() {
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
             '<pattern id="latA" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
               '<rect width="14" height="14" class="b-bg"/>' +
               '<rect width="6" height="14" class="b-pink"/>' +
             '</pattern>' +
             '<pattern id="latB" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">' +
               '<rect width="6" height="14" class="b-sage"/>' +
             '</pattern>' +
           '</defs></svg>';
  }

  function backSVG() {
    return '<svg class="art" viewBox="0 0 100 148" preserveAspectRatio="none" aria-hidden="true">' +
             '<rect class="b-frame" x="0.6" y="0.6" width="98.8" height="146.8" rx="13"/>' +
             '<rect x="6" y="6" width="88" height="136" rx="8" fill="url(#latA)"/>' +
             '<rect x="6" y="6" width="88" height="136" rx="8" fill="url(#latB)"/>' +
             '<rect class="b-line" x="6" y="6" width="88" height="136" rx="8"/>' +
           '</svg>';
  }

  root.KCardArt = { faceSVG: faceSVG, backSVG: backSVG, defsSVG: defsSVG, RANK_CH: RANK_CH };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KCardArt;
})(typeof self !== 'undefined' ? self : this);
