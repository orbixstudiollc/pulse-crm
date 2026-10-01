import { defineObject, FieldType } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { oneToMany } from 'src/gtm/sequences/relation-fields';
import { TEMPLATE_CATEGORIES, toOptions } from 'src/gtm/sequences/values';

// A reusable email. Subject and body take {{firstName}}, {{company}},
// {{jobTitle}}, {{senderName}}... with optional fallbacks: {{firstName|there}}.
export default defineObject({
  universalIdentifier: ID.EMAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'emailTemplate',
  namePlural: 'emailTemplates',
  labelSingular: 'Template',
  labelPlural: 'Templates',
  description: 'Reusable outreach emails with {{firstName}} style variables',
  icon: 'IconTemplate',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.EMAIL_TEMPLATE_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.EMAIL_TEMPLATE_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconTemplate',
    },
    {
      universalIdentifier: ID.EMAIL_TEMPLATE_SUBJECT_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'subject',
      label: 'Subject',
      icon: 'IconMail',
    },
    {
      universalIdentifier: ID.EMAIL_TEMPLATE_BODY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'body',
      label: 'Body',
      icon: 'IconAlignLeft',
      description: 'Plain text. Variables: {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}, {{city}}, {{website}}, {{senderName}}. Fallback: {{firstName|there}}',
      universalSettings: { displayedMaxRows: 12 },
    },
    {
      universalIdentifier: ID.EMAIL_TEMPLATE_CATEGORY_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'category',
      label: 'Category',
      icon: 'IconTag',
      options: toOptions(TEMPLATE_CATEGORIES),
      defaultValue: "'COLD_OUTREACH'",
    },
    oneToMany({
      universalIdentifier: ID.EMAIL_TEMPLATE_SEQUENCE_STEPS_UNIVERSAL_IDENTIFIER,
      name: 'sequenceSteps',
      label: 'Used in steps',
      icon: 'IconListNumbers',
      targetObject: ID.SEQUENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_STEP_TEMPLATE_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
