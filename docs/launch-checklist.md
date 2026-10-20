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
2. `#41` (`da74005`), `#42` (`4d539163`), and `#46` (`08655f54`) are already on `main`. Migration `0036` shipped with `#41`. A dead Gmail inbox is already acknowledged.
3. Merge `#43`, `#44`, `#45`, and `#48` in any order. Each one keeps its new tests in its own file, so they no longer fight over `tests/portal.test.ts`.
4. Merge `#47` for Access and Free products. It adds migrations `0037` and `0038`. The only conflict with `#45` is `src/lib/portal-tabs.ts`. Keep `#47`’s copy, whether `#45` lands first or second. That file is the Connect-accounts list plus Free products and Access.
5. Confirm Webflow env still has `STRIPE_ENABLED` empty after `#43`.
6. Run the portal tests on `main` after the merges (`npm test` and `npx tsc --noEmit`). `npm test` runs every `tests/*.test.ts` file once the first of those pull requests lands.

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
- Gmail history older than the latest 20 inbox messages is not recovered. `#48` covers that recent page, and it already includes the dead-token acknowledgement from `#42`.
- The approval-queue email bridge is not built.
- An attorney still needs to review the e-sign wording.
