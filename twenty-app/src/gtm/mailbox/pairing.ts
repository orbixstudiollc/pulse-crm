import { shuffle } from 'src/gtm/mailbox/random';
import type { MailboxProvider } from 'src/gtm/mailbox/values';

export type PoolMailbox = {
  id: string;
  email: string;
  provider: MailboxProvider | null;
};

export type WarmupPair = { fromId: string; toId: string };

export const domainOf = (email: string): string =>
  email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase();

// Penalties used to score a candidate recipient; lower is better.
const SAME_DOMAIN_PENALTY = 6;
const REPEAT_PAIR_PENALTY = 4;
const PROVIDER_SKEW_PENALTY = 1.5;
const RECEIVED_LOAD_WEIGHT = 1;

// Plan who emails whom. quotas maps sender id to the number of warmup emails
// it should send now. Rules:
// - never send to yourself;
// - spread receives evenly over the pool (fewest received so far wins);
// - avoid the same domain and repeating the same pair while alternatives exist;
// - mix recipient providers so each sender reaches Google, Microsoft and others.
// `history` lets callers seed today's pair counts so repeated runs keep spreading.
export const planWarmupPairs = (
  pool: readonly PoolMailbox[],
  quotas: ReadonlyMap<string, number>,
  rng: () => number,
  history: readonly WarmupPair[] = [],
): WarmupPair[] => {
  if (pool.length < 2) return [];

  const byId = new Map(pool.map((mailbox) => [mailbox.id, mailbox]));
  const received = new Map<string, number>(pool.map((mailbox) => [mailbox.id, 0]));
  const pairCount = new Map<string, number>();
  const providerCount = new Map<string, number>();
  const pairKey = (from: string, to: string) => `${from}>${to}`;
  const providerKey = (from: string, provider: string | null) => `${from}>${provider ?? 'OTHER'}`;

  const record = (fromId: string, toId: string) => {
    const to = byId.get(toId);
    if (!to) return;
    received.set(toId, (received.get(toId) ?? 0) + 1);
    pairCount.set(pairKey(fromId, toId), (pairCount.get(pairKey(fromId, toId)) ?? 0) + 1);
    const pk = providerKey(fromId, to.provider);
    providerCount.set(pk, (providerCount.get(pk) ?? 0) + 1);
  };

  for (const pair of history) {
    if (byId.has(pair.fromId)) record(pair.fromId, pair.toId);
  }

  const providers = [...new Set(pool.map((mailbox) => mailbox.provider))];
  const remaining = new Map<string, number>();
  for (const [id, quota] of quotas) {
    if (byId.has(id) && quota > 0) remaining.set(id, Math.floor(quota));
  }

  const pairs: WarmupPair[] = [];

  // Round-robin over senders so no single sender hogs the least-loaded recipients.
  while (remaining.size > 0) {
    for (const fromId of shuffle([...remaining.keys()], rng)) {
      const from = byId.get(fromId);
      if (!from) continue;
      const fromDomain = domainOf(from.email);

      const providerTotals = providers.map((provider) => providerCount.get(providerKey(fromId, provider)) ?? 0);
      const minProviderTotal = Math.min(...providerTotals);

      let best: { id: string; score: number } | null = null;
      for (const candidate of shuffle(pool, rng)) {
        if (candidate.id === fromId) continue;
        if (candidate.email.toLowerCase() === from.email.toLowerCase()) continue;
        const skew = (providerCount.get(providerKey(fromId, candidate.provider)) ?? 0) - minProviderTotal;
        const score =
          (received.get(candidate.id) ?? 0) * RECEIVED_LOAD_WEIGHT +
          (pairCount.get(pairKey(fromId, candidate.id)) ?? 0) * REPEAT_PAIR_PENALTY +
          (domainOf(candidate.email) === fromDomain ? SAME_DOMAIN_PENALTY : 0) +
          skew * PROVIDER_SKEW_PENALTY;
        if (!best || score < best.score) best = { id: candidate.id, score };
      }

      if (best) {
        pairs.push({ fromId, toId: best.id });
        record(fromId, best.id);
      }

      const left = (remaining.get(fromId) ?? 0) - 1;
      if (left <= 0 || !best) remaining.delete(fromId);
      else remaining.set(fromId, left);
    }
  }

  return pairs;
};
