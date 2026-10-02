// Universal identifiers for the Lead Finder area (Prospeo search, enrichment
// and ICP scoring). Kept apart from universal-identifiers.ts to avoid merge
// conflicts with other areas.

export const PROSPEO_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER = '0956d082-4225-404a-b6cc-40c138b1eb44';

// Fields Lead Finder needs for ICP scoring
export const COMPANY_INDUSTRY_UNIVERSAL_IDENTIFIER = 'f996a759-3bb6-4a55-a5af-dd892a891480';
export const COMPANY_HEADCOUNT_RANGE_UNIVERSAL_IDENTIFIER = '404c2c98-1bf2-4036-80dc-42835ebef0ff';
export const PERSON_LOCATION_UNIVERSAL_IDENTIFIER = 'f720ecdf-3243-48d1-b371-2c4ce7e6dff2';

// Logic functions
export const FIND_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER = 'e76778ac-9016-43bc-a6c0-048fa6447102';
export const ENRICH_LEAD_FUNCTION_UNIVERSAL_IDENTIFIER = 'd73a05c9-16ee-4385-a5b4-4ac13df56147';
export const SCORE_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER = 'ff6aa87a-96a9-4e1c-8b48-ac58d964e901';
export const RESCORE_ON_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER = 'c7b00e3d-74e4-47fd-b2aa-4e2faf7484dc';
export const RESCORE_ON_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER = '1338d52f-03e6-4d12-8d8f-eed5fcebfc7d';

// Command menu
export const ENRICH_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER = '5b34ba95-c386-4ba8-b6df-39b2b2fb8077';
export const FIND_LEADS_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER = 'd91ea301-40dd-4e57-8c36-c98df18b239e';
export const ENRICH_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER = 'ad832440-30e2-4316-845d-51901d32d9a1';
export const FIND_LEADS_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER = 'f2de08d7-7094-458c-9594-e899aab1be1f';

// HTTP routes (served under /s/ by Twenty's functions gateway)
export const FIND_LEADS_ROUTE_PATH = '/prospeo/find-leads';
export const ENRICH_LEAD_ROUTE_PATH = '/prospeo/enrich-lead';
export const PROSPEO_CREDITS_ROUTE_PATH = '/prospeo/credits';
export const PROSPEO_CREDITS_FUNCTION_UNIVERSAL_IDENTIFIER = '09da5333-2a94-4866-b1b8-b8a3ac7bd8ec';
