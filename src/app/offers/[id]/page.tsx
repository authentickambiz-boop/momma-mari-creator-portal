import Link from "next/link";
import { PortalFrame } from "@/components/portal-frame";
import { PromoSourceForm } from "@/components/promo-source-form";
import { PromoVisual } from "@/components/promo-visual";
import { listCreatorOffers, listOfferBoard } from "@/lib/brand-offers";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { promoErrorNote } from "@/lib/promo-notes";
import { promoViewsForOffers } from "@/lib/promo-visuals";

export default async function OfferDetailPage({
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
      <PortalFrame viewer={portal.viewer} tab="offers" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand offer</h1>}>
        <p className="note">Brand offers stay with the owner.</p>
      </PortalFrame>
    );
  }
  const creatorView = portal.viewer.role === "creator";
  const inbox = creatorView ? await listCreatorOffers(portal.db, portal.viewer) : [];
  const board = portal.viewer.role === "admin" ? await listOfferBoard(portal.db, portal.viewer) : [];
  const mine = inbox.find((offer) => offer.campaignId === id) ?? null;
  const owned = board.find((offer) => offer.id === id) ?? null;
  const brand = owned?.brand ?? mine?.brand ?? "";
  const deliverables = owned?.deliverables ?? mine?.deliverables ?? [];
  if (!brand) {
    return (
      <PortalFrame viewer={portal.viewer} tab="offers" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand offer</h1>}>
        <p className="note">That offer is not on your list.</p>
        <p><Link href="/offers">Back to offers</Link></p>
      </PortalFrame>
    );
  }
  const visuals = await promoViewsForOffers(portal.db, [{ id, brand, deliverables }]);
  const visual = visuals[id] ?? null;
  return (
    <PortalFrame viewer={portal.viewer} tab="offers" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>{brand}</h1>}>
      {query.promo === "saved" ? <p className="note">Product image saved. Nothing was emailed.</p> : null}
      {promoErrorNote(query.promoError) ? <p className="private-note">{promoErrorNote(query.promoError)}</p> : null}
      <article className="card stack">
        <PromoVisual visual={visual?.choice ?? null} brand={brand} showCheck={portal.viewer.role === "admin"} />
        <p>{deliverables.join(", ") || "Deliverables TBD"}</p>
        {mine ? <p>The brand will pay {formatMoney(mine.budgetCents)} for this.</p> : null}
        {owned ? <p className="note">{owned.contactName}{owned.contactEmail ? ` · ${owned.contactEmail}` : ""}</p> : null}
        <p className="note">This is the product the offer is about. Nothing is emailed from this page.</p>
        {portal.viewer.role === "admin" ? (
          <PromoSourceForm
            subjectType="offer"
            subjectId={id}
            productName={visual?.productName ?? deliverables[0] ?? null}
            productPageUrl={visual?.productPageUrl ?? null}
            ownerImageUrl={visual?.ownerImageUrl ?? null}
            returnTo={`/offers/${id}`}
          />
        ) : null}
        <p><Link href="/offers">Back to offers</Link></p>
      </article>
    </PortalFrame>
  );
}
