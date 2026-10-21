"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { saveBrandBrief } from "@/lib/brand-brief";
import { giftGuideErrorCode, GIFT_GUIDE_OFFER, saveGiftGuideReservation } from "@/lib/gift-guide";
import { inquiryErrorCode } from "@/lib/inquiry-notes";

export async function brandInquiryAction(formData: FormData) {
  const db = await getDb();
  const result = await saveBrandBrief(db, {
    brand: String(formData.get("brand") ?? ""),
    companyWebsite: String(formData.get("companyWebsite") ?? ""),
    name: String(formData.get("name") ?? ""),
    title: String(formData.get("title") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    agency: String(formData.get("agency") ?? ""),
    clientBrand: String(formData.get("clientBrand") ?? ""),
    creators: formData.getAll("creators").map((value) => String(value)),
    goal: String(formData.get("goal") ?? ""),
    deliverables: String(formData.get("deliverables") ?? ""),
    budget: String(formData.get("budget") ?? ""),
    budgetKind: String(formData.get("budgetKind") ?? ""),
    usage: String(formData.get("usage") ?? ""),
    usageDuration: String(formData.get("usageDuration") ?? ""),
    exclusivity: String(formData.get("exclusivity") ?? ""),
    timeline: String(formData.get("timeline") ?? ""),
    approvals: String(formData.get("approvals") ?? ""),
    billingContact: String(formData.get("billingContact") ?? ""),
    billingEmail: String(formData.get("billingEmail") ?? ""),
    legalEntity: String(formData.get("legalEntity") ?? ""),
    poNeeded: String(formData.get("poNeeded") ?? ""),
    paymentTerms: String(formData.get("paymentTerms") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    deposit: String(formData.get("deposit") ?? ""),
    productSample: String(formData.get("productSample") ?? ""),
    heardAbout: String(formData.get("heardAbout") ?? ""),
    honeypot: String(formData.get("website") ?? ""),
  });
  if (!result.ok) redirect(`/inquire?error=${inquiryErrorCode(result.error)}`);
  redirect("/inquire?sent=1");
}

export async function giftGuideReservationAction(formData: FormData) {
  const db = await getDb();
  const result = await saveGiftGuideReservation(db, {
    brand: String(formData.get("brand") ?? ""),
    contactName: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
    productName: String(formData.get("productName") ?? ""),
    productUrl: String(formData.get("productUrl") ?? ""),
    retailPrice: String(formData.get("retailPrice") ?? ""),
    category: String(formData.get("category") ?? ""),
    packageId: String(formData.get("packageId") ?? ""),
    promoCode: String(formData.get("promoCode") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    ackPaid: String(formData.get("ackPaid") ?? ""),
    ackApproval: String(formData.get("ackApproval") ?? ""),
    ackKids: String(formData.get("ackKids") ?? ""),
    ackUpfront: String(formData.get("ackUpfront") ?? ""),
    honeypot: String(formData.get("fax") ?? ""),
  });
  const path = GIFT_GUIDE_OFFER.inquiryPath;
  if (!result.ok) redirect(`${path}&error=${giftGuideErrorCode(result.error)}`);
  redirect(`${path}&sent=1`);
}
