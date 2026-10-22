import { savePromoVisualAction } from "@/app/promo-actions";

export function PromoSourceForm({
  subjectType,
  subjectId,
  productName,
  productPageUrl,
  ownerImageUrl,
  returnTo,
}: {
  subjectType: "deal" | "offer" | "gift";
  subjectId: string;
  productName: string | null;
  productPageUrl: string | null;
  ownerImageUrl: string | null;
  returnTo: string;
}) {
  return (
    <form action={savePromoVisualAction} className="stack promo-source-form">
      <div className="sec-title">Product image</div>
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Product name<input name="productName" defaultValue={productName ?? ""} placeholder="Glow bar" /></label>
      <label>Product page<input name="productPageUrl" defaultValue={productPageUrl ?? ""} placeholder="https://brand.com/products/glow-bar" /></label>
      <label>Image link<input name="ownerImageUrl" defaultValue={ownerImageUrl ?? ""} placeholder="https://brand.com/glow.jpg" /></label>
      <label>Or upload a photo<input type="file" name="imageFile" accept="image/*" /></label>
      <p className="note">A photo from the brand email is used first, then the product page, then this upload or link. Nothing is emailed.</p>
      <button className="btn ghost" type="submit">Save product image</button>
    </form>
  );
}
