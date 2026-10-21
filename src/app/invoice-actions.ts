"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { approveInvoiceReminder, dollarsToInvoiceCents, generateDealInvoice } from "@/lib/brand-invoices";
import { currentViewer } from "@/lib/current-user";

function fail(code: string): never {
  redirect(`/invoices?error=${code}`);
}

export async function generateInvoiceAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amountCents: number | null = null;
  if (amountRaw) {
    const parsed = dollarsToInvoiceCents(amountRaw);
    if ("error" in parsed) fail("amount");
    amountCents = parsed.cents;
  }
  const netRaw = String(formData.get("netDays") ?? "").trim();
  const netDays = netRaw ? Number(netRaw) : null;
  const poNumber = String(formData.get("poNumber") ?? "").trim();
  const db = await getDb();
  const result = await generateDealInvoice(db, viewer, {
    dealId,
    amountCents,
    netDays: netRaw ? netDays : null,
    poNumber: poNumber || null,
  });
  if (!result.ok) fail(result.code);
  redirect(result.calledStripe ? "/invoices?saved=stripe" : "/invoices?saved=1");
}

export async function approveReminderAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await approveInvoiceReminder(db, viewer, String(formData.get("reminderId") ?? ""));
  if (!result.ok) fail(result.code);
  redirect("/invoices?saved=approved");
}
