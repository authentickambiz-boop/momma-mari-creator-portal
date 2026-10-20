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
| [#45](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/45) | `cursor/portal-polish-e39d` | Phone table scrolling and the Connect accounts tab. Those already landed inside `#47`. | Refreshed onto `73950a6` as `44094da`. The only conflict was `src/lib/portal-tabs.ts`. Main’s tab list was kept (Free products and Access stay). After that refresh the branch matches `main`. Merging it changes nothing. Closing it is also fine. `npx tsc --noEmit` clean. `npm test` 66 passing. |
| [#49](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/49) | `cursor/overnight-log-refresh-e39d` | This log and the launch checklist, rewritten after `#43`, `#44`, `#48`, and `#47` landed. | Docs only, refreshed onto `73950a6`. Ready to merge. It does not collide with `#50` or `#51`. |
| [#50](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/50) | `cursor/gmail-history-pages-e39d` | Follow up to 5 Gmail `history.list` pages. If another page remains, save only the last history record actually read and return 503 so Pub/Sub retries. The cursor does not jump to the newest mailbox id while pages are still unread. Nothing is sent. | Commit `3ae060f`. Test file `tests/gmail-history-pages.test.ts`. `npx tsc --noEmit` clean. `npm test` 67 passing. Ready to merge. It edits `src/lib/gmail-push.ts` and `docs/live-sync-setup.md`. |
| [#51](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/51) | `cursor/public-page-chrome-e39d` | Services, roster, and inquire hide the creator chat and the quiet-hours install bar. Login and the signed-in portal still show both. Phone headings on those public pages wrap. | Commit `87bb4c2`. Test file `tests/public-page-chrome.test.ts`. `npx tsc --noEmit` clean. `npm test` 67 passing (main’s 66 plus this file; it does not include the `#50` test). The first HTML of `/services`, `/roster`, and `/inquire` was checked on a local server and does not include the chat or the quiet-hours note. `/login` still does. Ready to merge. It edits the community panel, the home screen, `src/lib/public-site.ts`, and `src/app/globals.css`. It does not edit `src/lib/gmail-push.ts`. |

`#43`, `#44`, `#47`, and `#48` are on `main`. New tests stay in their own `tests/<topic>.test.ts` files. `npm test` runs `tests/*.test.ts`. The shared helpers are `tests/harness.ts`.

Migration `0036` is on `main` from `#41`. `#47` added `0037` and `0038`. The next unused number is `0039`. Do not add another `0036`.

## Where #37 and #39 actually landed

| PR | Squash commit | Base it merged into | On `main`? |
| --- | --- | --- | --- |
| [#37](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/37) staged permissions | `9ecc3b5` | `cursor/live-deal-sync-e39d` | Yes, via [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) (`73950a6`), migration `0037`. |
| [#39](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/39) free products | `6861f981` | `cursor/staged-permissions-e39d` | Yes, via [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) (`73950a6`), migration `0038`. |

## Left to do

- Merge `#49` anytime. It only edits this log and the launch checklist.
- `#45` matches `main`. Merge it as a no-op or close it.
- Merge `#50` and `#51` in either order. They touch different files.
- New tests go in a new `tests/<topic>.test.ts` that imports `./harness`. Do not append to `tests/portal.test.ts`.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The current refresh token fails with `unauthorized_client` until a new token is saved. `#42` keeps Pub/Sub from retrying that dead inbox in the meantime.
- Mail older than the latest 20 inbox messages is still not recovered. `#48` covers that recent page when history has expired.
- History beyond 5 pages on one push is `#50`. Until that lands, one history page is read and the cursor can jump past the rest.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment, when paid Google features turn on.
- Leave `STRIPE_ENABLED` and `STRIPE_SECRET_KEY` empty until live Stripe keys exist. `#43` is the switch, and it is already on `main`.
- Leave `BOLDSIGN_ENABLED` and `PUSH_ENABLED` empty.
- Leave `TOKEN_ENCRYPTION_KEY` handling as it is. Do not generate a new key in code and do not commit the key.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
- The email bridge in `docs/build-plan-remaining.md` (sending from the approval queue) is not started. Everything external still waits in the approval queue.
- Have an attorney review the e-sign wording before relying on it. That note stays on the sign page. The gifted terms are still DRAFT, pending the same review. Nothing on Free products is charged.
- Public pages are served under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them. `#51` keeps the creator chat and the quiet-hours note off those three pages.
