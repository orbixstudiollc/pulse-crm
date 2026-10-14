import { describe, expect, it } from 'vitest';

import {
  decryptMailboxSecret,
  encryptMailboxSecret,
  isSealedMailboxSecret,
  warmupTagSecret,
} from 'src/gtm/mailbox/credentials';
import {
  detectWarmupTag,
  generateWarmupTag,
  isWarmupMessage,
  verifyWarmupTag,
  WARMUP_TAG_HEADER,
  warmupTagFooter,
  warmupTagPrefix,
} from 'src/gtm/mailbox/warmup-tag';

const KEY = 'test-key-0123456789-abcdefghijklmnop';
const secret = warmupTagSecret(KEY);

describe('warmup tag', () => {
  it('generates signed tags with a stable per-workspace prefix', () => {
    const tag = generateWarmupTag(secret, 'original', '0a1b2c3d');
    expect(tag).toMatch(/^x[0-9a-f]{5}o0a1b2c3d[0-9a-f]{6}$/);
    expect(tag.startsWith(warmupTagPrefix(secret))).toBe(true);
    expect(generateWarmupTag(secret, 'original', '0a1b2c3d')).toBe(tag);
    expect(warmupTagPrefix(warmupTagSecret('another-key-0123456789'))).not.toBe(warmupTagPrefix(secret));
  });

  it('verifies kind and rejects forged or foreign tags', () => {
    const reply = generateWarmupTag(secret, 'reply');
    expect(verifyWarmupTag(secret, reply)).toEqual({ tag: reply, kind: 'reply' });
    const forged = `${reply.slice(0, -1)}${reply.endsWith('0') ? '1' : '0'}`;
    expect(verifyWarmupTag(secret, forged)).toBeNull();
    expect(verifyWarmupTag(warmupTagSecret('another-key-0123456789'), reply)).toBeNull();
    expect(() => generateWarmupTag(secret, 'original', 'xyz')).toThrow();
  });

  it('detects tags in headers (any case) or in the body footer', () => {
    const tag = generateWarmupTag(secret);
    expect(detectWarmupTag(secret, { headers: { [WARMUP_TAG_HEADER.toLowerCase()]: tag } })?.tag).toBe(tag);
    expect(detectWarmupTag(secret, { headers: { 'X-ENTITY-REF-ID': [tag] } })?.kind).toBe('original');
    expect(detectWarmupTag(secret, { text: `Thanks,\nAnn\n\n${warmupTagFooter(tag)}` })?.tag).toBe(tag);
    expect(isWarmupMessage(secret, { text: 'Hello, regular email', headers: {} })).toBe(false);
    expect(isWarmupMessage(secret, { headers: { 'x-entity-ref-id': 'abc' } })).toBe(false);
  });
});

describe('mailbox credentials', () => {
  it('round-trips and never contains the plain password', () => {
    const sealed = encryptMailboxSecret({ password: 'hunter2-app-pass' }, KEY);
    expect(isSealedMailboxSecret(sealed)).toBe(true);
    expect(sealed).not.toContain('hunter2');
    expect(decryptMailboxSecret(sealed, KEY)).toEqual({ password: 'hunter2-app-pass' });
    expect(encryptMailboxSecret({ password: 'hunter2-app-pass' }, KEY)).not.toBe(sealed);
  });

  it('fails on a wrong key, tampering or a short key', () => {
    const sealed = encryptMailboxSecret({ password: 'pw' }, KEY);
    expect(() => decryptMailboxSecret(sealed, 'some-other-key-0123456789')).toThrow();
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptMailboxSecret(parts.join('.'), KEY)).toThrow();
    expect(() => decryptMailboxSecret('plaintext', KEY)).toThrow(/format/);
    expect(() => encryptMailboxSecret({ password: 'pw' }, 'short')).toThrow(/MAILBOX_ENCRYPTION_KEY/);
  });
});
