import { saveTalentAction } from "@/app/company-actions";
import { PublicNoteForm } from "@/components/public-note-form";
import { PublicShell } from "@/components/public-shell";
import { companyNoteErrorNote } from "@/lib/company-notes";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Momma Mari talent network",
    description: "There are no open roles listed. Leave a note for the talent network.",
    path: "/careers",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function CareersPage({ searchParams }: { searchParams: Promise<{ saved?: string; noteError?: string }> }) {
  const params = await searchParams;
  const note = companyNoteErrorNote(params.noteError);
  return (
    <PublicShell title="Careers" lede="No open roles are listed. This is a talent network, not a job board.">
      <p>Tell Kamron what you do. The note is saved in the portal. Nothing is emailed, and no role is invented here.</p>
      {params.saved ? <p className="note">Saved in the portal. Nothing was emailed.</p> : null}
      {note ? <p className="private-note">{note}</p> : null}
      <PublicNoteForm action={saveTalentAction} messageLabel="What you do" submitLabel="Save note" />
    </PublicShell>
  );
}
