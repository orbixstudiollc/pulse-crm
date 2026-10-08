// Universal identifiers for lead qualification (import, website research,
// company and title classification, the 85% gates, enrollment). Kept apart
// from the other id files so parallel branches do not conflict.

// Person fields the app owns. The classification fields themselves
// (agencyClassification, titleConfidence, emailVerificationStatus, ...) were
// created in the workspace and are read and written by name.
export const PERSON_QUALIFICATION_STATUS_UNIVERSAL_IDENTIFIER = '805772de-868f-4baa-842b-6e97558ce30c';
export const PERSON_QUALIFICATION_NOTES_UNIVERSAL_IDENTIFIER = 'b5991897-9c8e-49dc-ac3b-713ffdb77841';

// Logic functions
export const IMPORT_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER = 'd08e5674-2ba2-471c-9915-5c8caa93be43';
export const QUALIFY_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER = '3e529d47-75f0-47da-b090-9423ad57688a';
export const ENROLL_QUALIFIED_FUNCTION_UNIVERSAL_IDENTIFIER = 'd9835bc4-9ac0-460b-93d8-2566a3f2d94d';
export const QUALIFICATION_STATUS_FUNCTION_UNIVERSAL_IDENTIFIER = '3a05c6fb-967c-4896-b08f-b2c571a7bd46';

// Twenty AI agent used when AI_PROVIDER is twenty
export const LEAD_QUALIFIER_AGENT_UNIVERSAL_IDENTIFIER = '3b02c504-6027-49f8-9dfa-ea220bbef3f9';

// App variables
export const FIRECRAWL_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER = '819ebe8c-5ddf-4c35-9221-6c49f251abe3';
export const SPIDER_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER = '46de15b3-e5df-4631-88f3-68f7e1a3b5f9';
export const OPENROUTER_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER = 'df59e7de-5e97-43d1-89cc-55e23ad10758';
export const JEV_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER = '0be2fe3e-65c8-417b-a6d0-ee8cd951a4c1';
export const QUALIFY_REVIEW_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER = '093ed55b-8f7a-4cc5-8ffd-7b87a79c3931';
export const QUALIFY_THRESHOLD_VARIABLE_UNIVERSAL_IDENTIFIER = '0f69ffd7-55c5-46cd-9525-2e73154711ee';
export const QUALIFY_DAILY_VERIFICATIONS_VARIABLE_UNIVERSAL_IDENTIFIER = 'e59c2ccd-aa7f-42f8-806b-fb896944bb94';

// Lead review view and its sidebar link
export const LEAD_REVIEW_VIEW_UNIVERSAL_IDENTIFIER = '4bd45239-b46c-4ffa-b540-4fbbb4f5959a';
export const LEAD_REVIEW_VIEW_FILTER_UNIVERSAL_IDENTIFIER = 'e234e354-5a04-40d6-8667-4cabdd2fbcf7';
export const LEAD_REVIEW_VIEW_SORT_UNIVERSAL_IDENTIFIER = '8d45ccaf-a962-4f68-b7d7-1cce4918124f';
export const LEAD_REVIEW_VIEW_F_NAME_UNIVERSAL_IDENTIFIER = 'a88d90e5-5529-464f-b46e-6bc6ce399d53';
export const LEAD_REVIEW_VIEW_F_STATUS_UNIVERSAL_IDENTIFIER = '79c6d449-7dfe-49dc-af0f-7c4f4b6cf5d2';
export const LEAD_REVIEW_VIEW_F_SCORE_UNIVERSAL_IDENTIFIER = '6c0b72fb-acf3-44d7-88d5-3b98e941e357';
export const LEAD_REVIEW_VIEW_F_NOTES_UNIVERSAL_IDENTIFIER = 'c91185a7-e137-4046-b3a8-6c76d967f232';
export const LEAD_REVIEW_VIEW_F_TITLE_UNIVERSAL_IDENTIFIER = '03cdd034-c5dc-41c0-b8e3-ef80709a9f71';
export const LEAD_REVIEW_VIEW_F_COMPANY_UNIVERSAL_IDENTIFIER = 'f957ef84-01ad-40b9-aeb9-fb533e231333';
export const LEAD_REVIEW_VIEW_F_EMAILS_UNIVERSAL_IDENTIFIER = '9b84a330-124e-4c07-b77b-c54791d01e2c';
export const LEAD_REVIEW_VIEW_F_SUMMARY_UNIVERSAL_IDENTIFIER = '8e139706-8d76-46ea-8dd3-1c45bd06e705';
export const LEAD_REVIEW_NAV_UNIVERSAL_IDENTIFIER = 'b9e9aff2-7c81-4fba-9b66-35c87007a96d';

// HTTP routes (served under /s/ by Twenty's functions gateway)
export const IMPORT_LEADS_ROUTE_PATH = '/qualify/import';
export const QUALIFY_LEADS_ROUTE_PATH = '/qualify/run';
export const ENROLL_QUALIFIED_ROUTE_PATH = '/qualify/enroll';
export const QUALIFICATION_STATUS_ROUTE_PATH = '/qualify/status';
