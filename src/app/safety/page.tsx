import { clearSafetyAction } from "@/app/actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { listSafetyHolds } from "@/lib/safety";
import { safetyLabel } from "@/lib/safety-shared";

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; safetyError?: string; cleared?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const listed = staff ? await listSafetyHolds(portal.db, portal.viewer) : null;
  const holds = listed?.ok ? listed.holds : [];
  const back = `/safety${params.creator ? `?creator=${encodeURIComponent(params.creator)}` : ""}`;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="safety"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>Safety</h1>
            <p>A school logo, house number, location tag, or child&apos;s full name holds the draft for Kamron. The matched words are not saved.</p>
          </div>
        </div>
      }
    >
      {portal.viewer.role === "creator" ? (
        <div className="card">
          <p>Safety holds are for the team.</p>
        </div>
      ) : (
        <div className="card">
          <p className="note">Nothing is sent to the brand while a flag is held. Only Kamron can clear a hold.</p>
          {params.cleared === "1" ? <p className="note">Hold cleared. Nothing was sent to the brand.</p> : null}
          {params.safetyError === "creator" ? <p className="note">You can&apos;t clear a safety hold.</p> : null}
          {params.safetyError === "owner" ? <p className="note">Only Kamron can clear a safety hold.</p> : null}
          {holds.length === 0 ? <p className="note">No drafts are held.</p> : null}
          {holds.map((hold) => (
            <div key={hold.draftId} className="box">
              <div>
                <b>{hold.brand}</b>
                {" · "}
                {hold.creatorName}
                {" · v"}
                {hold.version}
              </div>
              <div className="note">Held for Kamron: {hold.kinds.map((kind) => safetyLabel(kind)).join(", ")}.</div>
              {portal.viewer.role === "admin" ? (
                <form action={clearSafetyAction} className="stage-form">
                  <input type="hidden" name="draftId" value={hold.draftId} />
                  <input type="hidden" name="back" value={back} />
                  <button className="btn" type="submit">Clear hold</button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PortalFrame>
  );
}
