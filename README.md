# Momma Mari creator portal

Private deal dashboard for creators managed by Momma Mari LLC. Public pages at `/services`, `/roster`, and `/inquire` describe the work, list creators from the roster (no email, handle, or pay), and save a brand inquiry onto the brand list. The inquiry form does not send email. Each creator signs in with Google and sees only her own deals, drafts, payments, and analytics. Kamron (`Kamron@mommamari.com`) is the agency admin and can see every creator, including deals still hidden from the creator.

The pilot is a Next.js app prepared for [Webflow Cloud](https://developers.webflow.com/webflow-cloud), mounted at `mommamari.com/portal`. This repository does not deploy itself and does not connect to the Webflow site. The steps at the bottom are what the owner runs once.

Local address while developing: [http://localhost:43123](http://localhost:43123)

## Why Next.js

Checked against Webflow Cloud docs on October 17, 2026 ([bring your own app](https://developers.webflow.com/webflow-cloud/bring-your-own-app)):

- Webflow Cloud hosts Next.js 15+, Astro 5+, Vite 6.1+, and static sites on Cloudflare Workers.
- Next.js is the full-stack path: server-rendered pages, Route Handlers for the bot API, and first-class D1 and KV bindings. Astro is a better fit for content sites than for this portal.
- The package manager on Webflow Cloud is npm. Node 22 or newer.
- Do not set `basePath` or `assetPrefix`. Webflow overwrites them from the mount path at build time. Client `fetch` and plain links read `NEXT_PUBLIC_BASE_PATH`.
- Webflow ignores a custom `build` script and runs `opennextjs-cloudflare build`. `npm run build` is only a local check.
- Storage is declared in `wrangler.json`. The D1 binding is `DB` (migrations in `drizzle/`). The KV binding is `SESSIONS`. Webflow replaces the placeholder ids and applies the SQL files on deploy.

## What runs today

- Google sign-in (authorization code) with an allowlist. Admin emails in `ADMIN_EMAILS` are owners. Managers are added on the Team page and sign in with their own Google email. Creator emails come from the `creators` table. A stranger is rejected. An owner address is checked first, then a manager, then a creator.
- Team. Kamron opens Team, adds a manager by the Google email they will use to sign in, and assigns each creator a primary manager and an optional backup. The manager sees My creators and a Needs you list, and only those creators. They do not see other creators, the Team page, earnings, or payout amounts. Owners still see everyone and can override any decision.
- Sessions are an HMAC-signed httpOnly cookie, stored in the database and, on Webflow Cloud, also in KV.
- Deal list and deal detail, earnings, analytics, and connect-accounts, laid out to match the approved October 17, 2026 mockup.
- Seed data for MariClare (`mmaclamroc@gmail.com`): KOSBLING, VEV Gummies, WaterH, Persona, Sanvive, Halara, plus a Grail deal that stays hidden from her. `drizzle/0004_creator_profiles.sql` fills in Abby Theriot (`theofficialtheriots@gmail.com`) and AuthenticKam (`authentickambiz@gmail.com`).
- Draft upload in 8 MB chunks. With Drive credentials, the portal opens a Google resumable session and forwards each chunk. The session URL stays on the server. The draft row stores the deal id, Drive file id, and the deal's Gmail thread id.
- Bearer JSON API for the agency bot.
- Creator interest. Kamron marks an offer "Screened and released to creator" before she can see it. She can say "I'm interested" or "Not for me". That moves the stage, tells Kamron, and drops a pending email into the approval queue. Nothing is sent until he approves it. The From address is `authentickambiz@gmail.com`.
- Contract versions. An admin uploads the brand's PDF or DOCX. Each file is kept (v1, v2, …) in a Contracts folder. A private checklist stays with Kamron. Asking the brand for changes queues an email from `authentickambiz@gmail.com`. Approving the contract is admin-only and tells the creator the file is ready to sign. She never sees the checklist notes.
- Click-to-sign. After Kamron approves a PDF (or a DocuSign-marked PDF), the creator opens it on the sign page, agrees to sign electronically, and types or draws her signature. The portal stamps that signature on the PDF, adds a certificate page, and keeps every copy. A signed-contract email to the brand waits in the approval queue, from `authentickambiz@gmail.com`, until Kamron approves it. Have an attorney review this e-sign wording before you rely on it.
- Managers. An owner assigns each creator to a manager. That manager screens offers, reviews videos, and approves brand email for those creators. Approving contracts and countersigning stay with the owner unless he turns those on. Every stage change and approval records who did it.
- Product and posting. Kamron or a manager enters the carrier and tracking number. The creator sees it and taps I got it, which turns on the draft upload. After the brand approves the video, she pastes the live links and the manager confirms they match the brief. Kamron marks brand invoiced, brand paid into the Momma Mari account, creator payout pending, and creator paid. Nothing is charged or sent automatically. He sees the 20% commission. She sees when the brand paid, the 20% fee, and when her cut was sent. A manager sees no amounts.
- Calendar. Draft and post due dates sit on a Calendar page. Three days ahead, the bot can leave a note in the portal or drop a reminder email into the approval queue. That email stays pending, from `authentickambiz@gmail.com`, until Kamron approves it. A creator can connect her calendar and download an `.ics` file. Nothing is emailed or added to an outside calendar on its own.
- Brands. The Brands page groups each company with its contact, past deals, screening notes, and responses, including declines. Kamron sees the rate. A manager sees the same list for their creators, without amounts. A creator does not see this page.
- Usage rights. A deal can have a start and end for the license. If it ends within 30 days, or it already ended, the Usage rights page flags it and suggests B-UA, B-UA90, B-UA12, or B-UAP. Those are names only. Nothing is charged.
- Media kit. A creator types her own followers, average views, and engagement, then shares a page. The page does not show pay or her email. Zernio stats stay off unless `ZERNIO_STATS_ENABLED=true`.
- Email copies and BoldSign. When an email is approved, and again when the bot marks it sent, the portal saves a PDF. With Drive connected, that file goes in a folder named 04 Emails. Otherwise the portal keeps it, and the approval still succeeds. BoldSign stays off unless `BOLDSIGN_ENABLED=true`. Signing stays on this site at no extra cost while it is off.
- Members. A creator opens My profile and turns on only the fields she wants on the Members page. The profile stays hidden until she does. Handles, pay, email, and notes stay off unless she checks that field, and pay is never a profile field. She can hide the whole profile in one click. Kamron can hide or reset one field and she is told why.

Server-side rules, covered by `npm test`:

- A creator's queries only return her rows, and only deals with "visible to creator" on.
- Asking for another creator, for "all", or for a hidden deal returns the same "isn't on your list" result. The page does not reveal that the deal exists.
- Kamron sees hidden deals and the private note on a card.
- The creator's cut is always the brand amount minus Momma Mari's 20% fee. A stored split is not used for that math.

## What is stubbed until you add credentials

- **Google sign-in** until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Locally, `AUTH_DEV_LOGIN=true` shows practice buttons that skip Google. Leave that off on Webflow Cloud.
- **Drive** until a refresh token or a service account is set. The upload still records a draft on the deal and says, in the page, that the video itself was not stored. It does not pretend the file reached Drive.
- **Zernio connect buttons** until `PUT /api/bot/creators` sets a URL. Until then the button explains that the bot will add the link.
- **Analytics** are seed rows labeled EXAMPLE. The first real daily row from the bot replaces that chart for that creator.
- **Gmail thread ids** on seed deals are `seed-thread-*`. The bot should write the real thread id with `PATCH /api/bot/deals/:id`. The portal does not read a mailbox.
- No bank details, no payout sending, and no 15-minute worker. The bot calls the API on its own schedule. New deals from the bot stay hidden until `visibleToCreator` is set true.

## Run it locally

Requires Node 22+ and npm.

```bash
npm install
cp .env.example .env.local
```

Fill in at least `SESSION_SECRET` and `BOT_API_TOKEN` (any long random strings). The checked-in `.env.example` lists every variable. A local `.env.local` is gitignored.

```bash
npm run dev
```

Open [http://localhost:43123](http://localhost:43123). The first request creates `data/portal.sqlite` and applies `drizzle/0000_schema.sql` and `drizzle/0001_seed.sql`. Sign in with a practice button.

`next.config.ts` turns off Next's dev-only React debug channel. That channel waits on the hot-reload socket before the page becomes interactive, and Chrome's websocket handshake against this Next version fails (`permessage-deflate`), so buttons and uploads would never attach. Refresh the browser after code changes. Production and Webflow Cloud do not use the channel.

```bash
npm test
```

Tests use an in-memory database, so they do not touch `data/portal.sqlite`.

To regenerate the seed file after editing `scripts/render-seed.mjs`:

```bash
npm run db:seed
```

Delete `data/portal.sqlite` and restart the dev server to reapply migrations. Already-applied files are not run again.

## Bot API

Every route under `/api/bot` requires:

```http
Authorization: Bearer $BOT_API_TOKEN
Content-Type: application/json
```

A missing or wrong token returns `401`. If `BOT_API_TOKEN` is unset, every bot route returns `503`.

Examples below use the local server. On the live site, change the host to `https://mommamari.com/portal` (the mount path is already in that origin; do not add `/portal` twice).

### List drafts since a timestamp

Seed drafts are omitted unless `includeSeed=true`, so a poll does not email brands about the sample WaterH file. Drafts still in `uploading` are omitted. `upload_session_url` is never returned.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/drafts?since=2026-10-01T00:00:00.000Z"
```

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/drafts?since=2026-10-01T00:00:00.000Z&includeSeed=true"
```

Each draft includes `id`, `dealId`, `brand`, `creatorEmail`, `gmailThreadId`, `version`, `filename`, `driveFileId`, `driveFileUrl`, `status`, and `uploadedAt`.

### Post a revision on a deal

`source` is `brand`, `us`, or `bot`. `draftStatus` is optional and must be one of `uploading`, `new`, `email_awaiting_ok`, `sent`, `approved`, `revisions`. When both `draftId` and `draftStatus` are sent, that draft's status is updated.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"summary":"Brand asked for a shorter bio-link term.","source":"brand","occurredLabel":"Oct 18, 9:00 AM","emailUrl":"https://mail.google.com/mail/u/0/#inbox/THREAD"}' \
  http://localhost:43123/api/bot/deals/vev/feedback
```

### Update a deal

Known deal statuses: `pitch`, `negotiating`, `active`, `delivered`, `paid`. You can also set `visibleToCreator`, `nextStep`, `botMessage`, `stage` (number or null), `workflowStage`, `stageNote`, `uploadEnabled`, `gmailThreadId`, and `kamronNotes`.

`workflowStage` is the detailed stage id. Sending it records a stage-history row (actor `bot`) and moves the coarse `status` to that stage's bucket. A private `stageNote` is stored on that history row only. A status-only update does not move `workflowStage`. The old numeric `stage` is still the 5-step video bar (`0` draft due, `1` manager review, `2` brand revisions, `3` brand approved, `4` scheduled / posted) and, when sent as a number, also moves `workflowStage` to the matching stage. If the same request sends both a status and a stage, the explicit status wins.

Stage ids, in order: `offer_received`, `offer_shared`, `creator_interested`, `interest_sent`, `contract_received`, `contract_review`, `revisions_requested`, `revised_contract`, `approved_by_agency`, `awaiting_signature`, `signed_by_creator`, `signed_sent`, `waiting_for_product`, `product_received`, `draft_due`, `draft_submitted`, `manager_review`, `sent_to_brand`, `brand_revisions`, `brand_approved`, `scheduled_posted`, `payment_pending`, `paid`. Side exits: `creator_declined`, `brand_quiet`, `cancelled`, `on_hold`. A new deal with no `workflowStage` starts at the stage that matches its status (or `offer_received` when the status is `pitch`) and stays hidden unless `visibleToCreator` is true. Moving a deal to `offer_shared` turns it on for the creator. `offer_received` and `creator_declined` turn it off, unless that same request also sets `visibleToCreator`.

### Approval queue

Outgoing brand email is not sent from this API. `POST /api/bot/approvals` stores a pending draft. The bot cannot set `status` to anything but pending, and it cannot choose a From address. Every draft is from `authentickambiz@gmail.com`. An admin approves, edits, or rejects it in the portal. `GET /api/bot/approvals` returns only approved drafts (`?status=pending` is rejected). `POST /api/bot/approvals/:id/sent` with `{ "messageId": "..." }` marks one approved draft sent. Pending, rejected, and already-sent drafts return `409`.

`gate` is `interest`, `revision`, `signed_contract`, `video`, or `decline`. A decline also needs a brand contact (`brandContact.name`, `email`, or `company`) and either `suggestedCreatorId` (a different creator on the roster) or `suggestedPlan`. Approving a decline saves that contact. The suggestion is for Kamron; it is not added to the email text.

`email_awaiting_ok` on a video draft does not allow sending. The video email still has to be an approval with gate `video`.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": "persona",
    "gate": "interest",
    "to": "hello@persona.example",
    "subject": "MariClare is interested",
    "body": "Hi, MariClare would like to move ahead at the rate we discussed."
  }' \
  http://localhost:43123/api/bot/approvals
```

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  http://localhost:43123/api/bot/approvals
```

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"REAL_GMAIL_MESSAGE_ID"}' \
  http://localhost:43123/api/bot/approvals/APPROVAL_ID/sent
```

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active","visibleToCreator":true,"gmailThreadId":"REAL_THREAD_ID"}' \
  http://localhost:43123/api/bot/deals/persona
```

### Creator interest

A creator only sees an offer after Kamron screens it. On the deal, he enters the brand email and clicks **Screened and released to creator**. That moves the deal to `offer_shared`, turns it on for her, and logs the screening. Unscreened offers stay hidden. Moving the stage menu to "Offer shared with creator" logs a screening too, when one is not already there.

On that offer she sees **I'm interested** and **Not for me**, plus an optional note. She can only answer her own released offers, and only once.

I'm interested moves the deal to `creator_interested`, writes stage history (her note stays on that history row), notifies Kamron, and drafts an interest email into the approval queue. The note is in the draft so Kamron can send the rate or the date she asked for. From is always `authentickambiz@gmail.com`. The draft stays pending until he approves it.

Not for me asks for an optional reason, moves the deal to `creator_declined`, takes it off her list, and notifies Kamron. The reason is in his notice and in the stage history. The queued email is a polite no that tries to keep the relationship. It does not include her reason or a suggested creator. The draft is prefilled with the brand contact and a suggestion: another roster creator with a lower monthly goal when there is one, otherwise the next creator by name, plus another plan ("A gifted post or a smaller scope, if a full paid post doesn't fit."). Approving that decline saves the brand contact, the same way any other decline in the queue does. If Kamron rejects it, nothing is sent and the contact is not saved.

`GET /api/bot/interest` returns those choices for Kash Bot (`?since=` is an ISO timestamp). It does not include mailbox tokens, and it does not send the email. Approved mail is still `GET /api/bot/approvals`.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/interest"
```

### Manager video review

When a creator finishes uploading a video, the deal moves to Draft submitted and the file stays in her Brand Drafts folder. Each version is kept (v1, v2, v3).

On a finished draft, an admin (`ADMIN_EMAILS`) sees **Approve** and **Request changes**, plus notes. A creator cannot review her own video.

Request changes sends that version back to her with the notes, moves the deal to Draft due, writes the stage history, and turns the upload box back on for the next version. The brand is not emailed.

Approve moves the deal to Manager review and puts a video email in the approval queue. The email includes the Drive link when there is one. From is always `authentickambiz@gmail.com`. It stays pending until an admin approves it on the Approvals page. Nothing is sent before that.

She sees a notice in the portal for either decision: what to fix, or that her manager approved it and the brand email is waiting for Kamron.

`GET /api/bot/draft-reviews` returns those reviews for Kash Bot (`?since=` is an ISO timestamp). It does not send the email.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/draft-reviews"
```

### Contracts

An admin uploads the brand's contract on the deal (PDF or DOCX). The first file is v1. The next upload is v2, and so on. Older files stay. Nothing is overwritten and nothing is deleted. When Drive is connected, the file goes in a folder named `02 Contracts` inside that creator's folder for the brand. The deal's video folder is left alone.

Each version has a review checklist: payment terms, usage rights and duration, exclusivity, deliverables and dates, revisions, kill fee, FTC disclosure, minors and kids' privacy, morality clause, and governing law. The notes on that list are only for Kamron. The creator never sees them.

**Request revisions** writes an email to the brand that lists the items marked as an issue. That email goes into the approval queue from `authentickambiz@gmail.com` and stays pending until an admin approves it. Nothing is sent before that.

**Approve contract** is admin-only. It moves the deal to Approved by Momma Mari. The creator gets a notice in the portal, and she can open the approved file. Versions that are still in review stay hidden from her. Signing is the next step, described below.

A PDF, or a file marked DocuSign, is fine for that later signing step. Any other format, including a Word file, is marked **needs review before signing** and cannot be approved until Kamron uploads a PDF or marks it as DocuSign.

Momma Mari countersigning is optional. Kamron checks it on the version when this deal needs her signature too. The creator sees that as a status line on the approved file, not as a checklist note.

KOSBLING is already past the contract (the draft is due). Uploading a contract there is refused, and that deal is not changed.

`GET /api/bot/contracts` returns the versions and the checklist for Kash Bot (`?since=` is an ISO timestamp). `POST /api/bot/contracts` attaches a contract the bot already pulled from email. Neither call sends mail or returns a mailbox token.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/contracts"
```

### Click-to-sign

After the contract is Approved by Momma Mari, the creator opens **Sign this contract** on her deal. She sees the PDF. She checks that she agrees to do business electronically, types her full legal name, adds a typed or drawn signature, and checks that she has read and agrees. Have an attorney review this e-sign wording before you rely on it.

The portal keeps an audit record: who signed, her email, the time in UTC, her IP address, her browser, and a SHA-256 of the exact file she signed. It stamps the signature on the last page, adds a certificate page, and saves that PDF in the Contracts folder. Older copies stay. Nothing is overwritten.

If Kamron checked **Momma Mari countersigns**, her countersignature comes next, and the brand email waits until that is done. Once the package is final, a signed-contract email goes into the approval queue from `authentickambiz@gmail.com` and stays pending until an admin approves it. The deal moves to Signed by the creator. Nothing is sent before that approval.

If the brand already sent a completed DocuSign, Kamron uploads that PDF on the deal. The sign page is skipped, and the file is stored as they sent it.

If Kamron marks **The signer is a minor**, a parent or guardian signs instead, and Kamron gets a flag to review it. A creator can only sign her own deal, once per version. Uploading a new version voids a signature request that was not finished.

`GET /api/bot/signatures` returns that status for Kash Bot (`?since=` is an ISO timestamp). It does not return a mailbox token.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/signatures"
```

### Owners and managers

Kamron's address in `ADMIN_EMAILS` is an owner. He sees every creator, the Team page, earnings, and payout amounts, and he can override any decision.

To add the first manager, sign in as Kamron and open **Team**. Enter the manager's name and the Google email they will use to sign in. Leave the defaults: approve brand emails on, approve videos on, approve contracts off, countersign off. Then assign a creator, such as MariClare, as that manager's primary. A backup is optional. You can move a creator to someone else at any time.

That manager signs in with the same Google email. They see **My creators** and a **Needs you** list for the people you assigned. They can screen and release offers, approve those creators' brand emails, review videos, and move stages. They do not see other creators, the Team page, earnings, or payout amounts. Contract approval and countersigning stay with you until you turn those toggles on for that manager. Deactivate a manager from Team when they should no longer sign in.

Notices go to the primary manager. If that manager is missing or deactivated and a backup is active, the backup gets the notice and you get a copy. If nobody is assigned, you get it, the same as before.

The bot lists stay the same shape and add the assigned primary manager (`manager` is `{ id, name, email }` or `null`). They still do not return a mailbox token.

### Product, posts, and payment

Kamron or the assigned manager opens the deal and enters the carrier and tracking number. The creator sees "On the way" and the tracking link, then taps **I got it**. That moves the deal to draft due and turns on the upload box.

After the brand approves the video, she pastes the live TikTok, Instagram, Facebook, or YouTube link. The manager confirms it matches the brief. If the brand email is on the deal, that confirmation can also drop a "post link to brand" email into the approval queue. It stays pending, from `authentickambiz@gmail.com`, until someone approves it. Nothing is sent on its own.

On Earnings, Kamron marks four steps, in order: brand invoiced, brand paid (into the Momma Mari account), creator payout pending, and creator paid. No money moves by itself. He sees Momma Mari's 20% commission. The creator sees when the brand paid, that 20% fee, and the date her cut was sent, plus her own payout amount. She does not see the contract split percent. A manager does not see amounts.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dealId":"vev","carrier":"UPS","trackingNumber":"1Z999"}' \
  http://localhost:43123/api/bot/shipments

curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/posts"
```

### Members

Each creator has a profile that stays hidden until she turns it on. Every field is off except the month and year she joined. The directory shows only the fields she checked. It never shows pay, email, phone, or Kamron's notes. She can hide the whole profile in one click. Kamron can hide or reset one field, and she is told why. If she leaves the roster, the profile disappears.

### Calendar

Kamron or the assigned manager sets a draft due date or a post due date on Calendar. The creator sees those dates. She does not see pay on that page. Three days before a date, the bot may call `POST /api/bot/reminders` with `"channel": "portal"` (a note on her home page) or `"channel": "queue"` (a pending email she will not receive until Kamron approves it). Calling it twice does not send a second reminder. Connecting her calendar only turns on a downloadable `.ics` file.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"today":"2026-10-18","channel":"portal"}' \
  http://localhost:43123/api/bot/reminders
```

### Brands

The Brands page is the contact list. Each card is one company. It shows the contact on the deal, any contact saved from an approved polite decline, every past deal, the screening log, and responses (interested, declined, no reply, negotiating). Kamron can add a response. He is the only one who sees rates. Managers see their creators' brands and no amounts. Creators do not get this page.

### Usage rights

Kamron or the assigned manager sets when a license starts and when it ends. An empty end date means perpetual and suggests B-UAP. A window of about 90 days suggests B-UA90, about a year suggests B-UA12, and a short window suggests B-UA. The page flags "Nearing expiry" inside 30 days and "Expired" after the end date. Nothing is charged.

### Media kit

A creator opens Media kit, types her stats, and turns on Share. The link is `/kit/` plus her name. Anyone with the link sees the display name, bio, followers, average views, engagement, and niches. They do not see pay, email, or phone. Zernio is off unless `ZERNIO_STATS_ENABLED=true`. Leave it empty. Stats stay hand-entered, and nothing is pulled from Zernio.

### Email copies

Approving an email saves a PDF of the From, To, subject, and body. When the bot marks that email sent, a second PDF is saved. On the Approvals page each one says "Copy kept in the portal". If Drive is connected, the same file is also uploaded into the brand folder's `04 Emails` subfolder. A Drive problem does not undo the approval.

BoldSign is off unless you set `BOLDSIGN_ENABLED=true` and `BOLDSIGN_API_KEY`. Leave both empty. Creators sign on this site, and nothing is charged. The Approvals page says so.

### Community chat

The chat sits on the right side of every portal page. Announcements are for the owner. Everyone and wins are for the roster. Every creator on the roster can use it. A manager can delete, mute, and handle reports. Only the owner can remove a member or change roles.

Photos are resized in the browser. The server strips EXIF and keeps the file private. A link expires after two minutes. If the photo shows a child's face, it waits for Kamron. Nothing in the chat is emailed on its own.

### Kid-safety check

Before a draft can go to a brand, the portal checks the file name, the caption, and the location tag for a school logo, a house number, a location tag, or a child's full name. A match is held for Kamron. The matched words are not saved, only the kind of flag. The creator and a manager cannot clear it. Approving the video while a flag is held does nothing: the stage stays put, and no brand email is queued. After Kamron clears it on the deal or on Safety, the manager can approve, and that email still waits in the approval queue.

### Monthly report

The Report page is one page for a month: her cut that was sent, the deals that moved, and follower and view numbers that were entered by hand. Kamron can draft that page into an email. It lands in the approval queue, from `authentickambiz@gmail.com`, and stays pending. Nothing is sent on its own. A second draft for the same creator and month is refused.

### Referrals

The Referrals page lists people a creator referred. The perk amount is a placeholder Kamron can type in, or set with `REFERRAL_PERK_CENTS` until he saves one. Leave that empty. Nothing is paid automatically. Have a lawyer review the perk before anyone is paid.

### Home screen

The portal can be added to a phone home screen. It has a manifest and a service worker. On the installed app, Chat is a button on the bottom bar. Quiet hours are 9 PM to 8 AM Eastern: approval, announcement, mention, and reply notices wait until morning. Leave `PUSH_ENABLED` empty. Nothing is sent to a push service while it is empty.

### Upsert a deal

`id`, `brand`, and either `creatorEmail` or `creatorId` are required. A new deal is hidden from the creator unless you pass `"visibleToCreator": true`. Omitted text fields are left as they are on update. `chips` is an array of `[text, tone]` pairs. Tones used by the mockup are `c-red`, `c-gray`, `c-sun`, `c-blue`, and `c-sage`.

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "momcozy",
    "creatorEmail": "mmaclamroc@gmail.com",
    "brand": "Momcozy",
    "status": "negotiating",
    "amountDisplay": "TBD",
    "rateLabel": "Waiting on their yes.",
    "deliverables": ["1 TikTok"],
    "gmailThreadId": "REAL_THREAD_ID",
    "nextStep": "Hidden until you flip visible to creator.",
    "visibleToCreator": false
  }' \
  http://localhost:43123/api/bot/deals
```

### Upsert a payment

The creator's cut is always the brand amount minus a flat 20% fee, so the fee and the payout add up to what the brand paid. `creatorSplitPercent` may still be sent, but it is not used for the amount. The payment row stores 80 for her cut and 20 for the fee.

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": "vev",
    "creatorSplitPercent": 80,
    "amountOwedCents": 120000,
    "landedAmountCents": 120000,
    "landedDate": "2026-11-02",
    "payoutApprovedOn": "2026-11-03",
    "paidOutDate": null
  }' \
  http://localhost:43123/api/bot/payments
```

### Write one day of analytics

`date` is `YYYY-MM-DD`. `engagementRate` is a percent (`6.8` means 6.8%). The row is upserted on creator + platform + date. `"example": true` keeps the EXAMPLE banner; a row without that flag replaces the sample chart.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorEmail": "mmaclamroc@gmail.com",
    "date": "2026-10-18",
    "platform": "tiktok",
    "followers": 1241000,
    "newFollowers": 420,
    "views": 390000,
    "engagementRate": 6.4,
    "saves": 2100,
    "example": false
  }' \
  http://localhost:43123/api/bot/analytics/daily
```

### Write an analytics snapshot

`POST /api/bot/analytics/snapshots` with the bearer token. Send one snapshot, a `snapshots` array, or the same shape as `data/analytics-snapshots.json` (`creators` with a `snapshots` list). The July seed file is that shape: one snapshot per creator per platform, `capturedOn` `2026-10-19`, `source` `July`, and `period` only when July showed one (`Past 30d` or `Past 90d`). A metric July did not display is left out. A shown value that is unavailable is `null` (Abby's Instagram saves), not `-1` and not `0`.

Until Momma Mari connects its own analytics tool, a bot reads https://july.bio/mommamari every Monday and posts one snapshot per creator per platform. The portal does not fetch July itself. Posting the same creator, platform, capture date, and date range updates that week. A different capture date adds a week and leaves every older row in place.

Numbers stay in July's own labels (`"326k"`, `"3.57%"`). The portal does not round them again. Rank scores read followers from the roster total audience, the average of the engagement figures that were shown, and the average of the average-view figures that were shown. A missing figure is skipped. The creator's Analytics card and media kit show the latest week, the change from the previous week, and a simple trend once two weeks exist.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"creatorId":"abby","platform":"TikTok","capturedOn":"2026-10-26","source":"July","metrics":{"followers":"79k","engagement":"6.4%"}}' \
  http://localhost:43123/api/bot/analytics/snapshots
```

To load a file into the local database:

```bash
npm run analytics:import -- data/analytics-snapshots.json
```

The owner can also type a snapshot on Analytics. Managers and creators cannot. A manager sees only assigned creators, and dollar amounts only when that manager's pricing switch is on.

### Finished creator onboarding

`GET /api/bot/onboarding` returns creators who connected Gmail and finished the bot profile. The Gmail refresh token is never included. Optional `since` is an ISO timestamp compared with `finishedAt`.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/onboarding?since=2026-10-01T00:00:00.000Z"
```

Each profile includes `creatorId`, `name`, `email`, `gmailEmail`, `gmailConnected`, `emailSetup` (`business`, `personal`, or `hosted`), `hostedEmailAddress` (always `name@mommamari.com` when hosted), `hostedEmailAddOn` (only for a hosted request: name `hosted creator email`, roster price `$79 one-time setup + $15/month`, public price `$99 one-time setup + $19/month`, `charged: false`), `botName`, `niche`, `kidsAges`, `contentStyle`, `rates`, `favoriteBrands`, `platforms`, `finishedAt`, and `message` (`New creator ready for bot`). The refresh token is never included.

### Upsert a creator

`resolveLogin` refuses any `.invalid` address, so a reserved placeholder can never open a session. Abby Theriot's sign-in is `theofficialtheriots@gmail.com` (`drizzle/0004_creator_profiles.sql`). Use this endpoint to replace a sign-in email.

Use this for a real sign-in email, the split, a Drive folder id, and the Zernio connect links. Emails are stored lowercase. A connect URL turns that platform's button into a real link.

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "abby",
    "name": "Abby Theriot",
    "email": "theofficialtheriots@gmail.com",
    "splitPercent": null,
    "driveFolderId": "DRIVE_FOLDER_ID",
    "connect": {
      "tiktok": "https://zernio.example/connect/abby-tiktok",
      "tiktokStatus": "disconnected"
    }
  }' \
  http://localhost:43123/api/bot/creators
```

### Draft upload (creator session, not the bot token)

The signed-in creator (or Kamron) calls these. The browser does not send the whole file in one form post.

1. `POST /api/deals/:dealId/uploads` with JSON `{ "filename", "mimeType", "sizeBytes" }`. Response: `{ "draftId", "mode": "drive" | "demo" }`.
2. `PUT /api/deals/:dealId/uploads/:draftId` with header `Content-Range: bytes START-END/TOTAL` and the chunk as the body. Chunks are 8 MB (`UPLOAD_CHUNK_BYTES`), a multiple of 256 KB, except the last chunk. They must arrive in order.

Google's resumable URL is not called from the browser, because Drive does not allow that cross-origin. The portal forwards each chunk and does not keep the bytes.

## Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project. Configure the OAuth consent screen. Add the scopes `openid`, `email`, and `profile`. While the app is in testing, add every creator Gmail and `Kamron@mommamari.com` as test users.
2. Create an OAuth client of type **Web application**.
3. Authorized redirect URIs, exactly:
   - `http://localhost:43123/api/auth/callback`
   - `https://mommamari.com/portal/api/auth/callback`
   - The `*.webflow.io` preview origin plus `/portal/api/auth/callback`, if you sign in before the custom domain is attached.
4. Put the client id and secret in `.env.local` and in the Webflow Cloud environment (mark the secret as a Secret Variable).
5. Set `APP_BASE_URL` to the same origin the browser uses, including `/portal` in production, with no trailing slash. The callback is built from `APP_BASE_URL`, not from the incoming request, so the mount path is not dropped.
6. Restart the server. The login page shows **Continue with Google**.
7. Only addresses in `ADMIN_EMAILS` or in `creators.email` get a session. Everyone else lands on `/login?error=not_allowed`.

## Connect your email

Sign-in stays on `openid email profile`. **Connect your email** is a second Google screen for the signed-in creator. It asks only for `gmail.readonly` and `gmail.compose`, with `include_granted_scopes=true` so earlier sign-in permissions are kept. The redirect URI is the existing `/api/auth/callback`. Do not add another one.

1. Enable the Gmail API on the same Google Cloud project.
2. Add those two Gmail scopes on the OAuth consent screen. They are restricted. While the app is unverified, creators must be test users (up to 100). A public launch needs Google's restricted-scope review.
3. Generate `TOKEN_ENCRYPTION_KEY` and set it as a Secret Variable:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   The refresh token is encrypted before it is saved. The bot API never receives it. If this key is empty, the button will not start.

4. A creator signs in and opens **Set up your bot**. She picks one email option:
   - **Recommended:** create a new Gmail used only for brand deals, then connect it. The page lists short steps for making that account.
   - **Personal email:** connect the inbox she already uses. The page says we only process brand-related mail, which the bot sorts and labels.
   - **Hosted email:** ask Momma Mari to host a business address on `@mommamari.com`. She types a name and sees a preview such as `abby@mommamari.com`. Momma Mari owns the domain and the mailbox. Roster creators are `$79 one-time setup + $15/month`. The public price is `$99 one-time setup + $19/month`. The portal does not charge anyone; Stripe is not connected yet. She can finish her profile without connecting Google.
5. Connecting a new or personal Gmail uses **Connect your email**. Finishing the profile writes **New creator ready for bot** on Kamron's home page. Kash Bot reads finished profiles, including `emailSetup`, from `GET /api/bot/onboarding` and creates the bot manually after Kamron says OK.

Watched brand inboxes (MariClare and AuthenticKam) are a separate read-only setup. The steps, the Pub/Sub topic, and the Webflow secrets are in `docs/live-sync-setup.md`. That path does not send mail.

## Google Drive

Uploads need one of these. Do not commit either value.

### Option A — refresh token (preferred)

Use the same OAuth client. Add the scope `https://www.googleapis.com/auth/drive`.

Mint a refresh token once, as the Google account that owns the draft folders:

1. Open this URL in a browser (replace `CLIENT_ID` and URL-encode the redirect if you change it):

   ```text
   https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost:43123/api/auth/callback&response_type=code&scope=https://www.googleapis.com/auth/drive&access_type=offline&prompt=consent
   ```

2. After consent, copy the `code` query parameter from the redirect (the portal will reject it as a login; that is expected).
3. Exchange it:

   ```bash
   curl -sS -X POST https://oauth2.googleapis.com/token \
     -d client_id=CLIENT_ID \
     -d client_secret=CLIENT_SECRET \
     -d code=CODE \
     -d grant_type=authorization_code \
     -d redirect_uri=http://localhost:43123/api/auth/callback
   ```

4. Save `refresh_token` as `GOOGLE_DRIVE_REFRESH_TOKEN`.

The Drive scope is broader than sign-in. Keep sign-in on `openid email profile` only. The refresh token is the only credential that uses the Drive scope.

### Option B — service account

Create a service account, enable the Google Drive API, and download the JSON key. Put the whole JSON on one line in `GOOGLE_SERVICE_ACCOUNT_JSON`. Share each creator folder with the service account `client_email` as **Editor**.

If both a refresh token and a service account are set, the refresh token is used.

### Folders

MariClare's folder id from the plan is `1Gmcgw_vSgxR07PTdHF--SN2k-2ZodEfE`, already stored on her creator row. Other creators use `drive_folder_id` on their row, or `GOOGLE_DRIVE_ROOT_FOLDER_ID` when that column is empty. The portal creates a subfolder named for the brand the first time a draft is uploaded, and reuses it after that.

Creators do not get access to the Drive folder.

## Connect the repo to Webflow Cloud at /portal

Do this in Webflow. Nothing in this repo publishes the site.

1. Push this repository to GitHub. Install the Webflow GitHub App on that repo so later pushes can deploy. Webflow Cloud builds from GitHub; it does not deploy from a local folder.
2. Confirm the mommamari.com site is on a plan that includes Webflow Cloud (Premium, as of this plan).
3. Open the site in Webflow → **Site settings** → **Webflow Cloud** → create an app from the GitHub repo.
4. Set the mount path to `/portal`. Not `/portal/`, and not a different path. The marketing site stays where it is; this app only answers under that path.
5. Framework should detect as Next.js from `package.json` and `webflow.json`.
6. Before the first deploy, add environment variables. `NEXT_PUBLIC_*` values are inlined at build time, so changing them later requires a new deploy.

   | Name | Value | Secret |
   | --- | --- | --- |
   | `APP_BASE_URL` | `https://mommamari.com/portal` | no |
   | `NEXT_PUBLIC_BASE_PATH` | `/portal` | no |
   | `AGENCY_TIMEZONE` | `America/New_York` | no |
   | `SESSION_SECRET` | long random string | yes |
   | `ADMIN_EMAILS` | `Kamron@mommamari.com` | no |
   | `ADMIN_DISPLAY_NAME` | `Kamron` | no |
   | `BOT_API_TOKEN` | long random string | yes |
   | `GOOGLE_CLIENT_ID` | from the OAuth client | no |
   | `GOOGLE_CLIENT_SECRET` | from the OAuth client | yes |
   | `TOKEN_ENCRYPTION_KEY` | 64 hex characters | yes |
   | `GOOGLE_DRIVE_REFRESH_TOKEN` or `GOOGLE_SERVICE_ACCOUNT_JSON` | one of the Drive options | yes |
   | `GOOGLE_DRIVE_ROOT_FOLDER_ID` | optional fallback folder | no |

   Do not set `AUTH_DEV_LOGIN` on Webflow Cloud. Practice buttons must not exist on the public site.

7. Storage: `wrangler.json` declares D1 binding `DB` (`database_name` `portal`, `migrations_dir` `drizzle`) and KV binding `SESSIONS`. Webflow provisions them and replaces the placeholder ids. If a binding is missing a required field, Webflow skips it silently and the app builds with no database, so leave those fields in place. It also declares an R2 binding `COMMUNITY_PHOTOS` (`bucket_name` `community-photos`). Text chat works without that bucket. Photos stay off until the binding is really attached. In Webflow Cloud, open the app → **Bindings** (or Storage), confirm `DB` and `SESSIONS` are listed, create an R2 bucket named `community-photos` if it is missing, and add a binding whose name is exactly `COMMUNITY_PHOTOS`. Then redeploy. No extra environment variable is required for chat or Add to Home Screen. `NEXT_PUBLIC_BASE_PATH` must stay `/portal`.
8. Deploy. Webflow runs `opennextjs-cloudflare build` and applies every `drizzle/*.sql` file that is not yet in `d1_migrations`. That includes the MariClare seed. The seed is labeled `is_seed` / `is_example` in the database and on the page.
9. Publish the Webflow site. The first publish is what makes `mommamari.com/portal` stop 404ing. A Cloud deploy alone does not update the site's routing.
10. Sign in as Kamron, confirm MariClare's six deals, and confirm Grail is visible only to the admin. Then sign in as MariClare and confirm Grail is absent.

Local `next dev` serves the app at `/`, not at `/portal`. That is expected. The mount path exists only on Webflow Cloud.

## Security notes

- Authorization is in the server queries and the upload routes. Hiding a card in the browser is not the control.
- Negotiation notes (`kamron_notes`) are returned only to an admin.
- The bot token is a server environment variable. It is not in any `NEXT_PUBLIC_` variable and not in the browser bundle.
- Session cookies are httpOnly. On an `https` `APP_BASE_URL` they are also `Secure`.
- No passwords and no bank numbers are stored. Payout method is a label, and the seed leaves it empty.
- Uploaded videos are private Drive files. The browser never receives the resumable session URL.
- Seed inbox rows are a snapshot from the approved mockup, not a live mailbox read. Do not copy personal bills into the portal.

## Seed data you will replace

| Item | Current value |
| --- | --- |
| MariClare sign-in | `mmaclamroc@gmail.com` |
| Abby sign-in | `theofficialtheriots@gmail.com` |
| AuthenticKam sign-in | `authentickambiz@gmail.com` |
| Creator cut | 80% of the brand amount. Momma Mari's fee is the other 20%. |
| Gmail threads | `seed-thread-kosbling`, `seed-thread-vev`, and the same pattern for the other seed deals |
| Grail | Hidden from MariClare. Note says payment on Grail-sourced deals routes to Grail first. |
| Analytics | EXAMPLE. Followers, the 14-day bars, and the three posts are invented sample numbers. |
| Drive folder | MariClare's existing folder id is on her row. No file is uploaded by the seed. |
