import { findOfferPrice } from "./payments-config";

export const BRAND_CREDIT = "Made by Momma Mari | mommamari.com";
export const BRAND_LOGO_PATH = "/momma-logo.png";

export function brandingFooter() {
  return { logo: BRAND_LOGO_PATH, credit: BRAND_CREDIT };
}

export function deliveryCarriesBranding(content: string) {
  return content.includes(BRAND_CREDIT) && content.includes(BRAND_LOGO_PATH);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

/** Append the logo and credit when a delivery does not already carry them. */
export function stampBranding(content: string) {
  if (deliveryCarriesBranding(content)) return content;
  const logo = content.includes(BRAND_LOGO_PATH) ? "" : `\n<img src="${BRAND_LOGO_PATH}" alt="Momma Mari">`;
  const credit = content.includes(BRAND_CREDIT) ? "" : `\n${BRAND_CREDIT}`;
  return `${content}${logo}${credit}`;
}

export function renderMediaKit(input: { creatorName: string; body: string }) {
  return stampBranding(
    `<article class="momma-mari-kit"><h1>${escapeHtml(input.creatorName)}</h1><p>${escapeHtml(input.body)}</p></article>`,
  );
}

export function renderRateCard(input: { creatorName: string; body: string }) {
  return stampBranding(
    `<article class="momma-mari-rate-card"><h1>${escapeHtml(input.creatorName)} rate card</h1><p>${escapeHtml(input.body)}</p></article>`,
  );
}

function productKind(product: string) {
  const offer = findOfferPrice(product, "one_time")?.offer;
  const name = offer?.name ?? product;
  return {
    kit: /media kit|starter kit/i.test(name),
    rate: /rate card/i.test(name),
  };
}

/** Media kits and rate cards share this wrapper. Other files still get the same mark. */
export function brandedDelivery(product: string, input: { creatorName: string; body: string }) {
  const kind = productKind(product);
  const plain = !input.body.includes("<");
  if (plain && kind.kit && kind.rate) {
    return `${renderMediaKit(input)}\n${renderRateCard(input)}`;
  }
  if (plain && kind.rate) return renderRateCard(input);
  if (plain && kind.kit) return renderMediaKit(input);
  return stampBranding(input.body);
}
