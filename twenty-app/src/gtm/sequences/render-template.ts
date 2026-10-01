// Template variable rendering for email templates. Pure: no I/O.
//
// Syntax:
//   {{firstName}}                 value, or "" when missing
//   {{ firstName | "there" }}     value, or the fallback when missing/blank
//   {{firstName|there}}           same, quotes optional
//   {{company.name}}              dotted paths into nested objects
//
// Keys are matched case-insensitively and with or without underscores, so
// Pulse's old {{first_name}} templates keep working against {{firstName}} data.
// Substitution is a single pass, so a value that itself contains "{{...}}" is
// never re-expanded. With `html: true` substituted values (and fallbacks) are
// HTML-escaped; the template's own markup is left alone.

export type TemplateValue = string | number | boolean | null | undefined;
export type TemplateVariables = { [key: string]: TemplateValue | TemplateVariables };

export type RenderOptions = {
  html?: boolean;
  // Used when a variable has no value and no inline fallback.
  defaultFallback?: string;
};

export type RenderResult = {
  text: string;
  // Variables that had no value (whether or not a fallback covered them).
  missing: string[];
};

const TOKEN = /\{\{\s*([A-Za-z_][\w.]*)\s*(?:\|\s*(?:"([^"]*)"|'([^']*)'|([^}]*?)))?\s*\}\}/g;

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeKey = (key: string) => key.replace(/_/g, '').toLowerCase();

const lookupOne = (
  scope: TemplateVariables | TemplateValue,
  segment: string,
): TemplateVariables | TemplateValue => {
  if (scope === null || typeof scope !== 'object') return undefined;
  if (segment in scope) return scope[segment];
  const wanted = normalizeKey(segment);
  for (const [k, v] of Object.entries(scope)) {
    if (normalizeKey(k) === wanted) return v;
  }
  return undefined;
};

const lookup = (vars: TemplateVariables, path: string): TemplateValue => {
  // Flat keys such as "contact.name" win over nested lookups.
  const flat = lookupOne(vars, path);
  if (flat !== undefined && (flat === null || typeof flat !== 'object')) return flat;
  let scope: TemplateVariables | TemplateValue = vars;
  for (const segment of path.split('.')) scope = lookupOne(scope, segment);
  return scope === null || typeof scope !== 'object' ? scope : undefined;
};

const isBlank = (v: TemplateValue) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export const renderTemplate = (
  template: string | null | undefined,
  vars: TemplateVariables,
  options: RenderOptions = {},
): RenderResult => {
  const missing = new Set<string>();
  const text = (template ?? '').replace(
    TOKEN,
    (_match, key: string, dq?: string, sq?: string, bare?: string) => {
      const value = lookup(vars, key);
      let out: string;
      if (isBlank(value)) {
        missing.add(key);
        const inline = dq ?? sq ?? (bare !== undefined ? bare.trim() : undefined);
        out = inline ?? options.defaultFallback ?? '';
      } else {
        out = String(value).trim();
      }
      return options.html ? escapeHtml(out) : out;
    },
  );
  return { text, missing: [...missing] };
};

// Variable names a template references (without fallbacks), for previews and
// validation in the UI or by the agent.
export const templateVariables = (template: string | null | undefined): string[] => {
  const names = new Set<string>();
  for (const m of (template ?? '').matchAll(TOKEN)) names.add(m[1]);
  return [...names];
};

// The variables a sequence email can use, built from a Twenty person record.
export type PersonForTemplate = {
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  jobTitle?: string | null;
  city?: string | null;
  company?: {
    name?: string | null;
    domainName?: { primaryLinkUrl?: string | null } | null;
  } | null;
};

export type SenderForTemplate = { name?: string | null; email?: string | null };

const domainOf = (url: string | null | undefined) =>
  (url ?? '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');

export const buildTemplateVariables = (
  person: PersonForTemplate,
  sender: SenderForTemplate = {},
  now: Date = new Date(),
): TemplateVariables => {
  const firstName = person.name?.firstName?.trim() ?? '';
  const lastName = person.name?.lastName?.trim() ?? '';
  const company = person.company?.name?.trim() ?? '';
  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    name: [firstName, lastName].filter(Boolean).join(' '),
    email: person.emails?.primaryEmail ?? '',
    jobTitle: person.jobTitle ?? '',
    title: person.jobTitle ?? '',
    city: person.city ?? '',
    location: person.city ?? '',
    company,
    companyName: company,
    website: domainOf(person.company?.domainName?.primaryLinkUrl),
    sender: { name: sender.name ?? '', email: sender.email ?? '' },
    senderName: sender.name ?? '',
    today: now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
  };
};
