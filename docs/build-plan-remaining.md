# Remaining build plan

Kamron approved this plan. Build one phase per pull request, starting from the latest `main` each time. Do not merge from the agent. Everything sent outside the portal goes through the approval queue. Leave the KOSBLING deal alone. Keep migrations in order and tests passing.

The manager role and the Needs you list already shipped. Phase 8 in this change is the polish that was still open. Community and Phases 9–17 come after, one pull request at a time.

## Phase 8, polish

- Save approved and sent emails to the deal's Drive folder as PDFs. The folder name is `04 Emails`. If Drive is not connected, keep the PDF in the portal. Approving or sending still succeeds if Drive is down.
- Add an optional BoldSign switch, off by default, behind `BOLDSIGN_ENABLED`. No new cost unless it is turned on. Click-to-sign on this site stays the path while the switch is off.
- Small UX polish: show the saved copy on the approval card, and say that BoldSign is off.

## Community C1, side panel and chat

The chat lives inside the portal, not on a separate page.

- The right side panel is 360–380px and sits in the shared App Router layout, so it persists across pages.
- Channels: Announcements (admins post only), everyone, and wins. Include a pinned message, reactions, and photos.
- Collapse to a 48px rail with an unread count. Remember the state per device. Ctrl+/ toggles it.
- Width: open by default at 1280px and up; a collapsed overlay drawer at 1024–1279px; below 1024px, a floating Chat button opens a full-screen sheet.
- Accessibility: `aria-live="polite"` and a labeled region.
- Admin menu on each message: Pin, Delete, Mute 24h, Remove member. Add a Reports queue with Dismiss, Delete, Mute, and Remove, and an audit log of admin actions. Creators can delete their own messages and report messages.
- Read-only and slow mode.
- The composer runs a privacy nudge for phone numbers, emails, addresses, school-like words, and dollar amounts: "This looks private. Post anyway?" Store counts only (`community_filter_hits`).
- Photos: before posting, ask "Does this show a child's face?" If yes, hold it for Kamron's approval. Strip EXIF on the server. Store photos in private R2 behind short-lived signed links. Resize on the client.
- Roles: admin and moderator. A moderator can delete, mute, and handle reports, but cannot remove members or change roles. Reuse the existing roles tables.
- No direct messages and no bot posts in v1. Guidelines get a one-time "I agree". Removed members' messages are labeled "former member". Keep history 12 months, and purge deleted items within 30 days. Send `noindex`, and require sign-in plus a roster check on every request.
- Polling, not WebSockets:
  - `GET /api/community/events?after=cursor` every 5 seconds while the panel is open and visible, 30 seconds when collapsed, 60 seconds when the tab is in the background.
  - Read a KV key `community:last` and return 204 if it has not changed.
  - `POST /api/community/messages` saves to D1, then bumps KV.
  - Presence `last_seen` is written at most once a minute.
  - Keep everything under `/api/community/*` JSON so we can switch to Ably later.
- Every roster creator gets access, not only Full Access.
- Tests: strangers, removed members, and muted members are refused. No community route imports or queries deals, payments, drafts, or earnings (static plus runtime checks). Access level (Full or Core) never appears in any response. Photo links expire, and EXIF is gone.

## Community C2, Members directory and My profile

