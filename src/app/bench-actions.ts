"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { approveBenchOffer, joinBench, promoteBench, queueBenchOffer, recordBenchPaid, setBenchScore } from "@/lib/bench";
import { currentViewer } from "@/lib/current-user";
import { benchErrorCode } from "@/lib/bench-notes";
import { dollarsToCents } from "@/lib/deal-rules";

function back(path: string, error: string): never {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}benchError=${benchErrorCode(error)}`);
}

export async function joinBenchAction(formData: FormData) {
  const db = await getDb();
  const samples = [0, 1, 2].map((index) => ({
    title: String(formData.get(`title-${index}`) ?? ""),
    url: String(formData.get(`url-${index}`) ?? ""),
  }));
  const result = await joinBench(db, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    niches: formData.getAll("niches").map((value) => String(value)),
    platforms: formData.getAll("platforms").map((value) => String(value)),
    samples,
  });
  if (!result.ok) back("/bench/join", result.error);
  redirect("/bench/join?saved=1");
}

export async function setBenchScoreAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setBenchScore(db, viewer, String(formData.get("benchId") ?? ""), Number(formData.get("score") ?? ""));
  if (!result.ok) back("/bench", result.error);
  redirect("/bench?saved=1");
}

export async function promoteBenchAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await promoteBench(db, viewer, String(formData.get("benchId") ?? ""), String(formData.get("creatorId") ?? ""));
  if (!result.ok) back("/bench", result.error);
  redirect("/bench?saved=1");
}

export async function queueBenchOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await queueBenchOffer(db, viewer, {
    campaignId: String(formData.get("campaignId") ?? ""),
    benchId: String(formData.get("benchId") ?? ""),
    amountCents: dollarsToCents(String(formData.get("amount") ?? "")) ?? -1,
  });
  if (!result.ok) back("/bench", result.error);
  redirect("/bench?saved=1");
}

export async function approveBenchOfferAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await approveBenchOffer(db, viewer, String(formData.get("offerId") ?? ""));
  if (!result.ok) back("/bench", result.error);
  redirect("/bench?saved=1");
}

export async function recordBenchPaidAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await recordBenchPaid(db, viewer, String(formData.get("offerId") ?? ""));
  if (!result.ok) back("/bench", result.error);
  redirect("/bench?saved=1");
}
