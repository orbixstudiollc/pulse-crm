import { describe, expect, it } from 'vitest';

import { domainOf, planWarmupPairs, type PoolMailbox } from 'src/gtm/mailbox/pairing';
import { seededRandom } from 'src/gtm/mailbox/random';

const pool: PoolMailbox[] = [
  { id: 'a1', email: 'ann@alpha-mail.com', provider: 'GOOGLE' },
  { id: 'a2', email: 'bob@alpha-mail.com', provider: 'GOOGLE' },
  { id: 'b1', email: 'cat@beta-send.io', provider: 'MICROSOFT' },
  { id: 'b2', email: 'dan@beta-send.io', provider: 'MICROSOFT' },
  { id: 'c1', email: 'eve@gamma-out.co', provider: 'GOOGLE' },
  { id: 'c2', email: 'fay@gamma-out.co', provider: 'MICROSOFT' },
];

const byId = new Map(pool.map((m) => [m.id, m]));

describe('planWarmupPairs', () => {
  it('sends exactly each quota and never to self', () => {
    const quotas = new Map(pool.map((m) => [m.id, 5]));
    const pairs = planWarmupPairs(pool, quotas, seededRandom(42));
    expect(pairs).toHaveLength(30);
    for (const m of pool) expect(pairs.filter((p) => p.fromId === m.id)).toHaveLength(5);
    expect(pairs.every((p) => p.fromId !== p.toId)).toBe(true);
  });

  it('spreads receives evenly across the pool', () => {
    const quotas = new Map(pool.map((m) => [m.id, 6]));
    const pairs = planWarmupPairs(pool, quotas, seededRandom(7));
    const received = pool.map((m) => pairs.filter((p) => p.toId === m.id).length);
    expect(Math.max(...received) - Math.min(...received)).toBeLessThanOrEqual(1);
  });

  it('prefers other domains and mixes providers', () => {
    // c2 (gamma, Microsoft) has two Google and two Microsoft mailboxes on other domains.
    const quotas = new Map([['c2', 4]]);
    const pairs = planWarmupPairs(pool, quotas, seededRandom(3));
    const targets = pairs.map((p) => byId.get(p.toId)!);
    expect(targets.every((t) => domainOf(t.email) !== 'gamma-out.co')).toBe(true);
    const providers = targets.map((t) => t.provider);
    expect(providers.filter((p) => p === 'GOOGLE').length).toBe(2);
    expect(providers.filter((p) => p === 'MICROSOFT').length).toBe(2);
    expect(new Set(pairs.map((p) => p.toId)).size).toBe(4);
  });

  it('takes earlier sends today into account', () => {
    const history = [
      { fromId: 'b1', toId: 'c1' },
      { fromId: 'b2', toId: 'c1' },
      { fromId: 'c2', toId: 'c1' },
    ];
    const pairs = planWarmupPairs(pool, new Map([['a1', 1]]), seededRandom(9), history);
    expect(pairs[0].toId).not.toBe('c1');
  });

  it('handles tiny pools and missing senders', () => {
    expect(planWarmupPairs(pool.slice(0, 1), new Map([['a1', 3]]), seededRandom(1))).toEqual([]);
    expect(planWarmupPairs(pool, new Map([['zz', 3]]), seededRandom(1))).toEqual([]);
    const two = planWarmupPairs(pool.slice(0, 2), new Map([['a1', 3]]), seededRandom(1));
    expect(two).toEqual([
      { fromId: 'a1', toId: 'a2' },
      { fromId: 'a1', toId: 'a2' },
      { fromId: 'a1', toId: 'a2' },
    ]);
  });
});
