// Agency settings from the app variables, with defaults. Pure.

import { bookingLinkFrom } from 'src/gtm/replies/app-variables';

export type AgencySettings = {
  clientEmailFrom: string | null;
  autoSend: boolean;
  intakeFormUrl: string | null;
  bookingLink: string | null;
  stripeSecretKey: string | null;
  invoiceDueDays: number;
  depositPercent: number;
  currency: string;
  publicPagesUrl: string | null;
};

type Env = Record<string, string | undefined>;

const clampNumber = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw?.trim());
  return raw?.trim() && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Public route base: PUBLIC_PAGES_URL, else the tracking endpoint without its
// /track (Twenty Cloud serves routes from a separate functions host), else
// PUBLIC_TWENTY_URL + /s.
export const publicPagesBase = (env: Env): string | null => {
  const clean = (u: string | undefined) => {
    const t = u?.trim().replace(/\/+$/, '');
    return t && /^https?:\/\//i.test(t) ? t : null;
  };
  const explicit = clean(env.PUBLIC_PAGES_URL);
  if (explicit) return explicit;
  const tracking = clean(env.TRACKING_ENDPOINT_URL);
  if (tracking && /\/track$/.test(tracking)) return tracking.replace(/\/track$/, '');
  const twenty = clean(env.PUBLIC_TWENTY_URL);
  return twenty ? `${twenty}/s` : null;
};

export const readAgencySettings = (env: Env): AgencySettings => ({
  clientEmailFrom: env.CLIENT_EMAIL_FROM?.trim().toLowerCase() || null,
  autoSend: env.CLIENT_AUTO_SEND?.trim().toLowerCase() === 'on',
  intakeFormUrl: bookingLinkFrom(env.INTAKE_FORM_URL),
  bookingLink: bookingLinkFrom(env.BOOKING_LINK),
  stripeSecretKey: env.STRIPE_SECRET_KEY?.trim() || null,
  invoiceDueDays: Math.round(clampNumber(env.INVOICE_DUE_DAYS, 7, 0, 120)),
  depositPercent: clampNumber(env.DEPOSIT_PERCENT, 50, 1, 100),
  currency: (env.CURRENCY?.trim().toUpperCase().match(/^[A-Z]{3}$/)?.[0]) ?? 'USD',
  publicPagesUrl: publicPagesBase(env),
});

export const formatMoney = (amount: number | null | undefined, currency: string) => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};
