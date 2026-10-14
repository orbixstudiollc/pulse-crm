// Public surface of the mailbox area for other areas (sequences, One Inbox).
// Pure helpers only: importing this does not pull in nodemailer or imapflow.
export { pickSendingMailbox, remainingSendsToday, sentTodayFor, type SendingMailboxLike } from 'src/gtm/mailbox/pick-sending-mailbox';
export { effectiveDailySendPolicy, dailySendLimitFor, rampSchedule, stageForDay, warmupDayFor, warmupVolumeForDay } from 'src/gtm/mailbox/ramp';
export { detectWarmupTag, isWarmupMessage, WARMUP_TAG_HEADER } from 'src/gtm/mailbox/warmup-tag';
export { warmupTagSecret } from 'src/gtm/mailbox/credentials';
export type { MailboxRecord } from 'src/gtm/mailbox/types';
export { MAILBOX_PROVIDERS, MAILBOX_STATUSES, WARMUP_STAGES } from 'src/gtm/mailbox/values';
export type { MailboxProvider, MailboxStatus, WarmupStage } from 'src/gtm/mailbox/values';
