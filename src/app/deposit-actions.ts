"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { markDealPaymentTiming, overrideDepositLock, setBrandBillingTerms, setDealDepositStatus } from "@/lib/brand-deposits";
import { currentViewer } from "@/lib/current-user";
import { depositErrorCode } from "@/lib/deposit-notes";

function dealBack(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  return `/deals/${dealId}${query}`;
}

export async function setDepositStatusAction(formData: FormData) {
  const back = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setDealDepositStatus(db, viewer, {
    dealId: String(formData.get("dealId") ?? ""),
    status: String(formData.get("status") ?? ""),
    invoicedOn: String(formData.get("invoicedOn") ?? ""),
    receivedOn: String(formData.get("receivedOn") ?? ""),
  });
  if (!result.ok) redirect(`${back}${back.includes("?") ? "&" : "?"}depositError=${depositErrorCode(result.error)}`);
  redirect(`${back}${back.includes("?") ? "&" : "?"}deposit=saved`);
}

export async function overrideDepositAction(formData: FormData) {
  const back = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await overrideDepositLock(db, viewer, {
    dealId: String(formData.get("dealId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) redirect(`${back}${back.includes("?") ? "&" : "?"}depositError=${depositErrorCode(result.error)}`);
  redirect(`${back}${back.includes("?") ? "&" : "?"}deposit=saved`);
}

export async function markPaymentTimingAction(formData: FormData) {
  const back = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await markDealPaymentTiming(db, viewer, {
    dealId: String(formData.get("dealId") ?? ""),
    dueOn: String(formData.get("dueOn") ?? ""),
    paidOn: String(formData.get("paidOn") ?? ""),
  });
  if (!result.ok) redirect(`${back}${back.includes("?") ? "&" : "?"}depositError=${depositErrorCode(result.error)}`);
  redirect(`${back}${back.includes("?") ? "&" : "?"}deposit=timing`);
}

export async function setBrandTermsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setBrandBillingTerms(db, viewer, {
    brand: String(formData.get("brand") ?? ""),
    terms: String(formData.get("terms") ?? ""),
  });
  if (!result.ok) redirect(`/brands?termsError=${depositErrorCode(result.error)}`);
  redirect("/brands?saved=terms");
}
