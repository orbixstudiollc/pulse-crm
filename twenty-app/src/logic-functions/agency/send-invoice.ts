import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { SEND_INVOICE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { agencyRecords, agencySettings, errorText } from 'src/gtm/agency/runtime';
import { createStripeClient, sendInvoice } from 'src/gtm/agency/stripe';

// Creates the invoice in Stripe and has Stripe email it the moment its Status
// is set to Approved.
const handler = async (event: DatabaseEventPayload) => {
  const after = (event.properties as { after?: { id?: string; status?: string | null } }).after;
  if (!after?.id || after.status !== 'APPROVED') return { ok: true, skipped: 'Not approved' };
  try {
    const settings = agencySettings();
    const stripe = settings.stripeSecretKey ? createStripeClient(settings.stripeSecretKey) : null;
    return await sendInvoice({ records: agencyRecords(), stripe, settings, invoiceId: after.id });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: SEND_INVOICE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-invoice',
  description: 'Creates an approved invoice in Stripe, which emails the client a payment link',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: { eventName: 'clientInvoice.updated', updatedFields: ['status'] },
});
