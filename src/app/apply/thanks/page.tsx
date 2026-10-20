import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export const metadata = {
  title: "Application received · Momma Mari",
  robots: { index: false, follow: false },
};

export default function ApplyThanksPage() {
  return (
    <PublicShell title="Application under review" lede="Thanks, your application will be reviewed soon.">
      <p className="note">Your application is under review. Nothing was emailed. Kamron will look at it from his dashboard.</p>
      <p><Link href="/login">Back to creator sign-in</Link></p>
    </PublicShell>
  );
}
