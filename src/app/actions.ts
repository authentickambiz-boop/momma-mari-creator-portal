"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { reviewApproval } from "@/lib/approvals";
import { canApproveEmail, canChangeDealStage, devLoginEnabled } from "@/lib/authz";
import { currentViewer } from "@/lib/current-user";
import { logOfferScreening, recordCreatorInterest, releaseOffer } from "@/lib/creator-interest";
import { approveContract, requestContractRevisions, saveChecklist, saveContract, setSigningFormat } from "@/lib/contracts";
import { CONTRACT_CHECKS } from "@/lib/contract-shared";
import { dismissCreatorNotice, reviewDraft } from "@/lib/video-review";
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

export async function reviewDraftAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  const back = `/deals/${dealId}${query}`;
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await reviewDraft(db, {
    draftId: String(formData.get("draftId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    note: String(formData.get("note") ?? ""),
    brandEmail: String(formData.get("brandEmail") ?? ""),
    actorEmail: viewer.email,
    actorRole: "admin",
  });
  if (!result.ok) {
    const code = result.status === 400 && result.error.includes("brand email") ? "email" : result.status === 400 ? "note" : "1";
    redirect(`${back}${query ? "&" : "?"}reviewError=${code}`);
  }
  redirect(back);
}

function contractBack(dealId: string, creator: string) {
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  return { query, back: `/deals/${dealId}${query}` };
}

function contractErrorCode(error: string) {
  if (error.includes("past the contract")) return "past";
  if (error.includes("needs review before signing")) return "review";
  if (error.includes("PDF or DOCX") || error.includes("20 MB")) return "type";
  if (error.includes("brand email")) return "email";
  if (error.includes("checklist") || error.includes("changes to request")) return "changes";
  return "1";
}

export async function uploadContractAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const { query, back } = contractBack(dealId, creator);
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${back}${query ? "&" : "?"}contractError=type`);
  }
  const db = await getDb();
  const result = await saveContract(db, {
    dealId,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
    docusign: formData.get("docusign") === "1",
    countersign: formData.get("countersign") === "1",
    actorEmail: viewer.email,
    actorRole: "admin",
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(result.error)}`);
  redirect(back);
}

export async function contractReviewAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const { query, back } = contractBack(dealId, creator);
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const intent = String(formData.get("intent") ?? "save");
  const checks = CONTRACT_CHECKS.map((item) => ({
    item: item.id,
    status: String(formData.get(`status:${item.id}`) ?? "unchecked"),
    note: String(formData.get(`note:${item.id}`) ?? ""),
  }));
  const countersign = formData.get("countersign") === "1";
  const signingFormat = String(formData.get("signingFormat") ?? "");
  const db = await getDb();
  const changes = String(formData.get("changes") ?? "");
  const issueCount = checks.filter((check) => check.status === "issue").length;

  if (intent === "approve" && signingFormat === "needs_review") {
    redirect(`${back}${query ? "&" : "?"}contractError=review`);
  }
  if (intent === "revisions" && issueCount === 0 && !changes.trim()) {
    redirect(`${back}${query ? "&" : "?"}contractError=changes`);
  }

  if (signingFormat) {
    const format = await setSigningFormat(db, { contractId, signingFormat, actorRole: "admin" });
    if (!format.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(format.error)}`);
  }

  const saved = await saveChecklist(db, {
    contractId,
    checks,
    countersign,
    actorEmail: viewer.email,
    actorRole: "admin",
    moveStage: intent !== "approve",
  });
  if (!saved.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(saved.error)}`);

  if (intent === "revisions") {
    const result = await requestContractRevisions(db, {
      contractId,
      changes,
      brandEmail: String(formData.get("brandEmail") ?? ""),
      actorEmail: viewer.email,
      actorRole: "admin",
    });
    if (!result.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(result.error)}`);
  }

  if (intent === "approve") {
    const result = await approveContract(db, {
      contractId,
      actorEmail: viewer.email,
      actorRole: "admin",
    });
    if (!result.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(result.error)}`);
  }
  redirect(back);
}

export async function dismissCreatorNoticeAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  await dismissCreatorNotice(db, viewer.creatorId, String(formData.get("id") ?? ""));
  const dealId = String(formData.get("dealId") ?? "");
  redirect(dealId ? `/deals/${dealId}` : "/");
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
