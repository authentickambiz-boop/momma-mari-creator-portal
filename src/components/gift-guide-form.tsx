import { giftGuideReservationAction } from "@/app/inquire-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { GIFT_GUIDE_OFFER, giftGuidePriceLabel } from "@/lib/gift-guide";

export function GiftGuideForm() {
  return (
    <form action={giftGuideReservationAction} className="card stack public-form">
      <label>Brand name
        <input name="brand" required autoComplete="organization" />
      </label>
      <label>Your name
        <input name="name" required autoComplete="name" />
      </label>
      <label>Work email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>Website
        <input name="website" type="url" placeholder="https://" autoComplete="url" />
      </label>
      <label>Product name
        <input name="productName" required />
      </label>
      <label>Product link
        <input name="productUrl" type="url" required placeholder="https://" />
      </label>
      <label>Retail price
        <input name="retailPrice" required inputMode="decimal" placeholder="24.00" />
      </label>
      <label>Gift category
        <select name="category" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          {GIFT_GUIDE_OFFER.categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </label>
      <label>Package
        <select name="packageId" required defaultValue="">
          <option value="" disabled>Choose a package</option>
          {GIFT_GUIDE_OFFER.packages.map((item) => (
            <option key={item.id} value={item.id}>{item.name} — {giftGuidePriceLabel(item)}</option>
          ))}
        </select>
      </label>
      <label>Black Friday or Cyber Monday code
        <input name="promoCode" placeholder="Optional" />
      </label>
      <label>Notes
        <textarea name="notes" rows={3} placeholder="Optional" />
      </label>
      <fieldset>
        <legend>Before you reserve</legend>
        {GIFT_GUIDE_OFFER.acknowledgments.map((item) => (
          <label key={item.id} className="contract-choices">
            <input type="checkbox" name={item.id} value="yes" required />
            {item.label}
          </label>
        ))}
      </fieldset>
      <div className="leave-blank" aria-hidden="true">
        <label>Leave this blank
          <input name="fax" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="note">{GIFT_GUIDE_OFFER.reserveNote} {GIFT_GUIDE_OFFER.capacityNote}</p>
      <PrivacyNotice />
      <button className="btn" type="submit">Reserve a spot</button>
    </form>
  );
}
