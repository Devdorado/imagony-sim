/* imagony Motion v1: Polygon-Buttons, Falt-Übergang zwischen Seiten, Prisma.
   Ablage: cloudflare-site/assets/imagony-motion.js, einbinden mit
   <script src="/assets/imagony-motion.js" defer></script>
   Keine Abhängigkeiten. Progressive Enhancement: ohne Skript funktionieren alle Links normal. */
(function () {
  "use strict";

  var STORAGE_KEY = "imagony:fold";
  /* Links, die mit Falt-Übergang wechseln. Anpassen, falls weitere Stellen dazukommen. */
  var FOLD_LINKS = ".button, .nav-cta, nav a, .path-list a, .card a, .hd-service-card a, .hd-back, .brand, .site-footer a, [data-fold]";
  var BUTTONS = ".button, .nav-cta";
  var navigating = false;
  var navigationTimers = [];
  var boundButtons = new WeakSet();

  var PRIMARY = ["#a99cff", "#b3a8ff", "#9f92fb", "#bdb3ff", "#a497fd", "#b8adff"];
  var SECONDARY = ["#1d2140", "#222750", "#191d38", "#262c56", "#1f2446"];
  var TILE_COLORS = ["#0b0c18", "#0b0c18", "#13152a", "#13152a", "#13152a", "#1d2140", "#1d2140", "#191c38", "#232850", "#2a2f5a", "#3d63f2", "#6d5ef0"];
  var SVG_NS = "http://www.w3.org/2000/svg";

  /* Prisma: offenes Dreieck aus drei facettierten Balken, viewBox "150 90 760 720", Seed 11 */
  var PRISM = [["460,107 504,159 478,195","#6254e7"],["504,159 498,234 478,195","#584bd0"],["504,159 549,213 498,234","#6a5ce9"],["549,213 545,291 498,234","#5c50ca"],["549,213 597,271 545,291","#8373ff"],["597,271 557,339 545,291","#6e61e1"],["597,271 636,316 557,339","#9080ff"],["636,316 617,370 557,339","#7669e3"],["636,316 680,369 617,370","#9e8fff"],["680,369 640,396 617,370","#8e80ff"],["680,369 725,423 640,396","#8277e1"],["725,423 657,446 640,396","#8075dd"],["725,423 764,469 657,446","#b2a3ff"],["764,469 691,476 657,446","#9287f1"],["764,469 812,526 691,476","#bfb1ff"],["812,526 730,511 691,476","#988df0"],["812,526 857,580 730,511","#9e94ef"],["857,580 770,563 730,511","#ab9fff"],["857,580 900,631 770,563","#cbbeff"],["900,631 814,605 770,563","#a399ed"],["478,195 498,234 479,305","#4d42b6"],["498,234 503,333 479,305","#4c41b5"],["498,234 545,291 503,333","#6a5de9"],["545,291 525,359 503,333","#5d51cd"],["545,291 557,339 525,359","#5c51bd"],["557,339 549,388 525,359","#584eb5"],["557,339 617,370 549,388","#6358be"],["617,370 571,414 549,388","#5a50ae"],["617,370 640,396 571,414","#8074e9"],["640,396 592,440 571,414","#645ab6"],["640,396 657,446 592,440","#8175de"],["657,446 620,472 592,440","#7369c7"],["657,446 691,476 620,472","#7b71cb"],["691,476 643,500 620,472","#8479d9"],["691,476 730,511 643,500","#8077ca"],["730,511 665,526 643,500","#897ed7"],["730,511 770,563 665,526","#877ecc"],["770,563 687,552 665,526","#887fcd"],["770,563 814,605 687,552","#9289d4"],["814,605 708,578 687,552","#8981c7"],["878,692 801,706 801,643","#2f4fda"],["801,706 729,668 801,643","#385eff"],["801,706 737,717 729,668","#3955e8"],["737,717 680,663 729,668","#3b59f3"],["737,717 679,727 680,663","#3f57eb"],["679,727 622,666 680,663","#445dfc"],["679,727 601,741 622,666","#4c60ff"],["601,741 585,680 622,666","#4152dc"],["601,741 546,750 585,680","#4a57e7"],["546,750 534,692 585,680","#4f5df7"],["546,750 475,763 534,692","#4d55e1"],["475,763 479,718 534,692","#4b52da"],["475,763 399,776 479,718","#6063ff"],["399,776 428,716 479,718","#5f62ff"],["399,776 336,788 428,716","#6866ff"],["336,788 388,714 428,716","#5856df"],["336,788 279,798 388,714","#786fff"],["279,798 316,744 388,714","#5b55db"],["279,798 204,811 316,744","#6358e1"],["204,811 284,734 316,744","#6357e0"],["801,643 729,668 697,610","#2d4bce"],["729,668 665,615 697,610","#253eaa"],["729,668 680,663 665,615","#2f46c0"],["680,663 624,622 665,615","#2e44bb"],["680,663 622,666 624,622","#3a4fd7"],["622,666 587,629 624,622","#2f41b0"],["622,666 585,680 587,629","#3c4ccc"],["585,680 559,634 587,629","#4050d8"],["585,680 534,692 559,634","#4d5af0"],["534,692 517,641 559,634","#414dcd"],["534,692 479,718 517,641","#4d55e1"],["479,718 482,648 517,641","#464cca"],["479,718 428,716 482,648","#484ac2"],["428,716 450,653 482,648","#4042ae"],["428,716 388,714 450,653","#4a48bc"],["388,714 417,659 450,653","#5755dd"],["388,714 316,744 417,659","#5f58e4"],["316,744 385,665 417,659","#5e57e1"],["316,744 284,734 385,665","#544abe"],["284,734 346,672 385,665","#5c51d0"],["162,761 186,697 249,711","#1e244a"],["186,697 272,650 249,711","#1b1f41"],["186,697 211,628 272,650","#222b5d"],["211,628 284,617 272,650","#222b5d"],["211,628 231,571 284,617","#222e67"],["231,571 307,554 284,617","#1d2859"],["231,571 259,495 307,554","#26367c"],["259,495 322,518 307,554","#27377e"],["259,495 276,447 322,518","#293c8b"],["276,447 334,462 322,518","#25367f"],["276,447 303,375 334,462","#3650bd"],["303,375 347,412 334,462","#2f46a4"],["303,375 328,307 347,412","#334fbc"],["328,307 371,349 347,412","#3552c3"],["328,307 352,240 371,349","#3654c9"],["352,240 389,326 371,349","#3655cb"],["352,240 374,178 389,326","#3758d4"],["374,178 414,270 389,326","#3656d1"],["374,178 396,118 414,270","#456fff"],["396,118 418,221 414,270","#426aff"],["249,711 272,650 324,646","#1b2041"],["272,650 336,611 324,646","#161a35"],["272,650 284,617 336,611","#1c244e"],["284,617 348,579 336,611","#181f43"],["284,617 307,554 348,579","#1c2554"],["307,554 362,542 348,579","#1c2656"],["307,554 322,518 362,542","#253478"],["322,518 371,516 362,542","#22306f"],["322,518 334,462 371,516","#283a86"],["334,462 386,476 371,516","#273883"],["334,462 347,412 386,476","#263987"],["347,412 395,449 386,476","#223379"],["347,412 371,349 395,449","#2b429e"],["371,349 410,410 395,449","#263a8b"],["371,349 389,326 410,410","#2c44a4"],["389,326 421,378 410,410","#2b43a0"],["389,326 414,270 421,378","#3453c9"],["414,270 433,347 421,378","#2f4ab3"],["414,270 418,221 433,347","#3352c9"],["418,221 446,311 433,347","#3657d5"]];

  var TILE_MS = 360;
  var TILE_STEPS = 14;
  var TILE_STEP_MS = 20;
  var COVER_MS = TILE_MS + TILE_STEPS * TILE_STEP_MS;   /* ≈ 640 ms */
  var FOLD_MS = 280;

  function reducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  function rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  /* ---------- Polygon-Buttons ---------- */
  function facetSvg(cols, palette, seed) {
    var r = rng(seed);
    var W = 24, H = 24;
    var svg = el("svg", { class: "facets", viewBox: "0 0 " + cols * W + " 48", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
    for (var row = 0; row < 2; row++) {
      for (var c = 0; c < cols; c++) {
        var x = c * W, y = row * H, flip = (c + row) % 2 === 0;
        var a = flip ? [[x, y], [x + W, y], [x, y + H]] : [[x, y], [x + W, y], [x + W, y + H]];
        var b = flip ? [[x + W, y], [x + W, y + H], [x, y + H]] : [[x, y], [x + W, y + H], [x, y + H]];
        /* Aussen zuerst falten, zur Mitte hin später */
        var dist = Math.abs(c + 0.5 - cols / 2) / (cols / 2);
        var delay = Math.round((1 - dist) * 9) * 22;
        [a, b].forEach(function (t) {
          var p = el("polygon", { points: t.map(function (q) { return q.join(","); }).join(" "), fill: palette[Math.floor(r() * palette.length)] });
          p.style.transitionDelay = delay + "ms";
          svg.appendChild(p);
        });
      }
    }
    return svg;
  }

  function enhanceButtons(root) {
    root = root || document;
    var list = Array.prototype.slice.call(root.querySelectorAll(BUTTONS));
    if (root.matches && root.matches(BUTTONS)) list.unshift(root);
    Array.prototype.forEach.call(list, function (btn, i) {
      if (btn.dataset.facets === "on" && btn.querySelector('.facets') && btn.querySelector('.button-label')) return;
      btn.dataset.facets = "on";
      var label = document.createElement("span");
      label.className = "button-label";
      while (btn.firstChild) label.appendChild(btn.firstChild);
      var primary = btn.classList.contains("primary");
      var cols = btn.classList.contains("nav-cta") ? 8 : 12;
      btn.appendChild(facetSvg(cols, primary ? PRIMARY : SECONDARY, 5 + i * 2));
      btn.appendChild(label);
      /* Nicht-navigierende Buttons (Formulare, Filter) falten nur kurz als Rückmeldung */
      if (btn.tagName === "BUTTON" && !btn.hasAttribute("data-no-fold") && !boundButtons.has(btn)) {
        boundButtons.add(btn);
        btn.addEventListener("click", function () { pressFold(btn); });
      }
    });
  }

  function pressFold(btn) {
    if (reducedMotion() || btn.classList.contains("is-folding")) return;
    btn.classList.add("is-folding");
    window.setTimeout(function () { btn.classList.remove("is-folding"); }, 560);
  }

  /* ---------- Überblendung aus Dreiecken ---------- */
  function buildOverlay(originX, originY, mode) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var S = 128, h = S * 0.866;
    var cols = Math.ceil(vw / (S / 2)) + 2, rows = Math.ceil(vh / h) + 1;
    var maxD = Math.hypot(vw, vh) * 0.75;
    var r = rng(Math.round(originX * 7 + originY * 13) + 1);
    var svg = el("svg", { class: "fold-overlay " + mode, viewBox: "0 0 " + vw + " " + vh, preserveAspectRatio: "none", "aria-hidden": "true" });
    for (var row = 0; row < rows; row++) {
      for (var c = 0; c < cols; c++) {
        var x = c * S / 2 - S / 2, y = row * h, up = (row + c) % 2 === 0;
        var pts = up ? [[x, y + h], [x + S / 2, y], [x + S, y + h]] : [[x, y], [x + S, y], [x + S / 2, y + h]];
        var d = Math.min(TILE_STEPS, Math.floor(Math.hypot(x + S / 2 - originX, y + h / 2 - originY) / maxD * TILE_STEPS));
        var p = el("polygon", {
          points: pts.map(function (q) { return Math.round(q[0]) + "," + Math.round(q[1]); }).join(" "),
          fill: TILE_COLORS[Math.floor(r() * TILE_COLORS.length)]
        });
        p.style.animationDelay = d * TILE_STEP_MS + "ms";
        svg.appendChild(p);
      }
    }
    document.body.appendChild(svg);
    return svg;
  }

  function isFoldableLink(a, event) {
    if (!a || !a.href) return false;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-fold")) return false;
    var url = new URL(a.href, location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false; /* Anker auf derselben Seite */
    return true;
  }

  function onClick(event) {
    var a = event.target.closest ? event.target.closest("a") : null;
    if (!a || !a.matches(FOLD_LINKS) || !isFoldableLink(a, event)) return;
    if (reducedMotion()) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    var destination = a.href;
    var rect = a.getBoundingClientRect();
    var ox = event.detail ? event.clientX : rect.left + rect.width / 2;
    var oy = event.detail ? event.clientY : rect.top + rect.height / 2;
    var isButton = a.matches(BUTTONS);
    if (isButton) a.classList.add("is-folding");
    navigationTimers.push(window.setTimeout(function () {
      buildOverlay(ox, oy, "is-covering");
      navigationTimers.push(window.setTimeout(function () {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ x: ox / window.innerWidth, y: oy / window.innerHeight, t: Date.now() }));
        } catch (e) { /* ohne Storage: neue Seite erscheint einfach ohne Entfalten */ }
        window.location.href = destination;
      }, COVER_MS));
    }, isButton ? FOLD_MS : 0));
    // A canceled navigation must not leave the old page covered or its links locked.
    navigationTimers.push(window.setTimeout(resetTransition, 5000));
  }

  function revealIfPending() {
    var raw = null;
    try { raw = sessionStorage.getItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY); } catch (e) { raw = null; }
    var root = document.documentElement;
    if (!raw || reducedMotion()) { root.classList.remove("fold-pending"); return; }
    var data;
    try { data = JSON.parse(raw); } catch (e) { data = null; }
    if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y) || !Number.isFinite(data.t) || data.x < 0 || data.x > 1 || data.y < 0 || data.y > 1 || Date.now() - data.t > 5000 || data.t > Date.now()) { root.classList.remove("fold-pending"); return; }
    var svg = buildOverlay(data.x * window.innerWidth, data.y * window.innerHeight, "is-revealing");
    root.classList.remove("fold-pending");
    window.setTimeout(function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }, COVER_MS + 120);
  }

  /* Zurück-Taste (bfcache): Überblendung und gefaltete Buttons zurücksetzen */
  function resetTransition() {
    navigating = false;
    navigationTimers.forEach(window.clearTimeout);
    navigationTimers = [];
    Array.prototype.forEach.call(document.querySelectorAll(".fold-overlay"), function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(document.querySelectorAll(".is-folding"), function (n) { n.classList.remove("is-folding"); });
    document.documentElement.classList.remove("fold-pending");
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* Storage is optional. */ }
  }

  function resetAfterBack(event) {
    if (event.persisted) resetTransition();
  }

  /* ---------- Prisma ---------- */
  var PRISM_CENTERS = PRISM.map(function (entry) {
    var v = entry[0].split(" ").map(function (q) { return q.split(",").map(Number); });
    return [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3];
  });

  function renderPrism(host) {
    if (host.dataset.prismReady === "on") return;
    host.dataset.prismReady = "on";
    var mirrored = host.hasAttribute("data-prism-mirror");
    var svg = el("svg", { viewBox: "150 90 760 720", "aria-hidden": "true", focusable: "false" });
    if (mirrored) svg.style.transform = "scaleX(-1)";
    var g = el("g", { stroke: "#c9c2ff", "stroke-opacity": "0.22", "stroke-width": "0.7", "stroke-linejoin": "round" });
    var polys = PRISM.map(function (entry) {
      var p = el("polygon", { points: entry[0], fill: entry[1] });
      g.appendChild(p);
      return p;
    });
    svg.appendChild(g);
    host.appendChild(svg);

    host.addEventListener("click", function (event) {
      if (reducedMotion()) return;
      var x, y;
      if (event.detail !== 0) {
        var r = host.getBoundingClientRect();
        var fx = mirrored ? (r.right - event.clientX) / r.width : (event.clientX - r.left) / r.width;
        x = 150 + fx * 760;
        y = 90 + (event.clientY - r.top) / r.height * 720;
      } else {
        var c = PRISM_CENTERS[Math.floor(Math.random() * PRISM_CENTERS.length)];
        x = c[0]; y = c[1];
      }
      PRISM_CENTERS
        .map(function (c, i) { return { i: i, d: Math.hypot(c[0] - x, c[1] - y) }; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 14)
        .forEach(function (item, k) {
          var p = polys[item.i];
          p.classList.remove("is-folding");
          void p.getBBox();                 /* Animation neu starten */
          p.style.animationDelay = Math.min(9, Math.floor(k * 0.7)) * 35 + "ms";
          p.classList.add("is-folding");
        });
    });
  }

  function init() {
    enhanceButtons(document);
    Array.prototype.forEach.call(document.querySelectorAll("[data-prism]"), renderPrism);
    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", resetAfterBack);
    window.addEventListener("pagehide", function () {
      navigationTimers.forEach(window.clearTimeout);
      navigationTimers = [];
    });
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener('change', function (event) {
      if (event.matches) resetTransition();
    });
    revealIfPending();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  /* Für dynamisch nachgeladene Inhalte (z. B. Marketplace-Listen) */
  window.imagonyMotion = { enhanceButtons: enhanceButtons };
})();
