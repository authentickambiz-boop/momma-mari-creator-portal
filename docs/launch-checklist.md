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
2. Already on `main` (`80837aa`): `#41` through `#111`, except `#45` and `#109`. `#110` (`80837aa`) shows the real reason a payment step was refused. `#61` (`fe295ac`) reads a second inbox page, up to 40 messages. Migration `0036` shipped with `#41`. Migrations `0037` and `0038` shipped with `#47`. Stripe, BoldSign, and push stay off.
3. `#45` still has no file changes. Leave it open for Kamron to close.
4. `#73` is on `main`. An unknown Gmail code on onboarding says to try again.
5. `#74` is on `main`. A brand inquiry can take a response and a contact before any deal exists. Signup keeps every rate and handle the form asks for, including a YouTube minimum and a Twitch handle. A brand-offer budget that is not dollars is refused instead of skipping that creator.
6. `#75` is on `main`. The members directory will not print wording taken from the link.
7. `#76` is on `main`. A brand offer is changed on Offers, not by splitting it on the campaign board.
8. `#77` through `#80` are on `main`. A gifted due date has to be a real day. A manager cannot change a deal for a creator who is not assigned. Access and Free products show a fixed sentence instead of text from the link.
9. `#81` through `#108`, `#110`, and `#111` are on `main`. Error links use a short code and a fixed sentence. A date shaped like YYYY-MM-DD has to be a real day. A campaign date that is not a real day says "Use a date like 2026-11-01." `npx tsc --noEmit` is clean. `npm test` is 123 passing.
10. [#109](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/109) is updated onto this main and still open. It shows the real stage, offer-answer, and release sentences, and it keeps the post-date code. [#112](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/112) is the public creator application. [#113](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/113) shows the real reason a live post link was refused. [#115](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/115) through [#127](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/127) show the real reason for tracking, referrals, the team page, approvals, email setup, finishing a profile, a public brand inquiry, a draft review, a safety-hold clear, a contract step, a signer flag, a home-page notice, and a profile hide. Each of those is based on this main and was tested on its own branch.
11. Confirm Webflow env still has `STRIPE_ENABLED` empty. `#43` is already on `main`.

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
3. Services links to the inquiry form. A brand inquiry shows up on Brands for Kamron, and he can save a response or another contact on that card before the brand is on a deal. The button saves the contact. It does not send email. Reply from the approval queue when you want a message to go out, from `authentickambiz@gmail.com`.

## Still waiting

- `#45` has no file changes. Leave it open for Kamron to close.
- Current `main` is `#110` (`80837aa`). `npx tsc --noEmit` is clean. `npm test` is 123 passing.
- `#109`, `#112`, `#113`, and `#115` through `#127` are the open code pull requests. `#114` is this checklist. Each code pull request was tested on its own branch from `80837aa`, not together.
- A campaign date that is not a real day says "Use a date like 2026-11-01." That sentence is on `main` from `#108`.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The saved refresh token still fails with `unauthorized_client` until she connects that inbox again. Signing out is not required.
- Mail older than the latest 40 inbox messages is not recovered. A failed later page does not move the cursor.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment.
- Leave `STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `BOLDSIGN_ENABLED`, and `PUSH_ENABLED` empty. Nothing is charged, and creators keep signing on this site.
- Leave `TOKEN_ENCRYPTION_KEY` as the key already set on Webflow Cloud. Do not rotate it from a pull request.
- The approval-queue email bridge is not built. Everything that would leave the portal still waits in that queue. The from address stays `authentickambiz@gmail.com`.
- Have an attorney review the e-sign wording and the gifted terms before relying on them. Those notes stay on the sign page and Free products. Nothing on Free products is charged.
- Public pages stay under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
