import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  compositeHex,
  contrastRatio,
  dateInNewYork,
  HALLOWEEN_GLASS,
  SEASONAL_THEMES,
  selectSeasonalTheme,
} from "../src/lib/seasonal-theme";

const require = createRequire(import.meta.url);
const embed = require("../public/seasonal/embed.js") as {
  THEMES: { id: string; start: string; end: string; placeholder: boolean }[];
  FLOATERS: { kind: string; duration: string; top: string; left: string }[];
  GLASS: { fill: string; alpha: number; mobileAlpha: number; ink: string; heading: string; link: string };
  activeScene: (now: Date) => { id: string; desktop: string; mobile: string } | null;
  shouldSkip: (pathname: string) => boolean;
};

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("webflow seasonal embed", () => {
  test("the embed follows the same Eastern Time calendar as the portal", () => {
    assert.equal(embed.THEMES.length, SEASONAL_THEMES.length);
    for (const theme of SEASONAL_THEMES) {
      const copy = embed.THEMES.find((item) => item.id === theme.id);
      assert.ok(copy, theme.id);
      assert.equal(copy?.start, theme.start);
      assert.equal(copy?.end, theme.end);
      assert.equal(copy?.placeholder, theme.placeholder);
    }
    const samples = [
      "2026-09-30T23:59:59",
      "2026-10-01T00:00:00",
      "2026-10-21T15:00:00",
      "2026-11-01T23:59:59",
      "2026-11-02T00:00:00",
      "2026-12-25T12:00:00",
      "2027-02-14T12:00:00",
      "2027-05-08T12:00:00",
    ];
    for (const iso of samples) {
      const now = dateInNewYork(iso);
      const portal = selectSeasonalTheme({ now });
      const scene = embed.activeScene(now);
      if (!portal || portal.placeholder) assert.equal(scene, null, iso);
      else {
        assert.equal(scene?.id, portal.id, iso);
        assert.match(scene?.desktop ?? "", new RegExp(`${portal.id}-site\\.svg`));
        assert.match(scene?.mobile ?? "", new RegExp(`${portal.id}-mobile\\.svg`));
      }
    }
  });

  test("the bundle is standalone, skips the portal, and stays light on phones", () => {
    const js = source("public/seasonal/embed.js");
    const css = source("public/seasonal/embed.css");
    assert.match(js, /requestIdleCallback/);
    assert.match(js, /loading = "lazy"/);
    assert.match(js, /halloween-site\.svg/);
    assert.match(js, /halloween-mobile\.svg/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /animation-play-state:\s*paused/);
    assert.match(css, /max-width:\s*820px/);
    assert.match(css, /rgba\(32, 14, 58, 0\.68\)/);
    assert.match(css, /rgba\(32, 14, 58, 0\.84\)/);
    assert.match(css, /backdrop-filter:\s*blur\(18px\)/);
    assert.match(css, /backdrop-filter:\s*none/);
    assert.equal(embed.shouldSkip("/portal"), true);
    assert.equal(embed.shouldSkip("/portal/services"), true);
    assert.equal(embed.shouldSkip("/"), false);
    assert.equal(embed.shouldSkip("/brands"), false);
    assert.ok(embed.FLOATERS.length >= 4 && embed.FLOATERS.length <= 8);
    for (const item of embed.FLOATERS) assert.ok(Number.parseFloat(item.duration) >= 16);
    assert.equal(embed.GLASS.alpha, HALLOWEEN_GLASS.alpha);
    assert.equal(embed.GLASS.mobileAlpha, HALLOWEEN_GLASS.mobileAlpha);
    const inks = [embed.GLASS.ink, embed.GLASS.heading, embed.GLASS.link, HALLOWEEN_GLASS.muted, HALLOWEEN_GLASS.accent];
    for (const alpha of [embed.GLASS.alpha, embed.GLASS.mobileAlpha]) {
      const worst = compositeHex(embed.GLASS.fill, HALLOWEEN_GLASS.scene, alpha);
      for (const ink of inks) {
        const ratio = contrastRatio(ink, worst);
        assert.ok(ratio >= 4.5, `${ink} on ${worst} at ${alpha} is ${ratio.toFixed(2)}`);
      }
    }
  });
});
