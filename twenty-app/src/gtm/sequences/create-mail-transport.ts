// Integration point: return the mailer that sendSequenceSteps uses.
//
// Until the mailbox branch is merged this returns null, and the cron run
// reports `mailer: "not configured"` without touching any enrollment. The
// integrator replaces the body with something like:
//
//   const mailboxes = await loadMailboxes();
//   return {
//     transport: smtpTransport(...),
//     mailboxes: { pickMailbox: async ({ now }) =>
//       pickSendingMailbox(mailboxes, now)?.email ?? null },
//     usage: { recordSend: (email, at) => recordMailboxSend(email, at) },
//   };

import type { OutreachMailer } from 'src/gtm/sequences/transport';

export const createOutreachMailer = async (): Promise<OutreachMailer | null> => null;
