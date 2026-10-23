import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { GIFT_GUIDE_OFFER, giftGuidePriceLabel } from "@/lib/gift-guide";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Holiday Gift Guide 2026 · Momma Mari",
    description: "Creators share gifts they'd actually give. Paid placements are labeled. Reserve a spot for the 2026 holiday guide.",
    path: GIFT_GUIDE_OFFER.pagePath,
  }),
  robots: PUBLIC_ROBOTS,
};

export default function GiftGuidePage() {
  return (
    <PublicShell title={GIFT_GUIDE_OFFER.title} lede={GIFT_GUIDE_OFFER.lede}>
      <div className="callout" role="note">
        <b>{GIFT_GUIDE_OFFER.sponsoredLine}</b>
      </div>
      <p>{GIFT_GUIDE_OFFER.liveLabel} {GIFT_GUIDE_OFFER.pageLabel}</p>
      <p>{GIFT_GUIDE_OFFER.disclosure} {GIFT_GUIDE_OFFER.capacityNote}</p>
      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr><th>Package</th><th>What you get</th><th>Price</th></tr>
          </thead>
          <tbody>
            {GIFT_GUIDE_OFFER.packages.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.summary}</td>
                <td>{giftGuidePriceLabel(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Add-ons</div>
        <table>
          <thead><tr><th>Add-on</th><th>Price</th></tr></thead>
          <tbody>
            {GIFT_GUIDE_OFFER.addons.map((item) => (
              <tr key={item.id}><td>{item.name}</td><td>{item.priceLabel}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>The guide</h2>
        <p>{GIFT_GUIDE_OFFER.emptyState}</p>
      </section>
      <p style={{ marginTop: 16 }}>
        <Link className="btn" href={GIFT_GUIDE_OFFER.inquiryPath}>Reserve a spot</Link>
      </p>
      <p className="note">{GIFT_GUIDE_OFFER.reserveNote}</p>
    </PublicShell>
  );
}
