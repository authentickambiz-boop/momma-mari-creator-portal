"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>Something went wrong</h1>
        <p className="note">Your deals are still private. Try again, and if it keeps happening Kamron can check the server log.</p>
        <button className="btn" type="button" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
