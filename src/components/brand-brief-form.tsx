import { brandInquiryAction } from "@/app/inquire-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import {
  BRIEF_CREATORS,
  BUDGET_KINDS,
  BUDGET_RANGES,
  HEARD_ABOUT,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  USAGE_CHOICES,
  USAGE_DURATIONS,
} from "@/lib/brand-brief";
import { INQUIRY_SUBMIT_LABEL } from "@/lib/public-site";

export function BrandBriefForm({ featuredId }: { featuredId?: string | null }) {
  return (
    <form action={brandInquiryAction} className="card stack public-form">
      <label>Brand / company name
        <input name="brand" required autoComplete="organization" />
      </label>
      <label>Website
        <input name="companyWebsite" type="url" placeholder="https://" autoComplete="url" />
      </label>
      <label>Your name
        <input name="name" required autoComplete="name" />
      </label>
      <label>Title
        <input name="title" autoComplete="organization-title" />
      </label>
      <label>Work email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>Phone
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>Are you an agency?
        <select name="agency" defaultValue="no">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </label>
      <label>Which brand is the client?
        <input name="clientBrand" placeholder="If you are an agency" />
      </label>
      <fieldset>
        <legend>Creators</legend>
        {BRIEF_CREATORS.map((creator) => (
          <label key={creator.id} className="contract-choices">
            <input type="checkbox" name="creators" value={creator.id} defaultChecked={featuredId === creator.id} />
            {creator.label}
          </label>
        ))}
      </fieldset>
      <label>Campaign goal and KPIs
        <textarea name="goal" rows={3} required placeholder="Views, clicks, codes, sales, or a CPM target" />
      </label>
      <label>Deliverables
        <textarea name="deliverables" rows={3} required placeholder="Platform, number of posts, format, raw footage, hooks" />
      </label>
      <label>Budget
        <select name="budget" required defaultValue="">
          <option value="" disabled>Choose a range</option>
          {BUDGET_RANGES.map((range) => <option key={range} value={range}>{range}</option>)}
        </select>
      </label>
      <label>Paid, gifted, or affiliate
        <select name="budgetKind" defaultValue="Paid">
          {BUDGET_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </label>
      <label>Usage rights
        <select name="usage" defaultValue={USAGE_CHOICES[0]}>
          {USAGE_CHOICES.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
      </label>
      <label>Usage duration
        <select name="usageDuration" defaultValue="30 days">
          {USAGE_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration}</option>)}
        </select>
      </label>
      <label>Exclusivity
        <input name="exclusivity" placeholder="Category and length, or none" />
      </label>
      <label>Timeline
        <textarea name="timeline" rows={3} placeholder="Product ship date, draft due, go-live window, campaign end" />
      </label>
      <label>Approval rounds and brief link
        <textarea name="approvals" rows={2} placeholder="How many rounds, and a link to the brief" />
      </label>
      <label>Billing contact
        <input name="billingContact" placeholder="Name" autoComplete="name" />
      </label>
      <label>Billing email
        <input name="billingEmail" type="email" autoComplete="email" />
      </label>
      <label>Legal entity to invoice
        <input name="legalEntity" />
      </label>
      <label>PO needed?
        <select name="poNeeded" defaultValue="no">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </label>
      <label>Payment terms
        <select name="paymentTerms" defaultValue="Net 30">
          {PAYMENT_TERMS.map((term) => <option key={term} value={term}>{term}</option>)}
        </select>
      </label>
      <label>Payment method
        <select name="paymentMethod" defaultValue="ACH">
          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
        </select>
      </label>
      <label>Deposit?
        <select name="deposit" defaultValue="no">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </label>
      <label>Product sample
        <select name="productSample" defaultValue="no">
          <option value="no">No shipping address needed</option>
          <option value="yes">Yes, we'll send the address privately</option>
        </select>
      </label>
      <label>How did you hear about us?
        <select name="heardAbout" defaultValue="Search">
          {HEARD_ABOUT.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
      </label>
      <div className="leave-blank" aria-hidden="true">
        <label>Leave this blank
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="note">We reply within 3 business days.</p>
      <PrivacyNotice />
      <button className="btn" type="submit">{INQUIRY_SUBMIT_LABEL}</button>
    </form>
  );
}
