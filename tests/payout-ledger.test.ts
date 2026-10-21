import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { creatorW9s, deals, payoutLedger } from "../src/db/schema";
import { paymentsEnabled } from "../src/lib/payments-config";
import {
  form1099Totals,
  listCreatorW9s,
  listPayoutLedger,
  markBrandPaid,
  markCreatorPaid,
  payoutCsv,
  payoutTransfersEnabled,
  readCreatorW9,
  recordPayoutLine,
  splitAfterDeductions,
  storeCreatorW9,
  weekOf,
} from "../src/lib/payout-ledger";
import { visiblePortalTabs } from "../src/lib/portal-tabs";
import { getDealForViewer } from "../src/lib/queries";
import { admin, abby, mariclare, openTestDb } from "./harness";

const manager = {
  email: "riley.manager@gmail.com",
  role: "manager" as const,
  creatorId: null,
  name: "Riley",
  assignedCreatorIds: ["mariclare"],
};

describe("payout ledger", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("fees and expenses come off first, and a creator is paid only after the brand pays", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const dealCount = (await db.select().from(deals)).length;
    assert.equal(payoutTransfersEnabled(), false);
    assert.equal(paymentsEnabled(), false);
    assert.equal(weekOf("2026-10-21"), "2026-10-19");
    assert.equal(weekOf("2026-10-18"), "2026-10-12");

    const split = splitAfterDeductions(100000, 10000, 5000);
    assert.equal(split.ok, true);
    if (split.ok) {
      assert.equal(split.netCents, 85000);
      assert.equal(split.agencyCents, 17000);
      assert.equal(split.creatorCents, 68000);
      assert.equal(split.creatorCents + split.agencyCents, split.netCents);
    }
    assert.equal(splitAfterDeductions(1000, 800, 300).ok, false);

    const early = await recordPayoutLine(db, mariclare, {
      creatorId: "mariclare",
      brand: "Sample Outdoor",
      grossCents: 100000,
      feeCents: 10000,
      expenseCents: 5000,
    });
    assert.equal(early.ok, false);

    const saved = await recordPayoutLine(db, admin, {
      creatorId: "mariclare",
      brand: "Sample Outdoor",
      grossCents: 100000,
      feeCents: 10000,
      expenseCents: 5000,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const tooSoon = await markCreatorPaid(db, admin, saved.id, "2026-10-21");
    assert.equal(tooSoon.ok, false);
    if (!tooSoon.ok) assert.equal(tooSoon.code, "brand");

    await markBrandPaid(db, admin, saved.id, "2026-10-20");
    const paid = await markCreatorPaid(db, admin, saved.id, "2026-10-21");
    assert.equal(paid.ok, true);
    if (paid.ok) {
      assert.equal(paid.transferred, false);
      assert.equal(paid.transfersEnabled, false);
    }

    const second = await recordPayoutLine(db, admin, {
      creatorId: "abby",
      brand: "North Home",
      grossCents: 50000,
      feeCents: 0,
      expenseCents: 0,
      brandPaidOn: "2026-10-27",
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    await markCreatorPaid(db, admin, second.id, "2026-10-28");

    const waiting = await recordPayoutLine(db, admin, {
      creatorId: "mariclare",
      brand: "Still Waiting",
      grossCents: 20000,
      feeCents: 0,
      expenseCents: 0,
    });
    assert.equal(waiting.ok, true);

    const ledger = await listPayoutLedger(db, admin);
    assert.equal(ledger.ok, true);
    if (ledger.ok) {
      assert.equal(ledger.weeks.length, 2);
      assert.deepEqual(ledger.weeks.map((week) => week.weekOf).sort(), ["2026-10-19", "2026-10-26"]);
      const sample = ledger.lines.find((line) => line.brand === "Sample Outdoor");
      assert.equal(sample?.creatorCents, 68000);
      assert.equal(sample?.waitingOnBrand, false);
      assert.equal(ledger.waiting.some((line) => line.brand === "Still Waiting"), true);
    }
    const creatorView = await listPayoutLedger(db, mariclare);
    assert.equal(creatorView.ok, true);
    if (creatorView.ok) {
      assert.equal(creatorView.lines.every((line) => line.creatorId === "mariclare"), true);
      assert.equal(creatorView.lines.some((line) => line.brand === "North Home"), false);
    }
    assert.equal((await listPayoutLedger(db, manager)).ok, false);

    const tax = await form1099Totals(db, admin, 2026);
    assert.equal(tax.ok, true);
    if (tax.ok) {
      const mari = tax.totals.find((row) => row.creatorId === "mariclare");
      assert.equal(mari?.creatorCents, 68000);
      assert.equal(tax.totals.some((row) => row.creatorId === "abby"), true);
    }
    const creatorTax = await form1099Totals(db, mariclare, 2026);
    assert.equal(creatorTax.ok, true);
    if (creatorTax.ok) assert.equal(creatorTax.totals.every((row) => row.creatorId === "mariclare"), true);
    const emptyYear = await form1099Totals(db, admin, 2025);
    assert.equal(emptyYear.ok, true);
    if (emptyYear.ok) assert.equal(emptyYear.totals.length, 0);

    const csv = await payoutCsv(db, admin, 2026);
    assert.equal(csv.ok, true);
    if (csv.ok) {
      assert.match(csv.csv, /Sample Outdoor/);
      assert.match(csv.csv, /680\.00/);
      assert.match(csv.csv, /YEAR TOTAL/);
      assert.equal(csv.csv.toLowerCase().includes("minimum"), false);
      assert.equal(csv.csv.includes("Still Waiting"), false);
      assert.equal(csv.csv.includes("v1:"), false);
    }
    assert.equal((await payoutCsv(db, mariclare, 2026)).ok, false);

    const previous = process.env.CREATOR_PAYOUT_TRANSFERS_ENABLED;
    process.env.CREATOR_PAYOUT_TRANSFERS_ENABLED = "true";
    try {
      assert.equal(payoutTransfersEnabled(), true);
      const flagged = await markCreatorPaid(db, admin, second.id, "2026-10-28");
      assert.equal(flagged.ok, true);
      if (flagged.ok) assert.equal(flagged.transferred, false);
    } finally {
      if (previous == null) delete process.env.CREATOR_PAYOUT_TRANSFERS_ENABLED;
      else process.env.CREATOR_PAYOUT_TRANSFERS_ENABLED = previous;
    }

    const lib = readFileSync(path.join(process.cwd(), "src/lib/payout-ledger.ts"), "utf8");
    assert.equal(lib.includes("api.stripe.com"), false);
    assert.equal(lib.includes("gmail"), false);
    assert.equal(visiblePortalTabs(mariclare).some((tab) => tab.id === "payouts"), true);
    assert.equal(visiblePortalTabs(manager).some((tab) => tab.id === "payouts"), false);
    assert.equal((await db.select().from(deals)).length, dealCount);
    assert.equal((await getDealForViewer(db, admin, "kosbling"))?.brand, kosblingBefore?.brand);
    assert.equal((await db.select().from(payoutLedger)).length, 3);
  });

  test("a W-9 is stored encrypted and only the owner or that creator can open it", async () => {
    const bytes = new TextEncoder().encode("FORM W-9 SAMPLE for MariClare");
    const stored = await storeCreatorW9(db, admin, {
      creatorId: "mariclare",
      filename: "../w9 form.pdf",
      mimeType: "application/pdf",
      bytes,
    });
    assert.equal(stored.ok, true);
    if (!stored.ok) return;
    const rows = await db.select().from(creatorW9s);
    const row = rows.find((item) => item.id === stored.id);
    assert.equal(row?.filename, "w9 form.pdf");
    assert.equal(row?.ciphertext.startsWith("v1:"), true);
    assert.equal(row?.ciphertext.includes("FORM W-9 SAMPLE"), false);
    const listed = await listCreatorW9s(db, admin, "mariclare");
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.files.some((file) => file.id === stored.id), true);
      assert.equal(JSON.stringify(listed.files).includes("ciphertext"), false);
      assert.equal(JSON.stringify(listed.files).includes("FORM W-9"), false);
    }
    const opened = await readCreatorW9(db, mariclare, stored.id);
    assert.equal(opened.ok, true);
    if (opened.ok) assert.equal(new TextDecoder().decode(opened.bytes), "FORM W-9 SAMPLE for MariClare");
    assert.equal((await readCreatorW9(db, abby, stored.id)).ok, false);
    assert.equal((await readCreatorW9(db, manager, stored.id)).ok, false);
    const rejected = await storeCreatorW9(db, admin, {
      creatorId: "mariclare",
      filename: "notes.txt",
      mimeType: "text/plain",
      bytes,
    });
    assert.equal(rejected.ok, false);
  });
});
