import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InquirePage from "../src/app/inquire/page";
import { BrandBriefForm } from "../src/components/brand-brief-form";
import { BRIEF_CREATORS, inquiryCreatorIds } from "../src/lib/brand-brief";

const CREATOR_IDS = BRIEF_CREATORS.map((creator) => creator.id);

type InquireQuery = {
  sent?: string;
  error?: string;
  with?: string;
  brand?: string;
  program?: string;
  creator?: string | string[];
};

function creatorChecked(html: string, id: string) {
  const tag = html.match(new RegExp(`<input\\b(?=[^>]*\\bname="creators")(?=[^>]*\\bvalue="${id}")[^>]*>`));
  assert.ok(tag, `missing creators checkbox ${id}`);
  return /\bchecked\b/.test(tag[0]);
}

async function inquireHtml(query: Record<string, string | string[] | undefined> = {}) {
  const page = await InquirePage({ searchParams: Promise.resolve(query as InquireQuery) });
  return renderToStaticMarkup(page);
}

function checkedIds(html: string) {
  return CREATOR_IDS.filter((id) => creatorChecked(html, id));
}

describe("inquiry creator query prefill", () => {
  test("a single slug pre-selects that creator", async () => {
    const html = await inquireHtml({ creator: "mariclare" });
    assert.deepEqual(checkedIds(html), ["mariclare"]);
    assert.deepEqual(inquiryCreatorIds("mariclare"), ["mariclare"]);
  });

  test("a comma-separated list pre-selects each known creator", async () => {
    const html = await inquireHtml({ creator: "mariclare,abby" });
    assert.deepEqual(checkedIds(html), ["mariclare", "abby"]);
    const mixed = await inquireHtml({ creator: "mariclare,not-on-roster,abby" });
    assert.deepEqual(checkedIds(mixed), ["mariclare", "abby"]);
    assert.equal(mixed.includes("not-on-roster"), false);
    const repeated = await inquireHtml({ creator: ["mariclare", "abby"] });
    assert.deepEqual(checkedIds(repeated), ["mariclare", "abby"]);
  });

  test("slug matching ignores case", async () => {
    const html = await inquireHtml({ creator: "MariClare,ABBY" });
    assert.deepEqual(checkedIds(html), ["mariclare", "abby"]);
    assert.deepEqual(inquiryCreatorIds("AuthenticKam"), ["authentickam"]);
  });

  test("an unknown slug selects nothing and shows no error", async () => {
    const html = await inquireHtml({ creator: "not-a-creator" });
    assert.deepEqual(checkedIds(html), []);
    assert.equal(html.includes("not-a-creator"), false);
    assert.equal(html.includes("Nothing was emailed"), false);
    assert.equal(html.toLowerCase().includes("minimum"), false);
    assert.deepEqual(inquiryCreatorIds("not-a-creator"), []);
  });

  test("no creator param leaves every creator unchecked", async () => {
    const html = await inquireHtml({});
    assert.deepEqual(checkedIds(html), []);
    const empty = await inquireHtml({ creator: "" });
    assert.deepEqual(checkedIds(empty), []);
    const blank = await inquireHtml({ creator: " , " });
    assert.deepEqual(checkedIds(blank), []);
    assert.deepEqual(inquiryCreatorIds(undefined), []);
  });

  test("utm params can sit beside the creator slug", async () => {
    const html = await inquireHtml({
      creator: "abby",
      utm_source: "launch",
      utm_medium: "social",
      utm_campaign: "roster",
    });
    assert.deepEqual(checkedIds(html), ["abby"]);
    assert.equal(html.includes("utm_source"), false);
    assert.equal(html.includes("utm_campaign"), false);
  });

  test("the with param still pre-selects, and boxes stay toggleable", () => {
    const html = renderToStaticMarkup(createElement(BrandBriefForm, {
      featuredId: "mariclare",
      selectedIds: ["abby"],
      brand: "Northstar",
    }));
    assert.deepEqual(checkedIds(html), ["mariclare", "abby"]);
    assert.match(html, /name="brand"[^>]*value="Northstar"/);
    assert.equal(html.includes('type="hidden" name="creators"'), false);
    for (const id of CREATOR_IDS) {
      const tag = html.match(new RegExp(`<input\\b(?=[^>]*\\bname="creators")(?=[^>]*\\bvalue="${id}")[^>]*>`));
      assert.ok(tag);
      assert.equal(/\bdisabled\b/.test(tag[0]), false);
      assert.equal(/\breadonly\b/i.test(tag[0]), false);
    }
    const untouched = renderToStaticMarkup(createElement(BrandBriefForm, { brand: "" }));
    assert.deepEqual(checkedIds(untouched), []);
  });
});
