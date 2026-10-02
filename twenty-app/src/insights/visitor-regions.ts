// Which visitor countries are worth a company lookup and Prospeo credits.
// VISITOR_COUNTRIES takes region names and/or ISO country codes, comma
// separated, e.g. "EUROPE, GCC, US". "ALL" turns the filter off. Visits from
// other countries are still recorded; they just cost nothing.

export const VISITOR_REGIONS: Record<string, string[]> = {
  EUROPE: [
    'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR',
    'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT',
    'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'UA', 'VA', 'XK',
  ],
  GCC: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'],
  NORTH_AMERICA: ['US', 'CA'],
  OCEANIA: ['AU', 'NZ'],
};

// Europe, the GCC, the US and Canada, Australia and New Zealand. Asia, Africa
// and Latin America are skipped unless added.
export const DEFAULT_VISITOR_COUNTRIES = 'EUROPE, GCC, NORTH_AMERICA, OCEANIA';

const ALIASES: Record<string, string> = { EU: 'EUROPE', UK: 'GB', UAE: 'AE', KSA: 'SA', 'MIDDLE EAST': 'GCC', USA: 'US' };

/** The allowed ISO country codes, or null when every country is allowed. */
export const allowedCountries = (value: string | undefined | null): Set<string> | null => {
  const raw = value?.trim() || DEFAULT_VISITOR_COUNTRIES;
  const set = new Set<string>();
  for (const part of raw.split(/[,;\n]+/)) {
    const token = part.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!token) continue;
    if (token === 'ALL' || token === '*') return null;
    const name = ALIASES[token.replace(/_/g, ' ')] ?? ALIASES[token] ?? token;
    const region = VISITOR_REGIONS[name];
    if (region) region.forEach((code) => set.add(code));
    else if (/^[A-Z]{2}$/.test(name)) set.add(name);
  }
  return set.size > 0 ? set : null;
};

/** Unknown countries pass, so the lookup can find out; known ones must be on the list. */
export const countryAllowed = (country: string | null | undefined, allowed: Set<string> | null) =>
  !allowed || !country || allowed.has(country.trim().toUpperCase());
