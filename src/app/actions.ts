"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { canChangeDealStage, devLoginEnabled } from "@/lib/authz";
import { currentViewer } from "@/lib/current-user";
import { setDealStage } from "@/lib/deal-stage";
import { dismissNotification, finishOnboarding } from "@/lib/onboarding";
import { resolveLogin } from "@/lib/queries";
import { createSession, destroySession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function logoutAction() {
  const jar = await cookies();
  const db = await getDb();
  await destroySession(db, jar.get(sessionCookieName())?.value);
  jar.delete(sessionCookieName());
  redirect("/login");
}

export async function changeDealStageAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  const back = `/deals/${dealId}${query}`;
  const viewer = await currentViewer();
  if (!viewer || !canChangeDealStage(viewer)) redirect("/login");
  const db = await getDb();
  const note = String(formData.get("note") ?? "").trim();
  const result = await setDealStage(db, {
    dealId,
    toStage: String(formData.get("workflowStage") ?? ""),
    actorEmail: viewer.email,
    actorRole: "admin",
    note,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}stageError=1`);
  redirect(back);
}

export async function finishOnboardingAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  const result = await finishOnboarding(db, viewer.creatorId, {
    botName: String(formData.get("botName") ?? ""),
    niche: String(formData.get("niche") ?? ""),
    kidsAges: String(formData.get("kidsAges") ?? ""),
    contentStyle: String(formData.get("contentStyle") ?? ""),
    rates: String(formData.get("rates") ?? ""),
    favoriteBrands: String(formData.get("favoriteBrands") ?? ""),
    platforms: formData.getAll("platforms").map((value) => String(value)),
  });
  if (!result.ok) redirect("/onboarding?error=1");
  redirect("/onboarding?done=1");
}

export async function dismissNotificationAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  await dismissNotification(db, String(formData.get("id") ?? ""));
  redirect("/");
}

export async function devLoginAction(formData: FormData) {
  if (!devLoginEnabled()) redirect("/login?error=dev_disabled");
  const email = String(formData.get("email") ?? "");
  const db = await getDb();
  const result = await resolveLogin(db, email);
  if (!result.ok) redirect("/login?error=not_allowed");
  const session = await createSession(db, result.viewer);
  const jar = await cookies();
  jar.set(sessionCookieName(), session.cookieValue, sessionCookieOptions());
  redirect("/");
}
