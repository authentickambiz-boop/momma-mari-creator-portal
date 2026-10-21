import type { Metadata } from "next";
import { BrandBriefForm } from "@/components/brand-brief-form";
import { GiftGuideForm } from "@/components/gift-guide-form";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { brandInquiryPrefill } from "@/lib/brand-recap";
import { GIFT_GUIDE_OFFER, giftGuideErrorNote } from "@/lib/gift-guide";
import { inquiryErrorNote } from "@/lib/inquiry-notes";
import { publicPageMeta } from "@/lib/public-meta";
import { publicMeetCreator } from "@/lib/public-creators";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

const NOTES: Record<string, string> = {
  error: "Add the brand name and a real work email, then try again. Nothing was emailed.",
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ program?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  if (params.program === GIFT_GUIDE_OFFER.program) {
    return {
      ...publicPageMeta({
        title: "Reserve a Holiday Gift Guide spot · Momma Mari",
        description: "Reserve a spot in the Momma Mari Holiday Gift Guide 2026. Reserving is free.",
        path: GIFT_GUIDE_OFFER.inquiryPath,
      }),
      robots: PUBLIC_ROBOTS,
    };
  }
  return {
    ...publicPageMeta({
      title: "Work with us · Momma Mari",
      description: "Tell Momma Mari about a brand partnership. We reply within 3 business days.",
      path: "/inquire",
    }),
    robots: PUBLIC_ROBOTS,
  };
}

export default async function InquirePage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; with?: string; brand?: string; program?: string }> }) {
  const params = await searchParams;
  const giftGuide = params.program === GIFT_GUIDE_OFFER.program;
  const note = params.sent
    ? null
    : params.error
      ? (giftGuide ? giftGuideErrorNote(params.error) : inquiryErrorNote(params.error)) ?? (giftGuide ? "Check the reservation and try again. Nothing was charged." : NOTES.error)
      : null;
  const featured = !giftGuide && params.with ? await publicMeetCreator(await getDb(), params.with) : null;
  const brand = brandInquiryPrefill(params.brand);
  return (
    <PublicShell
      title={giftGuide ? "Reserve a Holiday Gift Guide spot" : "Work with us"}
      lede={giftGuide ? `${GIFT_GUIDE_OFFER.lede} ${GIFT_GUIDE_OFFER.reserveNote}` : "Tell us about the campaign. We reply within 3 business days."}
    >
      {params.sent ? (
        giftGuide ? (
          <div className="callout" role="status">
            <b>We have your reservation.</b>
            <p>Nothing was charged. We will follow up after the reservation is reviewed.</p>
          </div>
        ) : (
          <div className="callout" role="status">
            <b>We have your brief.</b>
            <p>You&apos;ll hear from us within 3 business days.</p>
          </div>
        )
      ) : (
        <>
          {note ? <p className="note">{note}</p> : null}
          {featured ? <p className="note">This brief starts with {featured.name}.</p> : null}
          {giftGuide ? <GiftGuideForm /> : <BrandBriefForm featuredId={featured?.id} brand={brand} />}
        </>
      )}
    </PublicShell>
  );
}
