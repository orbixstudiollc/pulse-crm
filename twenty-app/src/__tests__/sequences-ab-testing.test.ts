import { describe, expect, it } from 'vitest';

import {
  assignVariant,
  chooseVariant,
  hashToUnit,
  openPixelHtml,
  pickWinner,
  rate,
} from 'src/gtm/sequences/ab-testing';

const ids = Array.from({ length: 4000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

describe('hashToUnit', () => {
  it('is deterministic and in [0, 1)', () => {
    expect(hashToUnit('abc')).toBe(hashToUnit('abc'));
    expect(hashToUnit('abc')).not.toBe(hashToUnit('abd'));
    for (const id of ids.slice(0, 200)) {
      const u = hashToUnit(id);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe('assignVariant', () => {
  const ab = [
    { id: 'b', weight: 50 },
    { id: 'a', weight: 50 },
  ];

  it('gives an enrollment the same variant every time, whatever the input order', () => {
    for (const id of ids.slice(0, 50)) {
      expect(assignVariant(ab, id)?.id).toBe(assignVariant([...ab].reverse(), id)?.id);
    }
  });

  it('keeps the same arm on later steps with the same weights', () => {
    const step2 = [
      { id: 'a2', weight: 50 },
      { id: 'b2', weight: 50 },
    ];
    for (const id of ids.slice(0, 100)) {
      expect(assignVariant(ab, id)?.id[0]).toBe(assignVariant(step2, id)?.id[0]);
    }
  });

  it('splits roughly by weight', () => {
    const counts = { a: 0, b: 0 };
    const weighted = [
      { id: 'a', weight: 80 },
      { id: 'b', weight: 20 },
    ];
    for (const id of ids) counts[assignVariant(weighted, id)!.id as 'a' | 'b'] += 1;
    expect(counts.a / ids.length).toBeGreaterThan(0.75);
    expect(counts.a / ids.length).toBeLessThan(0.85);
  });

  it('skips inactive and zero-weight variants, and splits evenly when all weights are zero', () => {
    const pool = [
      { id: 'a', weight: 0 },
      { id: 'b', weight: 10 },
      { id: 'c', weight: 90, isActive: false },
    ];
    for (const id of ids.slice(0, 50)) expect(assignVariant(pool, id)?.id).toBe('b');
    const zero = [
      { id: 'a', weight: 0 },
      { id: 'b', weight: null },
    ];
    const seen = new Set(ids.slice(0, 200).map((id) => assignVariant(zero, id)?.id));
    expect(seen).toEqual(new Set(['a', 'b']));
    expect(assignVariant([], 'x')).toBeNull();
  });
});

describe('pickWinner / chooseVariant', () => {
  const variants = [
    { id: 'a', weight: 50, sent: 100, replied: 4 },
    { id: 'b', weight: 50, sent: 120, replied: 9 },
  ];

  it('waits for the minimum sample on every variant', () => {
    expect(pickWinner(variants, 101)).toBeNull();
    expect(pickWinner(variants, 100)?.id).toBe('b');
  });

  it('needs two active variants and a strict leader', () => {
    expect(pickWinner([variants[0]], 1)).toBeNull();
    expect(
      pickWinner(
        [
          { id: 'a', sent: 10, replied: 1 },
          { id: 'b', sent: 20, replied: 2 },
        ],
        5,
      ),
    ).toBeNull();
    expect(pickWinner([...variants, { id: 'c', sent: 0, isActive: false }], 50)?.id).toBe('b');
  });

  it('sends everything to the winner only when auto-winner is on', () => {
    const fresh = ids.slice(0, 40);
    expect(new Set(fresh.map((id) => chooseVariant(variants, id).variant?.id))).toEqual(new Set(['a', 'b']));
    for (const id of fresh) {
      expect(chooseVariant(variants, id, { autoPickWinner: true, winnerMinSends: 50 })).toEqual({
        variant: variants[1],
        byWinner: true,
      });
    }
    expect(chooseVariant(variants, ids[0], { autoPickWinner: true, winnerMinSends: 500 }).byWinner).toBe(false);
  });
});

describe('rate / openPixelHtml', () => {
  it('computes percentages with one decimal', () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(5, 0)).toBe(0);
  });

  it('builds an escaped pixel tag', () => {
    expect(openPixelHtml('https://x.test/s/sequences/open', 'e1', 'v1')).toBe(
      '<img src="https://x.test/s/sequences/open?e=e1&amp;v=v1" width="1" height="1" alt="" style="display:none">',
    );
    expect(openPixelHtml('https://x.test/o', 'e1', null)).toContain('?e=e1"');
  });
});
