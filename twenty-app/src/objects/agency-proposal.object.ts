import { defineObject, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { dateTime, longText, number, select, text } from 'src/gtm/agency/field-builders';
import { PROPOSAL_STATUSES } from 'src/gtm/agency/values';
import { manyToOne, oneToMany } from 'src/gtm/sequences/relation-fields';

// A proposal drafted from a deal's discovery-call notes. The client reads and
// accepts it on a public page (publicToken); accepting wins the deal.
export default defineObject({
  universalIdentifier: A.PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'proposal',
  namePlural: 'proposals',
  labelSingular: 'Proposal',
  labelPlural: 'Proposals',
  description: 'Proposals drafted from call notes, with views and follow-ups',
  icon: 'IconFileText',
  labelIdentifierFieldMetadataUniversalIdentifier: A.PROPOSAL_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    text(A.PROPOSAL_NAME_UNIVERSAL_IDENTIFIER, 'name', 'Title', 'IconFileText'),
    select(A.PROPOSAL_STATUS_UNIVERSAL_IDENTIFIER, 'status', 'Status', 'IconProgress', PROPOSAL_STATUSES, 'DRAFT'),
    longText(A.PROPOSAL_SUMMARY_UNIVERSAL_IDENTIFIER, 'summary', 'Summary', 'IconAlignLeft', 3),
    longText(A.PROPOSAL_BODY_UNIVERSAL_IDENTIFIER, 'body', 'Proposal', 'IconFileDescription', 20, {
      description: 'Markdown shown to the client. Edit freely before approving the email.',
    }),
    number(A.PROPOSAL_AMOUNT_UNIVERSAL_IDENTIFIER, 'amount', 'Total', 'IconCurrencyDollar'),
    longText(A.PROPOSAL_SERVICES_UNIVERSAL_IDENTIFIER, 'services', 'Services', 'IconBriefcase', 4, {
      description: 'One per line: "Service name | price"',
    }),
    text(A.PROPOSAL_PUBLIC_TOKEN_UNIVERSAL_IDENTIFIER, 'publicToken', 'Public token', 'IconKey', {
      description: 'Secret part of the client link',
    }),
    dateTime(A.PROPOSAL_SENT_AT_UNIVERSAL_IDENTIFIER, 'sentAt', 'Sent', 'IconSend'),
    dateTime(A.PROPOSAL_VIEWED_AT_UNIVERSAL_IDENTIFIER, 'viewedAt', 'First viewed', 'IconEye'),
    dateTime(A.PROPOSAL_RESPONDED_AT_UNIVERSAL_IDENTIFIER, 'respondedAt', 'Responded', 'IconMessageCheck'),
    number(A.PROPOSAL_FOLLOW_UPS_SENT_UNIVERSAL_IDENTIFIER, 'followUpsSent', 'Follow-ups sent', 'IconRepeat', { defaultValue: 0 }),
    dateTime(A.PROPOSAL_LAST_FOLLOW_UP_AT_UNIVERSAL_IDENTIFIER, 'lastFollowUpAt', 'Last follow-up', 'IconClock'),
    longText(A.PROPOSAL_CLIENT_COMMENT_UNIVERSAL_IDENTIFIER, 'clientComment', 'Client comment', 'IconMessage', 4),
    manyToOne({
      universalIdentifier: A.PROPOSAL_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
      name: 'opportunity',
      label: 'Deal',
      icon: 'IconTargetArrow',
      targetObject: STANDARD_OBJECT.opportunity.universalIdentifier,
      targetField: A.OPPORTUNITY_PROPOSALS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.PROPOSAL_PERSON_UNIVERSAL_IDENTIFIER,
      name: 'person',
      label: 'Client contact',
      icon: 'IconUser',
      targetObject: STANDARD_OBJECT.person.universalIdentifier,
      targetField: A.PERSON_PROPOSALS_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: A.PROPOSAL_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
      name: 'clientEmails',
      label: 'Emails',
      icon: 'IconMail',
      targetObject: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.CLIENT_EMAIL_PROPOSAL_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
