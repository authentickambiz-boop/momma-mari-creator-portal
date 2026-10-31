export default function Loading() {
  return (
    <div className="state-page" role="status" aria-live="polite" aria-busy="true">
      <div className="route-progress" aria-hidden="true" />
      <p className="note">One moment…</p>
    </div>
  );
}