- The `creator_profiles` table holds per-field visibility. Every field is off by default, and the profile stays hidden until the creator turns it on.
- Fields:
  - display name (required)
  - avatar (initials by default; show a "no kids' faces" reminder)
  - bio (280 characters)
  - niche tags from a fixed list
  - platform handles
  - audience size as a range only
  - formats
  - "ask me about"
  - open to collabs
  - state only
  - brands worked with (names only, never amounts)
  - family details (a child's first name or nickname plus an age range, with an extra confirm step)
  - joined month and year (on by default)
- Never show rates, pay, earnings, Full Access or Core status, contracts, email, phone, or Kamron's notes.
- Add profile cards, "how others see me", and one-click Hide. Admins can hide or reset a field, which is logged and tells the creator why. Leaving the roster hides the profile right away.
- Tests: the directory never returns off or Kamron-only fields, and creators cannot edit each other's profiles.

## Phase 9, payout tracker

Each creator sees when the brand paid, the 20% fee, and when their cut was sent. Build on Phase 7's payment stages, owner-marked only. No money moves.

## Phase 10, deliverable calendar and reminders

Draft and post due dates, optionally synced to the creator's calendar when connected, plus a bot nudge 3 days ahead. Nudges go to the approval queue or in-portal only. No auto-send.

## Phase 11, brand CRM

Every brand contact, past deal, rate, and response, including declines. The screening decisions log feeds it. Amounts are owner-only.

## Phase 12, usage-rights tracker

Flags licenses nearing expiry and suggests a renewal tied to catalog items B-UA, B-UA90, B-UA12, and B-UAP.

## Phase 13, auto media kit

A shareable media kit page. Stats are entered by hand for now. Zernio stats come later behind a flag.

## Phase 14, kid-safety upload check

Checks each draft for school logos, house numbers, location tags, and kids' full names before it goes to a brand. Flags are held for Kamron.

## Phase 15, monthly creator report

One page on earnings, deals, and growth. The email is drafted into the approval queue only.

## Phase 16, referral bonus

Tracks referrals. The perk amount is a configurable placeholder, and nothing is paid out automatically. This needs a lawyer check.

## Phase 17, Home Screen app

A PWA with a manifest, install prompt, and service worker, plus web push for approvals, announcements, mentions, and replies. Quiet hours are 9 PM–8 AM ET. The chat button becomes a bottom-bar item when installed.

## PR G, creator email bridge

Queued after PR F (`cursor/platform-bench-e39d`). This section is the plan only. Do not build the bridge in F, and do not start it until F is merged. One pull request, with tests. Nothing in it sends or charges on its own.

The portal is the only bridge between a creator's connected email and her managers. A manager never receives credentials, a password, or a direct inbox for her email or her social accounts. This pull request covers Gmail only. It does not connect a manager to TikTok, Instagram, or any other social login.

What the server does:

- Read each creator's connected Gmail with the scopes already used by Connect your email: `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.compose`. Keep sign-in on `openid email profile`. Use the existing redirect URI. Do not add another one, and do not request `https://mail.google.com/`.
- Store the refresh token encrypted with `TOKEN_ENCRYPTION_KEY`, the same rule as today. The token never goes to the browser, the manager, or the bot API. If the key is empty, connect does not start.
- Pull in only deal-relevant threads: a thread that matches an active deal or brand, plus a new brand inquiry the bot classifies as a deal. Each one becomes a task on the manager queue. A manager sees tasks only for creators assigned to her.
- Let the manager read that thread and draft a reply inside the portal. The send goes through the existing approval queue. Whether the creator or the owner must approve is a per-creator setting. After approval, the portal sends server-side as the creator. The manager never sees the token.
- This send path is not the agency From address. Other queued mail stays from `authentickambiz@gmail.com`. A deal reply waits pending until the required person approves it. Drafting does not send.
- Never show personal or other non-deal mail to a manager. The creator can mark a thread private. That mark keeps the body off the manager queue until she clears it. The owner can correct the bot's deal or not-deal label. Reclassifying a thread as not a deal removes it from the queue. An owner "this is a deal" label does not override a private mark.
- Audit-log every view and every send: who, which thread, and when. The owner can read the log. A manager cannot delete it.
- Drop access the moment a manager is unassigned. The next request returns nothing for that creator, and the portal does not keep a manager-side copy of the thread.
- Let the creator disconnect at any time. Disconnect revokes the Google grant and deletes the stored token. New pulls stop.
- Proxy attachments through the portal. A manager can open one file to view it. There is no bulk download and no Gmail attachment URL in the browser.

Google scope and verification, before this is offered past the current test roster:

- Both Gmail scopes are restricted. `gmail.readonly` is "view your email messages and settings." `gmail.compose` is "manage drafts and send emails." Google has no scope that means "deal threads only." The consent screen will say the app can read mail and send mail. Hiding personal mail is a portal rule, not a Google limit. The deals-only Gmail recommended on Connect your email is still the right mailbox to connect. A personal inbox still has to be filtered in the portal.
- The portal stores and transmits that mail on its own server, so restricted-scope verification includes a CASA security assessment by a Google-empanelled assessor. CASA is required before the app goes past 100 users. The unverified cap is 100 new users over the life of the Cloud project, and it cannot be reset. In Testing, only allowlisted test users can connect, they see a testing warning, and their refresh tokens expire seven days after consent. A creator will have to reconnect weekly until the app is verified and published. A password change can also invalidate a Gmail refresh token. Treat a dead token as "reconnect," not as an empty inbox.
- Publishing to any Google user requires brand verification first, then restricted-scope review, including a privacy policy on the same public domain as the app home page. The policy has to say that the portal reads Gmail, stores deal threads, shows those threads to the assigned manager, and deletes them on disconnect. Google's Limited Use rules also limit letting humans read Gmail, so the consent and the policy need to name that manager access. Google's own estimate for restricted-scope review is about six weeks, and that estimate is not a promise.
- Keep the verified scopes by repeating compliance review and CASA at least every 12 months. Adding another restricted scope later can force a new assessment.
- An Internal consent screen does not cover creators on their own Gmail. They are outside a Momma Mari Workspace, so the app stays External.
- Switching the send scope to `gmail.send` would not remove CASA. Reading mail with `gmail.readonly` and keeping it on the server is what requires the assessment.

When it is built, tests should show: a manager cannot read another creator's threads; unassign and disconnect both return no body and no token; a private or non-deal thread is absent from the manager payload; the token never appears in manager JSON, bot API responses, or page HTML; a reply stays pending until approval and goes out as the creator; an attachment route returns one file and not a zip. Leave the KOSBLING deal unchanged.
