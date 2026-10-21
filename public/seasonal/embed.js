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
    { id: "halloween", start: "2026-10-01T00:00:00", end: "2026-11-01T23:59:59", placeholder: false },
    { id: "thanksgiving", start: "2026-11-02T00:00:00", end: "2026-11-27T23:59:59", placeholder: true },
    { id: "holiday", start: "2026-11-28T00:00:00", end: "2027-01-01T23:59:59", placeholder: true },
    { id: "valentines", start: "2027-02-01T00:00:00", end: "2027-02-14T23:59:59", placeholder: true },
    { id: "mothers-day", start: "2027-05-02T00:00:00", end: "2027-05-09T23:59:59", placeholder: true },
  ];
  var SCENES = {
    halloween: { desktop: "halloween-site.svg", mobile: "halloween-mobile.svg" },
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

  function activeScene(now) {
    var theme = themeAt(now || new Date());
    if (!theme || theme.placeholder || !SCENES[theme.id]) return null;
    return { id: theme.id, desktop: SCENES[theme.id].desktop, mobile: SCENES[theme.id].mobile };
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
    LANTERNS.forEach(function (item) {
      var glow = document.createElement("span");
      glow.className = "mm-lantern";
      glow.style.top = item.top;
      glow.style.left = item.left;
      glow.style.width = item.size + "px";
      glow.style.height = item.size + "px";
      glow.style.animationDelay = item.delay;
      root.appendChild(glow);
    });
    FLOATERS.forEach(function (item) {
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
    var left = web().replace("mm-web-LEFT", "mm-web-left");
    var right = web().replace("mm-web-LEFT", "mm-web-right");
    root.insertAdjacentHTML("beforeend", left + right);
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
    var scene = activeScene(new Date());
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
    GLASS: GLASS,
    themeAt: themeAt,
    activeScene: activeScene,
    shouldSkip: shouldSkip,
    mount: mount,
  };
});
