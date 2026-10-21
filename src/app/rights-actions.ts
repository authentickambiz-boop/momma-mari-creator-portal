"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { rightsErrorCode } from "@/lib/rights-notes";
import { dollarsToCents } from "@/lib/payout-ledger";
import { bookUsageRenewalFee } from "@/lib/usage-renewal";
import { saveUsageRights } from "@/lib/usage";

export async function saveUsageRightsAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const exclusivityEnds = String(formData.get("exclusivityEndsOn") ?? "").trim();
  const tierRaw = String(formData.get("tier") ?? "").trim();
  const perpetualOverride = tierRaw === "perpetual";
  const tier = perpetualOverride ? "perpetual" as const : tierRaw === "" ? null : Number(tierRaw);
  const channels = formData.getAll("channels").map((value) => String(value));
  const feeRaw = String(formData.get("renewalFee") ?? "").trim();
  let renewalFeeCents: number | null | undefined;
  if (feeRaw) {
    const parsed = dollarsToCents(feeRaw, false);
    if (!("cents" in parsed)) redirect(`/rights?rightsError=${rightsErrorCode(parsed.error)}`);
    renewalFeeCents = parsed.cents;
  }
  const dealId = String(formData.get("dealId") ?? "");
  const result = await saveUsageRights(db, {
    dealId,
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: null,
    tier,
    channels,
    perpetualOverride,
    renewalFeeCents,
    usageType: String(formData.get("usageType") ?? ""),
    territory: String(formData.get("territory") ?? ""),
    exclusivityCategory: String(formData.get("exclusivityCategory") ?? ""),
    exclusivityEndsOn: exclusivityEnds || null,
    actorEmail: viewer.email,
    actorRole: viewer.role,
  });
  if (!result.ok) redirect(`/rights?rightsError=${rightsErrorCode(result.error)}`);
  if (renewalFeeCents != null) {
    const booked = await bookUsageRenewalFee(db, viewer, { dealId, amountCents: renewalFeeCents });
    if (!booked.ok) redirect(`/rights?rightsError=${rightsErrorCode(booked.error)}`);
  }
  redirect("/rights?saved=1");
}
