import { defineLogicFunction } from 'twenty-sdk/define';

import { INVOICE_REMINDERS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';
import { createStripeClient, syncInvoices } from 'src/gtm/agency/stripe';

// Hourly: reads sent invoices back from Stripe (Paid, Void), marks unpaid ones
// past their due date Overdue and drafts up to two polite reminders.
const handler = async () => {
  try {
    const settings = agencySettings();
    const stripe = settings.stripeSecretKey ? createStripeClient(settings.stripeSecretKey) : null;
    const writer = await agencyWriter().catch(() => null);
    return { ok: true, results: await syncInvoices({ records: agencyRecords(), stripe, writer, settings }) };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: INVOICE_REMINDERS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'invoice-reminders',
  description: 'Syncs sent invoices with Stripe (paid, void, overdue) and drafts payment reminders',
  timeoutSeconds: 180,
  handler,
  cronTriggerSettings: { pattern: '0 * * * *' },
});
