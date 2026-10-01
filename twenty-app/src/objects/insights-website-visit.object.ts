import { defineObject, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  PERSON_WEBSITE_VISITS_FIELD_ID,
  WEBSITE_VISIT_OBJECT_ID,
  WV_COMPANY_DOMAIN_FIELD_ID,
  WV_FIRST_VISITED_AT_FIELD_ID,
  WV_PAGE_VIEWS_FIELD_ID,
  WV_PERSON_FIELD_ID,
  WV_REFERRER_FIELD_ID,
  WV_URL_FIELD_ID,
  WV_UTM_CAMPAIGN_FIELD_ID,
  WV_UTM_CONTENT_FIELD_ID,
  WV_UTM_MEDIUM_FIELD_ID,
  WV_UTM_SOURCE_FIELD_ID,
  WV_UTM_TERM_FIELD_ID,
  WV_VISITED_AT_FIELD_ID,
  WV_VISITOR_ID_FIELD_ID,
} from 'src/constants/insights-ids';

// One record per website visitor (keyed by the snippet's visitorId). The
// `track` route upserts it: latest page and visit time move on, UTM fields
// keep the first touch, and a known email links the visitor to a Person.

const text = (universalIdentifier: string, name: string, label: string, icon: string) => ({
  universalIdentifier,
  type: FieldType.TEXT as const,
  name,
  label,
  icon,
});

export default defineObject({
  universalIdentifier: WEBSITE_VISIT_OBJECT_ID,
  nameSingular: 'websiteVisit',
  namePlural: 'websiteVisits',
  labelSingular: 'Website visit',
  labelPlural: 'Website visits',
  description: 'Visitors seen by the Pulse tracking snippet',
  icon: 'IconWorldWww',
  labelIdentifierFieldMetadataUniversalIdentifier: WV_VISITOR_ID_FIELD_ID,
  fields: [
    text(WV_VISITOR_ID_FIELD_ID, 'visitorId', 'Visitor', 'IconFingerprint'),
    text(WV_URL_FIELD_ID, 'url', 'Last page', 'IconLink'),
    text(WV_REFERRER_FIELD_ID, 'referrer', 'Referrer', 'IconArrowBackUp'),
    text(WV_UTM_SOURCE_FIELD_ID, 'utmSource', 'UTM source', 'IconSpeakerphone'),
    text(WV_UTM_MEDIUM_FIELD_ID, 'utmMedium', 'UTM medium', 'IconSpeakerphone'),
    text(WV_UTM_CAMPAIGN_FIELD_ID, 'utmCampaign', 'UTM campaign', 'IconSpeakerphone'),
    text(WV_UTM_TERM_FIELD_ID, 'utmTerm', 'UTM term', 'IconSpeakerphone'),
    text(WV_UTM_CONTENT_FIELD_ID, 'utmContent', 'UTM content', 'IconSpeakerphone'),
    text(WV_COMPANY_DOMAIN_FIELD_ID, 'companyDomain', 'Company domain', 'IconBuilding'),
    {
      universalIdentifier: WV_VISITED_AT_FIELD_ID,
      type: FieldType.DATE_TIME,
      name: 'visitedAt',
      label: 'Last visit',
      icon: 'IconClock',
    },
    {
      universalIdentifier: WV_FIRST_VISITED_AT_FIELD_ID,
      type: FieldType.DATE_TIME,
      name: 'firstVisitedAt',
      label: 'First visit',
      icon: 'IconClockPlay',
    },
    {
      universalIdentifier: WV_PAGE_VIEWS_FIELD_ID,
      type: FieldType.NUMBER,
      name: 'pageViews',
      label: 'Page views',
      icon: 'IconEye',
      defaultValue: 0,
    },
    {
      universalIdentifier: WV_PERSON_FIELD_ID,
      type: FieldType.RELATION,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier: PERSON_WEBSITE_VISITS_FIELD_ID,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
    },
  ],
});
