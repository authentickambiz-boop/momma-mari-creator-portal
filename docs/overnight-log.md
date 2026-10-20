# Overnight log

Work toward a launch-ready portal before the next brand payment. Paid features (Stripe live, Cloud Scheduler) stay off until Kamron turns them on. After that, the public site is for marketing mommamari.com, its services, and the creators.

Kamron merges. This log does not merge anything.

## Pull requests

| PR | Branch | What it does | Status |
| --- | --- | --- | --- |
| [#41](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/41) | `cursor/reconnect-invites-e39d` | Creators connect and disconnect Gmail, Drive, and each social account without signing out. A rejected Gmail inbox shows needs-reconnect. Invite and deadline alerts. Migration `0036` shipped with this merge. | Merged to `main` as `da74005`. |
| [#42](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/42) | `cursor/gmail-sync-ack-e39d` | A dead Gmail inbox (unauthorized client or invalid grant, or a mailbox with no token) is acknowledged with HTTP 200 so Pub/Sub stops retrying. Temporary Google errors stay 503. The history cursor is not moved on those failures. A blank thread does not open a deal. | Updated onto `da74005`. `npx tsc --noEmit` clean. `npm test` 60 passing. Ready to merge. |
| [#43](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/43) | `cursor/stripe-flag-e39d` | Payment links, incomplete subscriptions, and draft invoices. They run only when `STRIPE_ENABLED` is `true` and `STRIPE_SECRET_KEY` is set. Both are empty. Nothing is charged. | Updated onto `da74005`. `npx tsc --noEmit` clean. `npm test` 60 passing. Ready to merge. |
| [#44](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/44) | `cursor/public-marketing-e39d` | Public services, a creator roster that reads the creators table, and a brand inquiry form that saves a brand contact. Nothing is emailed. | Updated onto `da74005`. `npx tsc --noEmit` clean. `npm test` 60 passing. Ready to merge. |
| [#45](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/45) | `cursor/portal-polish-e39d` | Creators see the Connect accounts tab. Phone tables scroll. | Updated onto `da74005`. `npx tsc --noEmit` clean. `npm test` 60 passing. Ready to merge. |
| [#46](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/46) | `cursor/launch-checklist-e39d` | This log and `docs/launch-checklist.md`. | Updated onto `da74005`. `npx tsc --noEmit` clean. `npm test` 59 passing (this branch does not include the tests from #42–#45). Ready to merge. |
| [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) | `cursor/permissions-gifts-e39d` | Access (staged permissions) and Free products, brought onto `main` from the stacked squash merges. Migrations `0037_capability_grants.sql` and `0038_gifted_products.sql`. KOSBLING is unchanged. | Based on `da74005`. `npx tsc --noEmit` clean. `npm test` 61 passing. Ready to merge after `#42`–`#46`, or on its own. If `#45` merges first, this branch may need another update because both edit the tab bar. |
| [#48](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/48) | `cursor/gmail-history-gap-e39d` | When Gmail history has expired, read the latest 20 inbox messages and file unseen mail. A failed read returns 503 and leaves the cursor. Nothing is sent. | Based on `da74005`. `npx tsc --noEmit` clean. `npm test` 60 passing. Ready to merge. If `#42` merges first, refresh this one around `ingestGmailPush`. |

`#42` through `#47` are each against `main` and are not stacked on each other. Migration `0036` is already on `main`. Do not add another `0036`. The next unused numbers are `0037` and `0038`, and `#47` uses both.

## Where #37 and #39 actually landed

| PR | Squash commit | Base it merged into | On `main`? |
| --- | --- | --- | --- |
| [#37](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/37) staged permissions | `9ecc3b5` | `cursor/live-deal-sync-e39d` | No. [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) ports it onto `main` as migration `0037`. |
| [#39](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/39) free products | `6861f981` | `cursor/staged-permissions-e39d` | No. [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) ports it onto `main` as migration `0038`. |

## Left to do

- Merge `#42`, then `#43`, then `#44`, then `#45`, then `#46`, then `#47`, then `#48`. They are independent, so the order is only to keep this log easy to follow. Merge `#45` before `#47` if both are open, then refresh `#47` if the tab bar conflicts. Merge `#42` before `#48` if both are open, then refresh `#48` if `ingestGmailPush` conflicts.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after `#41` is deployed. The current refresh token fails with `unauthorized_client` until a new token is saved. `#42` keeps Pub/Sub from retrying that dead inbox in the meantime.
- Gmail history gaps are handled in `#48`: the latest 20 inbox messages are filed, and a failed read does not move the cursor. Mail older than that page is still not recovered.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment, when paid Google features turn on.
- Leave `STRIPE_ENABLED` and `STRIPE_SECRET_KEY` empty until live Stripe keys exist. `#43` is the switch.
- Leave `BOLDSIGN_ENABLED` and `PUSH_ENABLED` empty.
- Leave `TOKEN_ENCRYPTION_KEY` handling as it is. Do not generate a new key in code and do not commit the key.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
- Free Products and Access are in `#47`, not merged yet. `#45` puts the phone rules on every card with a table and every stage form, so those pages pick the same rules up once both are merged.
- The email bridge in `docs/build-plan-remaining.md` (sending from the approval queue) is not started. Everything external still waits in the approval queue.
- Have an attorney review the e-sign wording before relying on it. That note stays on the sign page.
- Public marketing pages in `#44` are served under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them.
