# Momma Mari creator portal

Private deal dashboard for creators managed by Momma Mari LLC. Each creator signs in with Google and sees only her own deals, drafts, payments, and analytics. Kamron (`Kamron@mommamari.com`) is the agency admin and can see every creator, including deals still hidden from the creator.

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

- Google sign-in (authorization code) with an allowlist. Admin emails come from `ADMIN_EMAILS`. Creator emails come from the `creators` table. A stranger is rejected. The same person is never both; admin is checked first.
- Sessions are an HMAC-signed httpOnly cookie, stored in the database and, on Webflow Cloud, also in KV.
- Deal list and deal detail, earnings, analytics, and connect-accounts, laid out to match the approved October 17, 2026 mockup.
- Seed data for MariClare (`mmaclamroc@gmail.com`): KOSBLING, VEV Gummies, WaterH, Persona, Sanvive, Halara, plus a Grail deal that stays hidden from her. `drizzle/0004_creator_profiles.sql` fills in Abby Theriot (`theofficialtheriots@gmail.com`) and AuthenticKam (`authentickambiz@gmail.com`).
- Draft upload in 8 MB chunks. With Drive credentials, the portal opens a Google resumable session and forwards each chunk. The session URL stays on the server. The draft row stores the deal id, Drive file id, and the deal's Gmail thread id.
- Bearer JSON API for the agency bot.

Server-side rules, covered by `npm test`:

- A creator's queries only return her rows, and only deals with "visible to creator" on.
- Asking for another creator, for "all", or for a hidden deal returns the same "isn't on your list" result. The page does not reveal that the deal exists.
- Kamron sees hidden deals and the private note on a card.
- A null creator split renders as **Pending contract**.

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

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active","visibleToCreator":true,"gmailThreadId":"REAL_THREAD_ID"}' \
  http://localhost:43123/api/bot/deals/persona
```

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

`creatorSplitPercent` is stored on the creator (one split for all of her deals) and copied onto the payment. Send `null` while the contract is still out; the earnings table shows **Pending contract**. When the split is a number, creator payout is `round(landed or owed × split / 100)`.

```bash
curl -sS -X PUT \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": "vev",
    "creatorSplitPercent": 70,
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

### Finished creator onboarding

`GET /api/bot/onboarding` returns creators who connected Gmail and finished the bot profile. The Gmail refresh token is never included. Optional `since` is an ISO timestamp compared with `finishedAt`.

```bash
curl -sS \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
  "http://localhost:43123/api/bot/onboarding?since=2026-10-01T00:00:00.000Z"
```

Each profile includes `creatorId`, `name`, `email`, `gmailEmail`, `gmailConnected`, `emailSetup` (`business`, `personal`, or `hosted`), `hostedEmailAddress`, `hostedEmailAddOn` (only for a hosted request: name `hosted creator email`, price `placeholder`), `botName`, `niche`, `kidsAges`, `contentStyle`, `rates`, `favoriteBrands`, `platforms`, `finishedAt`, and `message` (`New creator ready for bot`). The refresh token is never included.

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
    "email": "abby@example.com",
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
   - **Hosted email:** ask Momma Mari to host a business address. She enters the address she wants. Kamron gets a notice marked as the paid add-on `hosted creator email`. The price in the Stripe catalog is the placeholder `placeholder` until a real Stripe price is set. She can finish her profile without connecting Google.
5. Connecting a new or personal Gmail uses **Connect your email**. Finishing the profile writes **New creator ready for bot** on Kamron's home page. Kash Bot reads finished profiles, including `emailSetup`, from `GET /api/bot/onboarding` and creates the bot manually after Kamron says OK.

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
   | `AGENCY_TIMEZONE` | `America/Chicago` | no |
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

7. Storage: `wrangler.json` declares D1 binding `DB` (`database_name` `portal`, `migrations_dir` `drizzle`) and KV binding `SESSIONS`. Webflow provisions them and replaces the placeholder ids. If a binding is missing a required field, Webflow skips it silently and the app builds with no database, so leave those fields in place.
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
| Abby sign-in | `abby.theriot@example.com` |
| AuthenticKam sign-in | `authentickam@example.com` |
| Creator split | null, shown as Pending contract |
| Gmail threads | `seed-thread-kosbling`, `seed-thread-vev`, and the same pattern for the other seed deals |
| Grail | Hidden from MariClare. Note says payment on Grail-sourced deals routes to Grail first. |
| Analytics | EXAMPLE. Followers, the 14-day bars, and the three posts are invented sample numbers. |
| Drive folder | MariClare's existing folder id is on her row. No file is uploaded by the seed. |
