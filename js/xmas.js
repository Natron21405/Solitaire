/* =====================================================================
   xmas.js — the secret Christmas theme.

   Nothing here touches the game. The theme is a single class on <html>
   (`xmas`) plus a snow canvas; css/christmas.css does the rest.

   Flow:
     • Until unlocked, the app is plain Pastel Solitaire with no sign that
       anything is hidden.
     • On any win while still locked, ui.js asks for giftHTML() and adds a
       wrapped present to the "You won" sheet. If it is ignored, it simply
       comes back on the next win.
     • Opening the present unwraps it, sweeps the theme in, and saves
       { unlocked: true, on: true } to localStorage, so it survives relaunch.
     • Once unlocked, Statistics shows a Pastel / Christmas switch.

   A tiny inline script in index.html applies the class before first paint,
   so a relaunch never flashes pastel first.
   ===================================================================== */
(function (root) {
  'use strict';

  var KEY = 'pastel-solitaire-xmas';
  var THEME_COLOR = { pastel: '#7fb0cb', xmas: '#7ea3c4' };
  var reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  function isUnlocked() { return !!load().unlocked; }
  function isOn() { var s = load(); return !!(s.unlocked && s.on); }

  function setOn(on) {
    var s = load();
    if (!s.unlocked) { s.unlocked = true; s.unlockedAt = Date.now(); }
    s.on = !!on;
    save(s);
    apply();
  }

  function apply() {
    var on = isOn();
    document.documentElement.classList.toggle('xmas', on);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', on ? THEME_COLOR.xmas : THEME_COLOR.pastel);
    if (on) Snow.start(); else Snow.stop();
  }

  /* ---------- snow --------------------------------------------------------
     Drawn behind the board (cards and toolbar sit above it), so it never
     covers a card or eats a tap. ~30 fps and paused whenever the app is in
     the background, to stay light on the battery. */
  var Snow = (function () {
    var cv = null, ctx = null, flakes = [], raf = 0, running = false, last = 0, W = 0, H = 0, dpr = 1;

    function ensure() {
      if (cv) return;
      cv = document.createElement('canvas');
      cv.id = 'xm-snow';
      var app = document.getElementById('app');
      app.insertBefore(cv, app.firstChild);
      ctx = cv.getContext('2d');
      root.addEventListener('resize', size);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) halt(); else if (running) loop(performance.now());
      });
    }

    function size() {
      if (!cv) return;
      dpr = Math.min(2, root.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var want = Math.min(70, Math.round(W * H / 9000));
      while (flakes.length < want) flakes.push(flake(true));
      flakes.length = want;
    }

    function flake(anywhere) {
      var r = 0.8 + Math.random() * 2.2;
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -6,
        r: r,
        vy: 12 + r * 9 + Math.random() * 8,          // bigger = nearer = faster
        sway: 6 + Math.random() * 14,
        ph: Math.random() * Math.PI * 2,
        a: 0.45 + Math.random() * 0.45
      };
    }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return;                       // ~30 fps
      var dt = Math.min(0.1, (t - last) / 1000 || 0.033);
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.vy * dt;
        f.ph += dt * 0.9;
        var x = f.x + Math.sin(f.ph) * f.sway;
        if (f.y > H + 6) { flakes[i] = flake(false); continue; }
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    function halt() { cancelAnimationFrame(raf); raf = 0; }

    return {
      start: function () {
        if (reduceMotion) return;
        ensure();
        cv.style.display = '';
        running = true;
        size();
        if (!raf && !document.hidden) { last = 0; loop(performance.now()); }
      },
      stop: function () {
        running = false;
        halt();
        if (cv) { ctx.clearRect(0, 0, W, H); cv.style.display = 'none'; }
      }
    };
  })();

  /* ---------- the gift ------------------------------------------------------ */

  var GIFT_SVG =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<defs><radialGradient id="xmGlow"><stop offset="0" stop-color="#fff7d6"/>' +
        '<stop offset=".6" stop-color="#ffe9a8" stop-opacity=".7"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="glow" cx="50" cy="50" r="34" fill="url(#xmGlow)"/>' +
      /* box */
      '<rect x="20" y="44" width="60" height="46" rx="5" fill="#f2a3b3"/>' +
      '<rect x="20" y="44" width="60" height="46" rx="5" fill="none" stroke="#d97b8f" stroke-width="1.5"/>' +
      '<rect x="45" y="44" width="10" height="46" fill="#9fd9bf"/>' +
      '<path d="M24 52h52" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' +
      /* lid + bow (lifts off) */
      '<g class="lid">' +
        '<rect x="15" y="33" width="70" height="14" rx="4" fill="#f7b9c6" stroke="#d97b8f" stroke-width="1.5"/>' +
        '<rect x="45" y="33" width="10" height="14" fill="#9fd9bf"/>' +
        '<path d="M50 33c-6-12-22-16-22-6 0 6 12 7 22 6z" fill="#7cc7a6" stroke="#4f9c7c" stroke-width="1.4"/>' +
        '<path d="M50 33c6-12 22-16 22-6 0 6-12 7-22 6z" fill="#7cc7a6" stroke="#4f9c7c" stroke-width="1.4"/>' +
        '<circle cx="50" cy="32" r="4" fill="#5fb38f"/>' +
      '</g>' +
    '</svg>';

  function giftHTML() {
    return '<div class="xm-gift">' +
             '<p>Wait… something’s been left for you.</p>' +
             '<button type="button" class="xm-gift-btn" id="xm-gift" aria-label="Open the present">' + GIFT_SVG + '</button>' +
             '<div class="xm-gift-hint">Tap to open</div>' +
           '</div>';
  }

  /* Unwrap the present, sweep the theme in, then call onDone() (ui.js uses
     it to show the "Merry Christmas" sheet). */
  function wireGift(scope, onDone) {
    var btn = scope.querySelector('#xm-gift');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (btn.dataset.opening) return;
      btn.dataset.opening = '1';

      if (reduceMotion) { setOn(true); onDone && onDone(); return; }

      btn.classList.add('open');
      var r = btn.getBoundingClientRect();
      var bx = (r.left + r.width / 2) + 'px', by = (r.top + r.height / 2) + 'px';

      setTimeout(function () {
        var burst = document.createElement('div');
        burst.id = 'xm-burst';
        burst.style.setProperty('--bx', bx);
        burst.style.setProperty('--by', by);
        document.body.appendChild(burst);
        void burst.offsetWidth;
        burst.classList.add('grow');

        setTimeout(function () {          // screen fully covered: flip the theme
          setOn(true);
          onDone && onDone();
          requestAnimationFrame(function () {
            burst.classList.remove('grow');
            burst.style.clipPath = 'none';
            burst.classList.add('fade');
            setTimeout(function () { burst.remove(); }, 1000);
          });
        }, 800);
      }, 520);
    });
  }

  /* ---------- Statistics switch ---------------------------------------------- */

  function themeSwitchHTML() {
    if (!isUnlocked()) return '';
    var on = isOn();
    return '<h2>Theme</h2>' +
      '<div class="seg xm-theme">' +
        '<button type="button" data-xm="0" class="' + (on ? '' : 'sel') + '">Pastel</button>' +
        '<button type="button" data-xm="1" class="' + (on ? 'sel' : '') + '">Christmas</button>' +
      '</div>';
  }

  function wireThemeSwitch(scope) {
    scope.querySelectorAll('[data-xm]').forEach(function (b) {
      b.addEventListener('click', function () {
        setOn(b.dataset.xm === '1');
        scope.querySelectorAll('[data-xm]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      });
    });
  }

  apply();

  root.KXmas = {
    isUnlocked: isUnlocked, isOn: isOn, setOn: setOn, apply: apply,
    giftHTML: giftHTML, wireGift: wireGift,
    themeSwitchHTML: themeSwitchHTML, wireThemeSwitch: wireThemeSwitch,
    /* for testing: wipe the secret so the gift shows again */
    _reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} apply(); }
  };
})(typeof self !== 'undefined' ? self : this);
