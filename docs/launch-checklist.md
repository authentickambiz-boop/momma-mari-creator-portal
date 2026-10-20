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
2. Already on `main`: `#41` (`da74005`), `#42` (`4d53916`), `#46` (`08655f5`), `#43` (`bc51ed7`), `#44` (`8349259`), `#48` (`3df3b46`), `#47` (`73950a6`), `#50` (`4ee1322`), `#51` (`02574a4`), `#49` (`709d83a`), `#52` (`d497e50`), `#53` (`4af6c94`), `#54` (`2a50833`), `#55` (`5ecdc2b`), `#56` (`428cad4`), `#57` (`e7a5dc0`), `#58` (`f12169b`), and `#59` (`f84722f`). Migration `0036` shipped with `#41`. Migrations `0037` and `0038` shipped with `#47`. A dead Gmail inbox is already acknowledged. A missing message, a draft, and internal mail do not stall the cursor. Watch renewal keeps the history cursor. History pages are followed. Newsletters and spam do not open a new deal. Phone forms stack, and long checkbox labels stay on the phone page. Public pages hide creator chat and show a roster count. The dashboard, brand offers, campaign budgets, and Free products say what they do. Stripe stays off. Free products and Access are on `main`.
3. `#45` still has no file changes versus current `main` (`f84722f`). The phone scrolling and the Connect accounts tab already shipped inside `#47`. Leave `#45` open for Kamron to close.
4. Merge `#60` (a reply draft, a rate confirmation, and saved dates show a note on the deal). An empty draft and a rate that is not dollars write nothing. Nothing is emailed or paid. This checklist is in that same pull request.
5. Confirm Webflow env still has `STRIPE_ENABLED` empty. `#43` is already on `main`.
6. Run the portal tests on `main` after the merges (`npm test` and `npx tsc --noEmit`). `npm test` runs every `tests/*.test.ts` file.

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
2. The roster grows when a creator row is added. It shows a name, initials, a public count, and the line “On the Momma Mari roster.” Email, handles, pay, and kids’ ages stay off that page.
3. Services links to the inquiry form. A brand inquiry shows up on Brands for Kamron. The button saves the contact. It does not send email. Reply from the approval queue when you want a message to go out, from `authentickambiz@gmail.com`.

## Still waiting

- Free Products and Access are on `main` via `#47`. The gifted terms are still DRAFT, pending lawyer review. Nothing on that page is charged.
- Gmail history older than the latest 20 inbox messages is not recovered. `#48` covers that recent page, and it already includes the dead-token acknowledgement from `#42`.
- Gmail history pages beyond the first five on one push are retried by Pub/Sub. `#50` is on `main`. The cursor does not jump past unread pages.
- Newsletters and spam stay off new deals. That shipped in `#53`. `#58` also skips drafts and mail whose From is a watched inbox. That is on `main`.
- A reply draft, a rate confirmation, and saved dates show a note on the deal once `#60` is merged. An empty draft and a rate that is not dollars write nothing. Nothing is emailed or paid.
- A brand offer is saved on the creator's portal. The button says Save offer. A `.invalid` contact is refused. Nothing is emailed.
- A campaign filter that is not a dollar amount stays on the board with an error, instead of being ignored.
- The dashboard shows the reinvestment error, and a saved target says nothing was paid or billed.
- The approval-queue email bridge is not built.
- An attorney still needs to review the e-sign wording.
