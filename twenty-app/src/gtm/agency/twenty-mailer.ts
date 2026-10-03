// ClientMailer over Twenty's own email sending: the account connected in
// Settings > Accounts whose address is CLIENT_EMAIL_FROM (e.g. hello@orbix.studio),
// so client mail comes from the real inbox and lands in its Sent folder.

import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import type { ClientMailer } from 'src/gtm/agency/send-client-email';
import type { Records } from 'src/gtm/agency/gql';

export const findConnectedAccountId = async (records: Records, handle: string): Promise<string | null> => {
  const rows = await records.findMany<{ id: string; handle: string | null; handleAliases: string | null }>(
    'connectedAccounts',
    {},
    { handle: true },
    50,
  );
  const h = handle.trim().toLowerCase();
  return rows.find((r) => r.handle?.trim().toLowerCase() === h)?.id ?? null;
};

export const createTwentyClientMailer = async (records: Records, from: string | null): Promise<ClientMailer | null> => {
  if (!from) return null;
  const connectedAccountId = await findConnectedAccountId(records, from).catch(() => null);
  if (!connectedAccountId) {
    return { send: async () => ({ ok: false, error: `No connected account ${from} in Settings > Accounts` }) };
  }
  const client = new MetadataApiClient() as unknown as { mutation: (r: Record<string, unknown>) => Promise<any> };
  return {
    async send({ to, subject, html }) {
      try {
        const res = await client.mutation({
          sendEmail: {
            __args: { input: { connectedAccountId, to, subject, body: html } },
            success: true,
            error: true,
          },
        });
        return res?.sendEmail?.success ? { ok: true } : { ok: false, error: res?.sendEmail?.error || 'Send failed' };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
};
