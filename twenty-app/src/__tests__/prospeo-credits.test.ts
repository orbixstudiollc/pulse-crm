import { describe, expect, it, vi } from 'vitest';

import { getAccountInfo, parseAccountInfo } from 'src/gtm/prospeo/api';

const account = {
  current_plan: 'STARTER',
  current_team_members: 1,
  remaining_credits: 2000,
  used_credits: 0,
  next_quota_renewal_days: 30,
  next_quota_renewal_date: '2026-11-01 22:44:29+00:00',
};

const reply = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe('Prospeo credits', () => {
  it('reads the account details from the response envelope', () => {
    expect(parseAccountInfo({ error: false, response: account })).toEqual({
      plan: 'STARTER',
      remainingCredits: 2000,
      usedCredits: 0,
      renewalDate: '2026-11-01 22:44:29+00:00',
      renewalInDays: 30,
    });
  });

  it('asks with a GET and the key header', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { error: false, response: account }));
    const info = await getAccountInfo('key-1', fetchImpl as unknown as typeof fetch);
    expect(info.remainingCredits).toBe(2000);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.prospeo.io/account-information');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)['X-KEY']).toBe('key-1');
  });

  it('retries as POST when GET is not allowed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply(405, { error: true }))
      .mockResolvedValueOnce(reply(200, { error: false, response: account }));
    const info = await getAccountInfo('key-1', fetchImpl as unknown as typeof fetch);
    expect(info.plan).toBe('STARTER');
    expect((fetchImpl.mock.calls[1][1] as RequestInit).method).toBe('POST');
  });

  it('reports a bad key', async () => {
    const fetchImpl = vi.fn(async () => reply(401, { error: true, error_code: 'INVALID_API_KEY' }));
    await expect(getAccountInfo('bad', fetchImpl as unknown as typeof fetch)).rejects.toThrow('The Prospeo API key is invalid');
  });
});
