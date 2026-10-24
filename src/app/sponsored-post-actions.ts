"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { sponsoredErrorCode } from "@/lib/sponsored-post-notes";
import { saveSponsoredPost, saveSponsoredSnapshot, setSponsoredPostArchived, SNAPSHOT_METRICS } from "@/lib/sponsored-posts";

function destination(formData: FormData, key: string, value: string) {
  const params = new URLSearchParams();
  const fields = [
    ["returnCreator", "creator"],
    ["returnBrand", "brand"],
    ["returnSort", "sort"],
    ["returnDir", "dir"],
    ["returnShow", "show"],
  ] as const;
  for (const [formName, queryName] of fields) {
    const raw = String(formData.get(formName) ?? "").trim();
    if (raw) params.set(queryName, raw);
  }
  params.set(key, value);
  return `/sponsored-posts?${params.toString()}`;
}

function fail(formData: FormData, error: string): never {
  redirect(destination(formData, "sponsoredError", sponsoredErrorCode(error)));
}

export async function saveSponsoredPostAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveSponsoredPost(db, viewer, {
    id: String(formData.get("postId") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    creatorId: String(formData.get("creatorId") ?? ""),
    dealId: String(formData.get("dealId") ?? ""),
    campaignId: String(formData.get("campaignId") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    postUrl: String(formData.get("postUrl") ?? ""),
    postedOn: String(formData.get("postedOn") ?? ""),
    deliverableTerms: String(formData.get("deliverableTerms") ?? ""),
  });
  if (!result.ok) fail(formData, result.error);
  redirect(destination(formData, "saved", "post"));
}

export async function saveSponsoredSnapshotAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const metrics = Object.fromEntries(SNAPSHOT_METRICS.map((metric) => [metric, String(formData.get(metric) ?? "")]));
  const result = await saveSponsoredSnapshot(db, viewer, {
    postId: String(formData.get("postId") ?? ""),
    snapshotId: String(formData.get("snapshotId") ?? ""),
    checkpoint: String(formData.get("checkpoint") ?? ""),
    checkpointOther: String(formData.get("checkpointOther") ?? ""),
    note: String(formData.get("note") ?? ""),
    ...metrics,
  });
  if (!result.ok) fail(formData, result.error);
  redirect(destination(formData, "saved", "snapshot"));
}

export async function archiveSponsoredPostAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const flag = String(formData.get("archived") ?? "");
  if (flag !== "0" && flag !== "1") fail(formData, "Choose whether to archive this post.");
  const db = await getDb();
  const result = await setSponsoredPostArchived(db, viewer, String(formData.get("postId") ?? ""), flag === "1");
  if (!result.ok) fail(formData, result.error);
  redirect(destination(formData, "saved", flag === "1" ? "archived" : "restored"));
}
