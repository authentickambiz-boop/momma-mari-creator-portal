import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { creatorFiled1099s, deals } from "../src/db/schema";
import { paymentsEnabled } from "../src/lib/payments-config";
import {
  listFiled1099s,
  markBrandPaid,
  markCreatorPaid,
  readCreatorW9,
  readFiled1099,
  recordPayoutLine,
  storeCreatorW9,
  storeFiled1099,
  yearlySummaryCsv,
} from "../src/lib/payout-ledger";
import { getDealForViewer } from "../src/lib/queries";
import { admin, abby, mariclare, openTestDb } from "./harness";

const manager = {
  email: "riley.manager@gmail.com",
  role: "manager" as const,
  creatorId: null,
  name: "Riley",
  assignedCreatorIds: ["mariclare"],
};

function samplePdf(note: string) {
  return new TextEncoder().encode(`%PDF-1.4\n% ${note}\n`);
}

describe("filed 1099s and yearly summary", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("a filed 1099 is encrypted, and the yearly summary is not a tax form", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const dealCount = (await db.select().from(deals)).length;
    assert.equal(paymentsEnabled(), false);

    const saved = await recordPayoutLine(db, admin, {
      creatorId: "mariclare",
      brand: "Sample Outdoor",
      grossCents: 100000,
      feeCents: 0,
      expenseCents: 0,
      brandPaidOn: "2026-10-20",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    await markCreatorPaid(db, admin, saved.id, "2026-10-21");

    const other = await recordPayoutLine(db, admin, {
      creatorId: "abby",
      brand: "North Home",
      grossCents: 50000,
      feeCents: 0,
      expenseCents: 0,
      brandPaidOn: "2026-10-27",
    });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    await markCreatorPaid(db, admin, other.id, "2026-10-28");

    const waiting = await recordPayoutLine(db, admin, {
      creatorId: "mariclare",
      brand: "Still Waiting",
      grossCents: 20000,
      feeCents: 0,
      expenseCents: 0,
    });
    assert.equal(waiting.ok, true);
    if (!waiting.ok) return;
    await markBrandPaid(db, admin, waiting.id, "2026-10-22");

    const summary = await yearlySummaryCsv(db, admin, 2026);
    assert.equal(summary.ok, true);
    if (summary.ok) {
      assert.match(summary.csv, /Not a tax form/);
      assert.match(summary.csv, /Sample Outdoor/);
      assert.match(summary.csv, /North Home/);
      assert.equal(summary.csv.includes("Still Waiting"), false);
      assert.equal(summary.csv.toLowerCase().includes("1099"), false);
      assert.equal(summary.csv.toLowerCase().includes("minimum"), false);
      assert.equal(summary.filename, "momma-mari-yearly-summary-2026.csv");
    }
    const own = await yearlySummaryCsv(db, mariclare, 2026);
    assert.equal(own.ok, true);
    if (own.ok) {
      assert.match(own.csv, /Sample Outdoor/);
      assert.equal(own.csv.includes("North Home"), false);
      assert.match(own.csv, /Not a tax form/);
    }
    assert.equal((await yearlySummaryCsv(db, manager, 2026)).ok, false);
    assert.equal((await yearlySummaryCsv(db, admin, 1999)).ok, false);

    const pdf = samplePdf("FILED 1099-NEC for MariClare");
    const creatorUpload = await storeFiled1099(db, mariclare, {
      creatorId: "mariclare",
      year: 2026,
      filename: "1099.pdf",
      mimeType: "application/pdf",
      bytes: pdf,
    });
    assert.equal(creatorUpload.ok, false);

    const stored = await storeFiled1099(db, admin, {
      creatorId: "mariclare",
      year: 2026,
      filename: "../mari 1099.pdf",
      mimeType: "application/pdf",
      bytes: pdf,
    });
    assert.equal(stored.ok, true);
    if (!stored.ok) return;
    const again = await storeFiled1099(db, admin, {
      creatorId: "mariclare",
      year: 2026,
      filename: "mari-copy.pdf",
      mimeType: "application/pdf",
      bytes: samplePdf("second copy"),
    });
    assert.equal(again.ok, true);
    const rows = await db.select().from(creatorFiled1099s);
    assert.equal(rows.length, 2);
    const row = rows.find((item) => item.id === stored.id);
    assert.equal(row?.filename, "mari 1099.pdf");
    assert.equal(row?.ciphertext.startsWith("v1:"), true);
    assert.equal(row?.ciphertext.includes("FILED 1099-NEC"), false);
    assert.equal(row?.ciphertext.includes("%PDF"), false);

    const listed = await listFiled1099s(db, mariclare, 2026);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.files.length, 2);
      assert.equal(JSON.stringify(listed.files).includes("ciphertext"), false);
      assert.equal(JSON.stringify(listed.files).includes("FILED 1099"), false);
    }
    assert.equal((await listFiled1099s(db, mariclare, 2025)).ok, true);
    if ((await listFiled1099s(db, mariclare, 2025)).ok) {
      const older = await listFiled1099s(db, mariclare, 2025);
      if (older.ok) assert.equal(older.files.length, 0);
    }
    const opened = await readFiled1099(db, mariclare, stored.id);
    assert.equal(opened.ok, true);
    if (opened.ok) assert.equal(new TextDecoder().decode(opened.bytes), new TextDecoder().decode(pdf));
    const ownerOpened = await readFiled1099(db, admin, stored.id);
    assert.equal(ownerOpened.ok, true);
    assert.equal((await readFiled1099(db, abby, stored.id)).ok, false);
    assert.equal((await readFiled1099(db, manager, stored.id)).ok, false);
    assert.equal((await listFiled1099s(db, abby, 2026)).ok, true);
    const abbyList = await listFiled1099s(db, abby, 2026);
    if (abbyList.ok) assert.equal(abbyList.files.length, 0);
    assert.equal((await listFiled1099s(db, manager, 2026)).ok, false);

    const notPdf = await storeFiled1099(db, admin, {
      creatorId: "mariclare",
      year: 2026,
      filename: "notes.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("this is not a pdf"),
    });
    assert.equal(notPdf.ok, false);
    if (!notPdf.ok) assert.equal(notPdf.code, "pdf");
    assert.equal((await db.select().from(creatorFiled1099s)).length, 2);

    const w9 = await storeCreatorW9(db, mariclare, {
      creatorId: "mariclare",
      filename: "w9.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("FORM W-9 SAMPLE for MariClare"),
    });
    assert.equal(w9.ok, true);
    if (!w9.ok) return;
    const ownW9 = await readCreatorW9(db, mariclare, w9.id);
    assert.equal(ownW9.ok, true);
    if (ownW9.ok) assert.equal(new TextDecoder().decode(ownW9.bytes), "FORM W-9 SAMPLE for MariClare");
    assert.equal((await readCreatorW9(db, abby, w9.id)).ok, false);
    assert.equal((await readCreatorW9(db, manager, w9.id)).ok, false);

    const page = readFileSync(path.join(process.cwd(), "src/app/payouts/page.tsx"), "utf8");
    const library = readFileSync(path.join(process.cwd(), "src/lib/payout-ledger.ts"), "utf8");
    const sql = readFileSync(path.join(process.cwd(), "drizzle/0055_filed_1099.sql"), "utf8");
    assert.match(page, /https:\/\/www\.irs\.gov\/pub\/irs-pdf\/fw9\.pdf/);
    assert.match(page, /Download blank W-9/);
    assert.match(page, /Download your W-9/);
    assert.match(page, /Download yearly summary/);
    assert.match(page, /It is not a tax form/);
    assert.match(page, /does not make a 1099/);
    assert.equal(page.toLowerCase().includes("minimum"), false);
    assert.equal(library.includes("pdf-lib"), false);
    assert.equal(library.includes("PDFDocument"), false);
    assert.equal(library.includes("api.stripe.com"), false);
    assert.equal(sql.toLowerCase().includes("delete "), false);
    assert.equal((await db.select().from(deals)).length, dealCount);
    assert.equal((await getDealForViewer(db, admin, "kosbling"))?.brand, kosblingBefore?.brand);
    assert.equal((await getDealForViewer(db, admin, "kosbling"))?.workflowStage, kosblingBefore?.workflowStage);
  });
});
