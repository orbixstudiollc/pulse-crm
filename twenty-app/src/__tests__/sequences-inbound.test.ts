import { describe, expect, it } from 'vitest';

import { fetchSyncedMessage, toInboundEmail, type SyncedMessage } from 'src/gtm/sequences/inbound';

const message = (over: Partial<SyncedMessage> = {}): SyncedMessage => ({
  id: 'm1',
  subject: 'Re: quick question',
  text: 'Yes, interested',
  receivedAt: '2026-10-01T10:00:00Z',
  participants: [
    { role: 'from', handle: 'Ada@Acme.com', personId: 'p1' },
    { role: 'to', handle: 'sales@pulse.test', workspaceMemberId: 'wm1' },
  ],
  ...over,
});

describe('toInboundEmail', () => {
  it('turns a message from a person into a reply', () => {
    expect(toInboundEmail(message())).toEqual({
      personId: 'p1',
      fromEmail: 'ada@acme.com',
      kind: 'REPLY',
      subject: 'Re: quick question',
      snippet: 'Yes, interested',
      receivedAt: '2026-10-01T10:00:00Z',
      messageId: 'm1',
      mailboxEmail: 'sales@pulse.test',
    });
  });

  it('ignores our own outbound mail, bounces and out-of-office replies', () => {
    expect(
      toInboundEmail(message({ participants: [{ role: 'from', handle: 'me@pulse.test', workspaceMemberId: 'wm1' }] })),
    ).toBeNull();
    expect(
      toInboundEmail(message({ participants: [{ role: 'from', handle: 'MAILER-DAEMON@google.com' }] })),
    ).toBeNull();
    expect(toInboundEmail(message({ subject: 'Out of office: back Monday' }))).toBeNull();
    expect(toInboundEmail(message({ subject: 'Automatic reply: Re: hi' }))).toBeNull();
    expect(toInboundEmail(message({ participants: [] }))).toBeNull();
  });
});

describe('fetchSyncedMessage', () => {
  it('flattens the GraphQL response', async () => {
    const client = {
      query: async () => ({
        messages: {
          edges: [
            {
              node: {
                id: 'm1',
                subject: 's',
                text: 't',
                receivedAt: null,
                messageParticipants: { edges: [{ node: { role: 'from', handle: 'a@b.c' } }] },
              },
            },
          ],
        },
      }),
      mutation: async () => ({}),
    };
    expect(await fetchSyncedMessage(client, 'm1')).toEqual({
      id: 'm1',
      subject: 's',
      text: 't',
      receivedAt: null,
      participants: [{ role: 'from', handle: 'a@b.c' }],
    });
    expect(await fetchSyncedMessage({ ...client, query: async () => ({ messages: { edges: [] } }) }, 'x')).toBeNull();
  });
});
