import { defineObject, FieldType, OnDeleteAction } from 'twenty-sdk/define';

import * as ID from 'src/constants/sequences-ids';
import { manyToOne } from 'src/gtm/sequences/relation-fields';
import { STEP_TYPES, toOptions } from 'src/gtm/sequences/values';

// One step of a sequence. EMAIL steps send their template; TASK steps create a
// Twenty task on the person (call, LinkedIn touch...). Delay is counted from
// the previous step (or from enrollment for the first step).
export default defineObject({
  universalIdentifier: ID.SEQUENCE_STEP_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'sequenceStep',
  namePlural: 'sequenceSteps',
  labelSingular: 'Sequence step',
  labelPlural: 'Sequence steps',
  description: 'An email or task in a sequence, sent after a delay',
  icon: 'IconListNumbers',
  labelIdentifierFieldMetadataUniversalIdentifier: ID.SEQUENCE_STEP_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ID.SEQUENCE_STEP_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconListNumbers',
    },
    {
      universalIdentifier: ID.SEQUENCE_STEP_ORDER_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'stepOrder',
      label: 'Order',
      icon: 'IconSortAscendingNumbers',
      defaultValue: 1,
    },
    {
      universalIdentifier: ID.SEQUENCE_STEP_DELAY_DAYS_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'delayDays',
      label: 'Delay (days)',
      icon: 'IconClock',
      defaultValue: 0,
    },
    {
      universalIdentifier: ID.SEQUENCE_STEP_TYPE_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'stepType',
      label: 'Type',
      icon: 'IconMail',
      options: toOptions(STEP_TYPES),
      defaultValue: "'EMAIL'",
    },
    {
      universalIdentifier: ID.SEQUENCE_STEP_INSTRUCTIONS_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'instructions',
      label: 'Task instructions',
      icon: 'IconChecklist',
    },
    manyToOne({
      universalIdentifier: ID.SEQUENCE_STEP_SEQUENCE_UNIVERSAL_IDENTIFIER,
      name: 'sequence',
      label: 'Sequence',
      icon: 'IconRepeat',
      targetObject: ID.SEQUENCE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.SEQUENCE_STEPS_UNIVERSAL_IDENTIFIER,
      onDelete: OnDeleteAction.CASCADE,
    }),
    manyToOne({
      universalIdentifier: ID.SEQUENCE_STEP_TEMPLATE_UNIVERSAL_IDENTIFIER,
      name: 'template',
      label: 'Template',
      icon: 'IconTemplate',
      targetObject: ID.EMAIL_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: ID.EMAIL_TEMPLATE_SEQUENCE_STEPS_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
