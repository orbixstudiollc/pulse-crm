import { describe, expect, it } from 'vitest';

import { addDelay, isDue, retryAt } from 'src/gtm/sequences/scheduler';

// 2026-10-01 is a Thursday.
const thu = new Date('2026-10-01T09:30:00Z');
const fri = new Date('2026-10-02T09:30:00Z');
const sat = new Date('2026-10-03T09:30:00Z');

describe('addDelay', () => {
  it('adds calendar days and keeps the time of day', () => {
    expect(addDelay(thu, 3).toISOString()).toBe('2026-10-04T09:30:00.000Z');
    expect(addDelay(thu, 0).toISOString()).toBe(thu.toISOString());
    expect(addDelay(thu, 0.5).toISOString()).toBe('2026-10-01T21:30:00.000Z');
  });

  it('treats negative, null and NaN delays as zero', () => {
    expect(addDelay(thu, -2).getTime()).toBe(thu.getTime());
    expect(addDelay(thu, null).getTime()).toBe(thu.getTime());
    expect(addDelay(thu, Number.NaN).getTime()).toBe(thu.getTime());
  });

  it('counts business days only when asked', () => {
    const opts = { businessDaysOnly: true };
    expect(addDelay(thu, 1, opts).toISOString()).toBe('2026-10-02T09:30:00.000Z');
    expect(addDelay(thu, 2, opts).toISOString()).toBe('2026-10-05T09:30:00.000Z');
    expect(addDelay(fri, 1, opts).toISOString()).toBe('2026-10-05T09:30:00.000Z');
    expect(addDelay(thu, 5, opts).toISOString()).toBe('2026-10-08T09:30:00.000Z');
  });

  it('never lands on a weekend in business-day mode, even with no delay', () => {
    expect(addDelay(sat, 0, { businessDaysOnly: true }).toISOString()).toBe('2026-10-05T09:30:00.000Z');
    expect(addDelay(sat, 1, { businessDaysOnly: true }).toISOString()).toBe('2026-10-06T09:30:00.000Z');
  });

  it('rounds fractional business days up', () => {
    expect(addDelay(thu, 0.5, { businessDaysOnly: true }).toISOString()).toBe('2026-10-02T09:30:00.000Z');
  });
});

describe('isDue / retryAt', () => {
  it('is due at or after the send time', () => {
    expect(isDue('2026-10-01T09:30:00Z', thu)).toBe(true);
    expect(isDue('2026-10-01T09:31:00Z', thu)).toBe(false);
    expect(isDue(null, thu)).toBe(false);
    expect(isDue('garbage', thu)).toBe(false);
  });

  it('backs off retries up to a day', () => {
    expect(retryAt(thu).getTime() - thu.getTime()).toBe(60 * 60 * 1000);
    expect(retryAt(thu, 3).getTime() - thu.getTime()).toBe(4 * 60 * 60 * 1000);
    expect(retryAt(thu, 20).getTime() - thu.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
