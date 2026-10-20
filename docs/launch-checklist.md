# Launch checklist

Use this before the next brand payment, when Stripe live and Cloud Scheduler get switched on and the public work shifts to marketing mommamari.com.

Leave these empty until that moment. An empty value keeps the feature off:

- `STRIPE_ENABLED` and `STRIPE_SECRET_KEY` (payment links, subscriptions, and invoices do nothing)
- `BOLDSIGN_ENABLED` and `BOLDSIGN_API_KEY` (creators keep signing on this site)
- `PUSH_ENABLED` (quiet hours still apply, and nothing is sent to a push service)
- `ZERNIO_STATS_ENABLED` (media kit stats stay hand-entered)

`TOKEN_ENCRYPTION_KEY` stays the key already set on Webflow Cloud. Do not rotate it from a pull request, and do not put it in the repo.

Do not seed real inboxes, real brand threads, or live Stripe keys into code or migrations. MariClare’s KOSBLING deal stays as it is: id `kosbling`, creator `mariclare`, stage `draft_due`, visible, contact empty.

## Before merge

1. Read `docs/overnight-log.md` for the open pull requests.
2. `#41` is already on `main` (`da74005`), including migration `0036`.
3. Merge `#42` so a dead Gmail inbox is acknowledged and Pub/Sub stops retrying it.
4. Merge `#43` while Stripe is still off. Confirm Webflow env still has `STRIPE_ENABLED` empty.
5. Merge `#44` for `/services`, `/roster`, and `/inquire`.
6. Merge `#45` so creators see Connect accounts. On a phone, wide tables scroll.
7. Merge `#46` so this checklist and the overnight log are on `main`.
8. Merge `#47` so Access and Free products are on `main`. It adds migrations `0037` and `0038`. If `#45` is already merged, refresh `#47` first when the tab bar conflicts.
9. Run the portal tests on `main` after the merges (`npm test` and `npx tsc --noEmit`).

## Gmail, still before paid features

1. In Google Cloud, the OAuth client that issued the saved refresh token must be the same client as `GOOGLE_CLIENT_ID`. `unauthorized_client` means the saved token is from an old client.
2. After `#41` is deployed, MariClare (or Kamron, for a watched inbox) disconnects the old Gmail connection and connects it again. That stores a new refresh token. Signing out of the portal is not required.
3. Call `POST /portal/api/cron/gmail-watch` with `Authorization: Bearer <GMAIL_WATCH_CRON_SECRET>`. A renewed mailbox returns ok. A Google error is the text in the JSON, not only “Watch was not renewed.”
4. Confirm a new inbox message lands on a hidden deal until Kamron shares it. Spam and newsletters stay out. Nothing is emailed from the portal.
5. Cloud Scheduler can call that cron on a schedule later. Until the paid project is on, run the cron by hand when you need a renewal.

## The day paid features turn on

1. Put the live Stripe secret in Webflow as a secret variable named `STRIPE_SECRET_KEY`. Put the hosted-email price id in `STRIPE_PRICE_HOSTED_EMAIL`.
2. Set `STRIPE_ENABLED` to the exact string `true`.
3. On Billing, a creator can prepare a hosted-email payment link. The customer is charged only when they pay that link. Subscriptions stay incomplete. Invoices stay drafts until someone finalizes them in Stripe.
4. Turn on Cloud Scheduler for the Gmail watch cron, with the same bearer secret.
5. BoldSign and web push stay off unless you choose them in a later pass.

## Marketing

1. Link mommamari.com to `/portal/services`, `/portal/roster`, and `/portal/inquire`, or move those pages onto the marketing site later.
2. The roster grows when a creator row is added. It shows a name and initials. Email, handles, pay, and kids’ ages stay off that page.
3. A brand inquiry shows up on Brands for Kamron. It does not send email. Reply from the approval queue when you want a message to go out, from `authentickambiz@gmail.com`.

## Still waiting

- Free Products and Access are in `#47`, waiting to merge. The gifted terms are still DRAFT, pending lawyer review. Nothing on that page is charged.
- Gmail history gaps are not backfilled.
- The approval-queue email bridge is not built.
- An attorney still needs to review the e-sign wording.
