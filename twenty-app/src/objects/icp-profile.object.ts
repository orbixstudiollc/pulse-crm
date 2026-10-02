import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  ICP_DESCRIPTION_UNIVERSAL_IDENTIFIER,
  ICP_HEADCOUNT_UNIVERSAL_IDENTIFIER,
  ICP_INDUSTRIES_UNIVERSAL_IDENTIFIER,
  ICP_IS_ACTIVE_UNIVERSAL_IDENTIFIER,
  ICP_JOB_TITLES_UNIVERSAL_IDENTIFIER,
  ICP_LOCATIONS_UNIVERSAL_IDENTIFIER,
  ICP_NAME_UNIVERSAL_IDENTIFIER,
  ICP_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The ideal customer profile. Lead search and AI scoring read the active ones.
export const HEADCOUNT_RANGES = [
  '1-10', '11-20', '21-50', '51-100', '101-200', '201-500',
  '501-1000', '1001-2000', '2001-5000', '5001-10000', '10000+',
] as const;

export default defineObject({
  universalIdentifier: ICP_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'icpProfile',
  namePlural: 'icpProfiles',
  labelSingular: 'ICP',
  labelPlural: 'ICPs',
  description: 'Who you sell to: titles, industries, locations and company size',
  icon: 'IconTarget',
  labelIdentifierFieldMetadataUniversalIdentifier: ICP_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ICP_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconTarget',
    },
    {
      universalIdentifier: ICP_DESCRIPTION_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      icon: 'IconFileDescription',
    },
    {
      universalIdentifier: ICP_JOB_TITLES_UNIVERSAL_IDENTIFIER,
      type: FieldType.ARRAY,
      name: 'jobTitles',
      label: 'Job titles',
      icon: 'IconBriefcase',
    },
    {
      universalIdentifier: ICP_INDUSTRIES_UNIVERSAL_IDENTIFIER,
      type: FieldType.ARRAY,
      name: 'industries',
      label: 'Industries',
      icon: 'IconBuildingFactory2',
    },
    {
      universalIdentifier: ICP_LOCATIONS_UNIVERSAL_IDENTIFIER,
      type: FieldType.ARRAY,
      name: 'locations',
      label: 'Locations',
      icon: 'IconMap',
    },
    {
      universalIdentifier: ICP_HEADCOUNT_UNIVERSAL_IDENTIFIER,
      type: FieldType.MULTI_SELECT,
      name: 'headcount',
      label: 'Company size',
      icon: 'IconUsers',
      options: HEADCOUNT_RANGES.map((range, position) => ({
        label: range,
        value: `SIZE_${range.replace(/\D+/g, '_').replace(/_$/, '_PLUS')}`,
        position,
      })),
    },
    {
      universalIdentifier: ICP_IS_ACTIVE_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Active',
      icon: 'IconCircleCheck',
      defaultValue: true,
    },
  ],
});
