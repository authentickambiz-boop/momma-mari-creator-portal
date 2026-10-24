import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RoadmapBody } from "../src/components/roadmap-body";
import { pageGuideFor, pageGuideIssues } from "../src/lib/page-guides";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import {
  PROGRAM_DATES_LINE,
  PROGRAM_ROADMAPS,
  programRoadmap,
  roadmapOfficialHrefs,
  roadmapPath,
  roadmapPlainText,
  type RoadmapPart,
} from "../src/lib/program-roadmaps";
import { admin, mariclare } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function cellText(cell: RoadmapPart[]) {
  return cell.map((part) => part.text).join("");
}

const OFFICIAL_HREFS = [
  "https://www.sephorasquad.com/",
  "https://www.sephorasquad.com/faq",
  "https://www.ubcollective.com/",
  "https://www.ulta.com/company/affiliate",
  "https://creators.homedepot.com/",
  "https://www.lowes.com/l/creator/joinlowescreator",
];

describe("program roadmaps", () => {
  test("signed-in creators can open the three approved guides", () => {
    assert.deepEqual(pageGuideIssues(), []);
    assert.deepEqual(PROGRAM_ROADMAPS.map((guide) => guide.slug), ["beauty", "diy-home", "retailer-calendar"]);
    assert.deepEqual(PROGRAM_ROADMAPS.map((guide) => guide.title), [
      "Beauty content roadmap",
      "DIY and home content roadmap",
      "Retailer creator program calendar",
    ]);
    assert.equal(programRoadmap("missing"), null);
    assert.equal(programRoadmap("beauty")?.title, "Beauty content roadmap");
    assert.equal(roadmapPath(null, null), "/roadmaps");
    assert.equal(roadmapPath("beauty", null), "/roadmaps/beauty");
    assert.equal(roadmapPath("diy-home", "mariclare"), "/roadmaps/diy-home?creator=mariclare");
    assert.equal(roadmapPath(null, "all"), "/roadmaps?creator=all");

    const retailer = programRoadmap("retailer-calendar");
    assert.ok(retailer);
    assert.match(retailer.lede, /Checked Oct 23, 2026/);
    assert.equal(retailer.lede.includes(PROGRAM_DATES_LINE), true);
    assert.match(retailer.lede, /No rates are listed here/);
    assert.match(PROGRAM_DATES_LINE, /dates change every year/);
    assert.match(PROGRAM_DATES_LINE, /check the official page before applying/);
    assert.match(PROGRAM_DATES_LINE, /You apply yourself/);

    const beauty = programRoadmap("beauty");
    const diy = programRoadmap("diy-home");
    assert.ok(beauty && diy);
    const beautyPlan = beauty.sections.find((section) => section.heading === "12-week starter plan");
    const diyPlan = diy.sections.find((section) => section.heading === "12-week starter plan");
    const calendar = retailer.sections.find((section) => section.table?.headers[0] === "Program");
    assert.deepEqual(beautyPlan?.table?.headers, ["Weeks", "Focus", "Posts per week", "Goal"]);
    assert.equal(beautyPlan?.table?.rows.length, 6);
    assert.equal(cellText(beautyPlan?.table?.rows[0]?.[1] ?? []), "Film 3 GRWMs and 2 tutorials; test hooks");
    assert.equal(diyPlan?.table?.rows.length, 5);
    assert.equal(cellText(diyPlan?.table?.rows[0]?.[1] ?? []), "3 quick hacks + 1 before-and-after");
    assert.deepEqual(calendar?.table?.headers, ["Program", "What it is", "When", "Official page", "How to prepare"]);
    assert.equal(calendar?.table?.rows.length, 5);
    assert.deepEqual(roadmapOfficialHrefs(retailer), OFFICIAL_HREFS);
    assert.deepEqual(roadmapOfficialHrefs(beauty), []);
    assert.deepEqual(roadmapOfficialHrefs(diy), []);

    const plain = PROGRAM_ROADMAPS.map((guide) => roadmapPlainText(guide)).join("\n");
    assert.match(plain, /GRWM for my first night out since the baby/);
    assert.match(plain, /what I'd buy with \$50/);
    assert.match(plain, /Film the "before" on a tripod/);
    assert.match(plain, /2026 window was Sep 15–Oct 6 \(closed\)/);
    assert.match(plain, /class announced Jan 2027/);
    assert.match(plain, /mid-September 2027/);
    assert.match(plain, /Open to the public since Dec 10, 2025 \(rolling\)/);
    assert.match(plain, /page blocks automated checks; open in a browser/);
    assert.match(plain, /Local Lake Norman creators have a home-turf story to tell/);
    assert.match(plain, /Momma Mari can help you prepare/);
    assert.deepEqual(plain.match(/\$\d[\d,]*/g), ["$50"]);
    assert.equal(/\b(minimum|floor|earnings)\b/i.test(plain), false);
    assert.equal(plain.includes("stripe"), false);

    const manager = {
      email: "riley.manager@gmail.com",
      role: "manager" as const,
      creatorId: null,
      name: "Riley",
      assignedCreatorIds: ["mariclare"],
    };
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.href === "/roadmaps" && tab.label === "Program roadmaps"), true);
    assert.equal(visiblePortalTabs(admin).some((tab) => tab.id === "roadmaps"), true);
    assert.equal(visiblePortalTabs(manager).some((tab) => tab.id === "roadmaps"), true);
    const guide = pageGuideFor("roadmaps");
    assert.match(guide.who, /Everyone signed in/);
    assert.match(guide.who, /creators/i);
    assert.equal(guide.steps.length >= 3 && guide.steps.length <= 5, true);

    const html = renderToStaticMarkup(createElement(RoadmapBody, { guide: retailer }));
    assert.match(html, /class="roadmap-table"/);
    assert.match(html, /class="card"/);
    assert.equal(html.split('target="_blank"').length - 1, OFFICIAL_HREFS.length);
    assert.equal(html.split('rel="noopener noreferrer"').length - 1, OFFICIAL_HREFS.length);
    for (const href of OFFICIAL_HREFS) assert.equal(html.includes(`href="${href}"`), true);
    assert.match(html, /Year at a glance/);
    const beautyHtml = renderToStaticMarkup(createElement(RoadmapBody, { guide: beauty }));
    assert.equal(beautyHtml.includes("target="), false);
    assert.match(beautyHtml, /Checklist for every beauty post/);
    assert.match(renderToStaticMarkup(createElement(RoadmapBody, { guide: diy })), /Checklist/);

    const files = [
      "src/lib/program-roadmaps.ts",
      "src/components/roadmap-body.tsx",
      "src/app/roadmaps/page.tsx",
      "src/app/roadmaps/[slug]/page.tsx",
      "src/app/learn/page.tsx",
    ];
    for (const file of files) {
      const text = source(file);
      assert.equal(text.includes("stripe"), false, file);
      assert.equal(text.includes("worlds"), false, file);
      assert.equal(text.includes("@/lib/payments"), false, file);
      assert.equal(/sendEmail|sendMail|resend/i.test(text), false, file);
    }
    const index = source("src/app/roadmaps/page.tsx");
    const detail = source("src/app/roadmaps/[slug]/page.tsx");
    const learn = source("src/app/learn/page.tsx");
    const css = source("src/app/globals.css");
    assert.match(index, /loadPortal/);
    assert.match(index, /tab="roadmaps"/);
    assert.match(index, /PROGRAM_DATES_LINE/);
    assert.match(index, /Planning guides for creators in any niche/);
    assert.match(detail, /loadPortal/);
    assert.match(detail, /notFound/);
    assert.match(detail, /programRoadmap/);
    assert.match(detail, /\{guide\.lede\}/);
    assert.match(detail, /All program roadmaps/);
    assert.match(learn, /Open program roadmaps/);
    assert.match(learn, /roadmapPath/);
    assert.match(css, /\.card:has\(table\) \{ overflow-x: auto; \}/);
    assert.match(css, /\.roadmap-table \{ min-width: 64rem; \}/);
  });
});
