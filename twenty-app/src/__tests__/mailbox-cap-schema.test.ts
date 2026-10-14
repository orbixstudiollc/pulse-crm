import { describe, expect, it } from 'vitest';

import * as ids from 'src/constants/mailbox-ids';
import mailbox from 'src/objects/mailbox.object';
import healthView from 'src/views/mailbox-health.view';
import mailboxesView from 'src/views/mailboxes.view';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('mailbox cap metadata', () => {
  it('separates the editable owner maximum from read-only computed fields', () => {
    expect(mailbox.success, mailbox.errors.join('; ')).toBe(true);
    const fields = mailbox.config.fields ?? [];
    expect(fields.find((field) => field.name === 'configuredDailySendLimit')).toMatchObject({
      universalIdentifier: ids.MAILBOX_CONFIGURED_DAILY_SEND_LIMIT_UID,
      type: 'NUMBER',
      label: 'Your daily maximum',
      defaultValue: 0,
      isUIEditable: true,
    });
    expect(fields.find((field) => field.name === 'dailySendLimit')).toMatchObject({
      universalIdentifier: ids.MAILBOX_DAILY_SEND_LIMIT_UID,
      type: 'NUMBER',
      label: 'Effective daily cap',
      defaultValue: 0,
      isUIEditable: false,
    });
    expect(fields.find((field) => field.name === 'dailySendLimitReason')).toMatchObject({
      universalIdentifier: ids.MAILBOX_DAILY_SEND_LIMIT_REASON_UID,
      type: 'TEXT',
      isUIEditable: false,
    });
  });

  it.each([
    ['Mailboxes', mailboxesView],
    ['Warmup health', healthView],
  ] as const)('shows owner maximum, effective cap and reason in %s', (_name, view) => {
    expect(view.success, view.errors.join('; ')).toBe(true);
    const fields = view.config.fields ?? [];
    const maximum = fields.find((field) => field.fieldMetadataUniversalIdentifier === ids.MAILBOX_CONFIGURED_DAILY_SEND_LIMIT_UID);
    const effective = fields.find((field) => field.fieldMetadataUniversalIdentifier === ids.MAILBOX_DAILY_SEND_LIMIT_UID);
    const reason = fields.find((field) => field.fieldMetadataUniversalIdentifier === ids.MAILBOX_DAILY_SEND_LIMIT_REASON_UID);

    expect(maximum).toBeDefined();
    expect(effective).toBeDefined();
    expect(reason).toBeDefined();
    expect(maximum!.position).toBeLessThan(effective!.position!);
    expect(effective!.position).toBeLessThan(reason!.position!);
    expect(new Set(fields.map((field) => field.position)).size).toBe(fields.length);
    expect(new Set(fields.map((field) => field.fieldMetadataUniversalIdentifier)).size).toBe(fields.length);
  });

  it('gives new fields and view entries unique UUIDv4 identifiers', () => {
    const newIdentifiers = [
      ids.MAILBOX_CONFIGURED_DAILY_SEND_LIMIT_UID,
      ids.MAILBOX_DAILY_SEND_LIMIT_REASON_UID,
      ids.MAILBOXES_VIEW_F_CONFIGURED_DAILY_LIMIT_UID,
      ids.MAILBOXES_VIEW_F_DAILY_LIMIT_REASON_UID,
      ids.MAILBOX_HEALTH_VIEW_F_CONFIGURED_LIMIT_UID,
      ids.MAILBOX_HEALTH_VIEW_F_LIMIT_REASON_UID,
    ];
    for (const identifier of newIdentifiers) {
      expect(identifier).toMatch(UUID_V4);
      expect(Object.values(ids).filter((value) => value === identifier)).toHaveLength(1);
    }
  });
});
