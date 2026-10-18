"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { reviewApproval } from "@/lib/approvals";
import { canApproveEmail, canChangeDealStage, devLoginEnabled } from "@/lib/authz";
import { currentViewer } from "@/lib/current-user";
import { logOfferScreening, recordCreatorInterest, releaseOffer } from "@/lib/creator-interest";
import { setDealStage } from "@/lib/deal-stage";
import { isEmailSetup } from "@/lib/email-setup";
import { dismissNotification, finishOnboarding, saveEmailSetup } from "@/lib/onboarding";
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
  if (String(formData.get("workflowStage") ?? "") === "offer_shared") {
    await logOfferScreening(db, { dealId, actorEmail: viewer.email, note });
  }
  redirect(back);
}

export async function releaseOfferAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  const back = `/deals/${dealId}${query}`;
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await releaseOffer(db, {
    dealId,
    actorEmail: viewer.email,
    actorRole: "admin",
    brandEmail: String(formData.get("brandEmail") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) {
    const code = result.status === 409 ? "past" : "1";
    redirect(`${back}${query ? "&" : "?"}releaseError=${code}`);
  }
  redirect(back);
}

export async function creatorInterestAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  const decision = String(formData.get("decision") ?? "");
  const result = await recordCreatorInterest(db, {
    dealId,
    creatorId: viewer.creatorId,
    creatorEmail: viewer.email,
    creatorName: viewer.name,
    decision,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect(`/deals/${dealId}?interestError=1`);
  if (result.decision === "declined") redirect("/?passed=1");
  redirect(`/deals/${dealId}`);
}

export async function chooseEmailSetupAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const raw = String(formData.get("emailSetup") ?? "");
  const db = await getDb();
  if (raw === "reset") {
    await saveEmailSetup(db, viewer.creatorId, "reset");
    redirect("/onboarding");
  }
  if (!isEmailSetup(raw)) redirect("/onboarding?emailError=1");
  const result = await saveEmailSetup(db, viewer.creatorId, raw, String(formData.get("hostedEmail") ?? ""));
  if (!result.ok) redirect("/onboarding?emailError=1");
  redirect(raw === "hosted" ? "/onboarding?hosted=1" : "/onboarding?setup=1");
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

export async function reviewApprovalAction(formData: FormData) {
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  const back = `/approvals${query}`;
  const viewer = await currentViewer();
  if (!viewer || !canApproveEmail(viewer)) redirect("/login");
  const db = await getDb();
  const result = await reviewApproval(db, {
    approvalId: String(formData.get("approvalId") ?? ""),
    intent: String(formData.get("intent") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    note: String(formData.get("note") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}approvalError=1`);
  redirect(back);
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
