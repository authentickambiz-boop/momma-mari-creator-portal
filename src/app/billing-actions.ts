"use server";

import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/current-user";
import { createPaymentLink } from "@/lib/stripe-billing";

export async function prepareHostedEmailLinkAction() {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "creator" || !viewer.creatorId) redirect("/billing?stripe=creator_only");
  const result = await createPaymentLink({ priceId: process.env.STRIPE_PRICE_HOSTED_EMAIL ?? "" });
  if (!result.ok) redirect(result.status === 503 ? "/billing?stripe=off" : "/billing?stripe=error");
  redirect("/billing?stripe=ready");
}
