"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { saveBrandBrief } from "@/lib/brand-brief";
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
