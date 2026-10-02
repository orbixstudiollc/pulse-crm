import { createVerify, generateKeyPairSync } from 'crypto';
import { describe, expect, it } from 'vitest';

import { effectiveAuthType, resolveMailboxAuth } from 'src/gtm/mailbox/auth';
import {
  dedupeNewMailboxes,
  filterWorkspaceUsers,
  mailboxInputFromDirectoryUser,
  parseMailboxCsv,
  type DirectoryUser,
} from 'src/gtm/mailbox/bulk-import';
import { decryptMailboxSecret, encryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import {
  buildDelegationJwt,
  createDelegatedTokenSource,
  DIRECTORY_USER_READONLY_SCOPE,
  GMAIL_SCOPE,
  parseServiceAccountKey,
} from 'src/gtm/mailbox/google-delegation';
import { listWorkspaceUsers } from 'src/gtm/mailbox/google-directory';
import { providerFromMxHosts } from 'src/gtm/mailbox/server-settings';
import { importCsvMailboxes, importWorkspaceMailboxes } from 'src/gtm/mailbox/import-runner';
import { hasCredential } from 'src/gtm/mailbox/server-settings';
import type { ExistingMailbox, MailboxImportStore } from 'src/gtm/mailbox/twenty-repository';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const keyJson = JSON.stringify({
  type: 'service_account',
  client_email: 'warmup@proj.iam.gserviceaccount.com',
  client_id: '1234567890',
  private_key: pem.replace(/\n/g, '\\n'),
  token_uri: 'https://oauth2.googleapis.com/token',
});

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('Google domain-wide delegation', () => {
  const key = parseServiceAccountKey(keyJson);

  it('parses the key file, including escaped newlines', () => {
    expect(key.clientEmail).toBe('warmup@proj.iam.gserviceaccount.com');
    expect(key.privateKey).toContain('-----BEGIN PRIVATE KEY-----\n');
    expect(key.clientId).toBe('1234567890');
    expect(() => parseServiceAccountKey('{nope')).toThrow(/not valid JSON/);
    expect(() => parseServiceAccountKey({ client_email: 'x' })).toThrow(/private_key/);
  });

  it('builds an RS256 JWT with sub, scope, aud and a 1-hour expiry', () => {
    const now = new Date('2026-10-01T10:00:00Z');
    const jwt = buildDelegationJwt({ key, subject: 'ann@acme-mail.com', scopes: [GMAIL_SCOPE], now });
    const [header, claims, signature] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(claims)).toEqual({
      iss: 'warmup@proj.iam.gserviceaccount.com',
      sub: 'ann@acme-mail.com',
      scope: 'https://mail.google.com/',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1790848800,
      exp: 1790852400,
    });
    expect(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('exchanges the JWT for a token and caches it until shortly before expiry', async () => {
    let clock = new Date('2026-10-01T10:00:00Z');
    const calls: { url: string; body: string }[] = [];
    const tokens = createDelegatedTokenSource(key, {
      now: () => clock,
      fetch: async (url, init) => {
        calls.push({ url, body: init.body });
        return { ok: true, status: 200, json: async () => ({ access_token: `tok${calls.length}`, expires_in: 3600 }), text: async () => '' };
      },
    });
    expect(await tokens('ann@acme-mail.com', [GMAIL_SCOPE])).toBe('tok1');
    expect(await tokens('ANN@acme-mail.com', [GMAIL_SCOPE])).toBe('tok1');
    expect(await tokens('bob@acme-mail.com', [GMAIL_SCOPE])).toBe('tok2');
    const body = new URLSearchParams(calls[0].body);
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(decode(body.get('assertion')!.split('.')[1]).sub).toBe('ann@acme-mail.com');
    clock = new Date('2026-10-01T10:59:30Z');
    expect(await tokens('ann@acme-mail.com', [GMAIL_SCOPE])).toBe('tok3');
  });

  it('explains a refused delegation', async () => {
    const tokens = createDelegatedTokenSource(key, {
      fetch: async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => '{"error":"unauthorized_client"}' }),
    });
    await expect(tokens('ann@acme-mail.com', [GMAIL_SCOPE])).rejects.toThrow(/unauthorized_client.*1234567890/);
  });

  it('signs delegated mailboxes in with XOAUTH2 and needs no stored secret', async () => {
    const box = { email: 'ann@acme-mail.com', username: null, credentialCiphertext: null, connectionId: null, authType: 'GOOGLE_DELEGATED' as const };
    expect(effectiveAuthType(box)).toBe('GOOGLE_DELEGATED');
    expect(hasCredential(box)).toBe(true);
    expect(await resolveMailboxAuth(box, { encryptionKey: undefined, getDelegatedToken: async (e) => `t-${e}` })).toEqual({
      type: 'oauth',
      user: 'ann@acme-mail.com',
      accessToken: 't-ann@acme-mail.com',
    });
    await expect(resolveMailboxAuth(box, { encryptionKey: undefined })).rejects.toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON/);
  });

  it('pages through the Directory API', async () => {
    const urls: string[] = [];
    const users = await listWorkspaceUsers('admin-token', {
      domain: 'acme-mail.com',
      fetch: async (url, init) => {
        urls.push(url);
        expect(init.headers.Authorization).toBe('Bearer admin-token');
        const first = !url.includes('pageToken');
        return {
          ok: true,
          status: 200,
          json: async () => (first ? { users: [{ primaryEmail: 'a@acme-mail.com' }], nextPageToken: 'p2' } : { users: [{ primaryEmail: 'b@acme-mail.com' }] }),
          text: async () => '',
        };
      },
    });
    expect(users.map((u) => u.primaryEmail)).toEqual(['a@acme-mail.com', 'b@acme-mail.com']);
    expect(urls[0]).toContain('domain=acme-mail.com');
    expect(urls[1]).toContain('pageToken=p2');
    expect(DIRECTORY_USER_READONLY_SCOPE).toContain('admin.directory.user.readonly');
  });
});

