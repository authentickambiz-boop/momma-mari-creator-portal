import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WhereToStartGuide } from "../src/components/where-to-start-guide";
import { CREATOR_NICHE_IDS } from "../src/lib/creator-niche-shared";
import { SKILL_TOPICS } from "../src/lib/skill-lessons";
import { START_BASICS, WHERE_TO_START, analyticsLevel, whereToStart, type AnalyticsLevel } from "../src/lib/where-to-start";

const LEVELS: AnalyticsLevel[] = ["starting", "building", "ready"];

const SAFETY: Record<string, string> = {
  parenting: "Keep your child's face, name and school out of brand content unless you have a written OK, and work only with family-safe brands.",
  stay_at_home: "Keep kids' faces, names and your home address out of brand content unless you have a written OK.",
  music: "Keep the rights to your own tracks. Using your song in a brand's ad is a separate license.",
  modeling: "A brand using your photos or video as ads is a separate fee from the post itself.",
  sports_fitness: "Use the brand's approved wording for any supplement or health claim.",
  streaming: "Say it's sponsored on stream, and pin the disclosure in chat.",
  gaming: "Say it's sponsored on stream, and pin the disclosure in chat.",
  makeup_beauty: "Show the product clearly in the first few seconds, and only claim results you actually saw.",
};

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function visibleCopy(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

describe("where to start", () => {
  test("every niche returns a guide for all three levels, with the same safety note", () => {
    const topics = new Set(SKILL_TOPICS.map((topic) => topic.id));
    const niches = [...Object.keys(WHERE_TO_START), ...CREATOR_NICHE_IDS, "not-a-niche"];
    for (const niche of niches) {
      for (const level of LEVELS) {
        const guide = whereToStart(niche, level);
        assert.equal(topics.has(guide.topic), true, niche);
        assert.equal(guide.headline.length > 0, true);
        assert.equal(guide.body.length > 0, true);
        const expected = SAFETY[niche];
        assert.equal(guide.safety, expected);
      }
    }
    for (const level of LEVELS) {
      const fallback = whereToStart("default", level);
      assert.equal(fallback.safety, undefined);
      assert.deepEqual(whereToStart("other", level), fallback);
      assert.deepEqual(whereToStart("not-a-niche", level), fallback);
      assert.deepEqual(whereToStart(null, level), fallback);
      assert.deepEqual(whereToStart(undefined, level), fallback);
      assert.deepEqual(whereToStart("", level), fallback);
      assert.equal(whereToStart("lifestyle", level).safety, undefined);
      assert.equal(whereToStart("diy", level).safety, undefined);
    }
  });

  test("free creators see the shared first steps, and cut-offs stay off the page", () => {
    assert.deepEqual(START_BASICS, [
      "Add your handles and a recent analytics screenshot for each platform, so this guide matches where you are.",
      "Put a contact email in every bio, so brands can reach you without a DM.",
      "On every sponsored or gifted post, turn on the platform's paid-partnership label.",
    ]);
    const page = source("src/app/learn/page.tsx");
    assert.match(page, /const free = portal\.creatorFree/);
    assert.match(page, /const guide = free && portal\.viewer\.creatorId/);
    assert.match(page, /\{guide \? <WhereToStartGuide guide=\{guide\} \/> : null\}/);
    assert.equal(page.includes("{level}"), false);
    assert.equal(page.includes("50_000"), false);
    assert.equal(page.includes("1_000"), false);

    const lib = source("src/lib/where-to-start.ts");
    assert.match(lib, /reach >= 50_000/);
    assert.match(lib, /reach >= 1_000/);
    assert.equal(analyticsLevel({ followers: 999, views: null, uploads: 0 }), "starting");
    assert.equal(analyticsLevel({ followers: 1_000, views: null, uploads: 0 }), "building");
    assert.equal(analyticsLevel({ followers: null, views: 50_000, uploads: 0 }), "ready");

    for (const niche of [...Object.keys(WHERE_TO_START), "other", "not-a-niche"]) {
      for (const level of LEVELS) {
        const guide = whereToStart(niche, level);
        const html = renderToStaticMarkup(createElement(WhereToStartGuide, { guide }));
        const text = visibleCopy(html);
        const basicsAt = html.indexOf("data-start-basics");
        const cardAt = html.indexOf("data-where-to-start");
        assert.equal(basicsAt >= 0 && cardAt > basicsAt, true);
        for (const step of START_BASICS) assert.equal(text.includes(step), true);
        assert.equal(text.includes(guide.headline), true);
        assert.equal(text.includes(guide.body), true);
        assert.equal(/\d/.test(text), false, text);
        assert.equal(/\b(starting|building|ready)\b/.test(text), false, text);
        assert.equal(text.includes("$"), false);
        assert.equal(/\bminimums?\b/i.test(text), false);
        if (guide.safety) {
          const noteAt = html.indexOf("data-niche-safety");
          assert.equal(noteAt > cardAt, true);
          assert.equal(text.includes(guide.safety), true);
        } else {
          assert.equal(html.includes("data-niche-safety"), false);
        }
      }
    }
  });
});
