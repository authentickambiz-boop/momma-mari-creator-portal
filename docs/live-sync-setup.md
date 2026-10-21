# Live deal sync setup

The portal updates a deal the moment someone acts on it (a creator says she's interested, confirms the agreed rate, or signs, or you change a stage). Open deal pages then check a small JSON feed every 12 seconds and refresh the stage and the “Last updated” time on each card. Webflow Cloud has no WebSockets, so this is a poll, not a live socket.

New deals, including mail the portal reads in, stay hidden until you publish them from **Review**. Creators do not see drafts, notes, quotes, or minimums. A reply you compose there is saved for you only. Copy it when you want to send it yourself. The portal does not email the brand.

Brand mail is separate. Gmail tells Google Cloud Pub/Sub when a watched inbox changes. Pub/Sub calls `POST /api/gmail/push`. The portal reads the new messages. It never sends mail.

Do this once, in order. Use the same Google Cloud project that already has the portal’s sign-in client if you have one.

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, or pick the project that already has the Momma Mari OAuth client. The Gmail API, the OAuth client, and the Pub/Sub topic must live in this one project.
3. Note the project id (not just the display name). The topic name below uses it.

## 2. Turn on the APIs

1. **APIs & Services → Library**.
2. Enable **Gmail API**.
3. Enable **Cloud Pub/Sub API**.

## 3. Pub/Sub topic

1. **Pub/Sub → Topics → Create topic**.
2. Topic id: `gmail-push`.
3. Leave the defaults. You do not need a default subscription yet.
4. Open the topic. Go to **Permissions** (or the topic’s **Principals**).
5. **Grant access**. New principal:

   `gmail-api-push@system.gserviceaccount.com`

   Role: **Pub/Sub Publisher**.

   That address is Google’s own Gmail push account. You do not create it. It is not the account that calls the portal. Without this publisher role, `users.watch` fails.

6. Copy the full topic name. It looks like:

   `projects/YOUR_PROJECT_ID/topics/gmail-push`

   That value is the Webflow secret `GMAIL_WATCH_TOPIC`.

## 4. Service account for the push call

Pub/Sub will call the portal with a Google ID token. You check that token. The token’s email is a service account you own.

1. **IAM & Admin → Service accounts → Create service account**.
2. Name: `portal-gmail-push`.
3. Skip optional role grants. This account does not need a key file. Do not download a JSON key.
4. Copy the email, which looks like:

   `portal-gmail-push@YOUR_PROJECT_ID.iam.gserviceaccount.com`

   That value is the Webflow secret `GMAIL_PUSH_SERVICE_ACCOUNT`.

## 5. Push subscription

1. **Pub/Sub → Subscriptions → Create subscription**.
2. Subscription id: `gmail-push-portal`.
3. Topic: `gmail-push`.
4. Delivery type: **Push**.
5. Endpoint URL, exactly, with no trailing slash:

   `https://mommamari.com/portal/api/gmail/push`

6. Check **Enable authentication**.
7. Service account: the `portal-gmail-push@...` email from step 4.
8. Audience, exactly the same URL as the endpoint:

   `https://mommamari.com/portal/api/gmail/push`

   That value is the Webflow secret `GMAIL_PUSH_AUDIENCE`. If the audience and the URL differ by even a slash, the portal rejects the call.

9. Acknowledgement deadline: 30 seconds is enough.
10. Create the subscription.

The portal returns 401 when the token is missing or does not match that audience and service account. Pub/Sub will retry those. A 200 means the notice was accepted, including a dead mailbox: `unauthorized_client`, `invalid_grant`, or an inbox that is not connected returns 200 with `"ok": false` so Pub/Sub stops retrying a token that cannot recover. A temporary Google error returns 503 so Pub/Sub tries again. The history cursor stays put on both of those failures. The token is not included.

## 6. OAuth consent and the three inboxes

The watched-inbox button asks for `https://www.googleapis.com/auth/gmail.modify` so the portal can add `MM/` labels and create a draft. Do not add `gmail.send` or `https://mail.google.com/`. Google's screen for `gmail.modify` says the app can send. The portal never calls send, trash, or delete. A reply is a draft, and any price or date in that draft is the placeholder `[CONFIRM]`. A draft Sintra already wrote is left as it is.

The per-creator **Connect Gmail (read only)** button stays on `gmail.readonly`. It does not label or draft.

1. **APIs & Services → OAuth consent screen**.
2. If the app is still in **Testing**, add these test users:
   - `mmaclamroc@gmail.com` (MariClare)
   - `authentickambiz@gmail.com` (AuthenticKam)
   - `Kamron@mommamari.com`
3. Add `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.modify`. The older “Connect your email” button also asks for `gmail.compose`. Neither button sends mail. Inboxes connected before `gmail.modify` was added have to be connected again. The old token cannot add labels.
4. While the app is in Testing, Google expires refresh tokens after 7 days. Publishing the app (after Google’s review, because Gmail read is a restricted scope) stops that expiry. Until then, reconnect the inbox when the token dies. The watch itself also lasts at most 7 days, which is why the daily renewal in step 9 exists.
5. The OAuth client stays a **Web application**. Authorized redirect URI, already used by sign-in:

   `https://mommamari.com/portal/api/auth/callback`

   Do not add a second redirect URI for Gmail.

## 7. Webflow Cloud secrets

In the Webflow Cloud environment for this site, set:

| Name | Value | Secret |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth web client id | no |
| `GOOGLE_CLIENT_SECRET` | OAuth web client secret | yes |
| `TOKEN_ENCRYPTION_KEY` | 64 hex characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | yes |
| `GMAIL_WATCH_TOPIC` | `projects/YOUR_PROJECT_ID/topics/gmail-push` | no |
| `GMAIL_PUSH_AUDIENCE` | `https://mommamari.com/portal/api/gmail/push` | no |
| `GMAIL_PUSH_SERVICE_ACCOUNT` | `portal-gmail-push@YOUR_PROJECT_ID.iam.gserviceaccount.com` | no |
| `GMAIL_WATCH_CRON_SECRET` | a long random string you invent | yes |
| `APP_BASE_URL` | `https://mommamari.com/portal` | no |
| `BOT_API_TOKEN` | the token the drafting bot already uses | yes |

`TOKEN_ENCRYPTION_KEY` must stay the same for as long as you want old refresh tokens to keep working. Refresh tokens are stored as `v1:` ciphertext. The database never gets the raw token.

Redeploy after saving the secrets so the new server can read them.

## 8. Connect the three mailboxes

1. Sign in to the portal as yourself (the owner).
2. Open **Connect**.
3. Under **Watched inboxes**, connect:
   - MariClare → `mmaclamroc@gmail.com`
   - AuthenticKam → `authentickambiz@gmail.com`
   - Kamron → `Kamron@mommamari.com`
4. Google’s screen must be the account named on the button. The portal rejects a different account. Accept the permission. Reconnect an inbox that was connected when the button was read-only.
5. `authentickambiz@gmail.com` is also your admin sign-in, so that inbox is connected from this owner screen, not from a creator session. `Kamron@mommamari.com` is connected from this owner screen too. It is not a roster creator. MariClare can still connect `mmaclamroc@gmail.com` from her own sign-in.

A successful connect tries to start the watch immediately. If the topic secret is missing, the token is still saved and the daily job starts the watch later.

## 9. Daily watch renewal

`users.watch` expires after 7 days. Renew it every day so it never lapses.

There is no timer inside Webflow Cloud. Use Google Cloud Scheduler (3 jobs a month are free):

1. **Cloud Scheduler → Create job**.
2. Name: `gmail-watch-renew`.
3. Frequency: `0 12 * * *`. Time zone: `America/New_York`. That is 12:00 noon Eastern, once a day.
4. Target type: **HTTP**.
5. URL: `https://mommamari.com/portal/api/cron/gmail-watch`
6. Method: **POST**.
7. Auth header: **Add header**
   - Header: `Authorization`
   - Value: `Bearer YOUR_GMAIL_WATCH_CRON_SECRET`
8. Create.

You can also call that URL with GET. A wrong or missing bearer token gets 401. If `GMAIL_WATCH_CRON_SECRET` is empty, the route returns 503 and does not call Google.

Run the job once by hand after connecting the inboxes. The response lists each mailbox. `"ok": true` means Gmail accepted the watch. The other mailbox stays `"Mailbox is not connected."` until you connect it. A connected mailbox that Gmail refused returns `"ok": false` and Google's error text. The refresh token, access token, and client secret are not included.

The watch call fails before any mail is delivered when Gmail cannot publish a test message to the topic. The error looks like: `Gmail watch failed (400): Error sending test message to Cloud PubSub projects/YOUR_PROJECT_ID/topics/gmail-push : User not authorized to perform this action.` Fix that on the topic itself, not only on the project: principal `gmail-api-push@system.gserviceaccount.com`, role **Pub/Sub Publisher**. An organization policy that blocks principals outside your domain can refuse this grant even when the console looks saved. The project id inside `GMAIL_WATCH_TOPIC` has to be the same project that owns the OAuth client in `GOOGLE_CLIENT_ID`. `GOOGLE_CLIENT_SECRET` has to be that same client's secret.

A refresh failure looks different: `Gmail token refresh failed (401): unauthorized_client` or `invalid_grant`. Those two mean the saved refresh token cannot be used with the current OAuth client (often because it was minted by an older client). The inbox stays listed and Connect accounts shows **Needs reconnect** for that creator and on the admin Watched inboxes list. The token is not deleted by the cron.

Disconnect it, then connect it again:

- On **Connect accounts**, the creator or the owner uses **Disconnect** on that inbox. The page asks for confirmation. Nobody is signed out of the portal.
- Or call `POST /api/bot/mailboxes/disconnect` with `Authorization: Bearer BOT_API_TOKEN` and JSON `{ "email": "mmaclamroc@gmail.com" }`.

Disconnect revokes the Google token, then clears the refresh token and the watch row. It does not delete deals. Then use **Connect** or **Reconnect** on that same inbox so Google mints a token for the current client.

The same screen covers Google Drive and TikTok, Instagram, Facebook, and YouTube. Each row shows **Connected**, **Needs reconnect**, or **Not connected**, with **Connect**, **Reconnect**, and **Disconnect**. Drive uses the `drive.file` scope and is stored per creator. Disconnecting it does not revoke the agency Drive credential used for uploads. Social disconnect keeps the Zernio connect link. A manager can see the status and cannot change it.

`invalid_client` is different: the client id and secret do not match, and the inbox is not marked needs-reconnect. Fix the secret, then run the cron again. `APP_BASE_URL` is the site origin plus `/portal`. The OAuth client's authorized redirect URI is that value plus `/api/auth/callback`. The Pub/Sub push URL and `GMAIL_PUSH_AUDIENCE` must both be the host that actually serves the portal, plus `/api/gmail/push`. A watch can succeed and later pushes can still be rejected when those two URLs differ.

## 10. What the portal does with a message

- The push body is a Pub/Sub envelope. The inner `emailAddress` and `historyId` say which inbox moved.
- The portal calls Gmail `history.list` from the history id it stored for that inbox. The same history notice does not create a second deal. A Pub/Sub notice whose history id is not newer than that cursor is acknowledged and not read again. If Google returns another page, the portal reads up to 5 pages, files those messages, stores the last history record it actually read, and returns 503 so Pub/Sub retries the rest. It does not jump the cursor to the newest mailbox id while pages are still unread.
- `history.list` includes messages added to the mailbox and messages that gained the Inbox or Sent label. A label such as starred, by itself, does not open a deal. Spam, trash, and newsletter labels still do not open a new deal.
- When Google says that history id has expired, the portal reads the latest 20 inbox messages (`messages.list` on `INBOX`) and files the ones it has not seen. Mail older than that page is not recovered. The history cursor moves only after that read succeeds. A temporary failure reading the inbox returns 503 so Pub/Sub can retry. A dead token (`unauthorized_client` or `invalid_grant`) is acknowledged with 200, the Connect page shows needs-reconnect, and the cursor stays put.
- Renewing a watch stores the new expiration and keeps the history cursor already on file. The first watch, when no cursor exists yet, stores the history id Google returns. A renewal without a future expiration is a failure and does not move the cursor.
- A message whose From domain is spam is dropped. The block list is `forceawakens.net`, `qq.com`, `foxmail`, `163.com`, `mail.ru`, and the endings `.live`, `.xyz`, `.mobi`, `.online`, `.cc`, `.shop`, `.work`, `.cloud`.
- Any other new thread becomes a deal at **Offer received**, hidden from creators until you publish it on the **Review** page. Publishing shares it with that creator. Reject leaves it hidden. Edit and reply drafts on that page are only for you.
- A message on a thread the portal already knows updates that deal. It does not open a second deal.
- A message sent from the inbox itself, on a thread we already have, moves that deal to **Interest sent** when the deal is still in the early offer stages.
- `mmaclamroc@gmail.com` files under MariClare. `authentickambiz@gmail.com` files under AuthenticKam. `Kamron@mommamari.com` files under Kamron, hidden until you publish it. It is not a roster row.
- The same message id is filed once. A second Pub/Sub notice for that id does not open a second deal or a second draft.
- Each filed message gets an `MM/` label, added only: `MM/Deal` and `MM/Needs reply` for brand mail, `MM/Deal` and `MM/Waiting` when the inbox itself replied, and `MM/Not a deal` for spam, newsletters, and mail between these inboxes. A Gmail draft is not relabeled.
- Brand mail also saves a portal reply and, when the thread has no draft yet, a Gmail draft. The rate and the date in that draft are `[CONFIRM]`. Nothing is sent. If the thread already has a draft, including one that mentions Sintra, that draft is not edited and not deleted.
- The 15-minute job `POST /api/cron/gmail-sync` reads forward from the history id already stored for each of these three inboxes, so a missed push still files. It does not jump past unread history pages. The other creators' inboxes stay behind `GMAIL_SYNC_ENABLED`.

Nothing in this path sends or deletes email. The Gmail calls are `users.watch`, `history.list`, `messages.list`, `messages.get`, `threads.get`, `labels.list`, `labels.create`, `messages.modify` (add labels only), and `drafts.create`.

## 11. The drafting bot

Stop the hourly poll. Call this when you want to know if new brand mail arrived:

`GET /api/bot/inbox-events?since=2026-10-19T00:00:00.000Z`

Header: `Authorization: Bearer BOT_API_TOKEN`

`since` must be an ISO time. A bad value returns 400. The list is only new brand mail. Spam and our own replies are not in it. An empty `events` array means there is nothing to draft.

Two other bot calls:

- `PUT /api/bot/brand-crm` with JSON `{ "domain", "contactEmail", "brand", "outcome", "ratePaidCents", "nextFollowUp" }`. The same domain and contact email update one row.
- `POST /api/bot/deals/sync` with JSON `{ "deals": [ ... ] }`. Each item is the same shape as the single-deal upsert. A new deal stays hidden until you publish it, even if the payload asks to show it. The response is `{ "results": [ { "id", "ok", "status", "error" } ] }`. One bad item does not cancel the rest. Minimums and internal quotes are not returned, and they are not written onto fields a creator can see.

## 12. Each creator's brand inbox

The two watched inboxes above keep working as they do today. A separate switch covers every creator who connects her own Gmail.

Leave `GMAIL_SYNC_ENABLED` empty until you want that sync. The portal does not read those inboxes while it is empty. Set it to the string `true` only after the steps below are done, then redeploy.

1. On the OAuth consent screen, keep `https://www.googleapis.com/auth/gmail.readonly`. Do not add `gmail.send`, `gmail.modify`, or `https://mail.google.com/`. The bridge button does not ask for `gmail.compose`.
2. Add each creator who will connect as a test user while the app is in Testing.
3. `TOKEN_ENCRYPTION_KEY` stays the key already set on Webflow Cloud. Do not rotate it. If it is empty, connect does not start.
4. The same Pub/Sub topic, push subscription, and service account from steps 3–5 cover these inboxes once sync is on. The daily watch job in step 9 renews them too.
5. Add a second Cloud Scheduler job so a missed push still gets read:
   - Name: `gmail-inbox-sync`
   - Frequency: `*/15 * * * *`. Time zone: `America/New_York`.
   - URL: `https://mommamari.com/portal/api/cron/gmail-sync`
   - Method: **POST**
   - Header: `Authorization` = `Bearer YOUR_GMAIL_WATCH_CRON_SECRET` (the same secret as the watch job)
6. A creator (or you, the owner) opens **Deal inbox** or **Connect accounts** and uses **Connect Gmail (read only)**. A manager does not get that button and does not get her password or token.
7. Brand threads show in **Deal inbox**. A reply is saved as a draft for you to approve. The portal does not send it.

| Name | Value | Secret |
| --- | --- | --- |
| `GMAIL_SYNC_ENABLED` | `true` only when you want live sync. Leave empty until then. | no |
| `GMAIL_WATCH_CRON_SECRET` | the same secret already used for watch renewal | yes |
| `GMAIL_WATCH_TOPIC` | the topic from step 3 | no |
| `GMAIL_PUSH_AUDIENCE` | `https://mommamari.com/portal/api/gmail/push` | no |
| `GMAIL_PUSH_SERVICE_ACCOUNT` | the push service account from step 4 | no |
| `TOKEN_ENCRYPTION_KEY` | the existing 64 hex character key. Do not rotate it here. | yes |
| `GOOGLE_CLIENT_ID` | the existing OAuth web client | no |
| `GOOGLE_CLIENT_SECRET` | that client's secret | yes |
| `APP_BASE_URL` | `https://mommamari.com/portal` | no |

## Cost

[Pub/Sub](https://cloud.google.com/pubsub/pricing) includes the first 10 GiB of message throughput each month at no charge. A Gmail notice is a few hundred bytes. A normal month of brand mail stays inside that free tier. Expected Pub/Sub cost is **$0**.

[Cloud Scheduler](https://cloud.google.com/scheduler/pricing) includes 3 jobs a month at no charge. This uses two: the daily watch renewal and the 15-minute catch-up. Expected scheduler cost is **$0**.

Gmail API reads are free inside Google’s default quota. There is no per-message fee for `users.watch`.

Prices can change. Check the two links above if Google updates them. There is still no charge from the portal itself, and this setup does not send mail or charge a card.

## Still needs a person

The portal cannot create the Google Cloud project, the topic, or the Webflow secrets. Billing on the Google Cloud project is funded. These steps are still manual. Do them in order. Nothing below is stored in this repo.

1. In the Google Cloud project that owns the portal OAuth client, enable **Gmail API** and **Cloud Pub/Sub API**.
2. Create the Pub/Sub topic `gmail-push`. Copy `projects/YOUR_PROJECT_ID/topics/gmail-push`.
3. On that topic, grant **Pub/Sub Publisher** to `gmail-api-push@system.gserviceaccount.com`. That principal is Google's. Do not create a key for it.
4. Create the service account `portal-gmail-push`. Do not download a JSON key. Copy `portal-gmail-push@YOUR_PROJECT_ID.iam.gserviceaccount.com`.
5. Create the push subscription `gmail-push-portal` on topic `gmail-push`.
   - Endpoint and audience, both exactly: `https://mommamari.com/portal/api/gmail/push`
   - Authentication on, service account from step 4.
6. On the OAuth consent screen, add `https://www.googleapis.com/auth/gmail.modify` and these test users while the app is in Testing: `mmaclamroc@gmail.com`, `authentickambiz@gmail.com`, `Kamron@mommamari.com`. Do not add `gmail.send` or `https://mail.google.com/`.
7. In Webflow Cloud, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` (the key already there; do not rotate it), `GMAIL_WATCH_TOPIC`, `GMAIL_PUSH_AUDIENCE`, `GMAIL_PUSH_SERVICE_ACCOUNT`, `GMAIL_WATCH_CRON_SECRET`, and `APP_BASE_URL` (`https://mommamari.com/portal`). Redeploy.
8. Sign in as the owner and connect the three watched inboxes. Reconnect any inbox that was connected before `gmail.modify`.
9. Create two Cloud Scheduler jobs, both with `Authorization: Bearer YOUR_GMAIL_WATCH_CRON_SECRET`:
   - `gmail-watch-renew`, `0 12 * * *`, `America/New_York`, POST `https://mommamari.com/portal/api/cron/gmail-watch`
   - `gmail-inbox-sync`, `*/15 * * * *`, `America/New_York`, POST `https://mommamari.com/portal/api/cron/gmail-sync`
10. Leave `GMAIL_SYNC_ENABLED` empty until other creators' inboxes should be read. The three watched inboxes catch up without that switch.

Google's restricted-scope review (and CASA, if Google requires it) is still outstanding. Until the app is published, refresh tokens in Testing expire after 7 days and those three people have to reconnect. The daily job renews the 7-day watch. It cannot renew a dead refresh token.
