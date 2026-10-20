"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { beginCreatorCheckout, createBillingPortalSession, paymentsEnabled, readCreatorBilling } from "@/lib/payments";
import { creatorIsSigned, setCreatorSigned } from "@/lib/signed-creators";
import { createPaymentLink, stripeLiveEnabled } from "@/lib/stripe-billing";

export async function prepareHostedEmailLinkAction() {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/billing?stripe=creator_only");
  if (!stripeLiveEnabled()) redirect("/billing?stripe=off");
  const result = await createPaymentLink({ priceId: process.env.STRIPE_PRICE_HOSTED_EMAIL ?? "" });
  if (!result.ok) redirect(result.status === 503 ? "/billing?stripe=off" : "/billing?stripe=error");
  redirect("/billing?stripe=ready");
}

export async function startCheckoutAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/billing?checkout=creator_only");
  const db = await getDb();
  const billing = await readCreatorBilling(db, viewer.creatorId);
  const result = await beginCreatorCheckout(db, {
    offerId: String(formData.get("offer") ?? ""),
    interval: String(formData.get("interval") ?? ""),
    email: viewer.email,
    creatorId: viewer.creatorId,
    customerId: billing.stripeCustomerId,
    memberPlan: billing.subscriptionPlan,
    memberStatus: billing.subscriptionStatus,
    signed: await creatorIsSigned(db, viewer.creatorId),
  });
  if (!result.ok) redirect(result.status === 503 || !paymentsEnabled() ? "/billing?checkout=off" : "/billing?checkout=error");
  redirect(result.url);
}

export async function setCreatorSignedAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await setCreatorSigned(db, viewer, String(formData.get("creatorId") ?? ""), formData.get("signed") === "1");
  if (!result.ok) redirect(`/dashboard?signed=${result.code}`);
  redirect("/dashboard?saved=1");
}

export async function manageBillingAction() {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/billing?checkout=creator_only");
  const db = await getDb();
  const billing = await readCreatorBilling(db, viewer.creatorId);
  const session = await createBillingPortalSession({ customerId: billing.stripeCustomerId });
  redirect(session.url);
}
