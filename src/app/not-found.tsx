import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function NotFound() {
  return (
    <>
    <a className="skip" href="#main">Skip to content</a>
    <div className="state-page" id="main">
      <div className="card login-card state-card">
        <BrandMark sub="Creator portal" />
        <p className="eyebrow">Missing page</p>
        <h1>That page isn&apos;t here.</h1>
        <p className="note">The portal lives on the deal list. Nothing was changed.</p>
        <Link className="btn" href="/">Back to deals</Link>
      </div>
    </div>
    </>
  );
}
