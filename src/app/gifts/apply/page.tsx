import Link from "next/link";
import { applyGiftedByEmailAction } from "@/app/gift-actions";
import { GIFTED_TERMS_TEXT, GIFTED_TERMS_VERSION } from "@/config/gifted-terms";
import { getDb } from "@/db/getDb";
import { formatMoney } from "@/lib/format";
import { listGiftedBoard } from "@/lib/gifted";

export const dynamic = "force-dynamic";

const guest = { email: "", role: "creator" as const, creatorId: null, name: "Bench" };

export default async function GiftedBenchApplyPage({ searchParams }: { searchParams: Promise<{ saved?: string; giftsError?: string }> }) {
  const params = await searchParams;
  const db = await getDb();
  const board = await listGiftedBoard(db, guest);
  return (
    <main className="wrap">
      <h1>Free products</h1>
      <p>This is for people already on the free bench. Roster creators should sign in and apply from the portal. Kamron approves each person. Nothing is charged.</p>
      {params.saved === "applied" ? <p className="note">Applied. Kamron still has to approve you. Nothing was charged.</p> : null}
      {params.giftsError ? <p className="private-note">{params.giftsError}</p> : null}
      <div className="callout">
        <b>DRAFT. Pending lawyer review.</b>
        <p style={{ whiteSpace: "pre-wrap" }}>{GIFTED_TERMS_TEXT}</p>
        <p className="note">Version {GIFTED_TERMS_VERSION}. Have an attorney review this wording before you rely on it.</p>
      </div>
      {board.length === 0 ? <p className="note">No free products yet. Nothing is charged.</p> : null}
      <div className="stack">
        {board.map((offer) => (
          <form key={offer.id} action={applyGiftedByEmailAction} className="card stack">
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="termsVersion" value={GIFTED_TERMS_VERSION} />
            <b>{offer.product}</b>
            <p className="note">{offer.brand} · {offer.deliverable} · due {offer.dueOn}</p>
            <p>Retail value {formatMoney(offer.retailValueCents)}</p>
            <label>Bench email<input type="email" name="email" required /></label>
            <label className="contract-choices">
              <input type="checkbox" name="acceptTerms" value="1" required />
              I accept the draft terms. If I receive the product and miss the video, the retail cost plus a $50 finder&apos;s fee can be flagged.
            </label>
            <button className="btn" type="submit">Apply</button>
          </form>
        ))}
      </div>
      <p><Link href="/bench/join">Join the bench</Link></p>
      <p><Link href="/login">Creator sign-in</Link></p>
    </main>
  );
}
