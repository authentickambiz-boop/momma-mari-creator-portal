import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, supportMessages } from "../src/db/schema";
import { savePublicNote } from "../src/lib/company-pages";
import { listSupportMessages } from "../src/lib/creator-home";
import { sitemapPublicPaths } from "../src/lib/public-meta";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { getDealForViewer } from "../src/lib/queries";
import { abby, admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const pages = [
  "src/app/about/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/faq/page.tsx",
  "src/app/careers/page.tsx",
  "src/app/press/page.tsx",
];

describe("public company pages", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("about, contact, faq, careers, and press stay public and store notes without email", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;

    const dropped = await savePublicNote(db, {
      name: "Spam",
      email: "spam@example.com",
      message: "buy now",
      subject: "Contact",
      honeypot: "https://spam.example",
    });
    assert.equal(dropped.ok, true);
    assert.equal(dropped.stored, false);
    assert.equal((await db.select().from(supportMessages)).some((row) => row.authorEmail === "spam@example.com"), false);

    const missing = await savePublicNote(db, {
      name: "",
      email: "ada@example.com",
      message: "Hello",
      subject: "Contact",
      honeypot: "",
    });
    assert.equal(missing.ok, false);

    const saved = await savePublicNote(db, {
      name: "Ada Contact",
      email: "Ada@Example.com",
      message: "I have a question about applying.",
      subject: "Contact",
      honeypot: "",
    });
    assert.equal(saved.ok, true);
    const row = (await db.select().from(supportMessages).where(eq(supportMessages.authorEmail, "ada@example.com")))[0];
    assert.equal(row?.subject, "Contact");
    assert.equal(row?.authorName, "Ada Contact");
    assert.equal(row?.creatorId, null);

    for (let count = 0; count < 2; count += 1) {
      assert.equal((await savePublicNote(db, {
        name: "Ada Contact",
        email: "ada@example.com",
        message: `Follow up ${count}`,
        subject: "Contact",
        honeypot: "",
      })).ok, true);
    }
    const limited = await savePublicNote(db, {
      name: "Ada Contact",
      email: "ada@example.com",
      message: "One more",
      subject: "Contact",
      honeypot: "",
    });
    assert.equal(limited.ok, false);

    const talent = await savePublicNote(db, {
      name: "Bea Talent",
      email: "bea@example.com",
      message: "I edit short videos.",
      subject: "Talent network",
      honeypot: "",
    });
    assert.equal(talent.ok, true);
    const owner = await listSupportMessages(db, admin);
    assert.equal(owner.some((item) => item.subject === "Talent network" && item.authorName === "Bea Talent"), true);
    const hidden = await listSupportMessages(db, abby);
    assert.equal(hidden.some((item) => item.authorName === "Bea Talent"), false);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    const footer = source("src/components/site-footer.tsx");
    const shell = source("src/components/public-shell.tsx");
    for (const file of pages) {
      const page = source(file);
      assert.match(page, /publicPageMeta/);
      assert.match(page, /PublicShell/);
      assert.equal(/\$\s?\d/.test(page), false);
      assert.equal(page.replaceAll("SIGN_FOLLOWER_MINIMUM", "").toLowerCase().includes("minimum"), false);
      assert.equal(page.includes("stripe"), false);
    }
    assert.match(source("src/lib/company-pages.ts"), /MariClare/);
    assert.match(source("src/lib/company-pages.ts"), /Kamron Santo/);
    assert.match(source("src/lib/company-pages.ts"), /2\.3 million/);
    assert.match(source("src/app/about/page.tsx"), /ABOUT_STORY/);
    assert.match(source("src/lib/company-pages.ts"), /980-358-0759/);
    assert.match(source("src/lib/company-pages.ts"), /Kamron@mommamari.com/);
    assert.match(source("src/app/contact/page.tsx"), /PUBLIC_CONTACT_PHONE/);
    assert.match(source("src/app/contact/page.tsx"), /PUBLIC_CONTACT_EMAIL/);
    assert.match(source("src/app/contact/page.tsx"), /no public street address/);
    assert.match(source("src/app/contact/page.tsx"), /companyNoteErrorNote\(params\.noteError\)/);
    assert.equal(source("src/app/contact/page.tsx").includes("{params.noteError}"), false);
    assert.match(source("src/app/contact/page.tsx"), /Saved in the portal\. Nothing was emailed\./);
    assert.match(source("src/app/careers/page.tsx"), /No open roles are listed/);
    assert.match(source("src/app/faq/page.tsx"), /href="\/contact"/);
    assert.match(source("src/app/faq/page.tsx"), /href="\/help"/);
    assert.match(source("src/app/press/page.tsx"), /withBasePath\("\/momma-logo.png"\)/);
    for (const href of ["/about", "/contact", "/faq", "/careers", "/press"]) {
      assert.match(footer, new RegExp(`href="${href}"`));
      assert.match(shell, new RegExp(`href="${href}"`));
      assert.equal(sitemapPublicPaths().includes(href), true);
      assert.equal(isPublicMarketingPath(href, ""), true);
    }
    assert.equal(source("src/lib/company-pages.ts").includes("createApprovalEmail"), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
