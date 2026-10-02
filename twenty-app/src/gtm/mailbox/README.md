# Mailboxes and self-built warmup

Sending mailboxes (`mailbox` object) warm each other up. No Instantly or other warmup provider is used.

## Setup

1. Set the app variable **MAILBOX_ENCRYPTION_KEY** (secret) in the app's settings: `openssl rand -base64 32`. It encrypts mailbox passwords (AES-256-GCM) and signs warmup tags. Changing it makes stored passwords unreadable, so you would have to set them again.
2. Optional: set **MAILBOX_WARMUP_CONFIG** (JSON) to change the ramp. The keys are in `config.ts`. Defaults: 2 emails a day rising to 40 by day 24, a send window of 07:00 to 19:00 UTC, and replies to 35% of warmup emails.
3. Create a mailbox record with email, sender name and provider. SMTP and IMAP hosts can stay empty for Google and Microsoft. Use an app password (Google: 2-step verification, then App passwords; Microsoft: SMTP AUTH must be enabled).
4. Store the password. It is never typed into a field:
   ```bash
   curl -X POST "$TWENTY_URL/s/mailbox-credential" -H "Authorization: Bearer $TWENTY_API_KEY" \
     -H 'Content-Type: application/json' -d '{"mailboxId":"<id>","password":"<app password>"}'
   ```
   The route stores only the ciphertext in `credentialCiphertext`. For OAuth, put an app connection id in `connectionId` and set `authType` to OAUTH_CONNECTION; the engine then signs in with XOAUTH2. No connection provider is defined yet. For many mailboxes, see the next section.
5. Set **Your daily maximum** (`configuredDailySendLimit`) to the owner's approved maximum sequence emails per UTC day. It defaults to 0, which disables sequence sending. **Effective daily cap** (`dailySendLimit`) and **Daily cap reason** (`dailySendLimitReason`) are read-only computed fields, visible alongside the maximum in both mailbox views.

## Adding many mailboxes at once

### Google Workspace: no passwords and no per-user sign-in (domain-wide delegation)

A service account acts as each user. Mailboxes get `authType = GOOGLE_DELEGATED`. The engine mints a 1-hour token per user from a signed JWT (`sub` = mailbox email, scope `https://mail.google.com/`), caches it until it expires, and signs in to SMTP and IMAP with XOAUTH2. No password is stored.

Admin setup (done once by a Workspace super admin):

1. In Google Cloud Console, create or pick a project. Under **APIs & Services > Library**, enable the **Gmail API** and the **Admin SDK API**.
2. Under **IAM & Admin > Service accounts**, click **Create service account** (no roles needed). Open it, go to **Keys > Add key > Create new key > JSON**, and download the file. If the organisation policy `iam.disableServiceAccountKeyCreation` blocks this, an org admin has to allow it for this project.
3. Copy the service account's **Unique ID (OAuth 2 client ID)** from its Details tab.
4. In the Google Admin console, go to **Security > Access and data control > API controls > Domain-wide delegation > Add new**. Paste the client ID and add both scopes, comma-separated:
   `https://mail.google.com/,https://www.googleapis.com/auth/admin.directory.user.readonly`
   Changes can take a few minutes, and sometimes up to 24 hours, to apply.
5. Make sure IMAP is allowed for users: **Apps > Google Workspace > Gmail > End user access > POP and IMAP access**.
6. In Twenty, set the app variables **GOOGLE_SERVICE_ACCOUNT_JSON** (secret; paste the whole key file) and **GOOGLE_WORKSPACE_ADMIN_EMAIL** (a super admin address, used only to list users).
7. Import. Run **Import Google Workspace mailboxes** from the command menu on the Mailboxes list, which imports every active user. To filter, ask the AI chat to use the `import-workspace-mailboxes` tool, or call the route:
   ```bash
   curl -X POST "$TWENTY_URL/s/mailboxes/import-workspace" -H "Authorization: Bearer $TWENTY_API_KEY" \
     -H 'Content-Type: application/json' -d '{"domain":"acme-mail.com","orgUnitPath":"/Senders","dryRun":true}'
   ```
   Filters: `domain`, `orgUnitPath` (includes child OUs) and `emails` (list). Suspended and archived users are skipped, and so are addresses that are already mailboxes. New mailboxes are set to WARMING with warmup on. Use `dryRun` to preview.

### Many separate Google Workspace accounts (one per domain)

One service account works for any number of Workspace accounts. Do steps 1 to 3 above once. Then, in each Workspace's Admin console, do step 4 with the same client ID and only the `https://mail.google.com/` scope, and check step 5. Set **GOOGLE_SERVICE_ACCOUNT_JSON** in Twenty (the admin email is not needed for this route). Then paste the addresses, one per line with no password, into **Add mailboxes** on the **Setup** page in the Pulse sidebar. **Check** mints a test token for every address, so a domain that has not authorised the client shows up before anything is created.

### gmail.com, outlook.com and other non-Workspace accounts: CSV paste

Delegation only works inside a Workspace domain. For other accounts, paste them all in one request; each password is sealed with MAILBOX_ENCRYPTION_KEY:
```bash
curl -X POST "$TWENTY_URL/s/mailboxes/import-csv" -H "Authorization: Bearer $TWENTY_API_KEY" \
  -H 'Content-Type: application/json' --data-binary @- <<'JSON'
{"csv": "email,password,display name\nann@gmail.com,abcd efgh ijkl mnop,Ann Lee\nbob@outlook.com,xxxx,Bob"}
JSON
```
- The columns are email, app password and display name. A header row is optional. Commas, semicolons and tabs all work. Optional columns are `provider` (google/microsoft/other), `smtpHost`, `smtpPort`, `imapHost` and `imapPort`; custom-domain mailboxes need the hosts.
- The provider is detected from gmail.com, googlemail.com, outlook.com, hotmail.com, live.com and msn.com, and SMTP/IMAP hosts default per provider.
- **Each gmail.com account needs 2-Step Verification turned on, then an app password** from https://myaccount.google.com/apppasswords (16 letters; spaces are ignored). The normal password does not work over SMTP/IMAP.
- Existing addresses and repeats are skipped. Bad rows are reported by line number. `"dryRun": true` previews the import.
- This is an authenticated route only, not an AI tool, so passwords never pass through a chat.

