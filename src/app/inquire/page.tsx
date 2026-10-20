import { brandInquiryAction } from "@/app/inquire-actions";
import { PublicShell } from "@/components/public-shell";
import { INQUIRY_SUBMIT_LABEL, PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  title: "Work with us · Momma Mari",
  description: "Tell Momma Mari about a brand partnership.",
  robots: PUBLIC_ROBOTS,
};

const NOTES: Record<string, string> = {
  sent: "Kamron has your note on the brand list. Nothing was emailed.",
  error: "Add the brand name and a real work email, then try again. Nothing was emailed.",
};

export default async function InquirePage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;
  const note = params.sent ? NOTES.sent : params.error ? NOTES.error : null;
  return (
    <PublicShell title="Work with us" lede="Tell Momma Mari what you want to make with a creator. This form saves a brand contact. It does not send an email.">
      {note ? <p className="note">{note}</p> : null}
      <form action={brandInquiryAction} className="card stack public-form">
        <label>Brand name
          <input name="brand" required autoComplete="organization" />
        </label>
        <label>Your name
          <input name="name" autoComplete="name" />
        </label>
        <label>Work email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>What are you looking for?
          <textarea name="note" rows={4} />
        </label>
        <button className="btn" type="submit">{INQUIRY_SUBMIT_LABEL}</button>
      </form>
    </PublicShell>
  );
}
