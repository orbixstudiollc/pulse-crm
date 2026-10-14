import { createSign } from 'crypto';

// Google Workspace domain-wide delegation without the googleapis dependency:
// a service account signs a JWT (RS256) whose `sub` is the user to act as,
// and Google's token endpoint swaps it for a 1-hour access token.
// https://developers.google.com/identity/protocols/oauth2/service-account

export const GMAIL_SCOPE = 'https://mail.google.com/';
export const DIRECTORY_USER_READONLY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export type ServiceAccountKey = {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  clientId: string | null;
};

// Parses the JSON key file downloaded from Google Cloud (accepts the raw JSON
// string or an already-parsed object, as RAW_JSON variables may arrive either way).
export const parseServiceAccountKey = (raw: unknown): ServiceAccountKey => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }
  const key = (value ?? {}) as Record<string, unknown>;
  if (typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be a service account key with client_email and private_key');
  }
  return {
    clientEmail: key.client_email,
    // Keys pasted through env vars sometimes carry literal "\n".
    privateKey: key.private_key.replace(/\\n/g, '\n'),
    tokenUri: typeof key.token_uri === 'string' ? key.token_uri : DEFAULT_TOKEN_URI,
    clientId: typeof key.client_id === 'string' ? key.client_id : null,
  };
};

const base64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

export const buildDelegationJwt = (input: {
  key: ServiceAccountKey;
  subject: string;
  scopes: string[];
  now: Date;
  lifetimeSeconds?: number;
}): string => {
  const iat = Math.floor(input.now.getTime() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: input.key.clientEmail,
    sub: input.subject,
    scope: input.scopes.join(' '),
    aud: input.key.tokenUri,
    iat,
    exp: iat + Math.min(3600, input.lifetimeSeconds ?? 3600),
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(input.key.privateKey);
  return `${unsigned}.${base64url(signature)}`;
};

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export type DelegatedTokenSource = (subject: string, scopes: string[]) => Promise<string>;

// Returns a token source that mints delegated tokens and caches each one
// (per user and scope set) until a minute before it expires.
export const createDelegatedTokenSource = (
  key: ServiceAccountKey,
  options: { fetch?: FetchLike; now?: () => Date; cache?: Map<string, { token: string; expiresAt: number }> } = {},
): DelegatedTokenSource => {
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const now = options.now ?? (() => new Date());
  const cache = options.cache ?? new Map<string, { token: string; expiresAt: number }>();

  return async (subject, scopes) => {
    const cacheKey = `${key.clientEmail}|${subject.toLowerCase()}|${[...scopes].sort().join(' ')}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt - 60_000 > now().getTime()) return cached.token;

    const assertion = buildDelegationJwt({ key, subject, scopes, now: now() });
    const response = await doFetch(key.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(
        `Google refused a delegated token for ${subject} (${response.status}): ${detail}. Check domain-wide delegation for client ${key.clientId ?? key.clientEmail} and these scopes: ${scopes.join(', ')}`,
      );
    }
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('Google token response had no access_token');
    cache.set(cacheKey, { token: body.access_token, expiresAt: now().getTime() + (body.expires_in ?? 3600) * 1000 });
    return body.access_token;
  };
};

// Shared across warm invocations of the same logic function container.
export const sharedTokenCache = new Map<string, { token: string; expiresAt: number }>();