describe('workspace user filtering and dedupe', () => {
  const users: DirectoryUser[] = [
    { primaryEmail: 'Ann@acme-mail.com', name: { fullName: 'Ann Lee' }, orgUnitPath: '/Sales' },
    { primaryEmail: 'bob@acme-mail.com', orgUnitPath: '/Sales/EMEA' },
    { primaryEmail: 'cat@acme-mail.com', orgUnitPath: '/Ops' },
    { primaryEmail: 'dan@other-mail.com', orgUnitPath: '/Sales' },
    { primaryEmail: 'old@acme-mail.com', orgUnitPath: '/Sales', suspended: true },
    { primaryEmail: 'arc@acme-mail.com', orgUnitPath: '/Sales', archived: true },
  ];
  const emails = (list: DirectoryUser[]) => list.map((u) => u.primaryEmail.toLowerCase());

  it('drops suspended/archived users and applies domain, OU and email filters', () => {
    expect(emails(filterWorkspaceUsers(users))).toEqual(['ann@acme-mail.com', 'bob@acme-mail.com', 'cat@acme-mail.com', 'dan@other-mail.com']);
    expect(emails(filterWorkspaceUsers(users, { domain: '@acme-mail.com' }))).toHaveLength(3);
    expect(emails(filterWorkspaceUsers(users, { orgUnitPath: '/Sales/' }))).toEqual(['ann@acme-mail.com', 'bob@acme-mail.com', 'dan@other-mail.com']);
    expect(emails(filterWorkspaceUsers(users, { emails: ['CAT@acme-mail.com'] }))).toEqual(['cat@acme-mail.com']);
  });

  it('maps users to delegated, warming mailboxes', () => {
    expect(mailboxInputFromDirectoryUser(users[0])).toMatchObject({
      email: 'ann@acme-mail.com',
      displayName: 'Ann Lee',
      provider: 'GOOGLE',
      authType: 'GOOGLE_DELEGATED',
      status: 'WARMING',
      warmupEnabled: true,
    });
  });

  it('skips existing mailboxes and repeats, case-insensitively', () => {
    const result = dedupeNewMailboxes(
      [{ email: 'A@x.io' }, { email: 'b@x.io' }, { email: 'a@X.io' }, { email: 'C@x.io' }],
      ['c@x.io'],
    );
    expect(result.fresh.map((m) => m.email)).toEqual(['a@x.io', 'b@x.io']);
    expect(result.skippedDuplicate).toEqual(['a@x.io']);
    expect(result.skippedExisting).toEqual(['c@x.io']);
  });
});

