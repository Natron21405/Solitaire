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
    /* 2 clubs — three round lobes, a centre fill and a flared stem, each its
       own shape so no overlap can cancel out. (The old single outline didn't
       close where it started and drew a stray line across the top lobe.) */
    '<circle cx="50" cy="27" r="18"/><circle cx="27" cy="53" r="18"/><circle cx="73" cy="53" r="18"/>' +
    '<circle cx="50" cy="47" r="13"/>' +
    '<path d="M50 48c0 20-6 32-15 44h30c-9-12-15-24-15-44z"/>',
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

  /* Court figures — "storybook" busts (Nov 2026 redraw).
     One design per rank, recoloured by suit: clothing and the portrait window
     take the suit colour (via --c / --c-soft, set per card colour in
     styles.css); crown, skin, hair and blush are fixed pastel accents so the
     figure still reads as a person at ~52px wide. Drawn on the court window
     x 24..76, y 30..118 and clipped to it. Rank is carried by the corner
     index, so no letter competes with the figure. */
  function faceBits(cy, opts) {
    opts = opts || {};
    var s = '';
    s += '<ellipse class="ct-sk" cx="50" cy="' + cy + '" rx="11.5" ry="12.5"/>';
    /* eyes: little arcs read better than dots at 50px */
    s += '<path class="ct-eyeln" d="M43.4 ' + (cy - 0.5) + 'q2.4 -2.6 4.8 0M51.8 ' + (cy - 0.5) + 'q2.4 -2.6 4.8 0"/>';
    if (opts.lash) s += '<path class="ct-eyeln" d="M42.6 ' + (cy - 1.2) + 'l-1.4 -1.2M57.4 ' + (cy - 1.2) + 'l1.4 -1.2"/>';
    s += '<circle class="ct-blush" cx="42.5" cy="' + (cy + 4.5) + '" r="2.6"/>';
    s += '<circle class="ct-blush" cx="57.5" cy="' + (cy + 4.5) + '" r="2.6"/>';
    if (!opts.noMouth) s += '<path class="ct-mouth" d="M46.6 ' + (cy + 6) + 'q3.4 3 6.8 0"/>';
    return s;
  }

  function courtKing() {
    return '' +
      '<rect class="ct-s ct-win" x="24" y="30" width="52" height="88"/>' +
      /* robe + ermine */
      '<path class="ct-m" d="M22 120c0-20 11-31 28-31s28 11 28 31z"/>' +
      '<path class="ct-p" d="M27 101c6-9 40-9 46 0l-2 8c-8-7-34-7-42 0z"/>' +
      '<g class="ct-ink"><circle cx="35" cy="101" r="1"/><circle cx="43" cy="98.6" r="1"/><circle cx="50" cy="98" r="1"/><circle cx="57" cy="98.6" r="1"/><circle cx="65" cy="101" r="1"/></g>' +
      /* sceptre over the shoulder */
      '<path class="ct-gdd" d="M64.5 118 69 74h2.4l-1.6 44z"/>' +
      '<circle class="ct-gd" cx="70.3" cy="72" r="3.6"/>' +
      /* hair at the sides, face, beard */
      '<path class="ct-beardc" d="M36.5 56c-3 6-2 13 1 16l3-14zM63.5 56c3 6 2 13-1 16l-3-14z"/>' +
      faceBits(58, { noMouth: true }) +
      '<path class="ct-beardc" d="M38 61c0 20 6 30 12 32 6-2 12-12 12-32-3 5-7 7-12 7s-9-2-12-7z"/>' +
      '<path class="ct-beardd" d="M43 66.5c3-2 5.4-1.2 7 0 1.6-1.2 4-2 7 0-2.4 2.2-5 2.2-7 .8-2 1.4-4.6 1.4-7-.8z"/>' +
      '<path class="ct-mouth" d="M48 71.5q2 1.4 4 0"/>' +
      /* crown */
      '<path class="ct-gd" d="M36 50V33l7 7 7-11 7 11 7-7v17z"/>' +
      '<rect class="ct-gdd" x="35" y="46" width="30" height="6" rx="2"/>' +
      '<circle class="ct-m" cx="50" cy="49" r="2"/><circle class="ct-s2" cx="42" cy="49" r="1.4"/><circle class="ct-s2" cx="58" cy="49" r="1.4"/>' +
      '<circle class="ct-gd" cx="36" cy="32.5" r="1.8"/><circle class="ct-gd" cx="50" cy="28.5" r="1.8"/><circle class="ct-gd" cx="64" cy="32.5" r="1.8"/>';
  }

  function courtQueen() {
    return '' +
      '<rect class="ct-s ct-win" x="24" y="30" width="52" height="88"/>' +
      /* long hair behind */
      '<path class="ct-hairq" d="M36 60c-4-22 32-22 28 0l5 33c-8 5-30 5-38 0z"/>' +
      /* gown with a soft bodice */
      '<path class="ct-m" d="M22 120c0-19 11-29 28-29s28 10 28 29z"/>' +
      '<path class="ct-s2" d="M41 91h18l-9 22z"/>' +
      '<path class="ct-sk" d="M45 80h10v7c-2 4-8 4-10 0z"/>' +
      /* pearls */
      '<g class="ct-p ct-pearl"><circle cx="43.5" cy="90.5" r="1.5"/><circle cx="46.7" cy="92.3" r="1.5"/><circle cx="50" cy="93" r="1.5"/><circle cx="53.3" cy="92.3" r="1.5"/><circle cx="56.5" cy="90.5" r="1.5"/></g>' +
      /* rose held at the chest */
      '<path class="ct-leaf" d="M64 108c-1-6 2-10 7-11-1 5-3 9-7 11z"/>' +
      '<circle class="ct-rose2" cx="63" cy="101" r="4.4"/><path class="ct-roseln" d="M60.6 100.4q2.4-2.6 4.8 0M61.6 102.4q1.4 1.2 2.8 0"/>' +
      faceBits(66, { lash: true }) +
      /* fringe, swept */
      '<path class="ct-hairq" d="M38.4 63c0-9 5-14 11.6-14 7 0 11.6 5 11.6 13-4-5-9-7-13-6-3 1-6 3-10.2 7z"/>' +
      /* tiara */
      '<path class="ct-gd" d="M39.5 52 41 44l4.5 3.5L50 39l4.5 8.5L59 44l1.5 8c-6-2-15-2-21 0z"/>' +
      '<circle class="ct-m" cx="50" cy="46.5" r="1.9"/>';
  }

  function courtJack() {
    return '' +
      '<rect class="ct-s ct-win" x="24" y="30" width="52" height="88"/>' +
      /* tunic with a stripe and a ruff */
      '<path class="ct-m" d="M22 120c0-19 11-29 28-29s28 10 28 29z"/>' +
      '<path class="ct-s2" d="M46 94h8v26h-8z"/>' +
      '<path class="ct-p ct-ruff" d="M34 90c2.8-3 5.6 3 8.4 0s5.6 3 8.4 0 5.6 3 8.4 0 5.6 3 8.4 0l-1 6c-2.8 3-5.6-3-8.4 0s-5.6-3-8.4 0-5.6-3-8.4 0-5.6-3-8.4 0z"/>' +
      /* bob of hair */
      '<path class="ct-hairj" d="M37 70c-3-16 6-23 13-23s16 7 13 23c-2 6-5 9-5 9H42s-3-3-5-9z"/>' +
      faceBits(68) +
      '<path class="ct-hairj" d="M39 64c2-6 6-9 11-9s9 3 11 9c-4-3-8-3-11-1-3-2-7-2-11 1z"/>' +
      /* beret + plume */
      '<path class="ct-m" d="M34 58c-1-9 8-15 18-15s18 5 16 12c-1 3-4 4-6 4-8-3-20-4-28-1z"/>' +
      '<rect class="ct-gdd" x="35" y="55" width="30" height="4.4" rx="2" transform="rotate(-4 50 57)"/>' +
      '<path class="ct-plume" d="M60 47c4-11 11-16 17-16-1 9-7 15-13 18-3 1-5 0-4-2z"/>' +
      '<path class="ct-plumeln" d="M62 46c4-5 8-9 13-12"/>';
  }

  function figure(rank) {
    return rank === 13 ? courtKing() : rank === 12 ? courtQueen() : courtJack();
  }


  /* Christmas-only artwork. Always present in the DOM but hidden unless the
     <html> element carries .xmas (see css/christmas.css), so switching theme
     is a single class flip — no card rebuild, and gameplay code never knows. */
  function holly(cx, cy, scale) {
    return '<g class="xm" transform="translate(' + cx + ',' + cy + ') scale(' + scale + ')">' +
             '<path class="hl" d="M0 2C-5-6-15-10-25-7c3 2 2 5 5 6-3 2-1 5 2 6-2 3 1 6 5 5 4 0 9-4 13-10z"/>' +
             '<path class="hl" d="M0 2C5-6 15-10 25-7c-3 2-2 5-5 6 3 2 1 5-2 6 2 3-1 6-5 5-4 0-9-4-13-10z"/>' +
             '<path class="hv" d="M-1 1C-8-3-15-5-21-5M1 1C8-3 15-5 21-5"/>' +
             '<circle class="hb" cx="-4" cy="-2" r="4.2"/>' +
             '<circle class="hb" cx="4" cy="-2" r="4.2"/>' +
             '<circle class="hb" cx="0" cy="4.5" r="4.2"/>' +
             '<circle class="hs" cx="-5.2" cy="-3.4" r="1.2"/><circle class="hs" cx="2.8" cy="-3.4" r="1.2"/>' +
           '</g>';
  }


  /* Christmas court figures — Santa (K), Mrs. Claus (Q), an elf (J).
     Drawn in the same storybook style as the everyday court above: clothes
     and portrait window in the suit colour, fixed pastel skin, white fur,
     gold trim, and faceBits() for matching eyes, blush and smile.
     Only shown when <html> has .xmas. */
  function xmasKing() {                                     /* Santa */
    return '' +
      '<rect class="ct-s ct-win" x="24" y="30" width="52" height="88"/>' +
      '<path class="ct-m" d="M22 120c0-20 11-31 28-31s28 11 28 31z"/>' +                  /* coat */
      '<rect class="ct-beardc" x="46" y="94" width="8" height="26"/>' +                   /* fur placket */
      '<rect class="ct-ink" x="22" y="108" width="56" height="5"/>' +                     /* belt */
      '<rect class="ct-gd" x="45" y="106.2" width="10" height="8.6" rx="1.6"/>' +
      '<rect class="ct-ink" x="47.6" y="108.4" width="4.8" height="4.2" rx=".6"/>' +       /* buckle */
      '<path class="ct-beardc" d="M36.5 56c-3 6-2 13 1 16l3-14zM63.5 56c3 6 2 13-1 16l-3-14z"/>' +
      faceBits(58, { noMouth: true }) +
      '<path class="ct-beardc" d="M37 61c-1 21 6 32 13 34 7-2 14-13 13-34-3 5-7 8-13 8s-10-3-13-8z"/>' + /* beard */
      '<path class="ct-beardd" d="M43 66.5c3-2 5.4-1.2 7 0 1.6-1.2 4-2 7 0-2.4 2.2-5 2.2-7 .8-2 1.4-4.6 1.4-7-.8z"/>' +
      '<path class="ct-mouth" d="M48 71.5q2 1.4 4 0"/>' +
      '<circle class="ct-nose" cx="50" cy="62.6" r="2.1"/>' +
      '<path class="ct-m" d="M35 51c0-14 7-21 17-21 9 0 15 7 18 17l2 9-6 1c-1-5-3-9-6-10 0 2 0 4-1 6z"/>' + /* hat */
      '<rect class="ct-beardc" x="34" y="46" width="32" height="8" rx="4"/>' +              /* fur brim */
      '<circle class="ct-beardc" cx="70" cy="57" r="4.6"/>';                                /* pompom */
  }

  function xmasQueen() {                                    /* Mrs. Claus */
    return '' +
      '<rect class="ct-s ct-win" x="24" y="30" width="52" height="88"/>' +
      '<path class="ct-whair" d="M36 63c-3-19 31-19 28 0l2 13c-8 4-24 4-32 0z"/>' +        /* white bob */
      '<path class="ct-m" d="M22 120c0-19 11-29 28-29s28 10 28 29z"/>' +                  /* dress */
      '<path class="ct-sk" d="M45 80h10v7c-2 4-8 4-10 0z"/>' +
      '<path class="ct-p ct-ruff" d="M38 89c4 4.5 20 4.5 24 0l-1 5.5c-6 4-16 4-22 0z"/>' +   /* lace collar */
      '<path class="ct-p" d="M43 98h14l3 22H40z"/>' +                                      /* apron */
      '<path class="ct-ruff" fill="none" d="M43 104h14"/>' +
      /* a frosted cookie in hand */
      '<circle class="ct-cookie" cx="64" cy="102" r="4.8"/>' +
      '<g class="ct-p"><circle cx="62.4" cy="100.6" r=".9"/><circle cx="65.4" cy="101.2" r=".9"/><circle cx="63.6" cy="103.6" r=".9"/></g>' +
      '<circle class="ct-whair" cx="50" cy="46" r="6"/>' +                                /* bun */
      faceBits(66, { lash: true }) +
      '<path class="ct-whair" d="M38.4 63c0-9 5-14 11.6-14 7 0 11.6 5 11.6 13-4-5-9-7-13-6-3 1-6 3-10.2 7z"/>' + /* fringe */
      '<circle class="ct-spec" cx="45.8" cy="65.4" r="3.4"/><circle class="ct-spec" cx="54.2" cy="65.4" r="3.4"/>' +
      '<path class="ct-spec" d="M49.2 65h1.6"/>' +                                         /* gold glasses */
      holly(57.5, 44, 0.32);
  }

  function xmasJack() {                                     /* Elf */
    return '' +
      '<rect class="ct-s ct-win" x="24" y="30" width="52" height="88"/>' +
      '<path class="ct-m" d="M22 120c0-19 11-29 28-29s28 10 28 29z"/>' +                  /* tunic */
      '<rect class="ct-ink" x="22" y="107" width="56" height="4.6"/>' +                   /* belt */
      '<rect class="ct-gd" x="46" y="105.4" width="8" height="7.8" rx="1.4"/>' +
      '<circle class="ct-gd" cx="50" cy="99.5" r="1.9"/>' +
      '<path class="ct-s2 ct-ruff" d="M34 90h32l-4 7-4-4.5-4 5.5-4-5.5-4 5.5-4-5.5-4 4.5z"/>' + /* pointed collar */
      '<path class="ct-sk" d="M39.5 66 30.5 58l2 11 7.5 2zM60.5 66l9-8-2 11-7.5 2z"/>' +    /* pointy ears */
      faceBits(68) +
      '<path class="ct-hairj" d="M39 64c2-6 6-9 11-9s9 3 11 9c-4-3-8-3-11-1-3-2-7-2-11 1z"/>' +
      '<path class="ct-m" d="M36 59c1-12 7-21 16-25l16-4c-5 5-7 11-5 29z"/>' +              /* pointed hat */
      '<rect class="ct-p" x="35" y="55" width="30" height="5.5" rx="2.7" transform="rotate(-3 50 58)"/>' +
      '<circle class="ct-gd" cx="68.5" cy="32.5" r="3"/>' +                                /* bell */
      '<path class="ct-gdd" d="M66.6 33.6h3.8"/>';
  }

  function figureXmas(rank) {
    return rank === 13 ? xmasKing() : rank === 12 ? xmasQueen() : xmasJack();
  }

  function court(rank, suit) {
    return (
      '<g clip-path="url(#courtclip)">' +
        '<g class="nx">' + figure(rank) + '</g>' +
        '<g class="xm">' + figureXmas(rank) + '</g>' +
      '</g>' +
      '<rect class="panel" x="24" y="30" width="52" height="88" rx="5"/>'
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
             /* Christmas back: candy-cane stripes with a thin mint pinstripe */
             '<pattern id="xmStripe" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
               '<rect width="16" height="16" class="xb-bg"/>' +
               '<rect width="6" height="16" class="xb-red"/>' +
               '<rect x="10" width="2" height="16" class="xb-mint"/>' +
             '</pattern>' +
           '</defs></svg>';
  }

  function backSVG() {
    return '<svg class="art" viewBox="0 0 100 148" preserveAspectRatio="none" aria-hidden="true">' +
             '<rect class="b-frame" x="0.6" y="0.6" width="98.8" height="146.8" rx="13"/>' +
             '<rect x="6" y="6" width="88" height="136" rx="8" fill="url(#latA)"/>' +
             '<rect x="6" y="6" width="88" height="136" rx="8" fill="url(#latB)"/>' +
             '<rect class="b-line" x="6" y="6" width="88" height="136" rx="8"/>' +
             '<g class="xm">' +
               '<rect x="6" y="6" width="88" height="136" rx="8" fill="url(#xmStripe)"/>' +
               '<rect class="b-line" x="6" y="6" width="88" height="136" rx="8"/>' +
               '<circle class="xb-medal" cx="50" cy="74" r="24"/>' +
               '<circle class="xb-ring" cx="50" cy="74" r="20"/>' +
             '</g>' +
             holly(50, 74, 0.62) +
           '</svg>';
  }

  root.KCardArt = { faceSVG: faceSVG, backSVG: backSVG, defsSVG: defsSVG, RANK_CH: RANK_CH };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KCardArt;
})(typeof self !== 'undefined' ? self : this);
