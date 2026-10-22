"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { dollarsToCents, markBrandPaid, markCreatorPaid, recordPayoutLine, storeCreatorW9, storeFiled1099 } from "@/lib/payout-ledger";

function fail(code: string): never {
  redirect(`/payouts?error=${code}`);
}

function cents(value: string, allowZero: boolean) {
  const parsed = dollarsToCents(value, allowZero);
  if ("error" in parsed) fail("amount");
  return parsed.cents;
}

export async function recordPayoutAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await recordPayoutLine(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    grossCents: cents(String(formData.get("gross") ?? ""), false),
    feeCents: cents(String(formData.get("fees") ?? ""), true),
    expenseCents: cents(String(formData.get("expenses") ?? ""), true),
    brandPaidOn: String(formData.get("brandPaidOn") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) fail(result.code);
  redirect("/payouts?saved=1");
}

export async function markBrandPaidAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await markBrandPaid(db, viewer, String(formData.get("lineId") ?? ""), String(formData.get("brandPaidOn") ?? ""));
  if (!result.ok) fail(result.code);
  redirect("/payouts?saved=brand");
}

export async function markCreatorPaidAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await markCreatorPaid(db, viewer, String(formData.get("lineId") ?? ""), String(formData.get("payoutOn") ?? ""));
  if (!result.ok) fail(result.code);
  redirect("/payouts?saved=paid");
}

export async function uploadW9Action(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const file = formData.get("w9");
  if (!(file instanceof File)) fail("file");
  const db = await getDb();
  const creatorId = viewer.role === "creator" ? viewer.creatorId ?? "" : String(formData.get("creatorId") ?? "");
  const result = await storeCreatorW9(db, viewer, {
    creatorId,
    filename: file.name,
    mimeType: file.type || "application/pdf",
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) fail(result.code);
  redirect("/payouts?saved=w9");
}

export async function uploadFiled1099Action(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const file = formData.get("form1099");
  if (!(file instanceof File)) fail("pdf");
  const year = Number(String(formData.get("year") ?? ""));
  const db = await getDb();
  const result = await storeFiled1099(db, viewer, {
    creatorId: String(formData.get("creatorId") ?? ""),
    year,
    filename: file.name,
    mimeType: file.type || "application/pdf",
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) fail(result.code);
  redirect(`/payouts?saved=1099&year=${year}`);
}
