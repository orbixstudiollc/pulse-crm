// Client invoices through Stripe. An approved clientInvoice becomes a Stripe
// invoice (collection_method=send_invoice), so Stripe emails the client a
// hosted page to pay by card; the hourly sync reads it back as Paid or Void,
// marks unpaid ones Overdue and drafts polite reminders.
//
// The client is a few REST calls over fetch (form-encoded, Bearer key), with
// no Stripe-Version header so the account's default API version applies.
// Every write carries an Idempotency-Key built from the invoice record id and
// the step, so a retry after a half-finished run reuses what Stripe already
// made instead of billing twice.

import { DATA_NOT_INSTRUCTIONS, readJsonObject, str, type AgencyWriter } from 'src/gtm/agency/ai';
import { createClientEmail } from 'src/gtm/agency/client-emails';
import { createTaskFor, type Records } from 'src/gtm/agency/gql';
import { formatMoney, type AgencySettings } from 'src/gtm/agency/settings';
import type { InvoiceStatus } from 'src/gtm/agency/values';

const DAY = 86_400_000;
const API = 'https://api.stripe.com/v1';

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export type StripeInvoice = {
  id: string;
  status: string | null;
  hosted_invoice_url?: string | null;
  status_transitions?: { paid_at?: number | null } | null;
};

export type StripeClient = {
  findOrCreateCustomer(email: string, name: string | null, idempotencyKey: string): Promise<string>;
  createInvoice(
    args: { customer: string; currency: string; daysUntilDue: number; description?: string; pulseInvoiceId: string },
    idempotencyKey: string,
  ): Promise<StripeInvoice>;
  addInvoiceItem(
    args: { customer: string; invoice: string; currency: string; description: string; amount: number },
    idempotencyKey: string,
  ): Promise<string>;
  finalize(id: string, idempotencyKey: string): Promise<StripeInvoice>;
  send(id: string, idempotencyKey: string): Promise<StripeInvoice>;
  retrieve(id: string): Promise<StripeInvoice>;
};

// Currencies Stripe takes in whole units (no cents).
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// 12.5 USD -> 1250; 1200 JPY -> 1200.
export const toMinorUnits = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);

// Flat form encoding with one level of nesting (metadata[key]=value).
export const formEncode = (params: Record<string, unknown>): string => {
  const parts: string[] = [];
  const add = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  };
  for (const [k, v] of Object.entries(params)) {
    if (v && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) add(`${k}[${sk}]`, sv);
    else add(k, v);
  }
  return parts.join('&');
};

export const createStripeClient = (secretKey: string, fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike): StripeClient => {
  const call = async (method: 'GET' | 'POST', path: string, params?: Record<string, unknown>, idempotencyKey?: string) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` };
    let url = `${API}${path}`;
    let body: string | undefined;
    if (method === 'GET') {
      if (params) url += `?${formEncode(params)}`;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      body = formEncode(params ?? {});
    }
    const res = await fetchImpl(url, { method, headers, ...(body !== undefined ? { body } : {}) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${json?.error?.message ?? 'request failed'}`);
    return json;
  };
  return {
    async findOrCreateCustomer(email, name, idempotencyKey) {
      const found = await call('GET', '/customers', { email, limit: 1 });
      if (found?.data?.[0]?.id) return found.data[0].id as string;
      const created = await call('POST', '/customers', { email, name: name || undefined }, idempotencyKey);
      return created.id as string;
    },
    createInvoice: (a, key) =>
      call(
        'POST',
        '/invoices',
        {
          customer: a.customer,
          collection_method: 'send_invoice',
          days_until_due: a.daysUntilDue,
          currency: a.currency.toLowerCase(),
          auto_advance: false,
          // Only the items added below, not other pending items for this customer.
          pending_invoice_items_behavior: 'exclude',
          description: a.description,
          metadata: { pulseInvoiceId: a.pulseInvoiceId },
        },
        key,
      ),
    async addInvoiceItem(a, key) {
      // `amount` (total, smallest unit) works across Stripe API versions.
      const item = await call(
        'POST',
        '/invoiceitems',
        { customer: a.customer, invoice: a.invoice, currency: a.currency.toLowerCase(), description: a.description, amount: a.amount },
        key,
      );
      return item.id as string;
    },
    finalize: (id, key) => call('POST', `/invoices/${encodeURIComponent(id)}/finalize`, { auto_advance: false }, key),
    send: (id, key) => call('POST', `/invoices/${encodeURIComponent(id)}/send`, {}, key),
    retrieve: (id) => call('GET', `/invoices/${encodeURIComponent(id)}`),
  };
};