describe('CSV paste', () => {
  it('parses positional rows with quotes, comments and Google app-password spacing', () => {
    const { rows, errors } = parseMailboxCsv(
      [
        '# my senders',
        'ann@gmail.com, abcd efgh ijkl mnop, Ann Lee',
        '"bob@outlook.com","p,w""1","Lee, Bob"',
        '',
        'not-an-email,pw,X',
        'cat@gmail.com,,Cat',
      ].join('\n'),
    );
    expect(rows).toEqual([
      expect.objectContaining({ line: 2, email: 'ann@gmail.com', password: 'abcdefghijklmnop', displayName: 'Ann Lee', provider: 'GOOGLE' }),
      expect.objectContaining({ line: 3, email: 'bob@outlook.com', password: 'p,w"1', displayName: 'Lee, Bob', provider: 'MICROSOFT' }),
    ]);
    expect(errors.map((e) => e.line)).toEqual([5, 6]);
  });

  it('reads a header row in any order, tabs, and custom hosts', () => {
    const { rows, errors } = parseMailboxCsv(
      'App Password\tEmail\tProvider\tSMTP host\tSMTP port\tIMAP host\nsecret\tme@custom.io\tother\tmail.custom.io\t465\tmail.custom.io\n',
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ email: 'me@custom.io', password: 'secret', provider: 'OTHER', smtpHost: 'mail.custom.io', smtpPort: 465, imapHost: 'mail.custom.io', imapPort: null });
  });

  it('skips lone domain headings and joins first and last name', () => {
    const { rows, errors } = parseMailboxCsv(
      'acme.com\t\nEmail\tPassword\tFirst name\tLast name\tProvider\nann@acme.com\tpw\tAnn\tLee\tgoogle\n\t\nbeta.io\t\nbob@beta.io\tpw2\t\t\tgoogle\n',
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.email, r.displayName, r.provider])).toEqual([
      ['ann@acme.com', 'Ann Lee', 'GOOGLE'],
      ['bob@beta.io', null, 'GOOGLE'],
    ]);
  });
});

describe('provider from MX', () => {
  it('spots Google Workspace and Microsoft 365', () => {
    expect(providerFromMxHosts(['smtp.google.com.'])).toBe('GOOGLE');
    expect(providerFromMxHosts(['aspmx.l.google.com', 'alt1.aspmx.l.google.com'])).toBe('GOOGLE');
    expect(providerFromMxHosts(['acme-io.mail.protection.outlook.com'])).toBe('MICROSOFT');
    expect(providerFromMxHosts(['mx.zoho.com'])).toBeNull();
  });
});

