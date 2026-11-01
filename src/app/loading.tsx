export default function Loading() {
  return (
    <div className="route-shell" role="status" aria-live="polite" aria-busy="true">
      <span className="nav-progress" />
      <div className="route-shell-side" aria-hidden="true">
        <div className="skeleton short" />
        <div className="skeleton line" />
        <div className="skeleton line" />
        <div className="skeleton line" />
      </div>
      <div className="route-shell-main">
        <p className="note">Opening this page…</p>
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}
