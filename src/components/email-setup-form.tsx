import { chooseEmailSetupAction } from "@/app/actions";
import { HostedAddressField } from "@/components/hosted-address-field";
import { STRIPE_CATALOG } from "@/lib/email-setup";

export function EmailSetupForm({ error }: { error: boolean }) {
  const offer = STRIPE_CATALOG.hostedCreatorEmail;
  return (
    <form action={chooseEmailSetupAction} className="card wizard">
      <h2>How should brand email work?</h2>
      <p className="note">Pick one. You can change it before you finish.</p>
      {error ? <p className="private-note">Enter the name you want before @mommamari.com, like abby.</p> : null}
      <label className="choice recommended">
        <span className="choice-head">
          <input type="radio" name="emailSetup" value="business" required />
          <b>Recommended: create a business-only email</b>
        </span>
        <span className="note">A new Gmail used only for brand deals, then connect that address here.</span>
        <ul>
          <li>Open gmail.com and choose Create account.</li>
          <li>Pick an address brands will recognize, such as yourname.brands@gmail.com.</li>
          <li>Sign in to that new address once so you know the password.</li>
          <li>Come back here and connect it. Leave your personal inbox out of this.</li>
        </ul>
      </label>
      <label className="choice">
        <span className="choice-head">
          <input type="radio" name="emailSetup" value="personal" />
          <b>Connect the email I already use</b>
        </span>
        <span className="note">We only process brand-related mail. Your bot sorts those threads and labels them. Personal mail stays in your inbox and is not used here.</span>
      </label>
      <label className="choice">
        <span className="choice-head">
          <input type="radio" name="emailSetup" value="hosted" />
          <b>Ask Momma Mari to host a business email</b>
        </span>
        <span className="note">
          Momma Mari owns @mommamari.com and the mailbox. This is a paid add-on, {offer.name}. You&apos;re on the roster, so yours is {offer.roster.priceLabel}. The public price is {offer.public.priceLabel}. Nothing is charged from this page.
        </span>
        <HostedAddressField />
      </label>
      <button className="btn" type="submit">Continue</button>
    </form>
  );
}
