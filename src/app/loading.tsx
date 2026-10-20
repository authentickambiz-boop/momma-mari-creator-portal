export default function Loading() {
  return (
    <div className="state-page" role="status" aria-live="polite">
      <div className="card login-card state-card">
        <p className="eyebrow">Momma Mari</p>
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton short" aria-hidden="true" />
        <div className="skeleton line" aria-hidden="true" />
        <p className="note">Loading your deals…</p>
      </div>
    </div>
  );
}
