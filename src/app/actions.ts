"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { reviewApproval } from "@/lib/approvals";
import { approvalErrorCode } from "@/lib/approval-notes";
import { canApproveContract, canApproveEmail, canApproveVideo, canChangeDealStage, canCountersign, devLoginEnabled } from "@/lib/authz";
import { addManager, assignCreatorManagers, setManagerActive, setManagerPermissions } from "@/lib/managers";
import { teamErrorCode } from "@/lib/team-notes";
import { currentViewer } from "@/lib/current-user";
import { logOfferScreening, recordCreatorInterest, releaseOffer } from "@/lib/creator-interest";
import { approveContract, requestContractRevisions, saveChecklist, saveContract, setSigningFormat } from "@/lib/contracts";
import { countersignContract, setSignerIsMinor, signContract, uploadBrandSignedCopy } from "@/lib/signing";
import { CONTRACT_CHECKS } from "@/lib/contract-shared";
import { clearSafetyHold } from "@/lib/safety";
import { draftMonthlyReport, reportErrorCode } from "@/lib/report";
import { recordReferral, referralErrorCode, setReferralPerk } from "@/lib/referrals";
import { dismissCreatorNotice, reviewDraft } from "@/lib/video-review";
import { setDealStage } from "@/lib/deal-stage";
import { dealNoticeCode } from "@/lib/deal-notice-notes";
import { confirmLivePost, confirmProductReceived, markPayment, paymentErrorCode, saveShipment, submitLivePosts } from "@/lib/fulfillment";
import { productErrorCode } from "@/lib/product-notes";
import { isEmailSetup } from "@/lib/email-setup";
import { emailSetupErrorCode } from "@/lib/email-setup-notes";
import { dismissNotification, finishOnboarding, saveEmailSetup } from "@/lib/onboarding";
import { finishErrorCode } from "@/lib/finish-notes";
import { onboardingPlatformId } from "@/lib/onboarding-fields";
import { creatorStartPath, saveQuestionnaireStep } from "@/lib/questionnaire";
import { resolveLogin } from "@/lib/queries";
import { createSession, destroySession, sessionCookieName, sessionCookieOptions } from "@/lib/session";
import { requestClientIp } from "@/lib/request-ip";

export async function draftReportAction(formData: FormData) {
  const viewer = await currentViewer();
  const creatorId = String(formData.get("creatorId") ?? "");
  const month = String(formData.get("month") ?? "");
  const query = new URLSearchParams();
  if (creatorId) query.set("creator", creatorId);
  if (month) query.set("month", month);
  const back = `/report?${query.toString()}`;
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await draftMonthlyReport(db, {
    creatorId: creatorId || viewer.creatorId || "",
    month,
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`${back}&reportError=${reportErrorCode(result.error)}`);
  redirect(`${back}&drafted=1`);
}

function referralBack(creatorId: string) {
  return creatorId ? `/referrals?creator=${encodeURIComponent(creatorId)}` : "/referrals";
}

export async function setReferralPerkAction(formData: FormData) {
  const viewer = await currentViewer();
  const creatorId = String(formData.get("creatorId") ?? "");
  const back = referralBack(creatorId);
  if (!viewer) redirect("/login");
  const raw = String(formData.get("dollars") ?? "").trim();
  const amountCents = raw === "" ? null : Math.round(Number(raw) * 100);
  const db = await getDb();
  const result = await setReferralPerk(db, {
    amountCents: raw !== "" && !Number.isFinite(amountCents) ? Number.NaN : amountCents,
    actorRole: viewer.role,
  });
  const join = back.includes("?") ? "&" : "?";
  if (!result.ok) redirect(`${back}${join}referralError=${referralErrorCode(result.error)}`);
  redirect(`${back}${join}saved=1`);
}

export async function recordReferralAction(formData: FormData) {
  const viewer = await currentViewer();
  const creatorId = String(formData.get("creatorId") ?? "") || viewer?.creatorId || "";
  const back = referralBack(creatorId);
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await recordReferral(db, {
    referrerCreatorId: creatorId,
    referredName: String(formData.get("name") ?? ""),
    referredEmail: String(formData.get("email") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
    actorCreatorId: viewer.creatorId,
  });
  if (!result.ok) redirect(`${back}${back.includes("?") ? "&" : "?"}referralError=${referralErrorCode(result.error)}`);
  redirect(`${back}${back.includes("?") ? "&" : "?"}saved=1`);
}

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
    actorRole: viewer.role,
    note,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}stageError=${dealNoticeCode(result.error)}`);
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
  if (!viewer || !canChangeDealStage(viewer)) redirect("/login");
  const db = await getDb();
  const result = await releaseOffer(db, {
    dealId,
    actorEmail: viewer.email,
    actorRole: viewer.role,
    brandEmail: String(formData.get("brandEmail") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}releaseError=${dealNoticeCode(result.error)}`);
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
  if (!result.ok) redirect(`/deals/${dealId}?interestError=${dealNoticeCode(result.error)}`);
  if (result.decision === "declined") redirect("/?passed=1");
  redirect(`/deals/${dealId}`);
}

