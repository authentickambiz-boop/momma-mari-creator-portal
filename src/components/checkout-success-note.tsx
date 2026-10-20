export function CheckoutSuccessNote({ checkout }: { checkout?: string }) {
  if (checkout !== "success") return null;
  return (
    <div className="callout">
      <b>Checkout finished.</b> Stripe is confirming it. Your plan shows on Billing and usage after that. Nothing was emailed.
    </div>
  );
}
