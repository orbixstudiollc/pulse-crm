import { defineObject } from 'twenty-sdk/define';

import * as A from 'src/constants/agency-ids';
import { bool, longText, number, select, text } from 'src/gtm/agency/field-builders';
import { SERVICE_CATEGORIES } from 'src/gtm/agency/values';
import { oneToMany } from 'src/gtm/sequences/relation-fields';

// What Orbix sells, with prices. Proposals are priced from this catalog (the
// AI never invents prices), won deals get their task checklist from it, and
// "Next service" is what renewals and upsells suggest.
export default defineObject({
  universalIdentifier: A.SERVICE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'agencyService',
  namePlural: 'agencyServices',
  labelSingular: 'Service',
  labelPlural: 'Services',
  description: 'Service catalog with prices, deliverables and the kickoff checklist',
  icon: 'IconBriefcase',
  labelIdentifierFieldMetadataUniversalIdentifier: A.SERVICE_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    text(A.SERVICE_NAME_UNIVERSAL_IDENTIFIER, 'name', 'Name', 'IconBriefcase'),
    select(A.SERVICE_CATEGORY_UNIVERSAL_IDENTIFIER, 'category', 'Category', 'IconTag', SERVICE_CATEGORIES),
    longText(A.SERVICE_DESCRIPTION_UNIVERSAL_IDENTIFIER, 'description', 'Description', 'IconAlignLeft', 4),
    number(A.SERVICE_PRICE_FROM_UNIVERSAL_IDENTIFIER, 'priceFrom', 'Price from', 'IconCurrencyDollar', { description: 'Lowest price, in the CURRENCY app variable' }),
    number(A.SERVICE_PRICE_TO_UNIVERSAL_IDENTIFIER, 'priceTo', 'Price to', 'IconCurrencyDollar', { description: 'Highest price; leave empty for a fixed price' }),
    number(A.SERVICE_DELIVERY_WEEKS_UNIVERSAL_IDENTIFIER, 'deliveryWeeks', 'Delivery (weeks)', 'IconClock'),
    longText(A.SERVICE_DELIVERABLES_UNIVERSAL_IDENTIFIER, 'deliverables', 'Deliverables', 'IconList', 6),
    longText(A.SERVICE_TASK_CHECKLIST_UNIVERSAL_IDENTIFIER, 'taskChecklist', 'Kickoff checklist', 'IconChecklist', 8, {
      description: 'One task per line. Optional "+N" at the end sets the due day after kickoff, e.g. "Moodboard +5".',
    }),
    text(A.SERVICE_NEXT_SERVICE_UNIVERSAL_IDENTIFIER, 'nextService', 'Next service', 'IconArrowRight', {
      description: 'Name of the service to suggest after this one (upsell)',
    }),
    bool(A.SERVICE_IS_ACTIVE_UNIVERSAL_IDENTIFIER, 'isActive', 'Active', 'IconCheck', true),
    oneToMany({
      universalIdentifier: A.SERVICE_PROJECTS_UNIVERSAL_IDENTIFIER,
      name: 'projects',
      label: 'Projects',
      icon: 'IconFolder',
      targetObject: A.PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
      targetField: A.PROJECT_SERVICE_UNIVERSAL_IDENTIFIER,
    }),
  ],
});
