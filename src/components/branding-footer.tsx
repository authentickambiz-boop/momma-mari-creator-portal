import { brandingFooter } from "@/lib/branding";
import { withBasePath } from "@/lib/format";

export function BrandingFooter() {
  const mark = brandingFooter();
  return (
    <footer className="brand-footer">
      <img src={withBasePath(mark.logo)} alt="Momma Mari" />
      <p>{mark.credit}</p>
    </footer>
  );
}
