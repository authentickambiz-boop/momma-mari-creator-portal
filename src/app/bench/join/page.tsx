import Link from "next/link";
import { IntakeForm } from "@/components/intake-form";
import { getDb } from "@/db/getDb";
import { benchErrorNote } from "@/lib/bench-notes";
import { intakeFormNote, isIntakeStep, loadResumeDraft, type IntakeSubmission } from "@/lib/intake-form";

export const metadata = { robots: { index: false, follow: false } };

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

export default async function JoinBenchPage({ searchParams }: { searchParams: Promise<{ saved?: string; benchError?: string; intakeError?: string; step?: string; token?: string }> }) {
  const params = await searchParams;
  const step = isIntakeStep(params.step) ? params.step : "contact";
  const db = await getDb();
  const draft = params.token ? await loadResumeDraft(db, params.token) : null;
  const note = intakeFormNote(params.intakeError) ?? (params.token && !draft ? intakeFormNote("resume") : null);
  return (
    <main className="wrap">
      <h1>Join the bench</h1>
      <p>This is free. There is no fee and no subscription. Roster creators see a job first. You are offered what they pass on. Momma Mari reviews each offer. The 20% applies only when a job is paid. The same application is required here. Creators still growing go to the curriculum.</p>
      {params.saved === "bench" ? <p className="note">You are on the bench. There is no fee.</p> : null}
      {benchErrorNote(params.benchError) ? <p className="private-note">{benchErrorNote(params.benchError)}</p> : null}
      <IntakeForm
        intent="bench"
        step={step}
        token={draft?.token ?? ""}
        values={draft?.values ?? EMPTY}
        hasRates={draft?.hasRates ?? false}
        note={note}
      />
      <p><Link href="/gifts/apply">Free products, if you are already on the bench</Link></p>
      <p><Link href="/login">Creator sign-in</Link></p>
    </main>
  );
}
