import { PublicShell } from "@/components/public-shell";
import { ABOUT_STORY, PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_PHONE } from "@/lib/company-pages";
import { withBasePath } from "@/lib/format";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "Momma Mari press",
    description: "Boilerplate and a press contact for Momma Mari.",
    path: "/press",
  }),
  robots: PUBLIC_ROBOTS,
};

export default function PressPage() {
  return (
    <PublicShell title="Press" lede="Boilerplate and who to write. There is no public street address.">
      <p>{ABOUT_STORY}</p>
      <p>Press contact: <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>, {PUBLIC_CONTACT_PHONE}.</p>
      <p><img src={withBasePath("/momma-logo.png")} alt="Momma Mari" /></p>
    </PublicShell>
  );
}
