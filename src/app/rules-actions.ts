"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import {
  DELIVERABLES,
  dollarsToCents,
  saveDealRules,
  savePricingFloor,
  setCategoryOverride,
  type DealRules,
  type DeliverableId,
} from "@/lib/deal-rules";

export async function saveDealRulesAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const creatorId = String(formData.get("creatorId") ?? "");
  const db = await getDb();
  const minRates: DealRules["minRates"] = {};
  const targetRates: DealRules["targetRates"] = {};
  for (const item of DELIVERABLES) {
    const min = dollarsToCents(String(formData.get(`min-${item.id}`) ?? ""));
    const target = dollarsToCents(String(formData.get(`target-${item.id}`) ?? ""));
    if (min != null) minRates[item.id as DeliverableId] = min;
    if (target != null) targetRates[item.id as DeliverableId] = target;
  }
  const kids = String(formData.get("kidsOnCamera") ?? "");
  const rules: DealRules = {
    minRates,
    targetRates,
    minDealCents: dollarsToCents(String(formData.get("minDeal") ?? "")),
    blockedCategories: formData.getAll("blockedCategories").map((value) => String(value)),
    blockedBrands: formData.getAll("blockedBrands").map((value) => String(value)),
    maxDealsPerMonth: Number(formData.get("maxDeals") ?? "") || null,
    turnaround: String(formData.get("turnaround") ?? "").trim(),
    exclusivityMaxDays: Number(formData.get("exclusivityDays") ?? "") || null,
    usageMinDays: Number(formData.get("usageDays") ?? "") || null,
    kidsOnCamera: kids === "yes" || kids === "no" || kids === "limits" ? kids : "",
    kidsLimits: String(formData.get("kidsLimits") ?? "").trim(),
    typicalRateCents: dollarsToCents(String(formData.get("typicalRate") ?? "")),
    acceptedCategories: formData.getAll("acceptedCategories").map((value) => String(value)),
    acceptGifted: formData.get("acceptGifted") === "yes",
    acceptCommissionOnly: formData.get("acceptCommissionOnly") === "yes",
  };
  const result = await saveDealRules(db, viewer, creatorId, rules);
  const back = `/rules?creator=${encodeURIComponent(creatorId)}`;
  if (!result.ok) redirect(`${back}&rulesError=${encodeURIComponent(result.error)}`);
  redirect(`${back}&saved=1`);
}

export async function setCategoryOverrideAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const dealId = String(formData.get("dealId") ?? "");
  const db = await getDb();
  const result = await setCategoryOverride(db, viewer, dealId, formData.get("override") === "1");
  const back = `/deals/${encodeURIComponent(dealId)}`;
  if (!result.ok) redirect(`${back}?rulesError=${encodeURIComponent(result.error)}`);
  redirect(`${back}?saved=1`);
}

export async function savePricingFloorAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const cents = dollarsToCents(String(formData.get("minProfit") ?? ""));
  const creatorId = String(formData.get("creatorId") ?? "");
  const result = await savePricingFloor(db, viewer, cents ?? -1);
  const back = `/rules?creator=${encodeURIComponent(creatorId)}`;
  if (!result.ok) redirect(`${back}&rulesError=${encodeURIComponent(result.error)}`);
  redirect(`${back}&saved=1`);
}
