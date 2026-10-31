import { publicPlans } from "./stripe-payment-links";

export type ComparisonColumn = {
  id: "free" | "plus" | "pro" | "business";
  name: string;
  price: string;
  href: string;
  button: string;
  highlight: boolean;
  featured: boolean;
};

export type ComparisonRow = {
  feature: string;
  free: string;
  plus: string;
  pro: string;
  business: string;
};

const ROWS: ComparisonRow[] = [
  { feature: "Account", free: "Free Google sign-up", plus: "Included", pro: "Included", business: "Included" },
  { feature: "Typed @handles", free: "Yes", plus: "Yes", pro: "Yes", business: "Yes" },
  { feature: "Screenshot and stats uploads", free: "Yes, private to you", plus: "Yes", pro: "Yes", business: "Yes" },
  { feature: "Where-to-start lessons", free: "Yes", plus: "Yes", pro: "Yes", business: "Yes" },
  { feature: "Apply for management", free: "Yes", plus: "Yes", pro: "Yes", business: "Yes" },
  { feature: "Commission-only deals", free: "Brand details hidden", plus: "Full details", pro: "Full details", business: "Full details" },
  { feature: "Product requests", free: "One open at a time", plus: "Included", pro: "Included", business: "Included" },
  { feature: "Platform connections", free: "Locked", plus: "Included", pro: "Included", business: "Included" },
  { feature: "Custom bot", free: "Locked", plus: "Included", pro: "Included", business: "Included" },
  { feature: "One-time services", free: "Listed prices", plus: "10% off", pro: "20% off", business: "Included" },
];

function monthHref(id: "plus" | "pro" | "business") {
  const plan = publicPlans().find((item) => item.id === id);
  const month = plan?.prices.find((price) => price.interval === "month");
  if (!month) throw new Error(`Missing ${id} monthly checkout link`);
  return month.href;
}

/** Free vs Plus vs Pro vs Business. Prices and checkout links come from the live catalog. */
export function pricingComparison(): { columns: ComparisonColumn[]; rows: ComparisonRow[] } {
  return {
    columns: [
      { id: "free", name: "Free", price: "$0", href: "/signup", button: "Create a free account", highlight: false, featured: false },
      { id: "plus", name: "Plus", price: "$19/mo", href: monthHref("plus"), button: "Buy now", highlight: false, featured: false },
      { id: "pro", name: "Pro", price: "$39/mo", href: monthHref("pro"), button: "Upgrade", highlight: true, featured: false },
      { id: "business", name: "Business", price: "$199/mo", href: monthHref("business"), button: "Upgrade", highlight: true, featured: true },
    ],
    rows: ROWS,
  };
}
