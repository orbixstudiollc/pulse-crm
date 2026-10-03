// Compact builders for the agency objects' scalar fields.

import { FieldType } from 'twenty-sdk/define';

import { toOptions } from 'src/gtm/sequences/values';

type Opts = { description?: string };

export const text = (universalIdentifier: string, name: string, label: string, icon: string, o: Opts = {}) =>
  ({ universalIdentifier, type: FieldType.TEXT as const, name, label, icon, ...o });

export const longText = (universalIdentifier: string, name: string, label: string, icon: string, rows = 8, o: Opts = {}) =>
  ({ universalIdentifier, type: FieldType.TEXT as const, name, label, icon, ...o, universalSettings: { displayedMaxRows: rows } });

export const number = (universalIdentifier: string, name: string, label: string, icon: string, o: Opts & { defaultValue?: number } = {}) =>
  ({ universalIdentifier, type: FieldType.NUMBER as const, name, label, icon, ...o });

export const dateTime = (universalIdentifier: string, name: string, label: string, icon: string, o: Opts = {}) =>
  ({ universalIdentifier, type: FieldType.DATE_TIME as const, name, label, icon, ...o });

export const date = (universalIdentifier: string, name: string, label: string, icon: string, o: Opts = {}) =>
  ({ universalIdentifier, type: FieldType.DATE as const, name, label, icon, ...o });

export const bool = (universalIdentifier: string, name: string, label: string, icon: string, defaultValue: boolean) =>
  ({ universalIdentifier, type: FieldType.BOOLEAN as const, name, label, icon, defaultValue });

export const select = <T extends { label: string; value: string; color: string }>(
  universalIdentifier: string,
  name: string,
  label: string,
  icon: string,
  values: readonly T[],
  defaultValue?: T['value'],
) => ({
  universalIdentifier,
  type: FieldType.SELECT as const,
  name,
  label,
  icon,
  options: toOptions(values),
  ...(defaultValue ? { defaultValue: `'${defaultValue}'` } : {}),
});
