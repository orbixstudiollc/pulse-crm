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
   The route stores only the ciphertext in `credentialCiphertext`. For OAuth, put an app connection id in `connectionId` instead; the engine then signs in with XOAUTH2. No connection provider is defined yet.

You need at least 2 mailboxes to start. The plan recommends about 10 or more, across 3 or more domains, mixing Google and Microsoft, with SPF, DKIM and DMARC set on every domain.

## Crons

| Function | Schedule (UTC) | What it does |
| --- | --- | --- |
| `run-warmup` | every 20 min | Spreads the day's ramp volume over the send window, pairs senders with recipients (never itself; other domains and a mix of providers preferred), sends over SMTP, and logs each send to `warmupMessage`. An SMTP 5xx rejection is logged as a bounce. An auth or connection failure sets the mailbox to `ERROR`. |
| `process-warmup-inboxes` | :10 and :40 | Over IMAP, finds unread tagged mail in INBOX and Junk, marks it read, flagged and (on Gmail) Important, moves it out of spam, and replies to a share of it. It then recomputes spam placement, bounce rate and health over 14 days, and auto-pauses a mailbox above 35% spam or 8% bounces. |
| `reset-mailbox-daily-counters` | 00:05 | Resets `sentToday` and `warmupSentToday`, advances the warmup day and stage, recomputes `dailySendLimit` and promotes WARMING mailboxes to ACTIVE at the MATURE stage. |

Stages and send caps: STARTING (days 1 to 7) sends 0 a day, BUILDING (8 to 14) sends 10, RAMPING (15 to 21) sends 25 and MATURE (22 onwards) sends 40. The cap is halved when health is below 50, and it is 0 while a mailbox is PAUSED or in ERROR. To retry a mailbox in ERROR, fix the problem and set its status back to WARMING, or store the password again.

## Warmup tag

Every warmup email carries a signed tag in an `X-Entity-Ref-ID` header and in a `Ref:` footer line. Use `isWarmupMessage(warmupTagSecret(key), { headers, text })` from `src/gtm/mailbox` to hide warmup mail, for example in One Inbox.

## For sequences

`pickSendingMailbox(mailboxes, now)` in `pick-sending-mailbox.ts` returns the mailbox with the most unused share of its daily cap, or null when every mailbox is full. After each send, increment `sentToday` and set `lastSentAt`.
