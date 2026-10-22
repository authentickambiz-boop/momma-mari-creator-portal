import Link from "next/link";
import { PortalFrame } from "@/components/portal-frame";
import { PromoSourceForm } from "@/components/promo-source-form";
import { PromoVisual } from "@/components/promo-visual";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { listGiftedBoard } from "@/lib/gifted";
import { promoErrorNote } from "@/lib/promo-notes";
import { promoViewsForGifts } from "@/lib/promo-visuals";

export default async function GiftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ promo?: string; promoError?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(null);
  if (portal.viewer.role === "manager") {
    return (
      <PortalFrame viewer={portal.viewer} tab="gifts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Free product</h1>}>
        <p className="note">Free products stay on the owner sign-in.</p>
      </PortalFrame>
    );
  }
  const board = await listGiftedBoard(portal.db, portal.viewer);
  const offer = board.find((item) => item.id === id) ?? null;
  if (!offer) {
    return (
      <PortalFrame viewer={portal.viewer} tab="gifts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Free product</h1>}>
        <p className="note">That free product is not posted.</p>
        <p><Link href="/gifts">Back to free products</Link></p>
      </PortalFrame>
    );
  }
  const visuals = await promoViewsForGifts(portal.db, [offer]);
  const visual = visuals[offer.id] ?? null;
  return (
    <PortalFrame viewer={portal.viewer} tab="gifts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>{offer.product}</h1>}>
      {query.promo === "saved" ? <p className="note">Product image saved. Nothing was emailed.</p> : null}
      {promoErrorNote(query.promoError) ? <p className="private-note">{promoErrorNote(query.promoError)}</p> : null}
      <article className="card stack">
        <PromoVisual visual={visual?.choice ?? null} brand={offer.brand} showCheck={portal.viewer.role === "admin"} />
        <p className="note">{offer.brand} · {offer.deliverable} · due {offer.dueOn}</p>
        <p>Retail value {formatMoney(offer.retailValueCents)}</p>
        <p className="note">This is the gifted product. Nothing is charged or emailed from this page.</p>
        {portal.viewer.role === "admin" ? (
          <PromoSourceForm
            subjectType="gift"
            subjectId={offer.id}
            productName={visual?.productName ?? offer.product}
            productPageUrl={visual?.productPageUrl ?? null}
            ownerImageUrl={visual?.ownerImageUrl ?? null}
            returnTo={`/gifts/${offer.id}`}
          />
        ) : null}
        <p><Link href={`/gifts#gift-${offer.id}`}>Back to free products</Link></p>
      </article>
    </PortalFrame>
  );
}
