/* ==========================================================================
   Breathing background engine — programmatic, no video/images.
   Drives every <canvas data-breathe="..."> on the page: soft blobs that
   breathe on a 10s cycle (4s expand / 6s release) while gently drifting and
   wobbling. One RAF loop paints all canvases. Ported verbatim (presets + math)
   from the Claude Design prototype (МОМЕНТЫ-промо.dc.html).
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // preset = blobs [{ rgb, x, y (0..1), r (fraction of max side), a }]
  var P = {
    phone:   { blobs: [ { rgb: [76, 86, 120],  x: .5,  y: .54, r: .66, a: .9 },
                        { rgb: [93, 111, 132], x: .52, y: .66, r: .52, a: .66 } ] },
    demo:    { blobs: [ { rgb: [201, 138, 107], x: .48, y: .5,  r: .62, a: .95 },
                        { rgb: [93, 111, 132],  x: .58, y: .6,  r: .5,  a: .66 } ] },
    sleep:   { blobs: [ { rgb: [76, 86, 120],  x: .9, y: .12, r: .62, a: .9 } ] },
    day:     { blobs: [ { rgb: [201, 138, 107], x: .9, y: .12, r: .62, a: .85 } ] },
    anx:     { blobs: [ { rgb: [62, 110, 94],  x: .9, y: .12, r: .62, a: .85 } ] },
    talk:    { blobs: [ { rgb: [180, 116, 79], x: .9, y: .86, r: .66, a: .8 } ] },
    support: { blobs: [ { rgb: [45, 95, 79],   x: .9, y: .86, r: .66, a: .85 } ] }
  };

  var items = [];
  var start = 0;

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  function setup() {
    var nodes = document.querySelectorAll('canvas[data-breathe]');
    items = Array.prototype.map.call(nodes, function (c) {
      var cfg = P[c.dataset.breathe] || P.phone;
      var key = c.dataset.breathe;
      var blobs = cfg.blobs.map(function (b, i) {
        var o = {};
        for (var k in b) o[k] = b[k];
        o.ds = 0.10 + i * 0.05;
        o.ds2 = 0.23 + i * 0.07;
        o.ph = i * 2.1 + (key.length % 4);
        return o;
      });
      return { c: c, ctx: c.getContext('2d'), blobs: blobs, w: 0, h: 0 };
    });
    resize();
  }

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    for (var i = 0; i < items.length; i++) {
      var o = items[i];
      var r = o.c.getBoundingClientRect();
      if (!r.width) continue;
      o.w = r.width; o.h = r.height;
      o.c.width = Math.round(r.width * dpr);
      o.c.height = Math.round(r.height * dpr);
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (reduce) render(0, 0.6); // repaint the frozen frame after a resize
  }

  function draw(o, t, breath) {
    var ctx = o.ctx, w = o.w, h = o.h;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    var S = Math.max(w, h);
    for (var i = 0; i < o.blobs.length; i++) {
      var b = o.blobs[i];
      var sway = 0.05;
      var cx = w * (b.x + Math.sin(t * b.ds + b.ph) * sway + Math.sin(t * b.ds2 + b.ph * 1.7) * sway * 0.5);
      var cy = h * (b.y + Math.cos(t * b.ds * 0.85 + b.ph) * sway + Math.cos(t * b.ds2 * 1.1 + b.ph) * sway * 0.45);
      var wob = 1 + Math.sin(t * b.ds2 * 1.4 + b.ph) * 0.06;
      var scale = (0.80 + breath * 0.30) * wob;
      var R = S * b.r * scale;
      var a = b.a * (0.5 + breath * 0.5);
      var rr = b.rgb[0], gg = b.rgb[1], bb = b.rgb[2];
      var grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grd.addColorStop(0, 'rgba(' + rr + ',' + gg + ',' + bb + ',' + Math.min(0.6, a * 0.6).toFixed(3) + ')');
      grd.addColorStop(0.5, 'rgba(' + rr + ',' + gg + ',' + bb + ',' + Math.min(0.28, a * 0.3).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(' + rr + ',' + gg + ',' + bb + ',0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function render(t, breath) {
    for (var i = 0; i < items.length; i++) draw(items[i], t, breath);
  }

  function tick(now) {
    if (!start) start = now;
    var t = (now - start) / 1000;
    var tt = t % 10;
    var breath = tt < 4 ? smooth(tt / 4) : smooth(1 - (tt - 4) / 6);
    render(t, breath);
    requestAnimationFrame(tick);
  }

  function init() {
    setup();
    window.addEventListener('resize', resize);
    if (reduce) {
      render(0, 0.6); // honor prefers-reduced-motion: paint one calm frame, no loop
    } else {
      requestAnimationFrame(tick);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
