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

  /* Court figures.
     A real court portrait is unreadable at 50px wide, so these are bold
     half-length silhouettes: clothing and hair as solid suit-coloured masses,
     the face as cream negative space. Everything is sized to survive being
     shrunk to a thumbnail; the rank itself is carried by the corner index, so
     no letter competes with the figure. */
  function figure(rank) {
    var robe = '<path d="M27 119c0-20 10-31 23-31s23 11 23 31z"/>';   /* solid mass */
    var out;

    if (rank === 13) {                                    /* King */
      out = robe +
        '<path class="paper" d="M35 56c0 24 6 36 15 39 9-3 15-15 15-39z"/>' +   /* beard */
        '<ellipse class="paper" cx="50" cy="53" rx="12.5" ry="13"/>' +          /* face  */
        '<path d="M42 62c3 2 13 2 16 0-2 4-14 4-16 0z"/>' +                     /* moustache */
        '<path d="M34 44V24l8 9 8-14 8 14 8-9v20z"/>' +                         /* crown */
        '<rect x="33" y="42" width="34" height="6" rx="1.8"/>' +
        '<path d="M48.6 20h2.8v-4h2.2v-2.6h-2.2V9h-2.8v4.4h-2.2V16h2.2z"/>';     /* cross */
    } else if (rank === 12) {                             /* Queen */
      out = robe +
        '<path class="paper" d="M33 50c-6 26-2 43 4 49h26c6-6 10-23 4-49z"/>' + /* hair  */
        '<ellipse class="paper" cx="50" cy="53" rx="11.5" ry="12.5"/>' +        /* face  */
        '<path d="M46 62c2 1.6 6 1.6 8 0-1.4 3-6.6 3-8 0z"/>' +                 /* mouth */
        '<path d="M34 44v-9l5 4 4-8 4 6 3-7 3 7 4-6 4 8 5-4v9z"/>' +            /* tiara */
        '<circle cx="50" cy="24" r="2.6"/>' +
        '<path d="M41 95h18l-2 8H43z"/>';                                       /* bodice */
    } else {                                              /* Jack */
      out = robe +
        '<path class="paper" d="M31 88c6 7 32 7 38 0v7c-6 7-32 7-38 0z"/>' +    /* ruff  */
        '<ellipse class="paper" cx="50" cy="57" rx="11.5" ry="12.5"/>' +        /* face  */
        '<path d="M46 66c2 1.6 6 1.6 8 0-1.4 3-6.6 3-8 0z"/>' +                 /* mouth */
        '<path d="M36 49c0-15 6-22 14-22s14 7 14 22z"/>' +                      /* cap   */
        '<path d="M61 36c4-9 11-14 17-14-2 8-7 15-13 18-2 1-5-1-4-4z"/>';       /* plume */
    }

    var ey = rank === 11 ? 55 : 51;
    return '<g class="fig">' + out +
           '<circle class="eye" cx="46" cy="' + ey + '" r="1.6"/>' +
           '<circle class="eye" cx="54" cy="' + ey + '" r="1.6"/>' +
           '<path class="eye" d="M49.4 ' + (ey + 2.5) + 'h1.2v4.5h-1.2z"/>' +   /* nose */
           '</g>';
  }

  function court(rank, suit) {
    return (
      '<rect class="panel" x="21" y="27" width="58" height="94" rx="7"/>' +
      '<rect class="panel-in" x="24" y="30" width="52" height="88" rx="5"/>' +
      '<g clip-path="url(#courtclip)">' + figure(rank) + '</g>' +
      suitMark(suit, 30, 37, 13, false) +
      suitMark(suit, 70, 111, 13, true)
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
             '<clipPath id="courtclip"><rect x="24" y="30" width="52" height="88" rx="5"/></clipPath>' +
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
