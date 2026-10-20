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
2. Already on `main` (`1073a41`): `#41` through `#80`, except `#45`. The newest of those are `#77` (`d9febda`), `#78` (`f3b30d0`), `#79` (`5039558`), and `#80` (`1073a41`). `#61` (`fe295ac`) reads a second inbox page, up to 40 messages. Migration `0036` shipped with `#41`. Migrations `0037` and `0038` shipped with `#47`. Stripe, BoldSign, and push stay off.
3. `#45` still has no file changes. Leave it open for Kamron to close.
4. `#73` is on `main`. An unknown Gmail code on onboarding says to try again.
5. `#74` is on `main`. A brand inquiry can take a response and a contact before any deal exists. Signup keeps every rate and handle the form asks for, including a YouTube minimum and a Twitch handle. A brand-offer budget that is not dollars is refused instead of skipping that creator.
6. `#75` is on `main`. The members directory will not print wording taken from the link.
7. `#76` is on `main`. A brand offer is changed on Offers, not by splitting it on the campaign board.
8. `#77` through `#80` are on `main`. A gifted due date has to be a real day. A manager cannot change a deal for a creator who is not assigned. Access and Free products show a fixed sentence instead of text from the link. `npx tsc --noEmit` is clean. `npm test` is 96 passing.
9. [#81](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/81) through [#88](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/88) are open. They do the same fixed-sentence mapping for the campaign board, prospects, brands, a creator profile, brand offers, settings, support, the calendar, and ranking, pods, reports, and the dashboard.
10. Confirm Webflow env still has `STRIPE_ENABLED` empty. `#43` is already on `main`.

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
- `#77` through `#80` are on `main` (`1073a41`). A gifted due date must be a real day. A manager cannot change a deal for a creator who is not on their list. Access and Free products show a fixed sentence instead of text from the link.
- `#81` through `#88` are open for the hourly merger. They map the campaign board, prospects, brands, profiles, brand offers, settings, support, the calendar, ranking, pods, reports, and the dashboard to fixed sentences.
- A made-up link can still print its own wording on Analytics, the media kit, usage rights, deal rules, review, the bench, a deal's reply, rate, and date notes, and an onboarding question.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The saved refresh token still fails with `unauthorized_client` until she connects that inbox again. Signing out is not required.
- Mail older than the latest 40 inbox messages is not recovered. A failed later page does not move the cursor.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment.
- Leave `STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `BOLDSIGN_ENABLED`, and `PUSH_ENABLED` empty. Nothing is charged, and creators keep signing on this site.
- Leave `TOKEN_ENCRYPTION_KEY` as the key already set on Webflow Cloud. Do not rotate it from a pull request.
- The approval-queue email bridge is not built. Everything that would leave the portal still waits in that queue. The from address stays `authentickambiz@gmail.com`.
- Have an attorney review the e-sign wording and the gifted terms before relying on them. Those notes stay on the sign page and Free products. Nothing on Free products is charged.
- Public pages stay under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
