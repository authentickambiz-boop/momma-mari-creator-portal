# Overnight log

Work toward a launch-ready portal before the next brand payment. Paid features (Stripe live, Cloud Scheduler) stay off until Kamron turns them on. After that, the public site is for marketing mommamari.com, its services, and the creators.

Kamron merges. This log does not merge anything.

## Pull requests

| PR | Branch | What it does | Status |
| --- | --- | --- | --- |
| [#41](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/41) | `cursor/reconnect-invites-e39d` | Creators connect and disconnect Gmail, Drive, and each social account without signing out. A rejected Gmail inbox shows needs-reconnect. Invite and deadline alerts. Migration `0036` shipped with this merge. | Merged to `main` as `da74005`. |
| [#42](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/42) | `cursor/gmail-sync-ack-e39d` | A dead Gmail inbox (unauthorized client or invalid grant, or a mailbox with no token) is acknowledged with HTTP 200 so Pub/Sub stops retrying. Temporary Google errors stay 503. The history cursor is not moved on those failures. A blank thread does not open a deal. | Squash-merged to `main` as `4d539163`. |
| [#46](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/46) | `cursor/launch-checklist-e39d` | The first copy of this log and `docs/launch-checklist.md`. | Squash-merged to `main` as `08655f54`. This file is the newer copy. |
| [#43](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/43) | `cursor/stripe-flag-e39d` | Payment links, incomplete subscriptions, and draft invoices. They run only when `STRIPE_ENABLED` is `true` and `STRIPE_SECRET_KEY` is set. Both are empty. Nothing is charged. | Refreshed onto `08655f54`. The Stripe test is in `tests/stripe-flag.test.ts`. `npx tsc --noEmit` clean. `npm test` 61 passing (60 portal, 1 Stripe). Ready to merge. |
| [#44](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/44) | `cursor/public-marketing-e39d` | Public services, a creator roster that reads the creators table, and a brand inquiry form that saves a brand contact. Nothing is emailed. | Refreshed onto `08655f54`. The test is in `tests/public-marketing.test.ts`. `npx tsc --noEmit` clean. `npm test` 61 passing (60 portal, 1 marketing). Ready to merge. |
| [#45](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/45) | `cursor/portal-polish-e39d` | Creators see the Connect accounts tab. Phone tables scroll. The tab list lives in `src/lib/portal-tabs.ts`. | Refreshed onto `08655f54`. The test is in `tests/portal-polish.test.ts`. `npx tsc --noEmit` clean. `npm test` 61 passing (60 portal, 1 polish). Ready to merge. |
| [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) | `cursor/permissions-gifts-e39d` | Access (staged permissions) and Free products, brought onto `main`. Migrations `0037_capability_grants.sql` and `0038_gifted_products.sql`. KOSBLING is unchanged. Includes the phone rules and the shared tab list, plus Free products and Access. | Refreshed onto `08655f54`. Tests are in `tests/permissions-gifts.test.ts`. `npx tsc --noEmit` clean. `npm test` 63 passing (60 portal, 1 polish, 2 gifts). Ready to merge. |
| [#48](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/48) | `cursor/gmail-history-gap-e39d` | When Gmail history has expired, read the latest 20 inbox messages and file unseen mail. A temporary failure stays 503. A dead token stays acknowledged. The cursor does not move on either failure. Nothing is sent. | Refreshed onto `08655f54` and combined with `#42`. The test is in `tests/gmail-history-gap.test.ts`. `npx tsc --noEmit` clean. `npm test` 61 passing (60 portal, 1 history gap). Ready to merge. |

`#43`, `#44`, `#45`, `#47`, and `#48` are each against `main`. They no longer append to `tests/portal.test.ts`. Each new test is its own file, and `npm test` runs `tests/*.test.ts`. The shared helpers are the same `tests/harness.ts` and the same `package.json` script line on every one of those branches. A squash of one does not rewrite the shared suite for the next.

Checked by squashing them in a scratch copy of `08655f54`: `#43`, then `#44`, then `#45` merge with no conflicts. `#48` merges cleanly on its own and after `#43`. `#47` merges cleanly on its own and after `#48`. The only leftover conflict is `src/lib/portal-tabs.ts` between `#45` and `#47`, in either order. Keep `#47`’s copy. It is the Connect-accounts list plus Free products and Access.

Migration `0036` is already on `main`. Do not add another `0036`. `#47` uses `0037` and `0038`.

## Where #37 and #39 actually landed

| PR | Squash commit | Base it merged into | On `main`? |
| --- | --- | --- | --- |
| [#37](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/37) staged permissions | `9ecc3b5` | `cursor/live-deal-sync-e39d` | No. [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) ports it onto `main` as migration `0037`. |
| [#39](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/39) free products | `6861f981` | `cursor/staged-permissions-e39d` | No. [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) ports it onto `main` as migration `0038`. |

## Left to do

- Merge `#43`, `#44`, `#45`, `#48`, and `#47`. Order among the first four does not matter. When `#45` and `#47` meet, the only conflict is `src/lib/portal-tabs.ts`. Keep `#47`’s file.
- New tests go in a new `tests/<topic>.test.ts` that imports `./harness`. Do not append to `tests/portal.test.ts`.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The current refresh token fails with `unauthorized_client` until a new token is saved. `#42` keeps Pub/Sub from retrying that dead inbox in the meantime.
- Mail older than the latest 20 inbox messages is still not recovered. `#48` covers that recent page.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment, when paid Google features turn on.
- Leave `STRIPE_ENABLED` and `STRIPE_SECRET_KEY` empty until live Stripe keys exist. `#43` is the switch.
- Leave `BOLDSIGN_ENABLED` and `PUSH_ENABLED` empty.
- Leave `TOKEN_ENCRYPTION_KEY` handling as it is. Do not generate a new key in code and do not commit the key.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
- Free Products and Access are in `#47`, not merged yet. `#45` puts the phone rules on every card with a table and every stage form, so those pages pick the same rules up once both are merged.
- The email bridge in `docs/build-plan-remaining.md` (sending from the approval queue) is not started. Everything external still waits in the approval queue.
- Have an attorney review the e-sign wording before relying on it. That note stays on the sign page. The gifted terms in `#47` are still DRAFT, pending the same review.
- Public marketing pages in `#44` are served under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them.
