import { createHmac, randomBytes } from 'crypto';

// Every warmup email carries a tag so receiving inboxes (and the One Inbox
// view) can recognise and hide it. The tag is signed with a key derived from
// the workspace's MAILBOX_ENCRYPTION_KEY, so it cannot be guessed or forged by
// outsiders, and it starts with a fixed per-workspace prefix so IMAP can search
// for it with a plain substring match.
//
// Shape: <prefix:6><kind:1><nonce:8><sig:6>, lowercase hex after the first char,
// e.g. "x3fa91o5be0c2d1a47c9e". kind is "o" for an original email, "r" for a reply.

export const WARMUP_TAG_HEADER = 'X-Entity-Ref-ID';

export type WarmupTagKind = 'original' | 'reply';

export type DetectedWarmupTag = { tag: string; kind: WarmupTagKind };

const KIND_CHAR: Record<WarmupTagKind, string> = { original: 'o', reply: 'r' };

const hmacHex = (secret: string, data: string): string =>
  createHmac('sha256', secret).update(data).digest('hex');

export const warmupTagPrefix = (secret: string): string =>
  `x${hmacHex(secret, 'pulse-warmup-prefix').slice(0, 5)}`;

export const generateWarmupTag = (
  secret: string,
  kind: WarmupTagKind = 'original',
  nonce: string = randomBytes(4).toString('hex'),
): string => {
  if (!/^[0-9a-f]{8}$/.test(nonce)) throw new Error('Warmup tag nonce must be 8 hex characters');
  const head = `${warmupTagPrefix(secret)}${KIND_CHAR[kind]}${nonce}`;
  return `${head}${hmacHex(secret, head).slice(0, 6)}`;
};

// Verifies one candidate token. Returns null if it is not a valid tag for this workspace.
export const verifyWarmupTag = (secret: string, token: string): DetectedWarmupTag | null => {
  const prefix = warmupTagPrefix(secret);
  const match = new RegExp(`^${prefix}([or])([0-9a-f]{8})([0-9a-f]{6})$`).exec(token.trim().toLowerCase());
  if (!match) return null;
  const head = `${prefix}${match[1]}${match[2]}`;
  if (hmacHex(secret, head).slice(0, 6) !== match[3]) return null;
  return { tag: `${head}${match[3]}`, kind: match[1] === 'r' ? 'reply' : 'original' };
};

// Finds a valid tag in a message's headers or text. Header lookup is case-insensitive.
export const detectWarmupTag = (
  secret: string,
  message: { headers?: Record<string, string | string[] | undefined> | null; text?: string | null },
): DetectedWarmupTag | null => {
  const wanted = WARMUP_TAG_HEADER.toLowerCase();
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (name.toLowerCase() !== wanted || value === undefined) continue;
    for (const candidate of Array.isArray(value) ? value : [value]) {
      const found = verifyWarmupTag(secret, candidate);
      if (found) return found;
    }
  }

  if (message.text) {
    const prefix = warmupTagPrefix(secret);
    const pattern = new RegExp(`${prefix}[or][0-9a-f]{14}`, 'gi');
    for (const candidate of message.text.match(pattern) ?? []) {
      const found = verifyWarmupTag(secret, candidate);
      if (found) return found;
    }
  }

  return null;
};

// Convenience for other areas (One Inbox, sequences) to drop warmup mail.
export const isWarmupMessage = (
  secret: string,
  message: { headers?: Record<string, string | string[] | undefined> | null; text?: string | null },
): boolean => detectWarmupTag(secret, message) !== null;

// The footer line placed in the body so the tag survives providers or sync
// layers that drop custom headers.
export const warmupTagFooter = (tag: string): string => `Ref: ${tag}`;
