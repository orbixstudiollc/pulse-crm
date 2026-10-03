import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import {
  BOOKING_LINK_VARIABLE_UNIVERSAL_IDENTIFIER,
  REPLY_AUTO_SEND_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/replies-ids';

// Per-workspace variables for reply triage. Spread into application-config.ts.
export const REPLIES_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  BOOKING_LINK: {
    universalIdentifier: BOOKING_LINK_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Booking link',
    description:
      'Calendly (or similar) link put in answers to interested replies, e.g. https://calendly.com/you/30min.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  REPLY_AUTO_SEND: {
    universalIdentifier: REPLY_AUTO_SEND_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Auto-send replies',
    description:
      'Off (default): answers are drafted on the Inbox item and a task is created. Interested: the booking-link answer to interested replies is sent from the mailbox that received it.',
    type: FieldType.SELECT,
    options: [
      { label: 'Off, draft only', value: 'off' },
      { label: 'Send to interested replies', value: 'interested' },
    ],
    isRequired: false,
  },
};

export const bookingLinkFrom = (raw: string | undefined): string | null => {
  const t = raw?.trim();
  return t && /^https?:\/\/\S+$/i.test(t) ? t : null;
};
