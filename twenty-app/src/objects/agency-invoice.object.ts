import { defineObject, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { date, dateTime, longText, number, select, text } from 'src/gtm/agency/field-builders';
import { INVOICE_STATUSES } from 'src/gtm/agency/values';
import { manyToOne, oneToMany } from 'src/gtm/sequences/relation-fields';

// A client invoice. Pulse drafts it when a deal is won; set Status to
// Approved and send-invoice creates it in Stripe, which emails the client a
// card payment link. The invoice sync marks it Paid or Overdue from Stripe.
export default defineObject({
  universalIdentifier: A.INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'clientInvoice',
  namePlural: 'clientInvoices',
  labelSingular: 'Invoice',
  labelPlural: 'Invoices',
  description: 'Invoices for client projects, with due dates and reminders',
  icon: 'IconReceipt',
  labelIdentifierFieldMetadataUniversalIdentifier: A.INVOICE_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    text(A.INVOICE_NAME_UNIVERSAL_IDENTIFIER, 'name', 'Invoice', 'IconReceipt'),
    select(A.INVOICE_STATUS_UNIVERSAL_IDENTIFIER, 'status', 'Status', 'IconProgress', INVOICE_STATUSES, 'DRAFT'),
    number(A.INVOICE_AMOUNT_UNIVERSAL_IDENTIFIER, 'amount', 'Amount', 'IconCurrencyDollar'),
    longText(A.INVOICE_LINE_ITEMS_UNIVERSAL_IDENTIFIER, 'lineItems', 'Line items', 'IconList', 6, {
      description: 'One per line: "Description | quantity | rate"',
    }),
    date(A.INVOICE_DUE_DATE_UNIVERSAL_IDENTIFIER, 'dueDate', 'Due', 'IconCalendarDue'),
    dateTime(A.INVOICE_SENT_AT_UNIVERSAL_IDENTIFIER, 'sentAt', 'Sent', 'IconSend'),
    dateTime(A.INVOICE_PAID_AT_UNIVERSAL_IDENTIFIER, 'paidAt', 'Paid', 'IconCash'),
    text(A.INVOICE_STRIPE_ID_UNIVERSAL_IDENTIFIER, 'stripeInvoiceId', 'Stripe invoice', 'IconBrandStripe'),
    text(A.INVOICE_PAYMENT_URL_UNIVERSAL_IDENTIFIER, 'paymentUrl', 'Payment link', 'IconLink'),
    number(A.INVOICE_REMINDERS_SENT_UNIVERSAL_IDENTIFIER, 'remindersDrafted', 'Reminders drafted', 'IconBell', { defaultValue: 0 }),
    manyToOne({
      universalIdentifier: A.INVOICE_COMPANY_UNIVERSAL_IDENTIFIER,
      name: 'company',
      label: 'Client',
      icon: 'IconBuildingSkyscraper',
      targetObject: STANDARD_OBJECT.company.universalIdentifier,
      targetField: A.COMPANY_INVOICES_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.INVOICE_PROJECT_UNIVERSAL_IDENTIFIER,
      name: 'project',
      label: 'Project',
      icon: 'IconFolder',
      targetObject: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.PROJECT_INVOICES_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.INVOICE_PERSON_UNIVERSAL_IDENTIFIER,
      name: 'person',
      label: 'Bill to',
      icon: 'IconUser',
      targetObject: STANDARD_OBJECT.person.universalIdentifier,
      targetField: A.PERSON_INVOICES_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: A.INVOICE_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
      name: 'clientEmails',
      label: 'Emails',
      icon: 'IconMail',
      targetObject: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.CLIENT_EMAIL_INVOICE_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
