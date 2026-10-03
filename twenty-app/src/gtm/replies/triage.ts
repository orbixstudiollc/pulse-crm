// Acts on one sequence reply in the Inbox: asks the AI what it means, stores
// the intent, a one-line summary and a drafted answer on the Inbox item, then
// does the follow-through for that intent:
//
//   INTERESTED     deal at "New" (unless one is open), answer with the booking
//                  link drafted, or sent when REPLY_AUTO_SEND is "interested"
//   QUESTION       task to answer, with the draft
//   NOT_NOW        lead Warm, follow-up task on their date (or in 90 days)
//   WRONG_PERSON   lead Cold, task to contact the person they named
//   NOT_INTERESTED lead Cold
//   UNSUBSCRIBE    lead Disqualified (enroll skips Disqualified leads)
//   OUT_OF_OFFICE  the sequence resumes the day after they are back (or in a
//                  week) and the reply is taken back out of the stats
//   OTHER          task to read it
//
// markReply has already stopped the sequence and made the lead Hot by the time
// this runs. Items that were triaged before are skipped.

import { buildTriagePrompt, parseTriageResponse, type Triage } from 'src/gtm/replies/classify';
import type { AutoSendMode, ReplyIntent } from 'src/gtm/replies/values';
import type { OpenerWriter } from 'src/gtm/sequences/openers';
import type { EnrollmentRecord, SequenceStore } from 'src/gtm/sequences/store';
import type { OutreachMailer } from 'src/gtm/sequences/transport';
import type { LeadStatus } from 'src/gtm/lead-values';

export type ReplyItem = {
  id: string;
  kind: string | null;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  mailboxEmail: string | null;
  messageId: string | null;
  personId: string | null;
  enrollmentId: string | null;
  triagedAt: string | null;
};

export type ReplyPerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  jobTitle: string | null;
  leadStatus: LeadStatus | null;
  companyId: string | null;
  companyName: string | null;
};

export type ReplyItemPatch = {
  replyIntent?: ReplyIntent;
  aiSummary?: string | null;
  draftReply?: string | null;
  triagedAt?: string;
  autoSentAt?: string | null;
};

export type NewOpportunity = { name: string; personId: string; companyId: string | null };

export type ReplyStore = Pick<
  SequenceStore,
  'setLeadStatus' | 'createTask' | 'getEnrollmentsByIds' | 'updateEnrollment' | 'incrementCampaignStats' | 'incrementVariantStats'
> & {
  getInboxItem(id: string): Promise<ReplyItem | null>;
  // Full text of the email when it can be read (Twenty-synced mail); the
  // Inbox item only keeps a short preview.
  getFullText(item: ReplyItem): Promise<string | null>;
  getPerson(id: string): Promise<ReplyPerson | null>;
  updateInboxItem(id: string, patch: ReplyItemPatch): Promise<void>;
  // An opportunity for this person (or their company) that is not won yet.
  findOpenOpportunity(personId: string, companyId: string | null): Promise<string | null>;
  createOpportunity(data: NewOpportunity): Promise<string>;
};

export type TriageSettings = {
  bookingLink: string | null;
  autoSend: AutoSendMode;
};

export type TriageResult = {
  ok: boolean;
  skipped?: string;
  intent?: ReplyIntent;
  opportunityId?: string | null;
  taskId?: string | null;
  autoSent?: boolean;
  resumedEnrollmentId?: string | null;
  error?: string;
};

const DAY = 24 * 60 * 60 * 1000;
export const NOT_NOW_DEFAULT_DAYS = 90;
export const OUT_OF_OFFICE_DEFAULT_DAYS = 7;

// The day after a YYYY-MM-DD date at 09:00 UTC, or now + fallback days. Dates
// in the past fall back too.
export const followUpAt = (date: string | null, now: Date, fallbackDays: number, dayAfter = false): Date => {
  if (date) {
    const d = new Date(`${date}T09:00:00Z`);
    if (Number.isFinite(d.getTime())) {
      const at = dayAfter ? new Date(d.getTime() + DAY) : d;
      if (at.getTime() > now.getTime()) return at;
    }
  }
  return new Date(now.getTime() + fallbackDays * DAY);
};

// A real RFC 5322 Message-ID (IMAP-synced mail) can thread the answer; a
// Twenty record id cannot.
export const threadableMessageId = (id: string | null | undefined): string | null => {
  const t = id?.trim();
  if (!t || !t.includes('@')) return null;
  return t.startsWith('<') ? t : `<${t}>`;
};

export const replySubject = (subject: string | null | undefined) => {
  const s = subject?.trim() || '';
  return /^re:/i.test(s) ? s : `Re: ${s || 'our conversation'}`;
};

const draftToHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
    .join('');

