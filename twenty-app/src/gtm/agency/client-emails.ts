// Client emails: every message Pulse writes to a client is a clientEmail
// record. It starts as DRAFT (waiting for approval in "Client emails") or,
// with CLIENT_AUTO_SEND on, as APPROVED, which the send-client-email trigger
// sends straight away.

import type { ClientEmailKind } from 'src/gtm/agency/values';
import type { Records } from 'src/gtm/agency/gql';

export type NewClientEmail = {
  kind: ClientEmailKind;
  subject: string;
  body: string;
  toEmail: string | null;
  personId?: string | null;
  projectId?: string | null;
  proposalId?: string | null;
  invoiceId?: string | null;
};

export const createClientEmail = async (
  records: Records,
  email: NewClientEmail,
  autoSend: boolean,
): Promise<string> =>
  records.create('clientEmail', {
    kind: email.kind,
    subject: email.subject.slice(0, 250),
    body: email.body,
    toEmail: email.toEmail,
    personId: email.personId ?? null,
    projectId: email.projectId ?? null,
    proposalId: email.proposalId ?? null,
    invoiceId: email.invoiceId ?? null,
    // Without a recipient it cannot go out on its own.
    status: autoSend && email.toEmail ? 'APPROVED' : 'DRAFT',
  });

// Plain text to simple HTML: paragraphs, line breaks and bare links.
export const textToHtml = (text: string): string => {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</p>`)
    .join('\n');
};
