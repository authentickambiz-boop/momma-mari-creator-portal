"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import {
  addProspect,
  allocateCampaign,
  convertProspect,
  markOpenOutside,
  queueOutsideOffer,
  saveCampaign,
} from "@/lib/campaigns";
import { currentViewer } from "@/lib/current-user";
import { dollarsToCents } from "@/lib/deal-rules";

function tags(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value).trim()).filter(Boolean);
}

export async function filterCampaignsAction(formData: FormData) {
  const params = new URLSearchParams();
  const creator = String(formData.get("creator") ?? "");
  const niche = String(formData.get("niche") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim();
  const min = String(formData.get("min") ?? "").trim();
  const max = String(formData.get("max") ?? "").trim();
  if (creator) params.set("creator", creator);
  if (niche) params.set("niche", niche);
  if (platform) params.set("platform", platform);
  if (min) params.set("min", min);
  if (max) params.set("max", max);
  redirect(`/campaigns?${params.toString()}`);
}

export async function saveCampaignAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveCampaign(db, viewer, {
    brand: String(formData.get("brand") ?? ""),
    name: String(formData.get("name") ?? ""),
    budgetCents: dollarsToCents(String(formData.get("budget") ?? "")) ?? -1,
    niches: tags(formData, "niches"),
    platforms: tags(formData, "platforms"),
    deliverables: tags(formData, "deliverables"),
    slots: Number(formData.get("slots") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: String(formData.get("endsOn") ?? ""),
  });
  if (!result.ok) redirect(`/campaigns?campaignError=${encodeURIComponent(result.error)}`);
  redirect(`/campaigns/${result.id}?saved=1`);
}

export async function allocateCampaignAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const campaignId = String(formData.get("campaignId") ?? "");
  const db = await getDb();
  const result = await allocateCampaign(db, viewer, {
    campaignId,
    creatorId: String(formData.get("creatorId") ?? ""),
    amountCents: dollarsToCents(String(formData.get("amount") ?? "")) ?? -1,
  });
  const back = `/campaigns/${encodeURIComponent(campaignId)}`;
  if (!result.ok) redirect(`${back}?campaignError=${encodeURIComponent(result.error)}`);
  redirect(`${back}?saved=1`);
}

export async function markOutsideAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const campaignId = String(formData.get("campaignId") ?? "");
  const db = await getDb();
  const result = await markOpenOutside(db, viewer, campaignId);
  const back = `/campaigns/${encodeURIComponent(campaignId)}`;
  if (!result.ok) redirect(`${back}?campaignError=${encodeURIComponent(result.error)}`);
  redirect(`${back}?saved=1`);
}

export async function addProspectAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await addProspect(db, viewer, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    niches: tags(formData, "niches"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!result.ok) redirect(`/prospects?prospectError=${encodeURIComponent(result.error)}`);
  redirect("/prospects?saved=1");
}

export async function convertProspectAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await convertProspect(db, viewer, String(formData.get("prospectId") ?? ""), String(formData.get("creatorId") ?? ""));
  if (!result.ok) redirect(`/prospects?prospectError=${encodeURIComponent(result.error)}`);
  redirect("/prospects?saved=1");
}

export async function queueOutsideOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const campaignId = String(formData.get("campaignId") ?? "");
  const db = await getDb();
  const result = await queueOutsideOffer(db, viewer, {
    campaignId,
    prospectId: String(formData.get("prospectId") ?? ""),
    amountCents: dollarsToCents(String(formData.get("amount") ?? "")) ?? -1,
  });
  const back = `/campaigns/${encodeURIComponent(campaignId)}`;
  if (!result.ok) redirect(`${back}?campaignError=${encodeURIComponent(result.error)}`);
  redirect(`${back}?queued=1`);
}
