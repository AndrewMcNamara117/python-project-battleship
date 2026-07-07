/* ============================================================
   IRON MILES — "Forged from Motion" logo reveal
   ------------------------------------------------------------
   Dependency-free timeline. Every visual property is a pure
   function of master time T (seconds), so the loop is perfectly
   seamless, replay is instant, and nothing ever drifts.

   MASTER TIMELINE (at --speed:1)
     0.00 – 1.20  1  dark opening, centre glow breathes in
     0.70 – 2.60  2  energy trails cross the lower-middle
     1.60 – 2.85  3  white "I" forges in 3 pieces (top→bottom)
     2.90 – 4.95  4  green "M" forges in 4 pieces (L→centre→R)
     4.95 – 5.35     energy pulse travels through the green
     5.10 – 5.70  5  full-logo impact: 97→100%, shake, glow
     5.50 – 6.50  6  tagline wipes in: FORGE / ONE / MORE
     6.60 – 8.60  7  finishing sweep, ambient trail, breathing
     8.40 – 10.1  8  outro: trails → tagline → mark dissolves
     LOOP = 10.4s
   ============================================================ */
(function () {
  "use strict";

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (/[?&]export/.test(location.search)) document.body.classList.add("export");

  /* ---------- element handles ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), logoWrap = $("logoWrap"), logo = $("logo"),
      centerglow = $("centerglow"), impactglow = $("impactglow"),
      texture = $("texture"), mglow = $("mglow"),
      backI = $("backI"), backM = $("backM"),
      pulseband = $("pulseband"), sweepband = $("sweepband"),
      tagline = $("tagline"), fx = $("fx"), ctx = fx.getContext("2d");

  var MINT = getComputedStyle(document.documentElement).getPropertyValue("--mint").trim() || "#10d7ae";
  var SPEED = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--speed")) || 1;
  var LOOP = 10.4;

  /* ---------- tiny easing kit ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(T, t0, d) { return clamp((T - t0) / d, 0, 1); }        // linear 0..1
  function outCubic(p) { return 1 - Math.pow(1 - p, 3); }
  function outExpo(p) { return p === 1 ? 1 : 1 - Math.pow(2, -10 * p); }
  function outBack(p) { var s = 1.25; p -= 1; return p * p * ((s + 1) * p + s) + 1; }
  function inOut(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function bell(p) { return Math.sin(Math.PI * clamp(p, 0, 1)); }      // 0→1→0

  /* ---------- the seven forged pieces ----------
     from = entry offset in SVG units; t0/d = timing; seam = lock
     point (SVG coords) where the spark burst fires. */
  var pieces = [
    { el: $("pI1"), t0: 1.60, d: .72, from: { x: -26, y:  92, r: -2 }, seam: [ 70, 130], white: 1 },
    { el: $("pI2"), t0: 1.84, d: .72, from: { x:  20, y: 116, r:  2 }, seam: [ 70, 240], white: 1 },
    { el: $("pI3"), t0: 2.08, d: .74, from: { x:   0, y: 138, r:  0 }, seam: [ 70, 450], white: 1 },
    { el: $("pM1"), t0: 2.90, d: .80, from: { x: -175, y: 145, r: -5 }, seam: [277, 451] },
    { el: $("pM2"), t0: 3.36, d: .80, from: { x:  22, y: -195, r:  4 }, seam: [381, 365] },
    { el: $("pM3"), t0: 3.82, d: .76, from: { x: 205, y:  42, r:  0 }, seam: [668, 470] },
    { el: $("pM4"), t0: 4.26, d: .70, from: { x: 150, y: -150, r:  6 }, seam: [668, 260] }
  ];

  /* ---------- reduced motion: static lockup, no engine ---------- */
  if (reduced) {
    fx.style.display = "none";
    $("replay").disabled = true;
    return;
  }

  /* ---------- canvas sizing ---------- */
  var dpr = Math.min(devicePixelRatio || 1, 2), CW = 0, CH = 0;
  function resize() {
    var r = stage.getBoundingClientRect();
    CW = Math.round(r.width); CH = Math.round(r.height);
    fx.width = CW * dpr; fx.height = CH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize); resize();

  /* map SVG viewBox coords (-40,-40,860,740) to stage pixels */
  function svgToStage(sx, sy) {
    var lr = logo.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    return [ (sx + 40) / 860 * lr.width  + lr.left - sr.left,
             (sy + 40) / 740 * lr.height + lr.top  - sr.top ];
  }

  /* ---------- energy trail path (echoes the reference poster) ---------- */
  function trailY(u) { // u: 0..1 across the stage
    return CH * (0.615 + 0.048 * Math.sin(u * 5.3 + 1.15) + 0.026 * Math.sin(u * 9.6 + 4.2));
  }
  function drawTrail(headU, span, width, alpha) {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    var steps = 46;
    for (var i = 0; i < steps; i++) {
      var u0 = headU - span * (i + 1) / steps, u1 = headU - span * i / steps;
      if (u1 < -0.08 || u0 > 1.08) continue;
      var fade = 1 - i / steps;                       // brighter at the head
      ctx.strokeStyle = "rgba(120,255,222," + (alpha * fade * fade) + ")";
      ctx.lineWidth = width * (0.35 + 0.65 * fade);
      ctx.shadowColor = MINT; ctx.shadowBlur = 16 * fade;
      ctx.beginPath();
      ctx.moveTo(u0 * CW, trailY(u0));
      ctx.lineTo(u1 * CW, trailY(u1));
      ctx.stroke();
    }
    // glowing head
    var hx = headU * CW, hy = trailY(headU);
    if (headU > -0.05 && headU < 1.05) {
      var g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      g.addColorStop(0, "rgba(220,255,246," + alpha + ")");
      g.addColorStop(.35, "rgba(16,215,174," + alpha * .8 + ")");
      g.addColorStop(1, "rgba(16,215,174,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, 26, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- deterministic spark bursts at every lock ---------- */
  function hash(n) { return Math.abs(Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1; }
  function drawBurst(T, lockT, sx, sy, white) {
    var life = (T - lockT) / 0.55;
    if (life <= 0 || life >= 1) return;
    var p = outCubic(life), o = svgToStage(sx, sy);
    var scale = logo.getBoundingClientRect().width / 860;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 13; i++) {
      var a = (i / 13) * Math.PI * 2 + hash(i + sx) * 0.9;
      var dist = (22 + hash(i * 3 + sy) * 46) * scale * p;
      var x = o[0] + Math.cos(a) * dist, y = o[1] + Math.sin(a) * dist * 0.85;
      var al = (1 - life) * (white ? 0.85 : 0.9);
      ctx.fillStyle = white ? "rgba(255,255,255," + al + ")" : "rgba(120,255,222," + al + ")";
      ctx.shadowColor = white ? "#fff" : MINT; ctx.shadowBlur = 8;
      var r = (white ? 1.6 : 1.9) * (1 - life) * scale * 3;
      ctx.beginPath(); ctx.arc(x, y, Math.max(r, .4), 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================
     RENDER — everything below is a pure function of T
     ============================================================ */
  function render(T) {
    /* ---- 1 · dark opening: centre glow ---- */
    var glowIn = outCubic(seg(T, 0.15, 1.05));
    var glowOut = 1 - outCubic(seg(T, 9.3, 0.8));
    centerglow.style.opacity = (0.55 * glowIn * glowOut).toFixed(3);

    /* ---- pieces: forge in, later dissolve out ---- */
    var out = outCubic(seg(T, 8.9, 0.8));                 // 8 · outro dissolve
    for (var i = 0; i < pieces.length; i++) {
      var pc = pieces[i];
      var p = outBack(seg(T, pc.t0, pc.d));
      var ox = pc.from.x * (1 - p), oy = pc.from.y * (1 - p), or_ = pc.from.r * (1 - p);
      // outro pushes pieces slightly back along their entry vector
      ox += pc.from.x * 0.22 * out; oy += pc.from.y * 0.22 * out; or_ += pc.from.r * 0.3 * out;
      pc.el.style.transform = "translate(" + ox + "px," + oy + "px) rotate(" + or_ + "deg)";
      pc.el.style.opacity = (clamp(p * 2.2, 0, 1) * (1 - out)).toFixed(3);
      var blur = 7 * (1 - clamp(p * 1.35, 0, 1)) + 6 * out; // motion blur in, dissolve blur out
      pc.el.style.filter = blur > 0.15 ? "blur(" + blur.toFixed(2) + "px)" : "";
    }

    /* ---- seam killers: solid letters appear on completion ---- */
    var backCut = 1 - outCubic(seg(T, 8.86, 0.16));
    backI.setAttribute("opacity", (outCubic(seg(T, 2.82, 0.2)) * backCut).toFixed(3));
    backM.setAttribute("opacity", (outCubic(seg(T, 4.96, 0.2)) * backCut).toFixed(3));

    /* ---- 4 · energy pulse through the green M ---- */
    var pp = seg(T, 4.95, 0.42);
    pulseband.setAttribute("opacity", (bell(pp) * 0.65).toFixed(3));
    pulseband.setAttribute("x", (-400 + inOut(pp) * 1300).toFixed(1));
    // quick green flash under the M as the pulse lands
    var flash = bell(seg(T, 4.95, 0.5)) * 0.30;

    /* ---- 5 · full-logo impact ---- */
    var imp = outBack(seg(T, 5.10, 0.30));
    var scale = 0.97 + 0.03 * imp;
    var shX = 0, shY = 0, sk = 1 - seg(T, 5.10, 0.18);
    if (sk > 0 && T > 5.10) { shX = 4.2 * sk * Math.sin(T * 150); shY = 3.2 * sk * Math.cos(T * 137); }
    stage.style.transform = "translate(" + shX.toFixed(2) + "px," + shY.toFixed(2) + "px)";
    logoWrap.style.transform = "translate(-50%,-54%) scale(" + scale.toFixed(4) + ")";
    var ig = bell(seg(T, 5.10, 0.60));
    impactglow.style.opacity = (ig * 0.85).toFixed(3);
    impactglow.style.transform = "scale(" + (0.6 + 0.6 * outCubic(seg(T, 5.10, 0.6))) + ")";

    /* ---- forged texture settles in after assembly ---- */
    texture.setAttribute("opacity", (0.16 * outCubic(seg(T, 5.15, 0.55)) * (1 - out)).toFixed(3));

    /* ---- 7 · breathing glow on the green section ---- */
    var breathe = outCubic(seg(T, 6.1, 0.8)) * (1 - outCubic(seg(T, 8.9, 0.7)));
    var mg = flash + breathe * (0.10 + 0.05 * Math.sin(T * 2.3));
    mglow.setAttribute("opacity", clamp(mg, 0, 1).toFixed(3));

    /* ---- 6 · tagline wipe: FORGE / ONE / MORE ---- */
    var tws = [$("tw1"), $("tw2"), $("tw3")];
    for (var w = 0; w < 3; w++) {
      var tp = outExpo(seg(T, 5.5 + w * 0.22, 0.55));
      tws[w].firstElementChild.style.transform = "translateX(" + (-103 * (1 - tp)) + "%)";
    }
    tagline.style.letterSpacing = (0.30 + 0.05 * outCubic(seg(T, 5.5, 1.1))) + "em";
    tagline.style.opacity = (1 - outCubic(seg(T, 8.62, 0.5))).toFixed(3);  // 8 · fade text

    /* ---- 7 · finishing light sweep across the mark ---- */
    var sw = seg(T, 6.62, 0.85);
    sweepband.setAttribute("opacity", (bell(sw) * 0.8).toFixed(3));
    sweepband.setAttribute("x", (-460 + inOut(sw) * 1400).toFixed(1));

    /* ---- canvas: trails + sparks ---- */
    ctx.clearRect(0, 0, CW, CH);
    var trailsFade = 1 - outCubic(seg(T, 8.40, 0.55));    // 8 · trails leave first
    // 2 · hero pass
    drawTrail(-0.06 + seg(T, 0.70, 1.9) * 1.18, 0.34, CH * 0.012, 0.85 * trailsFade * (T < 3.4 ? 1 : clamp(1 - (T - 3.4) / .6, 0, 1)));
    // 2 · secondary, dimmer & later
    drawTrail(-0.06 + seg(T, 1.15, 2.1) * 1.18, 0.26, CH * 0.007, 0.32 * trailsFade * (T < 3.8 ? 1 : clamp(1 - (T - 3.8) / .6, 0, 1)));
    // 7 · gentle ambient drift beneath the lockup
    var amb = outCubic(seg(T, 6.2, 1.0)) * trailsFade;
    if (amb > 0.01) drawTrail(0.5 + 0.42 * Math.sin(T * 0.55), 0.5, CH * 0.006, 0.16 * amb);
    // spark bursts at every lock moment
    for (var b = 0; b < pieces.length; b++) {
      var pcb = pieces[b];
      drawBurst(T, pcb.t0 + pcb.d * 0.82, pcb.seam[0], pcb.seam[1], pcb.white);
    }
  }

  /* ---------- master clock ---------- */
  var start = performance.now();
  var m = location.search.match(/[?&]t=([\d.]+)/);
  var frozen = m ? parseFloat(m[1]) : null;   // ?t=6.8 freezes a frame for QA/recording

  function frame(now) {
    if (frozen === null) render(((now - start) / 1000 * SPEED) % LOOP);
    requestAnimationFrame(frame);
  }
  if (frozen !== null) {
    render(frozen);
    addEventListener("resize", function () { resize(); render(frozen); });
  }
  requestAnimationFrame(frame);

  /* ---------- replay: button + R key ---------- */
  function replay() { frozen = null; start = performance.now(); }
  $("replay").addEventListener("click", replay);
  addEventListener("keydown", function (e) {
    if (e.key === "r" || e.key === "R") replay();
  });
})();
