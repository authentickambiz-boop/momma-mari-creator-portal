import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>That page isn&apos;t here.</h1>
        <p className="note">The portal lives on the deal list.</p>
        <Link className="btn" href="/">Back to deals</Link>
      </div>
    </div>
  );
}