const taskBody = (triage: Triage, item: ReplyItem) =>
  [
    triage.summary ? `**Summary:** ${triage.summary}` : null,
    item.snippet ? `**They wrote:** ${item.snippet}` : null,
    triage.draft ? `**Drafted answer:**\n\n${triage.draft}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

export const triageReply = async ({
  store,
  writer,
  inboxItemId,
  settings,
  mailer,
  senderName,
  now = new Date(),
  force = false,
}: {
  store: ReplyStore;
  writer: OpenerWriter;
  inboxItemId: string;
  settings: TriageSettings;
  // Only needed when auto-send is on.
  mailer?: OutreachMailer | null;
  senderName?: string | null;
  now?: Date;
  force?: boolean;
}): Promise<TriageResult> => {
  const item = await store.getInboxItem(inboxItemId);
  if (!item) return { ok: true, skipped: 'Inbox item not found' };
  if (item.kind !== 'REPLY') return { ok: true, skipped: 'Not a sequence reply' };
  if (!item.personId) return { ok: true, skipped: 'Reply has no person' };
  if (item.triagedAt && !force) return { ok: true, skipped: 'Already triaged' };

  const person = await store.getPerson(item.personId);
  if (!person) return { ok: true, skipped: 'Person not found' };

  const text = (await store.getFullText(item).catch(() => null)) || item.snippet;
  const raw = await writer.write(
    buildTriagePrompt({
      subject: item.subject,
      text,
      firstName: person.firstName,
      lastName: person.lastName,
      jobTitle: person.jobTitle,
      company: person.companyName,
      senderName,
      bookingLink: settings.bookingLink,
      today: now.toISOString().slice(0, 10),
    }),
  );
  const triage = parseTriageResponse(raw);
  if (!triage) return { ok: false, error: 'The AI did not return a usable intent' };

  const result: TriageResult = { ok: true, intent: triage.intent, opportunityId: null, taskId: null, autoSent: false, resumedEnrollmentId: null };
  const who = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || 'this lead';
  const task = async (title: string, dueAt: Date) =>
    store.createTask({ personId: person.id, title, body: taskBody(triage, item), dueAt: dueAt.toISOString() });
  const setStatus = async (status: LeadStatus) => {
    if (person.leadStatus !== 'CUSTOMER' && person.leadStatus !== status) await store.setLeadStatus(person.id, status);
  };

  let autoSentAt: string | null = null;

  switch (triage.intent) {
    case 'INTERESTED': {
      result.opportunityId = await store.findOpenOpportunity(person.id, person.companyId);
      if (!result.opportunityId) {
        result.opportunityId = await store.createOpportunity({
          name: person.companyName?.trim() || who,
          personId: person.id,
          companyId: person.companyId,
        });
      }
      const canSend = settings.autoSend === 'interested' && triage.draft && settings.bookingLink && mailer && item.mailboxEmail && (item.fromEmail || person.email);
      if (canSend) {
        const sent = await mailer!.transport.send({
          from: item.mailboxEmail!,
          to: (item.fromEmail || person.email)!,
          subject: replySubject(item.subject),
          text: triage.draft!,
          html: draftToHtml(triage.draft!),
          inReplyToMessageId: threadableMessageId(item.messageId),
          enrollmentId: item.enrollmentId ?? '',
          sequenceId: '',
          stepNumber: 0,
        });
        if (sent.ok) {
          autoSentAt = now.toISOString();
          result.autoSent = true;
          await mailer!.usage?.recordSend(item.mailboxEmail!, now).catch(() => undefined);
        }
      }
      result.taskId = await task(
        result.autoSent ? `Booking link sent to ${who}: check they book` : `Send ${who} the booking link`,
        result.autoSent ? new Date(now.getTime() + 2 * DAY) : now,
      );
      break;
    }
    case 'QUESTION':
      result.taskId = await task(`Answer ${who}'s question`, now);
      break;
    case 'NOT_NOW':
      await setStatus('WARM');
      result.taskId = await task(`Follow up with ${who}`, followUpAt(triage.followUpDate, now, NOT_NOW_DEFAULT_DAYS));
      break;
    case 'WRONG_PERSON': {
      await setStatus('COLD');
      const referral = [triage.referralName, triage.referralEmail].filter(Boolean).join(', ');
      result.taskId = await task(referral ? `Contact ${referral} (referred by ${who})` : `Ask ${who} who handles this`, now);
      break;
    }
    case 'NOT_INTERESTED':
      await setStatus('COLD');
      break;
    case 'UNSUBSCRIBE':
      await setStatus('DISQUALIFIED');
      break;
    case 'OUT_OF_OFFICE': {
      result.resumedEnrollmentId = await resumeAfterAutoReply(store, item, followUpAt(triage.followUpDate, now, OUT_OF_OFFICE_DEFAULT_DAYS, true));
      // markReply made them Hot for what was only an auto-reply.
      if (person.leadStatus === 'HOT') await store.setLeadStatus(person.id, 'WARM');
      break;
    }
    default:
      result.taskId = await task(`Read ${who}'s reply`, now);
  }

  await store.updateInboxItem(item.id, {
    replyIntent: triage.intent,
    aiSummary: triage.summary,
    draftReply: triage.draft,
    triagedAt: now.toISOString(),
    autoSentAt,
  });
  return result;
};

// Undoes markReply for an out-of-office: the enrollment goes back to Active
// from the step it was on, and its reply no longer counts in campaign or A/B
// stats.
const resumeAfterAutoReply = async (store: ReplyStore, item: ReplyItem, at: Date): Promise<string | null> => {
  if (!item.enrollmentId) return null;
  const [enrollment] = await store.getEnrollmentsByIds([item.enrollmentId]);
  if (!enrollment || enrollment.status !== 'REPLIED') return null;
  await store.updateEnrollment(enrollment.id, {
    status: 'ACTIVE',
    nextSendAt: at.toISOString(),
    repliedAt: null,
    stopReason: null,
  });
  await uncountReply(store, enrollment);
  return enrollment.id;
};

const uncountReply = async (store: ReplyStore, enrollment: EnrollmentRecord) => {
  if (enrollment.campaignId) await store.incrementCampaignStats(enrollment.campaignId, { replied: -1 });
  if (enrollment.lastVariantId) await store.incrementVariantStats(enrollment.lastVariantId, { replied: -1 });
};
