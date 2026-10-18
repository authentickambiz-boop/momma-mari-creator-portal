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