export async function reviewDraftAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  const back = `/deals/${dealId}${query}`;
  const viewer = await currentViewer();
  if (!viewer || !canApproveVideo(viewer)) redirect("/login");
  const db = await getDb();
  const result = await reviewDraft(db, {
    draftId: String(formData.get("draftId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    note: String(formData.get("note") ?? ""),
    brandEmail: String(formData.get("brandEmail") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) {
    const code = result.error.includes("held for Kamron")
      ? "held"
      : result.status === 400 && result.error.includes("brand email")
        ? "email"
        : result.status === 400
          ? "note"
          : "1";
    redirect(`${back}${query ? "&" : "?"}reviewError=${code}`);
  }
  redirect(back);
}

export async function clearSafetyAction(formData: FormData) {
  const viewer = await currentViewer();
  const back = String(formData.get("back") ?? "/safety");
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await clearSafetyHold(db, {
    draftId: String(formData.get("draftId") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  const join = back.includes("?") ? "&" : "?";
  if (!result.ok) {
    const code = result.error.includes("can't clear") ? "creator" : "owner";
    redirect(`${back}${join}safetyError=${code}`);
  }
  redirect(`${back}${join}cleared=1`);
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
  if (!viewer || !canApproveContract(viewer)) redirect("/login");
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
    actorRole: viewer.role,
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
  if (!viewer || !canApproveContract(viewer)) redirect("/login");
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
    const format = await setSigningFormat(db, { contractId, signingFormat, actorRole: viewer.role, actorEmail: viewer.email });
    if (!format.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(format.error)}`);
  }

  const saved = await saveChecklist(db, {
    contractId,
    checks,
    countersign,
    actorEmail: viewer.email,
    actorRole: viewer.role,
    moveStage: intent !== "approve",
  });
  if (!saved.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(saved.error)}`);

  if (intent === "revisions") {
    const result = await requestContractRevisions(db, {
      contractId,
      changes,
      brandEmail: String(formData.get("brandEmail") ?? ""),
      actorEmail: viewer.email,
      actorRole: viewer.role,
    });
    if (!result.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(result.error)}`);
  }

  if (intent === "approve") {
    const result = await approveContract(db, {
      contractId,
      actorEmail: viewer.email,
      actorRole: viewer.role,
    });
    if (!result.ok) redirect(`${back}${query ? "&" : "?"}contractError=${contractErrorCode(result.error)}`);
  }
  redirect(back);
}

async function clientAudit() {
  const headerList = await headers();
  return { ip: requestClientIp(headerList), userAgent: headerList.get("user-agent") || "unknown" };
}

function signBack(dealId: string, contractId: string, creator: string) {
  const creatorQuery = creator ? `&creator=${encodeURIComponent(creator)}` : "";
  return `/deals/${dealId}/sign?contract=${encodeURIComponent(contractId)}${creatorQuery}`;
}

function signErrorCode(error: string) {
  if (error.includes("both boxes")) return "boxes";
  if (error.includes("full legal name")) return "name";
  if (error.includes("parent or guardian has to sign")) return "guardian";
  if (error.includes("minor in this content")) return "content";
  if (error.includes("Draw your signature")) return "draw";
  if (error.includes("isn't a PDF")) return "pdf";
  if (error.includes("doesn't match")) return "mismatch";
  if (error.includes("signed contract can be queued")) return "signemail";
  if (error.includes("brand email")) return "email";
  if (error.includes("was replaced")) return "replaced";
  if (error.includes("already signed")) return "signed";
  if (error.includes("already past signing")) return "past";
  if (error.includes("isn't ready to sign")) return "ready";
  if (error.includes("only sign your own")) return "own";
  if (error.includes("needs review")) return "review";
  if (error.includes("completed signed PDF")) return "upload";
  return "1";
}

export async function signContractAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  const audit = await clientAudit();
  const result = await signContract(db, {
    contractId,
    actorEmail: viewer.email,
    actorRole: "creator",
    creatorId: viewer.creatorId,
    legalName: String(formData.get("legalName") ?? ""),
    signatureKind: String(formData.get("signatureKind") ?? ""),
    signaturePng: String(formData.get("signaturePng") ?? ""),
    consentEsign: formData.get("consentEsign") === "1",
    consentRead: formData.get("consentRead") === "1",
    guardianConfirm: formData.get("guardianConfirm") === "1",
    ip: audit.ip,
    userAgent: audit.userAgent,
  });
  if (!result.ok) redirect(`${signBack(dealId, contractId, "")}&signError=${signErrorCode(result.error)}`);
  redirect(`/deals/${dealId}?signed=1`);
}

export async function countersignContractAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const viewer = await currentViewer();
  if (!viewer || !canCountersign(viewer)) redirect("/login");
  const db = await getDb();
  const audit = await clientAudit();
  const result = await countersignContract(db, {
    contractId,
    actorEmail: viewer.email,
    actorRole: viewer.role,
    legalName: String(formData.get("legalName") ?? ""),
    signatureKind: String(formData.get("signatureKind") ?? ""),
    signaturePng: String(formData.get("signaturePng") ?? ""),
    consentEsign: formData.get("consentEsign") === "1",
    consentRead: formData.get("consentRead") === "1",
    ip: audit.ip,
    userAgent: audit.userAgent,
  });
  if (!result.ok) redirect(`${signBack(dealId, contractId, creator)}&signError=${signErrorCode(result.error)}`);
  const { back } = contractBack(dealId, creator);
  redirect(back);
}

export async function uploadBrandSignedCopyAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const { query, back } = contractBack(dealId, creator);
  const viewer = await currentViewer();
  if (!viewer || !canApproveContract(viewer)) redirect("/login");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${back}${query ? "&" : "?"}contractError=upload`);
  }
  const db = await getDb();
  const audit = await clientAudit();
  const result = await uploadBrandSignedCopy(db, {
    contractId,
    actorEmail: viewer.email,
    actorRole: viewer.role,
    filename: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    ip: audit.ip,
    userAgent: audit.userAgent,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}contractError=${signErrorCode(result.error)}`);
  redirect(back);
}

export async function setSignerMinorAction(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const { back } = contractBack(dealId, creator);
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  await setSignerIsMinor(db, {
    creatorId: String(formData.get("creatorId") ?? ""),
    minor: formData.get("minor") === "1",
    actorRole: "admin",
  });
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
  if (!isEmailSetup(raw)) redirect("/onboarding?emailError=choice");
  const result = await saveEmailSetup(db, viewer.creatorId, raw, String(formData.get("hostedEmail") ?? ""));
  if (!result.ok) redirect(`/onboarding?emailError=${emailSetupErrorCode(result.error)}`);
  redirect(raw === "hosted" ? "/onboarding?hosted=1" : "/onboarding?setup=1");
}

export async function finishOnboardingAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/login");
  const db = await getDb();
  const niche = formData.getAll("niche").map((value) => String(value)).filter(Boolean).join(", ");
  const brands = formData.getAll("favoriteBrands").map((value) => String(value)).filter(Boolean).join(", ");
  const result = await finishOnboarding(db, viewer.creatorId, {
    botName: String(formData.get("botName") ?? ""),
    niche,
    kidsAges: String(formData.get("kidsAges") ?? ""),
    contentStyle: String(formData.get("contentStyle") ?? ""),
    rates: String(formData.get("rates") ?? ""),
    favoriteBrands: brands,
    platforms: formData.getAll("platforms").map((value) => onboardingPlatformId(String(value)) ?? String(value)),
  });
  if (!result.ok) redirect(`/onboarding?step=bot&error=${finishErrorCode(result.error)}`);
  await saveQuestionnaireStep(db, viewer, { step: "bot", skip: false, pause: false, patch: {} });
  redirect("/onboarding?done=1");
}

export async function dismissNotificationAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "manager")) redirect("/login");
  const db = await getDb();
  await dismissNotification(db, String(formData.get("id") ?? ""), {
    role: viewer.role,
    managerId: viewer.managerId,
  });
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
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}approvalError=${approvalErrorCode(result.error)}`);
  redirect(back);
}

export async function addManagerAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await addManager(db, {
    actorRole: "admin",
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    permissions: {
      approveEmail: formData.get("approveEmail") === "1",
      approveVideo: formData.get("approveVideo") === "1",
      approveContract: formData.get("approveContract") === "1",
      countersign: formData.get("countersign") === "1",
      canPriceDeals: formData.get("canPriceDeals") === "1",
    },
  });
  if (!result.ok) redirect(`/team?teamError=${teamErrorCode(result.error)}`);
  redirect("/team");
}

export async function setManagerActiveAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await setManagerActive(db, {
    actorRole: "admin",
    managerId: String(formData.get("managerId") ?? ""),
    active: formData.get("active") === "1",
  });
  if (!result.ok) redirect(`/team?teamError=${teamErrorCode(result.error)}`);
  redirect("/team");
}

export async function setManagerPermissionsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await setManagerPermissions(db, {
    actorRole: "admin",
    managerId: String(formData.get("managerId") ?? ""),
    permissions: {
      approveEmail: formData.get("approveEmail") === "1",
      approveVideo: formData.get("approveVideo") === "1",
      approveContract: formData.get("approveContract") === "1",
      countersign: formData.get("countersign") === "1",
      canPriceDeals: formData.get("canPriceDeals") === "1",
    },
  });
  if (!result.ok) redirect(`/team?teamError=${teamErrorCode(result.error)}`);
  redirect("/team");
}

export async function assignManagersAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const primary = String(formData.get("primaryManagerId") ?? "");
  const backup = String(formData.get("backupManagerId") ?? "");
  const result = await assignCreatorManagers(db, {
    actorRole: "admin",
    creatorId: String(formData.get("creatorId") ?? ""),
    primaryManagerId: primary || null,
    backupManagerId: backup || null,
  });
  if (!result.ok) redirect(`/team?teamError=${teamErrorCode(result.error)}`);
  redirect("/team");
}

