import type { Metadata } from "next";
import Link from "next/link";
import { applyGiftedByEmailAction } from "@/app/gift-actions";
import { GiftedTermsNotice } from "@/components/gifted-terms-notice";
import { PrivacyNotice } from "@/components/privacy-notice";
import { GIFTED_TERMS_VERSION } from "@/config/gifted-terms";
import { getDb } from "@/db/getDb";
import { formatMoney } from "@/lib/format";
import { listGiftedBoard } from "@/lib/gifted";
import { giftErrorNote } from "@/lib/gift-notes";
import { promoViewsForGifts } from "@/lib/promo-visuals";
import { PromoVisual } from "@/components/promo-visual";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Free products · Momma Mari",
  robots: { index: false, follow: false },
};

const guest = { email: "", role: "creator" as const, creatorId: null, name: "Bench" };

export default async function GiftedBenchApplyPage({ searchParams }: { searchParams: Promise<{ saved?: string; giftsError?: string }> }) {
  const params = await searchParams;
  const giftsError = giftErrorNote(params.giftsError);
  const db = await getDb();
  const board = await listGiftedBoard(db, guest);
  const visuals = await promoViewsForGifts(db, board);
  return (
    <main className="wrap">
      <h1>Free products</h1>
      <p>This is for people already on the free bench. If you are on the roster, sign in and apply from the portal. Momma Mari reviews each request. This list is free.</p>
      {params.saved === "applied" ? <p className="note">Applied. Momma Mari will review your request.</p> : null}
      {giftsError ? <p className="private-note">{giftsError}</p> : null}
      <GiftedTermsNotice />
      {board.length === 0 ? <p className="note empty">No free products yet.</p> : null}
      <div className="stack">
        {board.map((offer) => (
          <form key={offer.id} action={applyGiftedByEmailAction} className="card stack">
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="termsVersion" value={GIFTED_TERMS_VERSION} />
            <PromoVisual visual={visuals[offer.id]?.choice ?? null} brand={offer.brand} />
            <b>{offer.product}</b>
            <p className="note">{offer.brand} · {offer.deliverable} · due {offer.dueOn}</p>
            <p>Retail value {formatMoney(offer.retailValueCents)}</p>
            <label>Bench email<input type="email" name="email" required /></label>
            <label className="contract-choices">
              <input type="checkbox" name="acceptTerms" value="1" required />
              I accept these terms. If I receive the product and miss the video, the retail cost plus a $50 finder&apos;s fee can be flagged.
            </label>
            <PrivacyNotice />
            <button className="btn" type="submit">Apply</button>
          </form>
        ))}
      </div>
      <p><Link href="/bench/join">Join the bench</Link></p>
      <p><Link href="/login">Creator sign-in</Link></p>
    </main>
  );
}
