import { describe, expect, it } from 'vitest';

import { allowedCountries, countryAllowed } from 'src/insights/visitor-regions';

describe('visitor countries', () => {
  it('defaults to Europe, the GCC, North America and Oceania', () => {
    const allowed = allowedCountries(undefined);
    for (const code of ['GB', 'DE', 'FR', 'AE', 'SA', 'QA', 'US', 'CA', 'AU']) expect(countryAllowed(code, allowed)).toBe(true);
    for (const code of ['BD', 'IN', 'PK', 'JP', 'CO', 'NG', 'EG', 'BR']) expect(countryAllowed(code, allowed)).toBe(false);
  });

  it('reads regions, codes and aliases', () => {
    const allowed = allowedCountries('gcc, uk, North America');
    expect([...(allowed ?? [])].sort()).toEqual(['AE', 'BH', 'CA', 'GB', 'KW', 'OM', 'QA', 'SA', 'US']);
    expect(allowedCountries('ALL')).toBeNull();
  });

  it('lets unknown countries through to the lookup', () => {
    expect(countryAllowed(null, allowedCountries(undefined))).toBe(true);
    expect(countryAllowed('bd', null)).toBe(true);
  });
});
