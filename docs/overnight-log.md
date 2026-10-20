# Overnight log

Work toward a launch-ready portal before the next brand payment. Paid features (Stripe live, Cloud Scheduler) stay off until Kamron turns them on. After that, the public site is for marketing mommamari.com, its services, and the creators.

Kamron merges. This log does not merge anything.

## Pull requests

| PR | Branch | What it does | Status |
| --- | --- | --- | --- |
| [#41](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/41) | `cursor/reconnect-invites-e39d` | Creators connect and disconnect Gmail, Drive, and each social account without signing out. A rejected Gmail inbox shows needs-reconnect. Invite and deadline alerts. Migration `0036` shipped with this merge. | Merged to `main` as `da74005`. |
| [#42](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/42) | `cursor/gmail-sync-ack-e39d` | A dead Gmail inbox (unauthorized client or invalid grant, or a mailbox with no token) is acknowledged with HTTP 200 so Pub/Sub stops retrying. Temporary Google errors stay 503. The history cursor is not moved on those failures. A blank thread does not open a deal. | Squash-merged to `main` as `4d53916`. |
| [#46](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/46) | `cursor/launch-checklist-e39d` | The first copy of this log and `docs/launch-checklist.md`. | Squash-merged to `main` as `08655f5`. This file is the newer copy. |
| [#43](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/43) | `cursor/stripe-flag-e39d` | Payment links, incomplete subscriptions, and draft invoices. They run only when `STRIPE_ENABLED` is `true` and `STRIPE_SECRET_KEY` is set. Both are empty. Nothing is charged. | Squash-merged to `main` as `bc51ed7`. Test file `tests/stripe-flag.test.ts`. |
| [#44](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/44) | `cursor/public-marketing-e39d` | Public services, a creator roster that reads the creators table, and a brand inquiry form that saves a brand contact. Nothing is emailed. | Squash-merged to `main` as `8349259`. Test file `tests/public-marketing.test.ts`. |
| [#48](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/48) | `cursor/gmail-history-gap-e39d` | When Gmail history has expired, read the latest 20 inbox messages and file unseen mail. A temporary failure stays 503. A dead token stays acknowledged. The cursor does not move on either failure. Nothing is sent. | Squash-merged to `main` as `3df3b46`. Test file `tests/gmail-history-gap.test.ts`. |
| [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) | `cursor/permissions-gifts-e39d` | Access (staged permissions) and Free products, brought onto `main`. Migrations `0037_capability_grants.sql` and `0038_gifted_products.sql`. KOSBLING is unchanged. The phone table rules and the tab list (Connect accounts, Free products, Access) shipped here too. | Squash-merged to `main` as `73950a6`. Tests in `tests/permissions-gifts.test.ts` and `tests/portal-polish.test.ts`. |
| [#45](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/45) | `cursor/portal-polish-e39d` | Phone table scrolling and the Connect accounts tab. Those already landed inside `#47`. | Refreshed onto current `main` (`709d83a`). The branch matches `main`. Merging it changes nothing. Closing it is also fine. `npx tsc --noEmit` clean. `npm test` 68 passing, the same suite as `main`. |
| [#49](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/49) | `cursor/overnight-log-refresh-e39d` | The previous copy of this log, written before `#50` and `#51` landed. | Squash-merged to `main` as `709d83a`. This file is the newer copy. |
| [#50](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/50) | `cursor/gmail-history-pages-e39d` | Follow up to 5 Gmail `history.list` pages. If another page remains, save only the last history record actually read and return 503 so Pub/Sub retries. The cursor does not jump to the newest mailbox id while pages are still unread. Nothing is sent. | Squash-merged to `main` as `4ee1322`. Test file `tests/gmail-history-pages.test.ts`. |
| [#51](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/51) | `cursor/public-page-chrome-e39d` | Services, roster, and inquire hide the creator chat and the quiet-hours install bar. Login and the signed-in portal still show both. Phone headings on those public pages wrap. | Squash-merged to `main` as `02574a4`. Test file `tests/public-page-chrome.test.ts`. |
| [#52](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/52) | `cursor/phone-layout-e39d` | Phone forms put the label above the field. Deal names shrink so the amount stays on the card. The tab row no longer sticks under the header. The public inquiry button fills the form. | Refreshed onto `709d83a`. Test file `tests/phone-layout.test.ts`. `npx tsc --noEmit` clean. `npm test` 69 passing (68 on main, plus this file). Ready to merge. It only adds to `src/app/globals.css`. |
| [#53](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/53) | `cursor/gmail-bulk-mail-e39d` | A new email that Gmail already filed as spam, trash, or a newsletter does not open a deal. A later note on a deal that already exists is still filed. Nothing is sent. | Refreshed onto `709d83a` after `#50`. Test file `tests/gmail-bulk-mail.test.ts`. `npx tsc --noEmit` clean. `npm test` 69 passing (68 on main, plus this file). Ready to merge. It edits `src/lib/gmail-push.ts` in a different place from the history-page code, and the two combined cleanly. |

`#43`, `#44`, `#47`, and `#48` are on `main`. New tests stay in their own `tests/<topic>.test.ts` files. `npm test` runs `tests/*.test.ts`. The shared helpers are `tests/harness.ts`.

Migration `0036` is on `main` from `#41`. `#47` added `0037` and `0038`. The next unused number is `0039`. Do not add another `0036`.

## Where #37 and #39 actually landed

| PR | Squash commit | Base it merged into | On `main`? |
| --- | --- | --- | --- |
| [#37](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/37) staged permissions | `9ecc3b5` | `cursor/live-deal-sync-e39d` | Yes, via [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) (`73950a6`), migration `0037`. |
| [#39](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/39) free products | `6861f981` | `cursor/staged-permissions-e39d` | Yes, via [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) (`73950a6`), migration `0038`. |

## Left to do

- `#45` matches `main`. Merge it as a no-op or close it.
- Merge `#52` and `#53` in either order. They edit different files. This log can merge anytime. It only edits these two docs.
- New tests go in a new `tests/<topic>.test.ts` that imports `./harness`. Do not append to `tests/portal.test.ts`.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The current refresh token fails with `unauthorized_client` until a new token is saved. `#42` keeps Pub/Sub from retrying that dead inbox in the meantime.
- Mail older than the latest 20 inbox messages is still not recovered. `#48` covers that recent page when history has expired.
- History beyond 5 pages on one push is on `main` via `#50`. Pub/Sub retries the rest. The cursor does not jump past unread pages.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment, when paid Google features turn on.
- Leave `STRIPE_ENABLED` and `STRIPE_SECRET_KEY` empty until live Stripe keys exist. `#43` is the switch, and it is already on `main`.
- Leave `BOLDSIGN_ENABLED` and `PUSH_ENABLED` empty.
- Leave `TOKEN_ENCRYPTION_KEY` handling as it is. Do not generate a new key in code and do not commit the key.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
- The email bridge in `docs/build-plan-remaining.md` (sending from the approval queue) is not started. Everything external still waits in the approval queue.
- Have an attorney review the e-sign wording before relying on it. That note stays on the sign page. The gifted terms are still DRAFT, pending the same review. Nothing on Free products is charged.
- Public pages are served under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them. `#51` keeps the creator chat and the quiet-hours note off those three pages.
- Until `#53` lands, a newsletter that Gmail already labeled can still open a hidden deal. The sender block list is already on `main`.
- Until `#52` lands, a stacked form can still push a phone page sideways, and the tab row can sit under the header.
