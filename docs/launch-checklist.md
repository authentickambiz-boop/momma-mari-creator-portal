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
2. Already on `main` (`cd2c74c`): `#41` through `#72`, except `#45`. The newest of those are `#68` (`1361a90`), `#69` (`66f14da`), `#70` (`1c4849d`), `#71` (`da6210e`), and `#72` (`cd2c74c`). `#61` (`fe295ac`) reads a second inbox page, up to 40 messages. Migration `0036` shipped with `#41`. Migrations `0037` and `0038` shipped with `#47`. Stripe, BoldSign, and push stay off.
3. `#45` still has no file changes versus current `main` (`cd2c74c`). Leave it open for Kamron to close.
4. `#73` is still open. It only changes the note for an unknown Gmail code on onboarding. The merger is handling it. It does not edit these docs.
5. [#74](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/74) is the launch smoke pass. A brand inquiry can take a response and a contact before any deal exists. Signup keeps every rate and handle the form asks for, including a YouTube minimum and a Twitch handle. A brand-offer budget that is not dollars is refused instead of skipping that creator. `npx tsc --noEmit` is clean. `npm test` is 89 passing.
6. Confirm Webflow env still has `STRIPE_ENABLED` empty. `#43` is already on `main`.
7. Run the portal tests on `main` again after `#73` merges (`npm test` and `npx tsc --noEmit`). `npm test` runs every `tests/*.test.ts` file.

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

- `#45` has no file changes versus `main` (`cd2c74c`). Leave it open for Kamron to close.
- `#73` is still open. It is a note for an unknown Gmail code on onboarding. Merge it when the hourly merger does. It does not change signup, connect, deals, offers, or the brand list.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The saved refresh token still fails with `unauthorized_client` until she connects that inbox again. Signing out is not required.
- Mail older than the latest 40 inbox messages is not recovered. A failed later page does not move the cursor.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment.
- Leave `STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `BOLDSIGN_ENABLED`, and `PUSH_ENABLED` empty. Nothing is charged, and creators keep signing on this site.
- Leave `TOKEN_ENCRYPTION_KEY` as the key already set on Webflow Cloud. Do not rotate it from a pull request.
- The approval-queue email bridge is not built. Everything that would leave the portal still waits in that queue. The from address stays `authentickambiz@gmail.com`.
- Have an attorney review the e-sign wording and the gifted terms before relying on them. Those notes stay on the sign page and Free products. Nothing on Free products is charged.
- Public pages stay under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
