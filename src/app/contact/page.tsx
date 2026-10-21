import { saveContactAction } from "@/app/company-actions";
import { PublicNoteForm } from "@/components/public-note-form";
import { PublicShell } from "@/components/public-shell";
import { companyNoteErrorNote } from "@/lib/company-notes";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_PHONE } from "@/lib/company-pages";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Contact Momma Mari",
    description: "Reach Kamron at Momma Mari. The form stays in the portal.",
    path: "/contact",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ saved?: string; noteError?: string }> }) {
  const params = await searchParams;
  const note = companyNoteErrorNote(params.noteError);
  return (
    <PublicShell title="Contact" lede="Write to Kamron. The form is saved in the portal. Nothing is emailed from it.">
      <p>Email <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a> or call {PUBLIC_CONTACT_PHONE}. There is no public street address.</p>
      {params.saved ? <p className="note">Saved in the portal. Nothing was emailed.</p> : null}
      {note ? <p className="private-note">{note}</p> : null}
      <PublicNoteForm action={saveContactAction} messageLabel="Message" submitLabel="Save message" />
    </PublicShell>
  );
}
