export type StripeKind = "payment_link" | "subscription" | "invoice";

export type StripeCall =
  | { ok: true; charged: false; kind: StripeKind; id: string; url: string | null }
  | { ok: false; charged: false; status: number; error: string };

const OFF: StripeCall = { ok: false, charged: false, status: 503, error: "Stripe is off. Nothing was charged." };

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

/** Live Stripe calls run only when both the flag and a secret key are set. */
export function stripeLiveEnabled() {
  return process.env.STRIPE_ENABLED === "true" && Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function redact(message: string, secret: string) {
  const cleaned = secret ? message.split(secret).join("[redacted]") : message;
  return cleaned.slice(0, 200);
}

async function stripePost(path: string, params: URLSearchParams, kind: StripeKind, fetchImpl: FetchLike): Promise<StripeCall> {
  if (!stripeLiveEnabled()) return OFF;
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = await response.json().catch(() => null) as { id?: string; url?: string | null; error?: { message?: string } } | null;
  if (!response.ok || !json?.id) {
    const detail = json?.error?.message?.trim() || "Stripe did not create that.";
    return { ok: false, charged: false, status: 502, error: redact(detail, secret) };
  }
  return { ok: true, charged: false, kind, id: json.id, url: json.url ?? null };
}

/** A payment link. The customer is not charged until they pay it. */
export async function createPaymentLink(input: { priceId: string }, fetchImpl: FetchLike = fetch) {
  const priceId = input.priceId.trim();
  if (!priceId) return { ok: false as const, charged: false as const, status: 400, error: "A Stripe price is required." };
  if (!stripeLiveEnabled()) return OFF;
  const params = new URLSearchParams();
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  return stripePost("payment_links", params, "payment_link", fetchImpl);
}

/** An incomplete subscription. Stripe does not collect until a later payment step. */
export async function createSubscription(input: { customerId: string; priceId: string }, fetchImpl: FetchLike = fetch) {
  const customerId = input.customerId.trim();
  const priceId = input.priceId.trim();
  if (!customerId || !priceId) return { ok: false as const, charged: false as const, status: 400, error: "A Stripe customer and price are required." };
  if (!stripeLiveEnabled()) return OFF;
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("items[0][price]", priceId);
  params.set("payment_behavior", "default_incomplete");
  return stripePost("subscriptions", params, "subscription", fetchImpl);
}

/** A draft invoice. It is not finalized, sent, or paid. */
export async function createInvoice(input: { customerId: string }, fetchImpl: FetchLike = fetch) {
  const customerId = input.customerId.trim();
  if (!customerId) return { ok: false as const, charged: false as const, status: 400, error: "A Stripe customer is required." };
  if (!stripeLiveEnabled()) return OFF;
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("auto_advance", "false");
  params.set("collection_method", "send_invoice");
  params.set("days_until_due", "30");
  return stripePost("invoices", params, "invoice", fetchImpl);
}
