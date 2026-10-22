/*
 * Webflow site-wide footer code, after this file is deployed:
 * <link rel="stylesheet" href="https://www.mommamari.com/portal/seasonal/embed.css">
 * <script src="https://www.mommamari.com/portal/seasonal/embed.js" defer></script>
 */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount();
})(function () {
  var TIME_ZONE = "America/New_York";
  var THEMES = [
    { id: "halloween", start: "2026-10-01T00:00:00", end: "2026-11-01T23:59:59", preview: false },
    { id: "thanksgiving", start: "2026-11-20T00:00:00", end: "2026-11-29T23:59:59", preview: true },
    { id: "hanukkah", start: "2026-12-04T00:00:00", end: "2026-12-12T23:59:59", preview: true },
    { id: "christmas", start: "2026-12-13T00:00:00", end: "2026-12-26T23:59:59", preview: true },
    { id: "new-year", start: "2026-12-31T00:00:00", end: "2027-01-02T23:59:59", preview: true },
    { id: "valentines", start: "2027-02-08T00:00:00", end: "2027-02-15T23:59:59", preview: true },
    { id: "st-patricks", start: "2027-03-10T00:00:00", end: "2027-03-17T23:59:59", preview: true },
    { id: "easter", start: "2027-03-21T00:00:00", end: "2027-04-04T23:59:59", preview: true },
    { id: "mothers-day", start: "2027-05-03T00:00:00", end: "2027-05-09T23:59:59", preview: true },
    { id: "fathers-day", start: "2027-06-14T00:00:00", end: "2027-06-20T23:59:59", preview: true },
    { id: "summer", start: "2027-06-28T00:00:00", end: "2027-07-05T23:59:59", preview: true },
    { id: "back-to-school", start: "2027-08-16T00:00:00", end: "2027-09-30T23:59:59", preview: true },
  ];
  var SCENES = {
    halloween: { desktop: "halloween-site.svg", mobile: "halloween-mobile.svg" },
    thanksgiving: { desktop: "thanksgiving-site.svg", mobile: "thanksgiving-mobile.svg" },
    hanukkah: { desktop: "hanukkah-site.svg", mobile: "hanukkah-mobile.svg" },
    christmas: { desktop: "christmas-site.svg", mobile: "christmas-mobile.svg" },
    "new-year": { desktop: "new-year-site.svg", mobile: "new-year-mobile.svg" },
    valentines: { desktop: "valentines-site.svg", mobile: "valentines-mobile.svg" },
    "st-patricks": { desktop: "st-patricks-site.svg", mobile: "st-patricks-mobile.svg" },
    easter: { desktop: "easter-site.svg", mobile: "easter-mobile.svg" },
    "mothers-day": { desktop: "mothers-day-site.svg", mobile: "mothers-day-mobile.svg" },
    "fathers-day": { desktop: "fathers-day-site.svg", mobile: "fathers-day-mobile.svg" },
    summer: { desktop: "summer-site.svg", mobile: "summer-mobile.svg" },
    "back-to-school": { desktop: "back-to-school-site.svg", mobile: "back-to-school-mobile.svg" },
  };
  var NIGHT = {
    halloween: true, hanukkah: true, christmas: true, "new-year": true, valentines: true, summer: true,
  };
  var FLOATERS = [
    { kind: "ghost", top: "14%", left: "12%", size: 120, duration: "22s", delay: "0s", drift: "a" },
    { kind: "ghost", top: "30%", left: "58%", size: 88, duration: "26s", delay: "-8s", drift: "b" },
    { kind: "bat", top: "10%", left: "36%", size: 56, duration: "18s", delay: "-4s", drift: "c" },
    { kind: "bat", top: "22%", left: "78%", size: 44, duration: "24s", delay: "-12s", drift: "a" },
    { kind: "ghost", top: "46%", left: "82%", size: 54, duration: "28s", delay: "-6s", drift: "c" },
  ];
  var LANTERNS = [
    { top: "62%", left: "74%", size: 150, delay: "0s" },
    { top: "70%", left: "86%", size: 110, delay: "-0.8s" },
  ];
  function drift(kind, top, left, size, duration, delay, name) {
    return { kind: kind, top: top, left: left, size: size, duration: duration, delay: delay, drift: name };
  }
  var CAST = {
    halloween: FLOATERS,
    thanksgiving: [
      drift("leaf", "6%", "10%", 58, "22s", "0s", "a"),
      drift("leaf", "14%", "28%", 36, "26s", "-4s", "b"),
      drift("leaf", "8%", "48%", 28, "20s", "-8s", "c"),
      drift("leaf", "18%", "66%", 44, "24s", "-2s", "a"),
      drift("leaf", "12%", "84%", 34, "28s", "-11s", "b"),
      drift("leaf", "28%", "16%", 40, "22s", "-6s", "c"),
      drift("leaf", "32%", "42%", 26, "30s", "-14s", "a"),
      drift("leaf", "24%", "74%", 32, "26s", "-1s", "b"),
    ],
    hanukkah: [
      drift("star", "8%", "18%", 42, "24s", "0s", "a"),
      drift("dreidel", "18%", "72%", 54, "26s", "-7s", "c"),
      drift("spark", "6%", "48%", 20, "20s", "-3s", "b"),
      drift("star", "28%", "30%", 28, "28s", "-11s", "a"),
      drift("dreidel", "14%", "88%", 40, "22s", "-5s", "b"),
      drift("spark", "34%", "60%", 16, "24s", "-9s", "c"),
    ],
    christmas: [
      drift("flake", "6%", "14%", 34, "20s", "0s", "a"),
      drift("flake", "16%", "70%", 26, "26s", "-8s", "c"),
      drift("flake", "28%", "36%", 22, "24s", "-4s", "b"),
      drift("flake", "10%", "88%", 30, "28s", "-12s", "a"),
      drift("flake", "34%", "56%", 18, "22s", "-2s", "c"),
    ],
    "new-year": [
      drift("spark", "8%", "12%", 36, "18s", "0s", "a"),
      drift("burst", "14%", "62%", 44, "24s", "-6s", "c"),
      drift("spark", "26%", "34%", 22, "22s", "-3s", "b"),
      drift("burst", "10%", "84%", 30, "28s", "-11s", "a"),
      drift("spark", "32%", "48%", 18, "20s", "-2s", "c"),
    ],
    valentines: [
      drift("heart", "10%", "14%", 52, "22s", "0s", "a"),
      drift("heart", "22%", "76%", 36, "26s", "-7s", "c"),
      drift("petal", "8%", "48%", 28, "24s", "-3s", "b"),
      drift("heart", "30%", "28%", 30, "28s", "-12s", "a"),
      drift("petal", "18%", "62%", 22, "20s", "-5s", "c"),
    ],
    "st-patricks": [
      drift("clover", "12%", "16%", 48, "22s", "0s", "a"),
      drift("clover", "24%", "74%", 34, "26s", "-6s", "c"),
      drift("clover", "8%", "46%", 26, "20s", "-2s", "b"),
      drift("clover", "30%", "28%", 30, "28s", "-10s", "a"),
      drift("clover", "18%", "88%", 22, "24s", "-4s", "c"),
    ],
    easter: [
      drift("petal", "10%", "18%", 36, "22s", "0s", "a"),
      drift("petal", "22%", "72%", 26, "26s", "-5s", "c"),
      drift("petal", "8%", "48%", 22, "20s", "-9s", "b"),
      drift("petal", "30%", "30%", 28, "28s", "-3s", "a"),
      drift("petal", "16%", "86%", 20, "24s", "-7s", "c"),
    ],
    "mothers-day": [
      drift("petal", "10%", "16%", 40, "22s", "0s", "a"),
      drift("heart", "20%", "76%", 34, "26s", "-6s", "c"),
      drift("petal", "8%", "44%", 24, "20s", "-2s", "b"),
      drift("petal", "28%", "28%", 30, "28s", "-11s", "a"),
      drift("heart", "16%", "60%", 22, "24s", "-4s", "c"),
    ],
    "fathers-day": [
      drift("leaf", "10%", "18%", 44, "22s", "0s", "a"),
      drift("spark", "22%", "64%", 22, "18s", "-6s", "c"),
      drift("leaf", "8%", "42%", 30, "26s", "-3s", "b"),
      drift("leaf", "28%", "82%", 36, "28s", "-10s", "a"),
      drift("spark", "34%", "30%", 18, "20s", "-2s", "c"),
    ],
    summer: [
      drift("burst", "8%", "16%", 48, "20s", "0s", "a"),
      drift("spark", "18%", "58%", 24, "24s", "-6s", "c"),
      drift("burst", "12%", "82%", 36, "28s", "-2s", "b"),
      drift("spark", "28%", "34%", 20, "22s", "-9s", "a"),
      drift("burst", "6%", "46%", 28, "26s", "-4s", "c"),
    ],
    "back-to-school": [
      drift("leaf", "8%", "14%", 52, "22s", "0s", "a"),
      drift("apple", "20%", "70%", 36, "26s", "-6s", "c"),
      drift("leaf", "12%", "42%", 30, "24s", "-3s", "b"),
      drift("leaf", "28%", "84%", 40, "28s", "-11s", "a"),
      drift("apple", "32%", "24%", 26, "20s", "-2s", "c"),
    ],
  };
  var GLOW = {
    halloween: LANTERNS,
    thanksgiving: [{ top: "70%", left: "60%", size: 110, delay: "0s" }, { top: "72%", left: "64%", size: 80, delay: "-0.9s" }],
    hanukkah: [{ top: "36%", left: "50%", size: 180, delay: "0s" }, { top: "38%", left: "12%", size: 90, delay: "-1.1s" }],
    christmas: [{ top: "52%", left: "82%", size: 140, delay: "0s" }, { top: "48%", left: "18%", size: 100, delay: "-0.9s" }],
    "new-year": [{ top: "16%", left: "16%", size: 150, delay: "0s" }, { top: "14%", left: "72%", size: 130, delay: "-0.7s" }],
    valentines: [{ top: "46%", left: "78%", size: 100, delay: "0s" }],
    "fathers-day": [{ top: "62%", left: "60%", size: 120, delay: "0s" }],
    summer: [{ top: "14%", left: "14%", size: 150, delay: "0s" }, { top: "12%", left: "74%", size: 160, delay: "-0.9s" }],
    "back-to-school": [{ top: "42%", left: "32%", size: 100, delay: "0s" }],
  };
  var GLASS = { fill: "#200E3A", alpha: 0.68, mobileAlpha: 0.84, ink: "#F7F1FF", heading: "#FFF6EA", link: "#FFE7C2" };
  var scriptEl = typeof document !== "undefined" ? document.currentScript : null;
  var started = false;

  function wallKey(date) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (part) {
      if (part.type !== "literal") parts[part.type] = part.value;
    });
    var hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  }

  function instantKey(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new Error("Bad theme instant: " + value);
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  }

  function themeAt(now) {
    var key = wallKey(now);
    for (var i = 0; i < THEMES.length; i += 1) {
      var theme = THEMES[i];
      if (key >= instantKey(theme.start) && key <= instantKey(theme.end)) return theme;
    }
    return null;
  }

  function activeScene(now, preview) {
    if (preview && SCENES[preview]) {
      return { id: preview, desktop: SCENES[preview].desktop, mobile: SCENES[preview].mobile, night: !!NIGHT[preview] };
    }
    var theme = themeAt(now || new Date());
    if (!theme || theme.preview || !SCENES[theme.id]) return null;
    return { id: theme.id, desktop: SCENES[theme.id].desktop, mobile: SCENES[theme.id].mobile, night: !!NIGHT[theme.id] };
  }

  function previewFromLocation() {
    if (typeof window === "undefined") return null;
    if (window.__MM_THEME_PREVIEW__) return String(window.__MM_THEME_PREVIEW__);
    try {
      return new URLSearchParams(window.location.search).get("mm_preview");
    } catch (error) {
      return null;
    }
  }

  function shouldSkip(pathname) {
    var path = pathname || "/";
    if (path === "/portal" || path.indexOf("/portal/") === 0) return true;
    return false;
  }

  function asset(file) {
    var base = typeof window !== "undefined" && window.__MM_ASSET_BASE__;
    if (base) return base.replace(/\/?$/, "/") + file;
    if (scriptEl && scriptEl.src) return new URL(file, scriptEl.src).href;
    return file;
  }

  function glyph(kind) {
    if (kind === "bat") {
      return '<svg viewBox="0 0 72 40" aria-hidden="true"><path fill="#6B46A3" stroke="#1C1A1F" stroke-width="2" d="M36 20c-4-8-12-8-20-3 4 2 6 7 4 11 6-4 11-4 16-2 5-2 10-2 16 2-2-4 0-9 4-11-8-5-16-5-20 3z"/><ellipse cx="36" cy="22" rx="8" ry="7" fill="#F6F0FC" stroke="#1C1A1F" stroke-width="2"/><circle cx="33" cy="21" r="1.3" fill="#1C1A1F"/><circle cx="39" cy="21" r="1.3" fill="#1C1A1F"/></svg>';
    }
    if (kind === "leaf") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#E09A3A" stroke="#1C140E" stroke-width="2" d="M24 6c10 8 16 18 12 30-12-2-20-10-26-18C6 10 14 4 24 6z"/></svg>';
    if (kind === "star") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#F7FBFF" stroke="#1C2430" stroke-width="2" stroke-linejoin="round" d="M24 4 L40 32 H8 Z"/><path fill="#C9D4E4" stroke="#1C2430" stroke-width="2" stroke-linejoin="round" d="M24 44 L8 16 H40 Z"/></svg>';
    if (kind === "dreidel") return '<svg viewBox="0 0 48 64" aria-hidden="true"><rect x="21" y="2" width="6" height="16" rx="2" fill="#E8EEF6" stroke="#1C2430" stroke-width="2"/><path d="M24 16 L40 30 L24 58 L8 30 Z" fill="#24508C" stroke="#1C2430" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 34 h12 M24 28 v12" stroke="#F7FBFF" stroke-width="2"/></svg>';
    if (kind === "flake") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="#F7F1FF" stroke-width="2.4" stroke-linecap="round" d="M24 6v36M8 14l32 20M8 34l32-20"/></svg>';
    if (kind === "spark" || kind === "burst") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#E2B657" stroke="#1C140E" stroke-width="2" d="M24 4l4 14 14 2-12 8 4 14-10-8-10 8 4-14L6 20l14-2z"/></svg>';
    if (kind === "heart") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#E7A0B4" stroke="#1C140E" stroke-width="2" d="M24 40C8 28 6 16 14 12c6-3 10 2 10 2s4-5 10-2c8 4 6 16-10 28z"/></svg>';
    if (kind === "clover") return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="7" fill="#3E9A56" stroke="#0C1812" stroke-width="2"/><circle cx="15" cy="26" r="7" fill="#3E9A56" stroke="#0C1812" stroke-width="2"/><circle cx="33" cy="26" r="7" fill="#2F7A44" stroke="#0C1812" stroke-width="2"/></svg>';
    if (kind === "apple") return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="28" r="12" fill="#C4453A" stroke="#1C140E" stroke-width="2"/><path d="M24 16c2-6 8-8 10-6" fill="none" stroke="#1E6A48" stroke-width="2"/></svg>';
    if (kind === "petal") return '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="26" rx="8" ry="12" fill="#F4C7D4" stroke="#1C140E" stroke-width="2" transform="rotate(-20 24 26)"/></svg>';
    return '<svg viewBox="0 0 64 72" aria-hidden="true"><path fill="#FFF8F1" stroke="#1C1A1F" stroke-width="2.5" d="M14 34c0-12 8-22 18-22s18 10 18 22v26l-6-6-6 6-6-6-6 6-6-6-6 6V34z"/><circle cx="26" cy="34" r="2.6" fill="#1C1A1F"/><circle cx="40" cy="34" r="2.6" fill="#1C1A1F"/><path d="M28 44c2.2 2.6 5.8 2.6 8 0" fill="none" stroke="#1C1A1F" stroke-width="2"/></svg>';
  }

  function harvestPiece(kind) {
    if (kind === "gourd") {
      return '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="40" rx="16" ry="11" fill="#E8C56A" stroke="#1C140E" stroke-width="3"/><path d="M32 29c3-12 12-14 8-20" fill="none" stroke="#2F6A36" stroke-width="3" stroke-linecap="round"/><path d="M18 40h28" stroke="#C4926A" stroke-width="2"/></svg>';
    }
    if (kind === "maple") {
      return '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#C4453A" stroke="#1C140E" stroke-width="3" d="M32 6c6 10 16 12 22 6 4 8 2 16-6 18 8 4 10 14 4 20-8-2-14 2-16 10-2-8-8-12-16-10-6-6-4-16 4-20-8-2-10-10-6-18 6 6 16 4 22-6z"/><path d="M32 28v28" stroke="#6B3414" stroke-width="3" stroke-linecap="round"/></svg>';
    }
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#E09A3A" stroke="#1C140E" stroke-width="3" d="M34 8c14 10 22 24 16 40-16-2-28-14-36-26C8 10 18 4 34 8z"/><path d="M30 22c6 8 8 16 6 26" fill="none" stroke="#6B3414" stroke-width="2.4"/></svg>';
  }

  function harvestFrame() {
    var pieces = [
      ["maple", "top:0;left:0", "-18deg", 86],
      ["gourd", "top:0;left:13%", "12deg", 56],
      ["leaf", "top:1%;left:28%", "-8deg", 44],
      ["maple", "top:0;right:16%", "16deg", 68],
      ["gourd", "top:0;right:0", "-12deg", 58],
      ["leaf", "top:22%;left:0", "22deg", 64],
      ["gourd", "top:48%;left:0", "-8deg", 52],
      ["maple", "top:18%;right:0", "-20deg", 74],
      ["leaf", "top:42%;right:0", "14deg", 56],
      ["gourd", "bottom:2%;left:2%", "10deg", 60],
      ["maple", "bottom:0;right:1%", "18deg", 70],
      ["leaf", "bottom:3%;left:42%", "-10deg", 48],
    ];
    return pieces.map(function (piece) {
      return '<span class="mm-harvest" style="' + piece[1] + ";width:" + piece[3] + "px;height:" + piece[3] + "px;transform:rotate(" + piece[2] + ')">' + harvestPiece(piece[0]) + "</span>";
    }).join("");
  }

  function lightFrame() {
    var colors = ["#C4453A", "#E2B657", "#F7F1FF", "#3E9A56", "#FFE7A8"];
    var bulbs = [];
    function add(style, index) {
      bulbs.push('<span class="mm-bulb" style="' + style + ";background:" + colors[index % colors.length] + ";animation-delay:" + ((index % 6) * -0.28) + 's"></span>');
    }
    var across = 16;
    var down = 9;
    var i;
    for (i = 0; i < across; i += 1) {
      add("top:92px;left:" + (4 + i * (92 / (across - 1))) + "%", i);
      add("bottom:12px;left:" + (5 + i * (90 / (across - 1))) + "%", i + 2);
    }
    for (i = 0; i < down; i += 1) {
      add("left:12px;top:" + (8 + i * (84 / (down - 1))) + "%", i + 1);
      add("right:12px;top:" + (8 + i * (84 / (down - 1))) + "%", i + 3);
    }
    return '<span class="mm-light-wire mm-light-wire-top"></span><span class="mm-light-wire mm-light-wire-bottom"></span><span class="mm-light-wire mm-light-wire-left"></span><span class="mm-light-wire mm-light-wire-right"></span>' + bulbs.join("");
  }

  function web() {
    return '<svg class="mm-web mm-web-LEFT" viewBox="0 0 140 140" aria-hidden="true"><g fill="none" stroke="#E6D8F6" stroke-width="1.3" stroke-linecap="round"><path d="M6 8 C 48 18, 86 28, 132 14"/><path d="M6 8 C 18 52, 28 92, 16 132"/><path d="M6 8 L 126 118"/><path d="M6 8 L 78 132"/><path d="M6 8 L 132 70"/></g></svg>';
  }

  function channel(value) {
    value = value / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function luminance(rgb) {
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function parseColor(value) {
    var match = /rgba?\(([^)]+)\)/.exec(value || "");
    if (!match) return null;
    var parts = match[1].split(",").map(function (part) { return Number(part.trim()); });
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length === 4 ? parts[3] : 1 };
  }

  function preserved(el) {
    return Boolean(el.closest && el.closest("a.b1, .availability-button, .mm-band-btn-light, .mm-band-btn-ghost, button, input, textarea, select"));
  }

  function glassed(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      if (node.getAttribute && node.getAttribute("data-mm-glass") === "true") return true;
      if (node === document.body) return true;
      var style = window.getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") return false;
      var bg = parseColor(style.backgroundColor);
      if (bg && bg.a >= 0.85 && node.getAttribute("data-mm-glass") !== "true") return false;
      node = node.parentElement;
    }
    return true;
  }

  function paint() {
    var nodes = document.body.querySelectorAll("*");
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (el.closest(".mm-scene") || preserved(el)) continue;
      var tag = el.tagName;
      if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SVG" || tag === "PICTURE" || tag === "SOURCE" || tag === "IFRAME") continue;
      var style = window.getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage !== "none") continue;
      var bg = parseColor(style.backgroundColor);
      var rect = el.getBoundingClientRect();
      var fixed = style.position === "fixed" || style.position === "sticky";
      var large = rect.width >= 160 && rect.height >= 64;
      var bar = fixed && rect.width >= 240 && rect.height >= 48;
      if ((bg && bg.a >= 0.85 && large) || (bar && (!bg || bg.a < 0.5))) el.setAttribute("data-mm-glass", "true");
    }
    for (i = 0; i < nodes.length; i += 1) {
      var text = nodes[i];
      if (text.closest(".mm-scene") || preserved(text)) continue;
      var textTag = text.tagName;
      if (textTag === "IMG" || textTag === "VIDEO" || textTag === "SVG" || textTag === "CANVAS") continue;
      if (!glassed(text)) continue;
      var color = parseColor(window.getComputedStyle(text).color);
      if (!color || luminance(color) >= 0.55) continue;
      var next = /^H[1-3]$/.test(textTag) ? GLASS.heading : (textTag === "A" ? GLASS.link : GLASS.ink);
      text.style.setProperty("color", next, "important");
    }
  }

  function wallParts(date) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (part) {
      if (part.type !== "literal") parts[part.type] = part.value;
    });
    var hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: hour,
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  }

  function parseHanukkahNight(value) {
    if (value == null || !/^[0-8]$/.test(String(value))) return null;
    return Number(value);
  }

  function hanukkahLabel(night, daysUntil) {
    if (night <= 0) {
      var days = daysUntil == null ? 0 : daysUntil;
      if (days === 0) return "Hanukkah begins at sundown";
      if (days === 1) return "1 day until Hanukkah";
      return days + " days until Hanukkah";
    }
    if (night === 1) return "Night 1 · the shamash and one candle";
    return "Night " + night + " · the shamash and " + night + " candles";
  }

  function hanukkahView(now, nightOverride) {
    var parts = wallParts(now || new Date());
    var key = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    var first = Date.UTC(2026, 11, 4, 17, 0, 0);
    var today = Date.UTC(parts.year, parts.month - 1, parts.day);
    var startDay = Date.UTC(2026, 11, 4);
    var daysUntil = Math.max(0, Math.round((startDay - today) / 86400000));
    var night;
    if (nightOverride !== null && nightOverride !== undefined && nightOverride >= 0 && nightOverride <= 8) night = nightOverride;
    else if (key < first) night = 0;
    else night = Math.min(8, Math.floor((key - first) / 86400000) + 1);
    var candles = [];
    var fromLeft;
    for (fromLeft = 0; fromLeft < 8; fromLeft += 1) {
      var placedNight = 8 - fromLeft;
      var lit = night > 0 && placedNight <= night;
      candles.push({
        night: placedNight,
        fromLeft: fromLeft,
        lit: lit,
        lightIndex: lit ? fromLeft - (8 - night) : null,
      });
    }
    return {
      night: night,
      daysUntil: night === 0 ? daysUntil : null,
      shamashLit: night > 0,
      candles: candles,
      label: hanukkahLabel(night, night === 0 ? daysUntil : null),
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch];
    });
  }

  function menorahMarkup(view) {
    var branches = [
      [40, 190, 8], [86, 180, -5], [132, 172, 7], [176, 166, -3],
      [284, 165, 4], [330, 171, -6], [376, 180, 5], [422, 191, -4],
    ];
    var parts = [];
    parts.push('<path d="M158 232 C196 220 268 222 304 234 L316 262 C248 274 196 272 146 260 Z" fill="#D5DEEA" stroke="#1C2430" stroke-width="3"/>');
    parts.push('<path d="M214 230 L207 156 C220 150 242 150 254 156 L246 230 Z" fill="#B7C6DA" stroke="#1C2430" stroke-width="3"/>');
    parts.push('<rect x="132" y="258" width="196" height="18" rx="7" fill="#F4F7FB" stroke="#1C2430" stroke-width="3"/>');
    function arm(x, y, bend) {
      var midX = 230 + (x - 230) * 0.42;
      var midY = Math.min(y, 168) - 18 + bend;
      return "M230 214 C " + (230 + bend) + " " + (y + 10) + ", " + midX + " " + midY + ", " + x + " " + y;
    }
    branches.forEach(function (branch) {
      parts.push('<path d="' + arm(branch[0], branch[1], branch[2]) + '" fill="none" stroke="#D5DEEA" stroke-width="7" stroke-linecap="round"/>');
    });
    function flame(delay) {
      return '<g class="mm-flame" style="animation-delay:' + delay + 's,' + (delay + 0.45) + 's"><ellipse cx="0" cy="2" rx="11" ry="16" fill="#FFE7A8" opacity="0.55"/><path d="M0 14 C7 4 5 -8 9 -22 C2 -10 -3 -4 -5 2 C-3 8 -2 12 0 14 Z" fill="#FFE7A8" stroke="#C4922A" stroke-width="1.5"/><path d="M0 10 C3 2 2 -4 4 -10 C1 -4 -1 0 -2 4 C-1 7 -1 9 0 10 Z" fill="#FFFDF8"/></g>';
    }
    branches.forEach(function (branch, index) {
      var candle = view.candles[index];
      var body = '<ellipse cx="0" cy="2" rx="11" ry="5" fill="#F4F7FB" stroke="#1C2430" stroke-width="2.4"/>';
      if (candle.lit) {
        var delay = 0.28 + candle.lightIndex * 0.16;
        body += '<rect x="-6.5" y="-36" width="13" height="40" rx="3" fill="#F7FBFF" stroke="#1C2430" stroke-width="2.3"/>';
        body += '<g transform="translate(0 -36)">' + flame(delay) + "</g>";
      }
      parts.push('<g transform="translate(' + branch[0] + " " + branch[1] + ')">' + body + "</g>");
    });
    parts.push('<ellipse cx="230" cy="126" rx="12" ry="5.5" fill="#F4F7FB" stroke="#1C2430" stroke-width="2.4"/>');
    if (view.shamashLit) {
      parts.push('<g transform="translate(230 124)"><rect x="-7" y="-46" width="14" height="48" rx="3" fill="#F7FBFF" stroke="#1C2430" stroke-width="2.4"/><g transform="translate(0 -46)">' + flame(0.05) + "</g></g>");
    }
    if (view.night === 0) {
      var tag = view.daysUntil === 0 ? "Tonight" : String(view.daysUntil);
      parts.push('<g transform="translate(230 78)"><ellipse cx="0" cy="0" rx="58" ry="30" fill="#F7FBFF" stroke="#1C2430" stroke-width="3"/><text x="0" y="8" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="26" fill="#16325C" font-weight="700">' + escapeHtml(tag) + "</text></g>");
    }
    return '<div class="mm-menorah" data-hanukkah-night="' + view.night + '"><svg class="mm-menorah-art" viewBox="0 0 460 300" aria-hidden="true">' + parts.join("") + '</svg><p class="mm-menorah-label">' + escapeHtml(view.label) + "</p></div>";
  }

  function build(scene) {
    var mobile = window.matchMedia("(max-width: 820px)").matches;
    var file = mobile ? scene.mobile : scene.desktop;
    var root = document.createElement("div");
    root.className = "mm-scene";
    root.setAttribute("data-theme", scene.id);
    root.setAttribute("data-night", scene.night ? "true" : "false");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = '<div class="mm-sky"></div><div class="mm-stars mm-stars-far"></div><div class="mm-stars mm-stars-near"></div><div class="mm-moon"></div>';
    var img = document.createElement("img");
    img.className = "mm-art";
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.setAttribute("fetchpriority", "low");
    var host = window;
    var place = function () { img.src = asset(file); };
    if (host.requestIdleCallback) host.requestIdleCallback(place, { timeout: 700 });
    else window.setTimeout(place, 1);
    root.appendChild(img);
    (GLOW[scene.id] || []).forEach(function (item) {
      var glow = document.createElement("span");
      glow.className = "mm-lantern";
      glow.style.top = item.top;
      glow.style.left = item.left;
      glow.style.width = item.size + "px";
      glow.style.height = item.size + "px";
      glow.style.animationDelay = item.delay;
      root.appendChild(glow);
    });
    (CAST[scene.id] || []).forEach(function (item) {
      var floater = document.createElement("span");
      floater.className = "mm-floater mm-floater-" + item.kind + " mm-drift-" + item.drift;
      floater.style.top = item.top;
      floater.style.left = item.left;
      floater.style.width = item.size + "px";
      floater.style.height = (item.kind === "bat" ? item.size * 0.56 : item.size) + "px";
      floater.style.animationDuration = item.duration;
      floater.style.animationDelay = item.delay;
      floater.innerHTML = glyph(item.kind);
      root.appendChild(floater);
    });
    if (scene.id === "halloween") {
      var left = web().replace("mm-web-LEFT", "mm-web-left");
      var right = web().replace("mm-web-LEFT", "mm-web-right");
      root.insertAdjacentHTML("beforeend", left + right);
    }
    if (scene.id === "thanksgiving") root.insertAdjacentHTML("beforeend", harvestFrame());
    if (scene.id === "christmas") root.insertAdjacentHTML("beforeend", lightFrame());
    if (scene.id === "hanukkah") {
      var night = null;
      try {
        night = parseHanukkahNight(new URLSearchParams(window.location.search).get("mm_night"));
      } catch (error) {
        night = null;
      }
      root.insertAdjacentHTML("beforeend", menorahMarkup(hanukkahView(new Date(), night)));
    }
    return root;
  }

  var RANK_LABELS = ["Seedling", "Sprout", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Ruby", "Sapphire", "Diamond"];
  var RANK_IDS = ["seedling", "sprout", "bronze", "silver", "gold", "platinum", "emerald", "ruby", "sapphire", "diamond"];
  var RANK_HOW = "How to reach this rank: details coming soon";
  var RANK_INTRO = "Ranks reflect a 0-100 creator score. How each rank is reached is coming soon.";
  var STORY_IMAGE = "https://cdn.prod.website-files.com/6930c02a157263872fbd655d/6ad2680fd6b2cc409007c310_maclamroc-mariclare-image%5B1%5D.jpg";
  var FOUNDER_IMAGE = "https://cdn.prod.website-files.com/6930c02a157263872fbd655d/6ad268743448708cf2d55775_authentickam-image%5B1%5D.jpg";
  var STORY_ALT = "MariClare, Momma Mari creator";
  var FOUNDER_ALT = "Kamron Santo, founder of Momma Mari";
  var publishedFixed = false;

  function classText(el) {
    var value = el && el.className;
    return typeof value === "string" ? value : "";
  }

  function insideTrail(el, root) {
    var node = el.parentNode;
    while (node && node !== root) {
      var cls = classText(node);
      if (cls.indexOf("trail-collection") !== -1 || cls.indexOf("mobile-images") !== -1) return true;
      node = node.parentNode;
    }
    return false;
  }

  function remember(list, el) {
    var i;
    if (!el) return;
    for (i = 0; i < list.length; i += 1) if (list[i] === el) return;
    list.push(el);
  }

  function careerRoots(doc) {
    var roots = [];
    var marked = doc.querySelectorAll('[trail-image="component"]');
    var i;
    var h;
    for (i = 0; i < marked.length; i += 1) remember(roots, marked[i]);
    var sections = doc.querySelectorAll("section");
    for (i = 0; i < sections.length; i += 1) {
      var headings = sections[i].querySelectorAll("h1, h2, h3");
      var match = false;
      for (h = 0; h < headings.length; h += 1) {
        if ((headings[h].textContent || "").indexOf("Ready to Grow Your Creator Career") !== -1) match = true;
      }
      if (!match) continue;
      remember(roots, sections[i].querySelector(".content-cta") || sections[i]);
    }
    return roots;
  }

  function calmCareerSections(doc) {
    var roots = careerRoots(doc);
    var r;
    for (r = 0; r < roots.length; r += 1) {
      var root = roots[r];
      if (root.hasAttribute && root.hasAttribute("trail-image") && root.parentNode) {
        var copy = root.cloneNode(true);
        root.parentNode.replaceChild(copy, root);
        root = copy;
      }
      if (root.removeAttribute) root.removeAttribute("trail-image");
      var lists = root.querySelectorAll('[trail-image="list"]');
      var n;
      for (n = 0; n < lists.length; n += 1) lists[n].removeAttribute("trail-image");
      var trails = root.querySelectorAll(".trail-collection, .mobile-images");
      for (n = 0; n < trails.length; n += 1) {
        trails[n].setAttribute("hidden", "hidden");
        trails[n].style.display = "none";
      }
      if (root.querySelector(".mm-cta-still")) continue;
      var images = root.querySelectorAll("img");
      var loose = null;
      for (n = 0; n < images.length; n += 1) {
        if (!insideTrail(images[n], root)) loose = images[n];
      }
      if (loose) continue;
      var figure = doc.createElement("figure");
      figure.className = "mm-cta-still";
      var image = doc.createElement("img");
      image.setAttribute("src", STORY_IMAGE);
      image.setAttribute("alt", STORY_ALT);
      image.setAttribute("decoding", "async");
      figure.appendChild(image);
      var button = root.querySelector(".cta-button");
      if (button && button.parentNode === root) root.insertBefore(figure, button);
      else root.appendChild(figure);
    }
  }

  function rewriteRankCards(doc) {
    var boxes = doc.querySelectorAll(".income-tiers-box-wrapper");
    if (!boxes.length) return;
    var headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6, .centered-heading");
    var i;
    for (i = 0; i < headings.length; i += 1) {
      if ((headings[i].textContent || "").indexOf("Creator Income Tiers") !== -1) headings[i].textContent = "Creator Ranks";
    }
    var subs = doc.querySelectorAll(".sub-heading");
    for (i = 0; i < subs.length; i += 1) {
      if (/monthly income/i.test(subs[i].textContent || "")) subs[i].textContent = RANK_INTRO;
    }
    for (i = 0; i < boxes.length && i < RANK_LABELS.length; i += 1) {
      var box = boxes[i];
      var name = box.querySelector(".desination");
      if (name) name.textContent = RANK_LABELS[i];
      var line = box.querySelector(".paragraph-4");
      if (line) line.textContent = RANK_HOW;
      var reson = box.querySelector(".reson");
      if (reson) {
        reson.textContent = "";
        reson.setAttribute("hidden", "hidden");
        reson.style.display = "none";
      }
      box.setAttribute("data-mm-rank", RANK_IDS[i]);
    }
  }

  function usePhoto(img, src, alt) {
    if ((img.getAttribute("src") || "") !== src) img.setAttribute("src", src);
    img.removeAttribute("srcset");
    img.setAttribute("alt", alt);
  }

  function swapStoryPhotos(doc) {
    var stories = doc.querySelectorAll("img.about-img");
    var i;
    for (i = 0; i < stories.length; i += 1) {
      var src = stories[i].getAttribute("src") || "";
      var alt = stories[i].getAttribute("alt") || "";
      var neon = /Neon Portrait/i.test(src) || /Neon Portrait/i.test(alt) || /Momma Mari story/i.test(alt);
      var ours = src.indexOf("6ad2680fd6b2cc409007c310") !== -1;
      if (!neon && !ours) continue;
      usePhoto(stories[i], STORY_IMAGE, STORY_ALT);
    }
    var cards = doc.querySelectorAll(".our-team-card");
    for (i = 0; i < cards.length; i += 1) {
      var who = cards[i].querySelector(".course-details-text");
      if (!who || (who.textContent || "").indexOf("Kamron Santo") === -1) continue;
      var photo = cards[i].querySelector("img");
      if (!photo) continue;
      usePhoto(photo, FOUNDER_IMAGE, FOUNDER_ALT);
    }
  }

  function applyPublishedFixes(doc) {
    calmCareerSections(doc);
    rewriteRankCards(doc);
    swapStoryPhotos(doc);
  }

  function presentPublishedSite() {
    if (publishedFixed || typeof document === "undefined") return;
    if (shouldSkip(window.location.pathname)) return;
    publishedFixed = true;
    applyPublishedFixes(document);
  }

  function mount() {
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
      return;
    }
    presentPublishedSite();
    if (started || document.querySelector(".mm-scene")) return;
    if (document.documentElement.getAttribute("data-seasonal")) return;
    if (shouldSkip(window.location.pathname)) return;
    var scene = activeScene(new Date(), previewFromLocation());
    if (!scene) return;
    started = true;
    document.documentElement.classList.add("mm-seasonal");
    document.documentElement.setAttribute("data-mm-theme", scene.id);
    document.body.insertBefore(build(scene), document.body.firstChild);
    paint();
  }

  return {
    THEMES: THEMES,
    SCENES: SCENES,
    FLOATERS: FLOATERS,
    NIGHT: NIGHT,
    GLASS: GLASS,
    themeAt: themeAt,
    activeScene: activeScene,
    shouldSkip: shouldSkip,
    hanukkahView: hanukkahView,
    mount: mount,
    RANK_LABELS: RANK_LABELS,
    RANK_HOW: RANK_HOW,
    RANK_INTRO: RANK_INTRO,
    STORY_IMAGE: STORY_IMAGE,
    FOUNDER_IMAGE: FOUNDER_IMAGE,
    applyPublishedFixes: applyPublishedFixes,
  };
});