function dealBack(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const creator = String(formData.get("creator") ?? "");
  const query = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  return { back: `/deals/${dealId}${query}`, query };
}

export async function saveShipmentAction(formData: FormData) {
  const { back, query } = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer || !canChangeDealStage(viewer)) redirect("/login");
  const db = await getDb();
  const result = await saveShipment(db, {
    dealId: String(formData.get("dealId") ?? ""),
    carrier: String(formData.get("carrier") ?? ""),
    trackingNumber: String(formData.get("trackingNumber") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}productError=${productErrorCode(result.error)}`);
  redirect(back);
}

export async function confirmProductAction(formData: FormData) {
  const { back, query } = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await confirmProductReceived(db, {
    dealId: String(formData.get("dealId") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
    creatorId: viewer.creatorId,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}productError=${productErrorCode(result.error)}`);
  redirect(back);
}

export async function submitLivePostsAction(formData: FormData) {
  const { back, query } = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await submitLivePosts(db, {
    dealId: String(formData.get("dealId") ?? ""),
    links: [{ platform: String(formData.get("platform") ?? ""), url: String(formData.get("url") ?? "") }],
    actorEmail: viewer.email,
    actorRole: viewer.role,
    creatorId: viewer.creatorId,
  });
  if (!result.ok) {
    const code = result.status === 409 ? "early" : "1";
    redirect(`${back}${query ? "&" : "?"}postError=${code}`);
  }
  redirect(back);
}

export async function confirmLivePostAction(formData: FormData) {
  const { back, query } = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer || !canChangeDealStage(viewer)) redirect("/login");
  const db = await getDb();
  const result = await confirmLivePost(db, {
    postId: String(formData.get("postId") ?? ""),
    meetsBrief: String(formData.get("meetsBrief") ?? "") === "yes",
    queueEmail: formData.get("queueEmail") === "1",
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) {
    const code = result.error.includes("brand email") ? "email" : "1";
    redirect(`${back}${query ? "&" : "?"}postError=${code}`);
  }
  redirect(back);
}

export async function markPaymentAction(formData: FormData) {
  const { back, query } = dealBack(formData);
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "admin") redirect("/login");
  const db = await getDb();
  const result = await markPayment(db, {
    dealId: String(formData.get("dealId") ?? ""),
    paymentStatus: String(formData.get("paymentStatus") ?? ""),
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`${back}${query ? "&" : "?"}paymentError=${paymentErrorCode(result.error)}`);
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
  redirect(await creatorStartPath(db, result.viewer));
}