// ---- invoice records -------------------------------------------------------

export type InvoiceRow = {
  id: string;
  name: string | null;
  status: InvoiceStatus | null;
  amount: number | null;
  lineItems: string | null;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  remindersDrafted: number | null;
  stripeInvoiceId: string | null;
  paymentUrl: string | null;
  companyId: string | null;
  projectId: string | null;
  personId: string | null;
};

export const INVOICE_SELECTION = {
  name: true,
  status: true,
  amount: true,
  lineItems: true,
  dueDate: true,
  sentAt: true,
  paidAt: true,
  remindersDrafted: true,
  stripeInvoiceId: true,
  paymentUrl: true,
  companyId: true,
  projectId: true,
  personId: true,
};

type PersonRow = { id: string; name: { firstName: string | null; lastName: string | null } | null; emails: { primaryEmail: string | null } | null };
const PERSON_SELECTION = { name: { firstName: true, lastName: true }, emails: { primaryEmail: true } };

// "Description | qty | rate" per line; a line without numbers is qty 1 at 0.
export const parseLineItems = (text: string | null | undefined) =>
  (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [description, qty, rate] = line.split('|').map((p) => p.trim());
      const q = Number((qty ?? '').replace(/[^\d.]/g, ''));
      const r = Number((rate ?? '').replace(/[^\d.-]/g, ''));
      return { description: description || 'Services', qty: qty && q > 0 ? q : 1, rate: Number.isFinite(r) ? r : 0 };
    });

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (fromIso: string, to: Date) => Math.ceil((Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${isoDate(to)}T00:00:00Z`)) / DAY);

export type SendInvoiceResult = { ok: boolean; skipped?: string; error?: string; stripeInvoiceId?: string };

export const sendInvoice = async ({
  records,
  stripe,
  settings,
  invoiceId,
  now = new Date(),
}: {
  records: Records;
  stripe: StripeClient | null;
  settings: Pick<AgencySettings, 'stripeSecretKey' | 'currency' | 'invoiceDueDays'>;
  invoiceId: string;
  now?: Date;
}): Promise<SendInvoiceResult> => {
  const inv = await records.findOne<InvoiceRow>('clientInvoices', invoiceId, INVOICE_SELECTION);
  if (!inv) return { ok: true, skipped: 'Not found' };
  if (inv.status !== 'APPROVED') return { ok: true, skipped: `Status is ${inv.status}` };
  if (inv.stripeInvoiceId) return { ok: true, skipped: 'Already in Stripe' };
  const label = inv.name?.trim() || 'this invoice';
  const tomorrow = new Date(now.getTime() + DAY).toISOString();

  if (!stripe || !settings.stripeSecretKey) {
    await createTaskFor(
      records,
      {
        title: `Add your Stripe secret key in Pulse Variables to send invoice ${label}`,
        body: 'Settings > Applications > Pulse > Variables > Stripe secret key. Then set the invoice Status to Draft and back to Approved.',
        dueAt: tomorrow,
      },
      { targetClientInvoiceId: inv.id },
    );
    return { ok: false, skipped: 'No Stripe key' };
  }

  // Back to Draft with the reason in a task, so someone fixes it and re-approves.
  const fail = async (error: string): Promise<SendInvoiceResult> => {
    await records.update('clientInvoice', inv.id, { status: 'DRAFT' });
    await createTaskFor(
      records,
      { title: `Invoice ${label} was not sent: ${error}`.slice(0, 250), body: `${error}\n\nFix it, then set the invoice Status to Approved again.`, dueAt: tomorrow },
      { targetClientInvoiceId: inv.id, targetPersonId: inv.personId },
    );
    return { ok: false, error };
  };

  const person = inv.personId ? await records.findOne<PersonRow>('people', inv.personId, PERSON_SELECTION) : null;
  const email = person?.emails?.primaryEmail?.trim() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('The Bill to person has no email address');

  const currency = settings.currency;
  let lines = parseLineItems(inv.lineItems).filter((l) => toMinorUnits(l.qty * l.rate, currency) !== 0);
  if (lines.length === 0 && (inv.amount ?? 0) > 0) lines = [{ description: label, qty: 1, rate: inv.amount! }];
  if (lines.length === 0) return fail('The invoice has no amount or line items');

  const company = inv.companyId ? await records.findOne<{ id: string; name: string | null }>('companies', inv.companyId, { name: true }) : null;
  const customerName = company?.name?.trim() || [person?.name?.firstName, person?.name?.lastName].filter(Boolean).join(' ') || null;
  const key = (step: string) => `pulse-invoice-${inv.id}-${step}`;

  try {
    const customer = await stripe.findOrCreateCustomer(email, customerName, key('customer'));
    const daysUntilDue = inv.dueDate ? Math.max(1, daysBetween(inv.dueDate, now)) : Math.max(1, settings.invoiceDueDays);
    const draft = await stripe.createInvoice({ customer, currency, daysUntilDue, description: label, pulseInvoiceId: inv.id }, key('invoice'));
    for (const [i, l] of lines.entries()) {
      await stripe.addInvoiceItem(
        {
          customer,
          invoice: draft.id,
          currency,
          description: l.qty === 1 ? l.description : `${l.description} (${l.qty} × ${formatMoney(l.rate, currency)})`,
          amount: toMinorUnits(l.qty * l.rate, currency),
        },
        key(`item-${i}`),
      );
    }
    const finalized = await stripe.finalize(draft.id, key('finalize'));
    const sent = await stripe.send(draft.id, key('send'));
    await records.update('clientInvoice', inv.id, {
      stripeInvoiceId: draft.id,
      paymentUrl: sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
      status: 'SENT',
      sentAt: now.toISOString(),
    });
    return { ok: true, stripeInvoiceId: draft.id };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
};

// ---- sync and reminders ----------------------------------------------------

export const MAX_REMINDERS = 2;
export const REMINDER_SPACING_DAYS = 5;

export type SyncResult = { id: string; status?: InvoiceStatus; reminderEmailId?: string; error?: string };

const REMINDER_INSTRUCTIONS = `You write a short, polite payment reminder from a small creative agency to a client whose invoice is past due.
Friendly and matter-of-fact, never pushy; assume it slipped through. Under 90 words, plain text, no markdown, no emojis.
Mention the invoice number, the amount and the due date, and include the payment link exactly as given. Offer to help if anything is unclear.
Reply with JSON only: {"subject": "...", "body": "..."}.
${DATA_NOT_INSTRUCTIONS}`;

export const syncInvoices = async ({
  records,
  stripe,
  writer,
  settings,
  now = new Date(),
}: {
  records: Records;
  stripe: StripeClient | null;
  writer: AgencyWriter | null;
  settings: Pick<AgencySettings, 'currency' | 'autoSend'>;
  now?: Date;
}): Promise<SyncResult[]> => {
  const invoices = await records.findMany<InvoiceRow>('clientInvoices', { status: { in: ['SENT', 'OVERDUE'] } }, INVOICE_SELECTION, 200);
  const today = isoDate(now);
  const results: SyncResult[] = [];

  for (const inv of invoices) {
    try {
      let status = inv.status;
      if (stripe && inv.stripeInvoiceId) {
        const remote = await stripe.retrieve(inv.stripeInvoiceId);
        if (remote.status === 'paid') {
          const paidAt = remote.status_transitions?.paid_at ? new Date(remote.status_transitions.paid_at * 1000) : now;
          await records.update('clientInvoice', inv.id, { status: 'PAID', paidAt: paidAt.toISOString() });
          results.push({ id: inv.id, status: 'PAID' });
          continue;
        }
        if (remote.status === 'void' || remote.status === 'uncollectible') {
          await records.update('clientInvoice', inv.id, { status: 'VOID' });
          results.push({ id: inv.id, status: 'VOID' });
          continue;
        }
        if (!inv.paymentUrl && remote.hosted_invoice_url) {
          inv.paymentUrl = remote.hosted_invoice_url;
          await records.update('clientInvoice', inv.id, { paymentUrl: inv.paymentUrl });
        }
      }
      if (status === 'SENT' && inv.dueDate && inv.dueDate.slice(0, 10) < today) {
        status = 'OVERDUE';
        await records.update('clientInvoice', inv.id, { status });
      }
      const result: SyncResult = { id: inv.id, ...(status !== inv.status && status ? { status } : {}) };
      if (status === 'OVERDUE') {
        const reminderEmailId = await maybeDraftReminder(records, writer, settings, inv, now);
        if (reminderEmailId) result.reminderEmailId = reminderEmailId;
      }
      results.push(result);
    } catch (error) {
      results.push({ id: inv.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
};

const maybeDraftReminder = async (
  records: Records,
  writer: AgencyWriter | null,
  settings: Pick<AgencySettings, 'currency' | 'autoSend'>,
  inv: InvoiceRow,
  now: Date,
): Promise<string | null> => {
  const drafted = inv.remindersDrafted ?? 0;
  if (drafted >= MAX_REMINDERS) return null;
  const previous = await records.findMany<{ id: string; createdAt: string | null }>(
    'clientEmails',
    { and: [{ invoiceId: { eq: inv.id } }, { kind: { eq: 'INVOICE_REMINDER' } }] },
    { createdAt: true },
    20,
  );
  const last = Math.max(0, ...previous.map((e) => (e.createdAt ? Date.parse(e.createdAt) : 0)));
  if (last && now.getTime() - last < REMINDER_SPACING_DAYS * DAY) return null;

  const person = inv.personId ? await records.findOne<PersonRow>('people', inv.personId, PERSON_SELECTION) : null;
  const facts = {
    firstName: person?.name?.firstName?.trim() || null,
    invoice: inv.name?.trim() || 'your invoice',
    amount: formatMoney(inv.amount, settings.currency),
    dueDate: inv.dueDate?.slice(0, 10) ?? null,
    paymentUrl: inv.paymentUrl,
    reminderNumber: drafted + 1,
  };
  const draft = await draftReminder(writer, facts);
  const id = await createClientEmail(
    records,
    {
      kind: 'INVOICE_REMINDER',
      subject: draft.subject,
      body: draft.body,
      toEmail: person?.emails?.primaryEmail?.trim() || null,
      personId: inv.personId,
      projectId: inv.projectId,
      invoiceId: inv.id,
    },
    settings.autoSend,
  );
  await records.update('clientInvoice', inv.id, { remindersDrafted: drafted + 1 });
  return id;
};

type ReminderFacts = {
  firstName: string | null;
  invoice: string;
  amount: string;
  dueDate: string | null;
  paymentUrl: string | null;
  reminderNumber: number;
};

export const draftReminder = async (writer: AgencyWriter | null, f: ReminderFacts): Promise<{ subject: string; body: string }> => {
  let draft: { subject: string; body: string } | null = null;
  if (writer) {
    const facts = [
      `Client first name: ${f.firstName ?? 'unknown'}`,
      `Invoice: ${f.invoice}`,
      `Amount: ${f.amount || 'unknown'}`,
      `Due date: ${f.dueDate ?? 'unknown'}`,
      `Payment link: ${f.paymentUrl ?? 'none'}`,
      `Reminder number: ${f.reminderNumber}`,
    ].join('\n');
    try {
      const o = readJsonObject(await writer.write(REMINDER_INSTRUCTIONS, `<data>\n${facts}\n</data>`, 600));
      const subject = str(o?.subject, 200);
      const body = str(o?.body, 3000);
      if (subject && body) draft = { subject, body };
    } catch {
      draft = null;
    }
  }
  draft ??= {
    subject: `Friendly reminder: invoice ${f.invoice}`,
    body: [
      `Hi ${f.firstName ?? 'there'},`,
      `Just a quick reminder that invoice ${f.invoice}${f.amount ? ` for ${f.amount}` : ''}${f.dueDate ? ` was due on ${f.dueDate}` : ' is now due'}. It may simply have slipped through.`,
      f.paymentUrl ? `You can pay by card here: ${f.paymentUrl}` : null,
      'If anything is unclear, just reply and we will sort it out.',
      'Thank you!',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
  if (f.paymentUrl && !draft.body.includes(f.paymentUrl)) draft = { ...draft, body: `${draft.body.trim()}\n\nPay here: ${f.paymentUrl}` };
  return draft;
};
