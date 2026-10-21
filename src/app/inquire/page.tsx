import { BrandBriefForm } from "@/components/brand-brief-form";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { brandInquiryPrefill } from "@/lib/brand-recap";
import { inquiryErrorNote } from "@/lib/inquiry-notes";
import { publicPageMeta } from "@/lib/public-meta";
import { publicMeetCreator } from "@/lib/public-creators";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Work with us · Momma Mari",
    description: "Tell Momma Mari about a brand partnership. We reply within 3 business days.",
    path: "/inquire",
  }),
  robots: PUBLIC_ROBOTS,
};

const NOTES: Record<string, string> = {
  error: "Add the brand name and a real work email, then try again. Nothing was emailed.",
};

export default async function InquirePage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; with?: string; brand?: string }> }) {
  const params = await searchParams;
  const note = params.sent ? null : params.error ? inquiryErrorNote(params.error) ?? NOTES.error : null;
  const featured = params.with ? await publicMeetCreator(await getDb(), params.with) : null;
  const brand = brandInquiryPrefill(params.brand);
  return (
    <PublicShell title="Work with us" lede="Tell us about the campaign. We reply within 3 business days.">
      {params.sent ? (
        <div className="callout" role="status">
          <b>We have your brief.</b>
          <p>You&apos;ll hear from us within 3 business days.</p>
        </div>
      ) : (
        <>
          {note ? <p className="note">{note}</p> : null}
          {featured ? <p className="note">This brief starts with {featured.name}.</p> : null}
          <BrandBriefForm featuredId={featured?.id} brand={brand} />
        </>
      )}
    </PublicShell>
  );
}
