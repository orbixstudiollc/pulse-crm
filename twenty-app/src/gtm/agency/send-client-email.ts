// Sends one approved client email and records what it did: the email becomes
// SENT (or FAILED with the error), and the record it belongs to moves on
// (proposal sent, follow-up counted, project's last update stamped).

import { textToHtml } from 'src/gtm/agency/client-emails';
import type { Records } from 'src/gtm/agency/gql';
import type { ClientEmailKind, ClientEmailStatus } from 'src/gtm/agency/values';

export type ClientMailer = {
  send(email: { to: string; subject: string; html: string }): Promise<{ ok: true } | { ok: false; error: string }>;
};

type ClientEmailRow = {
  id: string;
  status: ClientEmailStatus | null;
  kind: ClientEmailKind | null;
  toEmail: string | null;
  subject: string | null;
  body: string | null;
  proposalId: string | null;
  projectId: string | null;
};

export const CLIENT_EMAIL_SELECTION = {
  status: true,
  kind: true,
  toEmail: true,
  subject: true,
  body: true,
  proposalId: true,
  projectId: true,
};

export type SendOutcome = { ok: boolean; skipped?: string; error?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sendClientEmail = async ({
  records,
  mailer,
  id,
  now = new Date(),
}: {
  records: Records;
  mailer: ClientMailer | null;
  id: string;
  now?: Date;
}): Promise<SendOutcome> => {
  const email = await records.findOne<ClientEmailRow>('clientEmails', id, CLIENT_EMAIL_SELECTION);
  if (!email) return { ok: true, skipped: 'Not found' };
  if (email.status !== 'APPROVED') return { ok: true, skipped: `Status is ${email.status}` };

  const fail = async (error: string): Promise<SendOutcome> => {
    await records.update('clientEmail', id, { status: 'FAILED', error: error.slice(0, 500) });
    return { ok: false, error };
  };
  const to = email.toEmail?.trim() ?? '';
  if (!EMAIL.test(to)) return fail('No valid recipient address');
  if (!email.subject?.trim() || !email.body?.trim()) return fail('Subject or body is empty');
  if (!mailer) return fail('Client email account is not set up (CLIENT_EMAIL_FROM)');

  const sent = await mailer.send({ to, subject: email.subject.trim(), html: textToHtml(email.body) });
  if (!sent.ok) return fail(sent.error);

  const at = now.toISOString();
  await records.update('clientEmail', id, { status: 'SENT', sentAt: at, error: null });

  if (email.kind === 'PROPOSAL' && email.proposalId) {
    const p = await records.findOne<{ status: string | null; sentAt: string | null }>('proposals', email.proposalId, { status: true, sentAt: true });
    if (p) {
      await records.update('proposal', email.proposalId, {
        ...(p.status === 'DRAFT' ? { status: 'SENT' } : {}),
        ...(p.sentAt ? {} : { sentAt: at }),
      });
    }
  }
  if (email.kind === 'PROPOSAL_FOLLOW_UP' && email.proposalId) {
    const p = await records.findOne<{ followUpsSent: number | null }>('proposals', email.proposalId, { followUpsSent: true });
    await records.update('proposal', email.proposalId, { followUpsSent: (p?.followUpsSent ?? 0) + 1, lastFollowUpAt: at });
  }
  if (email.kind === 'WEEKLY_UPDATE' && email.projectId) {
    await records.update('clientProject', email.projectId, { lastClientUpdateAt: at });
  }
  return { ok: true };
};

// Approved emails that a trigger missed (older than a few minutes).
export const findStuckApproved = async (records: Records, now: Date, olderThanMinutes = 5) =>
  records.findMany<{ id: string }>(
    'clientEmails',
    { and: [{ status: { eq: 'APPROVED' } }, { updatedAt: { lte: new Date(now.getTime() - olderThanMinutes * 60_000).toISOString() } }] },
    {},
    20,
  );
