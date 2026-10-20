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
| [#45](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/45) | `cursor/portal-polish-e39d` | Phone table scrolling and the Connect accounts tab. Those already landed inside `#47`. | The branch matches current `main` (`2a50833`). Merging it changes nothing. Leave it open for Kamron to close. |
| [#49](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/49) | `cursor/overnight-log-refresh-e39d` | The previous copy of this log, written before `#50` and `#51` landed. | Squash-merged to `main` as `709d83a`. This file is the newer copy. |
| [#50](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/50) | `cursor/gmail-history-pages-e39d` | Follow up to 5 Gmail `history.list` pages. If another page remains, save only the last history record actually read and return 503 so Pub/Sub retries. The cursor does not jump to the newest mailbox id while pages are still unread. Nothing is sent. | Squash-merged to `main` as `4ee1322`. Test file `tests/gmail-history-pages.test.ts`. |
| [#51](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/51) | `cursor/public-page-chrome-e39d` | Services, roster, and inquire hide the creator chat and the quiet-hours install bar. Login and the signed-in portal still show both. Phone headings on those public pages wrap. | Squash-merged to `main` as `02574a4`. Test file `tests/public-page-chrome.test.ts`. |
| [#52](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/52) | `cursor/phone-layout-e39d` | Phone forms put the label above the field. Deal names shrink so the amount stays on the card. The tab row no longer sticks under the header. The public inquiry button fills the form. | Squash-merged to `main` as `d497e50`. Test file `tests/phone-layout.test.ts`. |
| [#53](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/53) | `cursor/gmail-bulk-mail-e39d` | A new email that Gmail already filed as spam, trash, or a newsletter does not open a deal. A later note on a deal that already exists is still filed. Nothing is sent. | Squash-merged to `main` as `4af6c94`. Test file `tests/gmail-bulk-mail.test.ts`. |
| [#54](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/54) | `cursor/overnight-log-next-e39d` | The previous copy of this log, written when `#52` and `#53` were still open. | Squash-merged to `main` as `2a50833`. This file is the newer copy. |
| [#55](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/55) | `cursor/gmail-watch-hardening-e39d` | A Pub/Sub notice that is not newer than the stored cursor is acknowledged and not read again. Renewing a watch keeps that cursor and requires a future expiration. A dead token during a push marks the inbox needs-reconnect. Inbox and Sent label changes are filed. Nothing is sent. | Squash-merged to `main` as `5ecdc2b`. Test file `tests/gmail-watch-hardening.test.ts`. |
| [#56](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/56) | `cursor/page-checkbox-wrap-e39d` | Long checkbox labels wrap inside the phone page. Connect, Reconnect, and Disconnect share the width. Cards wrap long text. A wide screen still keeps short permission boxes on one row. | Squash-merged to `main` as `428cad4`. Test file `tests/page-checkbox-wrap.test.ts`. |
| [#57](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/57) | `cursor/public-roster-inquire-e39d` | Services link to the brand inquiry. The roster shows a public count and a line under each name. The inquiry button says it saves a brand contact. Nothing is emailed. | Squash-merged to `main` as `e7a5dc0`. Test file `tests/public-roster-showcase.test.ts`. The previous copy of this log landed here. |
| [#58](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/58) | `cursor/gmail-missing-mail-e39d` | A deleted Gmail message is marked seen so one missing id cannot stall the cursor. A history id that is not a number is never stored. Drafts and mail from a watched inbox do not open a new deal. A thread that already exists is still filed. Nothing is sent. | Open at `53a5dd4`. Test file `tests/gmail-missing-mail.test.ts`. `npx tsc --noEmit` clean. `npm test` 71 passing on that branch. It was opened from `2a50833`, before `#55` landed, and it also edits `src/lib/gmail-push.ts`. Keep both: the watch renewal from `#55` and these missing-mail checks. |
| [#59](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/59) | `cursor/owner-board-polish-e39d` | The dashboard shows a reinvestment error and a saved note. A brand offer saves to the portal and refuses a `.invalid` contact. A campaign budget that is not a dollar amount shows an error. Free products say to use a date like 2026-11-20. Nothing is emailed, paid, or charged. This log is in the same pull request. | Open. Test file `tests/owner-board-polish.test.ts`. `npx tsc --noEmit` clean. `npm test` 74 passing (73 on current `main`, plus this file). |

`#43`, `#44`, `#47`, and `#48` are on `main`. New tests stay in their own `tests/<topic>.test.ts` files. `npm test` runs `tests/*.test.ts`. The shared helpers are `tests/harness.ts`.

Migration `0036` is on `main` from `#41`. `#47` added `0037` and `0038`. The next unused number is `0039`. Do not add another `0036`.

## Where #37 and #39 actually landed

| PR | Squash commit | Base it merged into | On `main`? |
| --- | --- | --- | --- |
| [#37](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/37) staged permissions | `9ecc3b5` | `cursor/live-deal-sync-e39d` | Yes, via [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) (`73950a6`), migration `0037`. |
| [#39](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/39) free products | `6861f981` | `cursor/staged-permissions-e39d` | Yes, via [#47](https://github.com/authentickambiz-boop/momma-mari-creator-portal/pull/47) (`73950a6`), migration `0038`. |

## Left to do

- `#45` still has no file changes versus current `main` (`e7a5dc0`). Leave it open for Kamron to close. Do not merge it from here.
- `#55`, `#56`, and `#57` are on `main` (`5ecdc2b`, `428cad4`, `e7a5dc0`).
- Merge `#58` (missing Gmail messages, drafts, and internal mail). It edits `src/lib/gmail-push.ts`, which `#55` also edited. Keep both behaviors.
- Merge the owner-board polish on `cursor/owner-board-polish-e39d` (dashboard notices, saved offers, campaign budget errors, and the Free products date hint). It does not edit `src/lib/gmail-push.ts` or `src/app/globals.css`.
- New tests go in a new `tests/<topic>.test.ts` that imports `./harness`. Do not append to `tests/portal.test.ts`.
- Reconnect MariClare’s watched inbox (`mmaclamroc@gmail.com`) after deploy. The current refresh token fails with `unauthorized_client` until a new token is saved. `#42` keeps Pub/Sub from retrying that dead inbox in the meantime. `#55` also marks needs-reconnect when a push hits that dead token.
- Mail older than the latest 20 inbox messages is still not recovered. `#48` covers that recent page when history has expired.
- History beyond 5 pages on one push is on `main` via `#50`. Pub/Sub retries the rest. The cursor does not jump past unread pages.
- Cloud Scheduler for `POST /portal/api/cron/gmail-watch` is still a manual step. Leave it until the next brand payment, when paid Google features turn on.
- Leave `STRIPE_ENABLED` and `STRIPE_SECRET_KEY` empty until live Stripe keys exist. `#43` is the switch, and it is already on `main`.
- Leave `BOLDSIGN_ENABLED` and `PUSH_ENABLED` empty.
- Leave `TOKEN_ENCRYPTION_KEY` handling as it is. Do not generate a new key in code and do not commit the key.
- Google restricted-scope review (and CASA, if Google requires it) is still outstanding for the Gmail watch.
- The email bridge in `docs/build-plan-remaining.md` (sending from the approval queue) is not started. Everything external still waits in the approval queue.
- Have an attorney review the e-sign wording before relying on it. That note stays on the sign page. The gifted terms are still DRAFT, pending the same review. Nothing on Free products is charged.
- Public pages are served under the portal mount (`/portal/services`, `/portal/roster`, `/portal/inquire`) until the Webflow marketing site links to them. `#51` keeps the creator chat and the quiet-hours note off those three pages. `#57` adds the roster count and points Services at the inquiry form.
