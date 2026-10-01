// Small builders for the two sides of a Twenty relation, so each object file
// stays readable. Both sides must point at each other's universal identifier.

import { FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

type Common = {
  universalIdentifier: string;
  name: string;
  label: string;
  icon: string;
  description?: string;
  targetObject: string;
  targetField: string;
};

export const manyToOne = ({
  onDelete = OnDeleteAction.SET_NULL,
  ...f
}: Common & { onDelete?: OnDeleteAction }) => ({
  universalIdentifier: f.universalIdentifier,
  type: FieldType.RELATION as const,
  name: f.name,
  label: f.label,
  icon: f.icon,
  description: f.description,
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: f.targetObject,
  relationTargetFieldMetadataUniversalIdentifier: f.targetField,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete,
    joinColumnName: `${f.name}Id`,
  },
});

export const oneToMany = (f: Common) => ({
  universalIdentifier: f.universalIdentifier,
  type: FieldType.RELATION as const,
  name: f.name,
  label: f.label,
  icon: f.icon,
  description: f.description,
  relationTargetObjectMetadataUniversalIdentifier: f.targetObject,
  relationTargetFieldMetadataUniversalIdentifier: f.targetField,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
