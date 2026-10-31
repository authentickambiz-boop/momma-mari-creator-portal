import Link from "next/link";
import { redirect } from "next/navigation";
import { chooseEmailSetupAction } from "@/app/actions";
import { CheckoutSuccessNote } from "@/components/checkout-success-note";
import { EmailSetupForm } from "@/components/email-setup-form";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PortalFrame } from "@/components/portal-frame";
import { QuestionStep } from "@/components/question-step";
import { CONNECTION_RETRY_NOTE } from "@/lib/account-connection-status";
import { emailSetupLabel, STRIPE_CATALOG } from "@/lib/email-setup";
import { publicBasePath } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";
import { FreeOnboardingForm, freeStepError, freeStepFrom } from "@/components/free-onboarding-form";
import { creatorIsFree } from "@/lib/account-tier";
import { freeOnboardingState } from "@/lib/free-onboarding";
import { onboardingPlatformId, onboardingPlatformLabel } from "@/lib/onboarding-fields";
import { gmailBridgeFirstLoginPrompt } from "@/lib/gmail-bridge-start";
import { emailSetupFor, gmailConnectionState, onboardingForCreator } from "@/lib/onboarding";
import { finishErrorNote } from "@/lib/finish-notes";
import { canOpenCharacterCreator } from "@/lib/worlds/character";
import { questionErrorNote } from "@/lib/question-notes";
import { questionnaireFor, stepIndex, type QuestionStepId } from "@/lib/questionnaire";

