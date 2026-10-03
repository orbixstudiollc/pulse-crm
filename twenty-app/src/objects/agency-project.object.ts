import { defineObject, STANDARD_OBJECT } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { date, dateTime, number, select, text } from 'src/gtm/agency/field-builders';
import { PROJECT_HEALTHS, PROJECT_STATUSES } from 'src/gtm/agency/values';
import { manyToOne, oneToMany } from 'src/gtm/sequences/relation-fields';

// Client work created when a deal is won. Tasks hang off it (Twenty's task
// targets); weekly updates, health flags, renewals and upsells read it.
export default defineObject({
  universalIdentifier: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'clientProject',
  namePlural: 'clientProjects',
  labelSingular: 'Project',
  labelPlural: 'Projects',
  description: 'Client projects from won deals, with health, updates and renewals',
  icon: 'IconFolder',
  labelIdentifierFieldMetadataUniversalIdentifier: A.PROJECT_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    text(A.PROJECT_NAME_UNIVERSAL_IDENTIFIER, 'name', 'Name', 'IconFolder'),
    select(A.PROJECT_STATUS_UNIVERSAL_IDENTIFIER, 'status', 'Status', 'IconProgress', PROJECT_STATUSES, 'KICKOFF'),
    select(A.PROJECT_HEALTH_UNIVERSAL_IDENTIFIER, 'health', 'Health', 'IconHeartbeat', PROJECT_HEALTHS, 'ON_TRACK'),
    date(A.PROJECT_START_DATE_UNIVERSAL_IDENTIFIER, 'startDate', 'Start', 'IconCalendar'),
    date(A.PROJECT_DUE_DATE_UNIVERSAL_IDENTIFIER, 'dueDate', 'Due', 'IconCalendarDue'),
    dateTime(A.PROJECT_DELIVERED_AT_UNIVERSAL_IDENTIFIER, 'deliveredAt', 'Delivered', 'IconCircleCheck'),
    number(A.PROJECT_VALUE_UNIVERSAL_IDENTIFIER, 'value', 'Value', 'IconCurrencyDollar'),
    date(A.PROJECT_RENEWAL_DATE_UNIVERSAL_IDENTIFIER, 'renewalDate', 'Renewal date', 'IconRefresh', {
      description: 'For retainers: a renewal email is drafted 14 days before',
    }),
    dateTime(A.PROJECT_LAST_CLIENT_UPDATE_AT_UNIVERSAL_IDENTIFIER, 'lastClientUpdateAt', 'Last update sent', 'IconSend'),
    dateTime(A.PROJECT_LAST_CLIENT_CONTACT_AT_UNIVERSAL_IDENTIFIER, 'lastClientContactAt', 'Last heard from client', 'IconMessage'),
    dateTime(A.PROJECT_UPSELL_SENT_AT_UNIVERSAL_IDENTIFIER, 'upsellDraftedAt', 'Upsell drafted', 'IconArrowUpRight'),
    dateTime(A.PROJECT_REFERRAL_ASKED_AT_UNIVERSAL_IDENTIFIER, 'referralDraftedAt', 'Referral ask drafted', 'IconUsers'),
    manyToOne({
      universalIdentifier: A.PROJECT_COMPANY_UNIVERSAL_IDENTIFIER,
      name: 'company',
      label: 'Client',
      icon: 'IconBuildingSkyscraper',
      targetObject: STANDARD_OBJECT.company.universalIdentifier,
      targetField: A.COMPANY_PROJECTS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.PROJECT_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
      name: 'opportunity',
      label: 'Deal',
      icon: 'IconTargetArrow',
      targetObject: STANDARD_OBJECT.opportunity.universalIdentifier,
      targetField: A.OPPORTUNITY_PROJECTS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.PROJECT_PERSON_UNIVERSAL_IDENTIFIER,
      name: 'person',
      label: 'Client contact',
      icon: 'IconUser',
      targetObject: STANDARD_OBJECT.person.universalIdentifier,
      targetField: A.PERSON_PROJECTS_UNIVERSAL_IDENTIFIER,
    }),
    manyToOne({
      universalIdentifier: A.PROJECT_SERVICE_UNIVERSAL_IDENTIFIER,
      name: 'service',
      label: 'Service',
      icon: 'IconBriefcase',
      targetObject: A.SERVICE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.SERVICE_PROJECTS_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: A.PROJECT_INVOICES_UNIVERSAL_IDENTIFIER,
      name: 'invoices',
      label: 'Invoices',
      icon: 'IconReceipt',
      targetObject: A.INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.INVOICE_PROJECT_UNIVERSAL_IDENTIFIER,
    }),
    oneToMany({
      universalIdentifier: A.PROJECT_CLIENT_EMAILS_UNIVERSAL_IDENTIFIER,
      name: 'clientEmails',
      label: 'Emails',
      icon: 'IconMail',
      targetObject: A.CLIENT_EMAIL_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.CLIENT_EMAIL_PROJECT_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
