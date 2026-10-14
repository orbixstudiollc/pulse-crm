import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Mailbox passwords (SMTP/IMAP app passwords) are never stored in plain text.
// Twenty app variables hold one secret per workspace, not one per record, and
// connection providers only cover OAuth, so per-mailbox passwords are sealed
// with AES-256-GCM under the workspace's MAILBOX_ENCRYPTION_KEY secret and the
// ciphertext goes into mailbox.credentialCiphertext.
//
// Format: "v1.<iv>.<authTag>.<ciphertext>", each part base64url.
// The key variable may be any string; it is stretched with SHA-256. Use at
// least 32 random bytes, e.g. `openssl rand -base64 32`.

export type MailboxSecret = { password: string };

const VERSION = 'v1';

const keyFrom = (keyMaterial: string): Buffer => {
  if (!keyMaterial || keyMaterial.trim().length < 16) {
    throw new Error('MAILBOX_ENCRYPTION_KEY is missing or shorter than 16 characters');
  }
  return createHash('sha256').update(keyMaterial, 'utf8').digest();
};

export const encryptMailboxSecret = (secret: MailboxSecret, keyMaterial: string): string => {
  const key = keyFrom(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
};

export const decryptMailboxSecret = (sealed: string, keyMaterial: string): MailboxSecret => {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Unrecognised mailbox credential format');
  const key = keyFrom(keyMaterial);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(plain) as Partial<MailboxSecret>;
  if (typeof parsed.password !== 'string') throw new Error('Mailbox credential is missing a password');
  return { password: parsed.password };
};

export const isSealedMailboxSecret = (value: string | null | undefined): boolean =>
  typeof value === 'string' && /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(value);

// Derived key for signing warmup tags, so the tag secret is not the raw encryption key.
export const warmupTagSecret = (keyMaterial: string): string =>
  createHash('sha256').update(`pulse-warmup-tag:${keyMaterial}`, 'utf8').digest('hex');