describe('import runners', () => {
  const store = (existing: (string | ExistingMailbox)[]) => {
    const created: Record<string, unknown>[] = [];
    const updated: [string, Record<string, unknown>][] = [];
    const s: MailboxImportStore = {
      listMailboxes: async () =>
        existing.map((m, i) => (typeof m === 'string' ? { id: `old${i}`, email: m, provider: null, authType: null } : m)),
      createMailbox: async (input) => {
        if (input.email.startsWith('fail')) throw new Error('boom');
        created.push(input);
        return { id: `id${created.length}` };
      },
      updateMailbox: async (id, patch) => {
        updated.push([id, patch]);
      },
    };
    return { s, created, updated };
  };
  const key = 'import-test-key-0123456789';

  it('imports Workspace rows without passwords through delegation, and checks each sign-in on a dry run', async () => {
    const lookup = async () => 'GOOGLE' as const;
    const csv = 'acme.io\t\nann@acme.io\t\nbad@acme.io\nbob@gmail.com\tpw';
    const verified: string[] = [];
    const delegation = {
      verify: async (email: string) => {
        if (email.startsWith('bad')) throw new Error('unauthorized_client');
        verified.push(email);
      },
    };

    const dry = await importCsvMailboxes({ store: store([]).s, csv, seal: (p) => p, dryRun: true, delegation, providerForDomain: lookup });
    expect(dry.created).toEqual(['ann@acme.io', 'bob@gmail.com']);
    expect(dry.delegated).toEqual(['ann@acme.io']);
    expect(dry.failed).toEqual([{ line: 3, email: 'bad@acme.io', error: 'unauthorized_client' }]);

    const { s, created } = store([]);
    await importCsvMailboxes({ store: s, csv, seal: (p) => encryptMailboxSecret({ password: p }, key), delegation, providerForDomain: lookup });
    expect(created.map((m) => [m.email, m.authType, Boolean(m.credentialCiphertext)])).toEqual([
      ['ann@acme.io', 'GOOGLE_DELEGATED', false],
      ['bad@acme.io', 'GOOGLE_DELEGATED', false],
      ['bob@gmail.com', 'PASSWORD', true],
    ]);

    const without = await importCsvMailboxes({ store: store([]).s, csv, seal: (p) => p, dryRun: true, providerForDomain: lookup });
    expect(without.created).toEqual(['bob@gmail.com']);
    expect(without.failed[0].error).toMatch(/service account/);
  });

  const switchPatch = {
    provider: 'GOOGLE',
    authType: 'GOOGLE_DELEGATED',
    credentialCiphertext: null,
    username: null,
    smtpHost: null,
    smtpPort: null,
    smtpSecure: null,
    imapHost: null,
    imapPort: null,
    lastError: null,
  };

  it('moves existing Google password mailboxes onto delegation when pasted again without a password', async () => {
    const lookup = async () => 'GOOGLE' as const;
    const existing: ExistingMailbox[] = [
      { id: 'm1', email: 'ann@acme.io', provider: 'GOOGLE', authType: 'PASSWORD' },
      { id: 'm2', email: 'bad@acme.io', provider: 'GOOGLE', authType: 'PASSWORD' },
      { id: 'm3', email: 'done@acme.io', provider: 'GOOGLE', authType: 'GOOGLE_DELEGATED' },
      { id: 'm4', email: 'keep@gmail.com', provider: 'GOOGLE', authType: 'PASSWORD' },
    ];
    const csv = 'Ann@acme.io\nbad@acme.io\ndone@acme.io\nkeep@gmail.com\tpw';
    const delegation = {
      verify: async (email: string) => {
        if (email.startsWith('bad')) throw new Error('unauthorized_client');
      },
    };

    const dry = store(existing);
    const check = await importCsvMailboxes({ store: dry.s, csv, seal: (p) => p, dryRun: true, delegation, providerForDomain: lookup });
    expect(check.switched).toEqual(['ann@acme.io']);
    expect(check.skippedExisting).toEqual(['done@acme.io', 'keep@gmail.com']);
    expect(check.failed).toEqual([{ line: 2, email: 'bad@acme.io', error: 'unauthorized_client' }]);
    expect(dry.updated).toEqual([]);

    const real = store(existing);
    const done = await importCsvMailboxes({ store: real.s, csv, seal: (p) => p, delegation, providerForDomain: lookup });
    expect(done.switched).toEqual(['ann@acme.io', 'bad@acme.io']);
    expect(real.updated).toEqual([
      ['m1', { ...switchPatch }],
      ['m2', { ...switchPatch }],
    ]);
    expect(real.created).toEqual([]);

    const noKey = await importCsvMailboxes({ store: store(existing).s, csv: 'ann@acme.io', seal: (p) => p, dryRun: true, providerForDomain: lookup });
    expect(noKey.switched).toEqual([]);
  });

  it('looks up the provider of custom domains once per domain', async () => {
    const { s, created } = store([]);
    const looked: string[] = [];
    const summary = await importCsvMailboxes({
      store: s,
      csv: 'a@acme.io,pw\nb@acme.io,pw\nc@other.io,pw',
      seal: (p) => encryptMailboxSecret({ password: p }, key),
      providerForDomain: async (domain) => {
        looked.push(domain);
        return domain === 'acme.io' ? 'GOOGLE' : null;
      },
    });
    expect(looked).toEqual(['acme.io', 'other.io']);
    expect(summary.created).toEqual(['a@acme.io', 'b@acme.io']);
    expect(created.map((m) => m.provider)).toEqual(['GOOGLE', 'GOOGLE']);
    expect(summary.failed.map((f) => f.email)).toEqual(['c@other.io']);
  });

  it('imports a CSV, sealing passwords and skipping existing, duplicate and unusable rows', async () => {
    const { s, created } = store(['old@gmail.com']);
    const csv = 'ann@gmail.com,pw1,Ann\nold@gmail.com,pw2\nANN@gmail.com,pw3\nme@custom.io,pw4\nfail@gmail.com,pw5';
    const summary = await importCsvMailboxes({ store: s, csv, seal: (p) => encryptMailboxSecret({ password: p }, key) });
    expect(summary.created).toEqual(['ann@gmail.com']);
    expect(summary.skippedExisting).toEqual(['old@gmail.com']);
    expect(summary.skippedDuplicate).toEqual(['ann@gmail.com']);
    expect(summary.failed.map((f) => f.email)).toEqual(['me@custom.io', 'fail@gmail.com']);
    expect(created[0]).toMatchObject({ email: 'ann@gmail.com', provider: 'GOOGLE', authType: 'PASSWORD', status: 'WARMING', warmupEnabled: true });
    expect(JSON.stringify(created)).not.toContain('pw1');
    expect(decryptMailboxSecret(created[0].credentialCiphertext as string, key)).toEqual({ password: 'pw1' });
  });

  it('imports Workspace users with filters, and dry-runs without writing', async () => {
    const users: DirectoryUser[] = [{ primaryEmail: 'a@acme-mail.com' }, { primaryEmail: 'b@acme-mail.com' }, { primaryEmail: 'c@acme-mail.com', suspended: true }];
    const { s, created } = store(['b@acme-mail.com']);
    const dry = await importWorkspaceMailboxes({ store: s, listUsers: async () => users, filter: {}, dryRun: true });
    expect(dry).toMatchObject({ listed: 3, matched: 2, created: ['a@acme-mail.com'], skippedExisting: ['b@acme-mail.com'], dryRun: true });
    expect(created).toHaveLength(0);
    const real = await importWorkspaceMailboxes({ store: s, listUsers: async () => users, filter: {} });
    expect(real.created).toEqual(['a@acme-mail.com']);
    expect(created[0]).toMatchObject({ authType: 'GOOGLE_DELEGATED' });
    expect(created[0].credentialCiphertext).toBeUndefined();
  });
});
