import { IntakeForm } from "@/components/intake-form";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { applyFormNote, CREATOR_BENEFITS } from "@/lib/creator-apply";
import { intakeFormNote, isIntakeStep, loadResumeDraft, type IntakeSubmission } from "@/lib/intake-form";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";
export const metadata = {
  ...publicPageMeta({
    title: "Apply to join Momma Mari",
    description: "Apply to join the Momma Mari creator roster. We reply within 5 business days.",
    path: "/apply",
  }),
  robots: PUBLIC_ROBOTS,
};

const EMPTY: IntakeSubmission = {
  legalName: "",
  preferredName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  addressState: "",
  zip: "",
  country: "United States",
  stateOfResidence: "",
  platforms: [],
  niches: [],
  goals: [],
  goalsText: "",
  kidsInContent: "",
  kidsCount: "",
  kidsAges: [],
  familyNotes: "",
  currentRates: "",
  analyticsMode: "",
  files: [],
  consentAccuracy: false,
};

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ error?: string; intakeError?: string; step?: string; token?: string; saved?: string }> }) {
  const params = await searchParams;
  const note = intakeFormNote(params.intakeError) ?? applyFormNote(params.error);
  const step = isIntakeStep(params.step) ? params.step : "contact";
  const db = await getDb();
  const draft = params.token ? await loadResumeDraft(db, params.token) : null;
  const resumeNote = params.token && !draft ? intakeFormNote("resume") : null;
  const savedNote = params.saved ? "Draft saved. Keep this link to come back. Nothing was emailed." : null;
  return (
    <PublicShell title="Apply to join Momma Mari" lede="Tell us about your content. The application collects what an interview needs. There is no fee to apply.">
      <div className="apply-split">
      <aside className="apply-side">
        <p className="eyebrow">Apply to join</p>
        <h2>Let&apos;s see if we&apos;re a fit.</h2>
        <p>We read every application. There is no fee. If you are still growing, start with a free account and the where-to-start lessons, or send this application for management.</p>
        <ol className="apply-steps">
          <li><span>1</span><div><strong>We review</strong><p>Contact, address, platforms, goals, and analytics stay on the owner&apos;s dashboard.</p></div></li>
          <li><span>2</span><div><strong>We let you know</strong><p>If it&apos;s a fit, your portal account opens. You&apos;ll hear from us within 5 business days.</p></div></li>
          <li><span>3</span><div><strong>Welcome aboard</strong><p>You sign in with the Google account on this application.</p></div></li>
        </ol>
        <p className="caption">We never ask for passwords or bank details in this form.</p>
      </aside>
      <div>
      <p className="sec-title">What you get</p>
      <div className="public-grid">
        {CREATOR_BENEFITS.map((benefit) => (
          <article key={benefit.title} className="card">
            <h2>{benefit.title}</h2>
            <p>{benefit.body}</p>
          </article>
        ))}
      </div>
      <p className="sec-title">Application</p>
      <PrivacyNotice />
      {savedNote ? <p className="note">{savedNote}</p> : null}
      <div className="leave-blank" aria-hidden="true">
        <label>Leave this blank
          <input name="website" form="intake-form" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <IntakeForm
        intent="apply"
        step={draft ? step : params.token ? "contact" : step}
        token={draft?.token ?? ""}
        values={draft?.values ?? EMPTY}
        hasRates={draft?.hasRates ?? false}
        note={note ?? resumeNote}
      />
      </div>
      </div>
    </PublicShell>
  );
}
