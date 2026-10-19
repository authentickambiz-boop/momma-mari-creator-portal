import Link from "next/link";
import { saveQuestionnaireAction } from "@/app/question-actions";
import { TagPicker } from "@/components/tag-picker";
import { BRAND_OPTIONS, FORMAT_OPTIONS, LANGUAGE_OPTIONS, LOCATION_OPTIONS, NICHE_CATALOG, PLATFORM_OPTIONS } from "@/lib/niche-catalog";
import { AGE_RANGES, AUDIENCE_RANGES } from "@/lib/profile-shared";
import {
  AUDIENCE_AGE_OPTIONS,
  CAMERA_OPTIONS,
  FREQUENCY_OPTIONS,
  GENDER_OPTIONS,
  QUESTION_STEPS,
  RATE_FIELDS,
  SHIPPING_OPTIONS,
  TURNAROUND_OPTIONS,
  nextStep,
  stepIndex,
  type QuestionnaireAnswers,
  type QuestionStepId,
} from "@/lib/questionnaire";

export function QuestionStep({
  stepId,
  answers,
  error,
  emailReady,
}: {
  stepId: QuestionStepId;
  answers: QuestionnaireAnswers;
  error: string | null;
  emailReady: boolean;
}) {
  const index = stepIndex(stepId);
  const step = QUESTION_STEPS[index];
  const previous = QUESTION_STEPS[index - 1]?.id;
  const width = Math.round(((index + 1) / QUESTION_STEPS.length) * 100);
  return (
    <form action={saveQuestionnaireAction} className="card wizard">
      <p className="note">Step {index + 1} of {QUESTION_STEPS.length}{step.optional ? " · Optional" : ""}</p>
      <div className="progress" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
      <h2>{step.title}</h2>
      {error ? <p className="private-note">{error}</p> : null}
      {stepId === "niches" ? <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={answers.niches} placeholder="Search niches" /> : null}
      {stepId === "platforms" ? (
        <>
          <TagPicker name="platforms" label="Platforms" options={PLATFORM_OPTIONS} selected={answers.platforms} />
          {PLATFORM_OPTIONS.map((platform) => (
            <label key={platform}>
              {platform} handle
              <input name={`handle${platform}`} defaultValue={answers.handles[platform] ?? ""} placeholder="@name" />
            </label>
          ))}
        </>
      ) : null}
      {stepId === "audience" ? (
        <>
          <label>
            Audience size
            <select name="audienceSize" defaultValue={answers.audienceSize}>
              <option value="">Choose a range</option>
              {AUDIENCE_RANGES.map((range) => <option key={range}>{range}</option>)}
            </select>
          </label>
          <label>
            Audience age
            <select name="audienceAge" defaultValue={answers.audienceAge}>
              <option value="">Choose an age</option>
              {AUDIENCE_AGE_OPTIONS.map((range) => <option key={range}>{range}</option>)}
            </select>
          </label>
          <label>
            Gender split
            <select name="genderSplit" defaultValue={answers.genderSplit}>
              <option value="">Choose a split</option>
              {GENDER_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <TagPicker name="locations" label="Top locations" options={LOCATION_OPTIONS} selected={answers.locations} placeholder="Country or state" />
        </>
      ) : null}
      {stepId === "formats" ? <TagPicker name="formats" label="Formats" options={FORMAT_OPTIONS} selected={answers.formats} /> : null}
      {stepId === "frequency" ? (
        <label>
          Posting frequency
          <select name="frequency" defaultValue={answers.frequency}>
            <option value="">Choose one</option>
            {FREQUENCY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      ) : null}
      {stepId === "rates" ? (
        <>
          <p className="note">A dollar amount for each deliverable you offer. This stays on your sign-in.</p>
          {RATE_FIELDS.map((field) => (
            <label key={field}>
              {field}
              <input name={`rate${field}`} defaultValue={answers.rates[field] ?? ""} placeholder="$500" />
            </label>
          ))}
        </>
      ) : null}
      {stepId === "brands" ? (
        <>
          <TagPicker name="brands" label="Brands you have worked with" options={BRAND_OPTIONS} selected={answers.brands} />
          <TagPicker name="blocked" label="Brands or categories you won't work with" options={BRAND_OPTIONS} selected={answers.blocked} placeholder="Search or add" />
        </>
      ) : null}
      {stepId === "kids" ? (
        <>
          <p className="note">Optional. Age ranges only. You can skip this.</p>
          <TagPicker name="kidAges" label="Kids' age ranges" options={AGE_RANGES} selected={answers.kidAges} />
          <label className="check">
            <input type="checkbox" name="kidsConfirm" value="1" defaultChecked={answers.kidsConfirm} />
            I confirm these are age ranges, not names or birthdays
          </label>
        </>
      ) : null}
      {stepId === "camera" ? (
        <label>
          On-camera comfort for your kids
          <select name="onCamera" defaultValue={answers.onCamera}>
            <option value="">Choose one</option>
            {CAMERA_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      ) : null}
      {stepId === "availability" ? (
        <>
          <label>
            Availability
            <input name="availability" defaultValue={answers.availability} placeholder="Weekdays, or booked until June" />
          </label>
          <label>
            Turnaround
            <select name="turnaround" defaultValue={answers.turnaround}>
              <option value="">Choose one</option>
              {TURNAROUND_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </>
      ) : null}
      {stepId === "shipping" ? (
        <label>
          Shipping region
          <select name="shipping" defaultValue={answers.shipping}>
            <option value="">Choose one</option>
            {SHIPPING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      ) : null}
      {stepId === "languages" ? <TagPicker name="languages" label="Languages" options={LANGUAGE_OPTIONS} selected={answers.languages} /> : null}
      {stepId === "bot" ? (
        <p className="note">
          {emailReady
            ? "The last step is the bot profile below."
            : "Choose how brand email should work above, then finish the bot profile below. Nothing is sent from here."}
        </p>
      ) : null}
      <input type="hidden" name="step" value={stepId} />
      <div className="wizard-actions">
        {stepId === "bot" ? null : <button className="btn" type="submit">Continue</button>}
        {step.optional ? <button className="btn ghost" type="submit" name="skip" value="1">Skip</button> : null}
        <button className="btn ghost" type="submit" name="pause" value="1">Finish later</button>
        {previous ? <Link href={`/onboarding?step=${previous}`}>Back</Link> : null}
      </div>
      {stepId === "bot" ? null : <p className="note">Next: {QUESTION_STEPS.find((item) => item.id === nextStep(stepId))?.title ?? "Done"}</p>}
    </form>
  );
}