You need at least 2 mailboxes to start. The plan recommends about 10 or more, across 3 or more domains, mixing Google and Microsoft, with SPF, DKIM and DMARC set on every domain.

## Crons

| Function | Schedule (UTC) | What it does |
| --- | --- | --- |
| `run-warmup` | every 20 min | Spreads the day's ramp volume over the send window, pairs senders with recipients (never itself; other domains and a mix of providers preferred), sends over SMTP, and logs each send to `warmupMessage`. An SMTP 5xx rejection is logged as a bounce. An auth or connection failure sets the mailbox to `ERROR`. |
| `process-warmup-inboxes` | :10 and :40 | Over IMAP, finds unread tagged mail in INBOX and Junk, marks it read, flagged and (on Gmail) Important, moves it out of spam, and replies to a share of it. It then recomputes spam placement, bounce rate and health over 14 days, and auto-pauses a mailbox above 35% spam or 8% bounces. |
| `reset-mailbox-daily-counters` | 00:05 | Resets `sentToday` and `warmupSentToday`, advances the warmup day and stage, recomputes `dailySendLimit` and promotes WARMING mailboxes to ACTIVE at the MATURE stage. |

Default stage allowances for sequence sends are STARTING (days 1 to 7): 0 a day, BUILDING (8 to 14): 10, RAMPING (15 to 21): 15 and MATURE (22 onwards): 20. Health below 50 halves the stage allowance, rounded down. PAUSED or ERROR mailboxes cannot send sequences. The effective daily cap is the smaller of the owner's configured maximum and this warmup/health allowance. For example, an owner maximum of 10 with healthy mailboxes produces stage caps of **0 / 10 / 10 / 10**; low health produces **0 / 5 / 7 / 10** under the default configuration. Warmup messages have their own ramp and counter; this maximum governs sequence emails.

An explicit owner maximum of 0 stays 0. A missing or invalid owner maximum fails closed with an effective cap of 0; the system never copies the old computed cap into the owner field or supplies an implicit nonzero maximum. Stats refreshes, UTC daily rollover and other automatic jobs may update the effective cap and reason, but never the owner's maximum. Mailbox selection and the outreach transport recompute the policy instead of trusting a stale stored effective cap. To retry a mailbox in ERROR, fix the problem and set its status back to WARMING, or store the password again; doing so does not override its owner maximum or warmup restrictions.

### Controlled deployment and initialization

The source change does not deploy metadata or initialize production records. Handle those as separate, explicitly authorized operations:

1. Validate the schema and run the offline unit tests. Deploy the new fields and both updated views together with the enforcement code. Keep the new owner field's default at 0; existing records without a valid owner maximum remain blocked from sequence sending until explicitly configured.
2. Before initializing the authorized 50 mailboxes, take a read-only snapshot of their exact record IDs, email addresses, owner maximum, effective cap, reason, status, warmup stage, health and usage. Compare that identity set with the approved list. Stop if any identity is missing, duplicated, unexpected or if the count is not exactly 50. Do not infer the set from the current total mailbox count.
3. Review a narrowly scoped change plan setting only `configuredDailySendLimit: 10` on those exact 50 IDs. Do not update other mailboxes or change credentials, status, warmup state or counters. Do not overwrite an existing explicit 0 or a lower approved maximum without specific approval for that mailbox. Resolve such exceptions before applying the plan; never substitute another record to reach 50.
4. After approval for the deployment and initialization, apply only the reviewed owner-field updates and recompute derived caps through the new policy. Read back all 50 records, verify the owner maximum is 10 where authorized, verify the expected stage/health caps and reasons, and confirm the scope of writes against the reviewed plan. STARTING remains 0; a healthy owner-10 mailbox never gets an effective cap above 10.
5. Verify the next stats refresh and UTC rollover preserve every configured maximum. If verification fails, stop sequence sending and investigate without restoring an old computed cap as the owner maximum. Keep the before/after evidence and an explicit rollback plan; do not silently roll back to an enforcement version that ignores the new owner cap.

## Warmup tag

Every warmup email carries a signed tag in an `X-Entity-Ref-ID` header and in a `Ref:` footer line. Use `isWarmupMessage(warmupTagSecret(key), { headers, text })` from `src/gtm/mailbox` to hide warmup mail, for example in One Inbox.

## For sequences

`pickSendingMailbox` in `pick-sending-mailbox.ts` returns the mailbox with the most unused share of its recomputed effective daily cap, or null when every mailbox is blocked or full. Use the same resolved warmup configuration for selection and transport enforcement. After each successful send, increment `sentToday` and set `lastSentAt`; denied sends must not open a mail transport or consume quota.

### Concurrency and delivery limits

The sequence runner sends serially within a run. The mailer re-reads mailbox policy before transport and retains a local usage floor so stale REST reads cannot reopen quota in that run. A usage-write failure holds that mailbox for the rest of the run. This is not a cross-worker atomic reservation: overlapping runners, a concurrent reset/write, or a crash after SMTP accepts mail but before usage is persisted can still race. Before live rollout, verify only one sequence worker owns each mailbox at a time; strict concurrent quotas and exactly-once delivery require a separate transactional reservation/outbox design.
