import { defineObject, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { dateTime, longText, select, text } from 'src/gtm/agency/field-builders';
import { CLIENT_EMAIL_KINDS, CLIENT_EMAIL_STATUSES } from 'src/gtm/agency/values';
import { manyToOne } from 'src/gtm/sequences/relation-fields';

// Every email Pulse writes to a client (proposal, follow-up, welcome, weekly
// update, reminder, upsell, referral ask). It waits as a Draft; set Status to
// Approved and send-client-email sends it from the CLIENT_EMAIL_FROM account.
export default defineObject({
  universalIdentifier: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'clientEmail',
  namePlural: 'clientEmails',
  labelSingular: 'Client email',
  labelPlural: 'Client emails',
  description: 'Drafted client emails waiting for approval, and what was sent',
  icon: 'IconMailForward',
  labelIdentifierFieldMetadataUniversalIdentifier: A.CLIENT_EMAIL_SUBJECT_UNIVERSAL_IDENTIFIER,
  fields: [
    text(A.CLIENT_EMAIL_SUBJECT_UNIVERSAL_IDENTIFIER, 'subject', 'Subject', 'IconMail'),
    select(A.CLIENT_EMAIL_KIND_UNIVERSAL_IDENTIFIER, 'kind', 'Kind', 'IconTag', CLIENT_EMAIL_KINDS),
    select(A.CLIENT_EMAIL_STATUS_UNIVERSAL_IDENTIFIER, 'status', 'Status', 'IconProgress', CLIENT_EMAIL_STATUSES, 'DRAFT'),
    text(A.CLIENT_EMAIL_TO_UNIVERSAL_IDENTIFIER, 'toEmail', 'To', 'IconAt'),
    longText(A.CLIENT_EMAIL_BODY_UNIVERSAL_IDENTIFIER, 'body', 'Body', 'IconAlignLeft', 14, {
      description: 'Plain text. Edit before approving.',
    }),
    dateTime(A.CLIENT_EMAIL_SENT_AT_UNIVERSAL_IDENTIFIER, 'sentAt', 'Sent', 'IconSend'),
    text(A.CLIENT_EMAIL_ERROR_UNIVERSAL_IDENTIFIER, 'error', 'Error', 'IconAlertTriangle'),
    manyToOne({
      universalIdentifier: A.CLIENT_EMAIL_PERSON_UNIVERSAL_IDENTIFIER,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      targetObject: STANDARD_OBJECT.person.universalIdentifier,
      targetField: A.PERSON_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.CLIENT_EMAIL_PROJECT_UNIVERSAL_IDENTIFIER,
      name: 'project',
      label: 'Project',
      icon: 'IconFolder',
      targetObject: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.PROJECT_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.CLIENT_EMAIL_PROPOSAL_UNIVERSAL_IDENTIFIER,
      name: 'proposal',
      label: 'Proposal',
      icon: 'IconFileText',
      targetObject: A.PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.PROPOSAL_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.CLIENT_EMAIL_INVOICE_UNIVERSAL_IDENTIFIER,
      name: 'invoice',
      label: 'Invoice',
      icon: 'IconReceipt',
      targetObject: A.INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.INVOICE_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
