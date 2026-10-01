import { defineView, ViewSortDirection, ViewType } from 'twenty-sdk/define';

import {
  WEBSITE_VISITS_VIEW_ID,
  WEBSITE_VISIT_OBJECT_ID,
  WV_COMPANY_DOMAIN_FIELD_ID,
  WV_PAGE_VIEWS_FIELD_ID,
  WV_PERSON_FIELD_ID,
  WV_REFERRER_FIELD_ID,
  WV_URL_FIELD_ID,
  WV_UTM_CAMPAIGN_FIELD_ID,
  WV_UTM_SOURCE_FIELD_ID,
  WV_VIEW_F_CAMPAIGN_ID,
  WV_VIEW_F_DOMAIN_ID,
  WV_VIEW_F_PAGE_VIEWS_ID,
  WV_VIEW_F_PERSON_ID,
  WV_VIEW_F_REFERRER_ID,
  WV_VIEW_F_SOURCE_ID,
  WV_VIEW_F_URL_ID,
  WV_VIEW_F_VISITED_AT_ID,
  WV_VIEW_F_VISITOR_ID,
  WV_VIEW_SORT_ID,
  WV_VISITED_AT_FIELD_ID,
  WV_VISITOR_ID_FIELD_ID,
} from 'src/constants/insights-ids';

// Most recent visitors first.
export default defineView({
  universalIdentifier: WEBSITE_VISITS_VIEW_ID,
  name: 'Website Visitors',
  objectUniversalIdentifier: WEBSITE_VISIT_OBJECT_ID,
  type: ViewType.TABLE,
  icon: 'IconWorldWww',
  position: 0,
  fields: [
    { universalIdentifier: WV_VIEW_F_VISITOR_ID, fieldMetadataUniversalIdentifier: WV_VISITOR_ID_FIELD_ID, position: 0, size: 160 },
    { universalIdentifier: WV_VIEW_F_PERSON_ID, fieldMetadataUniversalIdentifier: WV_PERSON_FIELD_ID, position: 1, size: 160 },
    { universalIdentifier: WV_VIEW_F_DOMAIN_ID, fieldMetadataUniversalIdentifier: WV_COMPANY_DOMAIN_FIELD_ID, position: 2, size: 150 },
    { universalIdentifier: WV_VIEW_F_URL_ID, fieldMetadataUniversalIdentifier: WV_URL_FIELD_ID, position: 3, size: 240 },
    { universalIdentifier: WV_VIEW_F_PAGE_VIEWS_ID, fieldMetadataUniversalIdentifier: WV_PAGE_VIEWS_FIELD_ID, position: 4, size: 100 },
    { universalIdentifier: WV_VIEW_F_SOURCE_ID, fieldMetadataUniversalIdentifier: WV_UTM_SOURCE_FIELD_ID, position: 5, size: 120 },
    { universalIdentifier: WV_VIEW_F_CAMPAIGN_ID, fieldMetadataUniversalIdentifier: WV_UTM_CAMPAIGN_FIELD_ID, position: 6, size: 140 },
    { universalIdentifier: WV_VIEW_F_REFERRER_ID, fieldMetadataUniversalIdentifier: WV_REFERRER_FIELD_ID, position: 7, size: 200 },
    { universalIdentifier: WV_VIEW_F_VISITED_AT_ID, fieldMetadataUniversalIdentifier: WV_VISITED_AT_FIELD_ID, position: 8, size: 150 },
  ],
  sorts: [
    {
      universalIdentifier: WV_VIEW_SORT_ID,
      fieldMetadataUniversalIdentifier: WV_VISITED_AT_FIELD_ID,
      direction: ViewSortDirection.DESC,
    },
  ],
});
