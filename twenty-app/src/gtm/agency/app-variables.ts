import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';

// Per-workspace variables for the agency automations. Spread into
// application-config.ts; read with readAgencySettings.
export const AGENCY_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  CLIENT_EMAIL_FROM: {
    universalIdentifier: A.CLIENT_EMAIL_FROM_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Client email account',
    description: 'Address of the account connected in Settings > Accounts that client emails are sent from, e.g. hello@orbix.studio.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  CLIENT_AUTO_SEND: {
    universalIdentifier: A.CLIENT_AUTO_SEND_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Auto-send client emails',
    description: 'Off (default): proposals, updates and other client emails wait in Client emails for you to approve. On: they are sent as soon as they are written.',
    type: FieldType.SELECT,
    options: [
      { label: 'Off, I approve each one', value: 'off' },
      { label: 'On, send automatically', value: 'on' },
    ],
    isRequired: false,
  },
  INTAKE_FORM_URL: {
    universalIdentifier: A.INTAKE_FORM_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Intake form link',
    description: 'Form new clients fill in after signing (Typeform, Google Form, Tally...). Put in the welcome email.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  STRIPE_SECRET_KEY: {
    universalIdentifier: A.STRIPE_SECRET_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Stripe secret key',
    description: 'sk_live_... or a restricted key with Customers, Invoices and Invoice items write access. Stripe emails approved invoices with a payment link.',
    isSecret: true,
    isRequired: false,
  },
  INVOICE_DUE_DAYS: {
    universalIdentifier: A.INVOICE_DUE_DAYS_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Invoice due (days)',
    description: 'Days the client has to pay. Default 7.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  DEPOSIT_PERCENT: {
    universalIdentifier: A.DEPOSIT_PERCENT_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Deposit (%)',
    description: 'Share of the deal invoiced at kickoff. Default 50; 100 bills it all upfront.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  CURRENCY: {
    universalIdentifier: A.CURRENCY_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Currency',
    description: 'Three-letter code for prices and invoices. Default USD.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  PUBLIC_PAGES_URL: {
    universalIdentifier: A.PUBLIC_PAGES_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Public pages URL',
    description: 'Optional. Base URL of the app\'s public routes, e.g. https://orbix-sales.withtwenty.com. Worked out from the tracking endpoint when empty.',
    type: FieldType.TEXT,
    isRequired: false,
  },
};