const GMAIL_ERRORS: Record<string, string> = {
  oauth: "Google didn't finish connecting your email. Try the button again.",
  no_refresh: "Google didn't give us a way to stay connected. Try Connect your email again and accept the permissions.",
  not_configured: "Email connection isn't set up on this server yet. Kamron still needs to add the encryption key.",
  creator_only: "Connect your email from your own sign-in. Kamron can't connect a creator's mailbox for her.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; connected?: string; done?: string; error?: string; gmail?: string; emailError?: string; setup?: string; hosted?: string; step?: string; questionError?: string; checkout?: string; freeError?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role === "manager") redirect("/");
  const creator = portal.viewed;
  const connection = creator ? await gmailConnectionState(portal.db, creator.id) : null;
  const profile = creator ? await onboardingForCreator(portal.db, creator.id) : null;
  const setup = creator ? await emailSetupFor(portal.db, creator.id) : null;
  const own = portal.viewer.role === "creator";
  if (creator && own && portal.viewer.creatorId && await creatorIsFree(portal.db, portal.viewer.creatorId)) {
    const state = await freeOnboardingState(portal.db, portal.viewer.creatorId);
    const step = freeStepFrom(state.firstIncomplete, params.step);
    return (
      <PortalFrame
        viewer={portal.viewer}
        tab="profile"
        creators={portal.creators}
        viewedId={portal.viewedId}
        hello={<div className="hello"><div><h1>Set up your free account</h1><p>Three steps. Each one saves when you press Next. You can skip and finish later.</p></div></div>}
      >
        <FreeOnboardingForm
          step={step}
          handles={state.handles}
          niche={state.niche}
          nicheOther={state.nicheOther}
          statNote={state.statNote}
          error={freeStepError(params.freeError)}
        />
      </PortalFrame>
    );
  }
  const quiz = creator && own ? await questionnaireFor(portal.db, creator.id) : null;
  const requested = params.step && stepIndex(params.step) >= 0 ? params.step : quiz?.step;
  const savedIndex = stepIndex(quiz?.step && quiz.step !== "done" ? quiz.step : "bot");
  const activeStep = (quiz && requested && stepIndex(requested) >= 0 && stepIndex(requested) <= savedIndex
    ? requested
    : quiz?.step && quiz.step !== "done"
      ? quiz.step
      : "niches") as QuestionStepId;
  const gmailError = params.gmail ? GMAIL_ERRORS[params.gmail] ?? CONNECTION_RETRY_NOTE : null;
  const choice = setup?.choice ?? null;
  const gmailPrompt = creator && own && choice !== "hosted"
    ? await gmailBridgeFirstLoginPrompt(portal.db, creator.id)
    : null;
  const readyForProfile = Boolean(connection?.connected) || (choice === "hosted" && Boolean(setup?.hostedEmailAddress));
  const finishNote = params.error
    ? finishErrorNote(params.error) ?? "That profile was not saved. Add a niche, a content style, rates, and at least one platform."
    : null;
  const wizardOpen = Boolean(quiz && !quiz.finished && creator && activeStep === "bot" && !profile?.finishedAt);
  const addOn = STRIPE_CATALOG.hostedCreatorEmail;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="connect"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>{own ? "Set up your portal" : "Creator onboarding"}</h1>
            <p>Choose how brand email should work, then answer a few questions so deals can be matched. You can finish later. Nothing is sent from here.</p>
          </div>
        </div>
      }
    >
      <CheckoutSuccessNote checkout={params.checkout} />
      {gmailError ? <p className="private-note" role="alert">{gmailError}</p> : null}
      {gmailPrompt ? <p className="callout">{gmailPrompt}</p> : null}
      {finishNote && !wizardOpen ? <p className="private-note" role="alert">{finishNote}</p> : null}
      {params.connected === "1" ? <p className="callout">Email connected. Finish the questions below.</p> : null}
      {params.done === "1" ? <p className="callout">You&apos;re set. Kamron has &quot;New creator ready for bot&quot; and will set the bot up with you.</p> : null}
      {params.hosted === "1" ? <p className="callout">Kamron has your hosted-email request. You can finish the profile while that address is set up.</p> : null}
      {!creator ? <p className="note empty">Pick a creator to see her profile.</p> : null}
      {creator && !choice && own && !profile?.finishedAt ? <EmailSetupForm error={params.emailError ?? null} /> : null}
      {creator && !choice && !own ? <p className="note">{creator.name} chooses her email setup from her own sign-in.</p> : null}
      {creator && choice === "business" && !connection?.connected ? (
        <div className="card">
          <h2>Create a business-only email</h2>
          <p>Use a new Gmail just for brand deals, then connect that address. This is separate from signing in.</p>
          <ul>
            <li>Open gmail.com and choose Create account.</li>
            <li>Pick an address brands will recognize, such as yourname.brands@gmail.com.</li>
            <li>Sign in to that new address once so you know the password.</li>
            <li>Connect it below. We never see the password.</li>
          </ul>
          {own ? <a className="btn" href={`${publicBasePath()}/api/auth/gmail`}>Connect your email</a> : <p className="note">{creator.name} connects this from her own sign-in.</p>}
        </div>
      ) : null}
      {creator && choice === "personal" && !connection?.connected ? (
        <div className="card">
          <h2>Connect your personal email</h2>
          <p>We only process brand-related mail. Your bot sorts those threads and labels them. Personal mail stays in your inbox and is not used here.</p>
          {own ? <a className="btn" href={`${publicBasePath()}/api/auth/gmail`}>Connect your email</a> : <p className="note">{creator.name} connects this from her own sign-in.</p>}
        </div>
      ) : null}
      {creator && choice === "hosted" && !profile?.finishedAt ? (
        <div className="card">
          <h2>Hosted business email</h2>
          <p>
            Your address will be {setup?.hostedEmailAddress}. Momma Mari owns @mommamari.com and the mailbox.
            You&apos;re on the roster, so the price is {addOn.roster.priceLabel}. The public price is {addOn.public.priceLabel}.
            Nothing is charged from this page. Kamron sets up the mailbox.
          </p>
        </div>
      ) : null}
      {creator && own && !profile?.finishedAt && choice ? (
        <form action={chooseEmailSetupAction}>
          <input type="hidden" name="emailSetup" value="reset" />
          <button className="btn ghost" type="submit">Choose a different email option</button>
        </form>
      ) : null}
      {quiz && !quiz.finished ? (
        <>
          <QuestionStep stepId={activeStep} answers={quiz.answers} error={questionErrorNote(params.questionError)} emailReady={readyForProfile} />
          {creator && activeStep === "bot" && !profile?.finishedAt ? (
            <OnboardingWizard
              creatorName={creator.name}
              suggestedBotName={`${creator.name} Bot`}
              error={params.error ?? null}
              emailReady={readyForProfile}
              niches={quiz.answers.niches}
              platforms={quiz.answers.platforms.filter((item) => onboardingPlatformId(item)).map((item) => onboardingPlatformLabel(onboardingPlatformId(item) ?? item))}
              brands={quiz.answers.brands}
            />
          ) : null}
        </>
      ) : null}
      {creator && profile?.finishedAt ? (
        <div className="card">
          <h2>{profile.botName}</h2>
          <p className="note">{choice ? emailSetupLabel(choice) : "Email setup not chosen"}</p>
          <p className="note">
            {connection?.gmailEmail
              ? `Email connected as ${connection.gmailEmail}`
              : choice === "hosted"
                ? `Your address will be ${setup?.hostedEmailAddress}. Roster price: ${addOn.roster.priceLabel}. Nothing is charged from this page.`
                : "Email not connected yet"}
          </p>
          <ul>
            <li>Niche: {profile.niche}</li>
            <li>Style: {profile.contentStyle}</li>
            <li>Kids&apos; ages: {profile.kidsAges || "Not shared"}</li>
            <li>Rates: {profile.rates}</li>
            <li>Favorite brands: {profile.favoriteBrands || "None listed"}</li>
            <li>Platforms: {profile.platforms.map(onboardingPlatformLabel).join(", ")}</li>
          </ul>
          <p className="note">Finished. Kamron sees &quot;New creator ready for bot&quot;.</p>
          {own && canOpenCharacterCreator(portal.viewer) ? (
            <div>
              <p>Design the bot other people will see in Worlds. You can skip this and change it later from Worlds Tools.</p>
              <p><Link href="/worlds/create">Create your character</Link></p>
              <p><Link href="/connect">Skip for now</Link></p>
            </div>
          ) : null}
          <Link href="/connect">Back to connected accounts</Link>
        </div>
      ) : null}
    </PortalFrame>
  );
}
