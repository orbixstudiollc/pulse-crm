import { describe, expect, it } from 'vitest';

import { resolveMailboxAuth } from 'src/gtm/mailbox/auth';
import { encryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import { parseHeaderBlock } from 'src/gtm/mailbox/imap-inbox';
import { serverSettingsFor } from 'src/gtm/mailbox/server-settings';
import { createTwentyMailboxRepository, type RestLike } from 'src/gtm/mailbox/twenty-repository';

describe('serverSettingsFor', () => {
  const empty = { smtpHost: null, smtpPort: null, smtpSecure: null, imapHost: null, imapPort: null };

  it('fills Google and Microsoft defaults', () => {
    expect(serverSettingsFor({ ...empty, provider: 'GOOGLE' })).toEqual({
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
    });
    expect(serverSettingsFor({ ...empty, provider: 'MICROSOFT' })?.smtp).toEqual({ host: 'smtp.office365.com', port: 587, secure: false });
  });

  it('needs hosts for other providers', () => {
    expect(serverSettingsFor({ ...empty, provider: 'OTHER' })).toBeNull();
    expect(serverSettingsFor({ ...empty, provider: 'OTHER', smtpHost: 'mail.x.io', imapHost: 'mail.x.io' })).toEqual({
      smtp: { host: 'mail.x.io', port: 587, secure: false },
      imap: { host: 'mail.x.io', port: 993, secure: true },
    });
  });
});

describe('resolveMailboxAuth', () => {
  const key = 'adapter-test-key-0123456789';

  it('decrypts the sealed password and defaults the user to the email', async () => {
    const auth = await resolveMailboxAuth(
      { email: 'a@x.io', username: null, credentialCiphertext: encryptMailboxSecret({ password: 'pw1' }, key), connectionId: null },
      { encryptionKey: key },
    );
    expect(auth).toEqual({ type: 'password', user: 'a@x.io', password: 'pw1' });
  });

  it('prefers an OAuth connection', async () => {
    const auth = await resolveMailboxAuth(
      { email: 'a@x.io', username: 'login', credentialCiphertext: null, connectionId: 'conn-1' },
      { encryptionKey: undefined, getAccessToken: async (id) => `token-for-${id}` },
    );
    expect(auth).toEqual({ type: 'oauth', user: 'login', accessToken: 'token-for-conn-1' });
  });

  it('explains what is missing', async () => {
    const box = { email: 'a@x.io', username: null, credentialCiphertext: null, connectionId: null };
    await expect(resolveMailboxAuth(box, { encryptionKey: key })).rejects.toThrow(/No credential/);
    await expect(resolveMailboxAuth({ ...box, credentialCiphertext: 'v1.a.b.c' }, { encryptionKey: undefined })).rejects.toThrow(/MAILBOX_ENCRYPTION_KEY/);
  });
});

describe('parseHeaderBlock', () => {
  it('lower-cases names and unfolds continuation lines', () => {
    expect(parseHeaderBlock('X-Entity-Ref-ID: abc\r\nMessage-ID:\r\n <1@x>\r\n\r\n')).toEqual({
      'x-entity-ref-id': 'abc',
      'message-id': '<1@x>',
    });
  });
});

describe('twenty REST repository', () => {
  it('pages through collections and uses REST filters', async () => {
    const calls: { method: string; path: string; query?: unknown; body?: unknown }[] = [];
    const client: RestLike = {
      async get<T>(path: string, options?: { query?: Record<string, unknown> }) {
        calls.push({ method: 'GET', path, query: options?.query });
        if (path === '/rest/mailboxes') {
          const first = !options?.query?.starting_after;
          return {
            data: { mailboxes: [{ id: first ? 'm1' : 'm2' }] },
            pageInfo: { hasNextPage: first, endCursor: first ? 'cur1' : null },
          } as T;
        }
        return { data: { warmupMessages: [{ id: 'w1', tag: 'x' }] }, pageInfo: { hasNextPage: false } } as T;
      },
      async post<T>(path: string, body?: unknown) {
        calls.push({ method: 'POST', path, body });
        return { data: { createWarmupMessage: { id: 'new' } } } as T;
      },
      async patch<T>(path: string, body?: unknown) {
        calls.push({ method: 'PATCH', path, body });
        return {} as T;
      },
    };
    const repo = createTwentyMailboxRepository(client);
    const last = () => calls[calls.length - 1];

    expect((await repo.listMailboxes()).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(calls[1].query).toMatchObject({ starting_after: 'cur1' });

    expect(await repo.findWarmupMessageByTag('x')).toMatchObject({ id: 'w1' });
    expect(last()?.query).toMatchObject({ filter: 'tag[eq]:"x"', limit: 1 });

    await repo.listWarmupMessagesSince(new Date('2026-10-10T00:00:00Z'));
    expect(last()?.query).toMatchObject({ filter: 'sentAt[gte]:"2026-10-10T00:00:00.000Z"' });

    expect(await repo.createWarmupMessage({} as never)).toEqual({ id: 'new' });
    await repo.updateMailbox('m1', { sentToday: 0 });
    expect(last()).toEqual({ method: 'PATCH', path: '/rest/mailboxes/m1', body: { sentToday: 0 } });
    const before = calls.length;
    await repo.updateMailbox('m1', {});
    expect(calls.length).toBe(before);
  });
});
