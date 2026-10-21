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
    { id: "christmas", start: "2026-12-20T00:00:00", end: "2026-12-26T23:59:59", preview: true },
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
      drift("leaf", "8%", "12%", 64, "22s", "0s", "a"),
      drift("leaf", "18%", "78%", 48, "26s", "-8s", "c"),
      drift("leaf", "6%", "42%", 36, "20s", "-4s", "b"),
      drift("leaf", "28%", "24%", 42, "28s", "-12s", "a"),
      drift("leaf", "22%", "60%", 30, "24s", "-2s", "c"),
    ],
    hanukkah: [
      drift("star", "10%", "16%", 36, "22s", "0s", "a"),
      drift("star", "20%", "74%", 28, "26s", "-7s", "c"),
      drift("spark", "8%", "46%", 22, "20s", "-3s", "b"),
      drift("star", "32%", "28%", 24, "28s", "-11s", "a"),
      drift("spark", "16%", "88%", 18, "24s", "-5s", "c"),
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
    thanksgiving: [{ top: "64%", left: "24%", size: 90, delay: "0s" }, { top: "62%", left: "54%", size: 80, delay: "-0.8s" }],
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
    if (kind === "star") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#E2B657" stroke="#1C140E" stroke-width="2" d="M24 4l5 14h14l-11 8 4 14-12-8-12 8 4-14L5 18h14z"/></svg>';
    if (kind === "flake") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="#F7F1FF" stroke-width="2.4" stroke-linecap="round" d="M24 6v36M8 14l32 20M8 34l32-20"/></svg>';
    if (kind === "spark" || kind === "burst") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#E2B657" stroke="#1C140E" stroke-width="2" d="M24 4l4 14 14 2-12 8 4 14-10-8-10 8 4-14L6 20l14-2z"/></svg>';
    if (kind === "heart") return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#E7A0B4" stroke="#1C140E" stroke-width="2" d="M24 40C8 28 6 16 14 12c6-3 10 2 10 2s4-5 10-2c8 4 6 16-10 28z"/></svg>';
    if (kind === "clover") return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="7" fill="#3E9A56" stroke="#0C1812" stroke-width="2"/><circle cx="15" cy="26" r="7" fill="#3E9A56" stroke="#0C1812" stroke-width="2"/><circle cx="33" cy="26" r="7" fill="#2F7A44" stroke="#0C1812" stroke-width="2"/></svg>';
    if (kind === "apple") return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="28" r="12" fill="#C4453A" stroke="#1C140E" stroke-width="2"/><path d="M24 16c2-6 8-8 10-6" fill="none" stroke="#1E6A48" stroke-width="2"/></svg>';
    if (kind === "petal") return '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="26" rx="8" ry="12" fill="#F4C7D4" stroke="#1C140E" stroke-width="2" transform="rotate(-20 24 26)"/></svg>';
    return '<svg viewBox="0 0 64 72" aria-hidden="true"><path fill="#FFF8F1" stroke="#1C1A1F" stroke-width="2.5" d="M14 34c0-12 8-22 18-22s18 10 18 22v26l-6-6-6 6-6-6-6 6-6-6-6 6V34z"/><circle cx="26" cy="34" r="2.6" fill="#1C1A1F"/><circle cx="40" cy="34" r="2.6" fill="#1C1A1F"/><path d="M28 44c2.2 2.6 5.8 2.6 8 0" fill="none" stroke="#1C1A1F" stroke-width="2"/></svg>';
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
    return root;
  }

  function mount() {
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
      return;
    }
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
    mount: mount,
  };
});
