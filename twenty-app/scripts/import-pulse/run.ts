// Import one Pulse workspace (Supabase) into Twenty.
//
//   PULSE_SUPABASE_URL=... PULSE_SUPABASE_SERVICE_ROLE_KEY=... PULSE_ORG_ID=... \
//   TWENTY_URL=https://your-twenty TWENTY_API_KEY=... node scripts/import-pulse/run.ts [--dry-run]
//
// Safe to re-run: every record carries a pulseId, and existing ones are updated
// instead of duplicated. Imports companies, leads and customers (as People with a
// lead status) and open or won deals (as Opportunities).

import {
  companyKey,
  companyPayload,
  customerToPerson,
  dealToOpportunity,
  leadToPerson,
  type PulseCustomer,
  type PulseDeal,
  type PulseLead,
} from './mapping.ts';

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = env('PULSE_SUPABASE_URL').replace(/\/$/, '');
const SUPABASE_KEY = env('PULSE_SUPABASE_SERVICE_ROLE_KEY');
const ORG_ID = env('PULSE_ORG_ID');
const TWENTY_URL = env('TWENTY_URL').replace(/\/$/, '');
const TWENTY_KEY = env('TWENTY_API_KEY');

// select=* because older Pulse databases lack some columns (e.g. leads.title).
async function supabaseAll<T>(table: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&organization_id=eq.${ORG_ID}&order=created_at.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${from + 999}`,
        },
      },
    );
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function twenty(method: string, path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${TWENTY_URL}/rest/${path}`, {
      method,
      headers: { Authorization: `Bearer ${TWENTY_KEY}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Twenty rate-limits API keys (100 requests a minute by default): wait and retry.
    if (res.status === 429 && attempt < 30) {
      const retryAfter = Number((await res.json().catch(() => ({}))).retryAfterSeconds) || 5;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Twenty ${method} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

/** pulseId -> Twenty id for records an earlier run already imported. */
async function existingByPulseId(object: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | null = null;
  do {
    const query = `limit=200&filter=pulseId[is]:NOT_NULL${cursor ? `&starting_after=${cursor}` : ''}`;
    const json = await twenty('GET', `${object}?${query}`);
    for (const record of json.data[object] as { id: string; pulseId: string | null }[]) {
      if (record.pulseId) map.set(record.pulseId, record.id);
    }
    cursor = json.pageInfo?.hasNextPage ? json.pageInfo.endCursor : null;
  } while (cursor);
  return map;
}

const counts: Record<string, { created: number; updated: number }> = {};

async function upsert(object: string, existing: Map<string, string>, payload: { pulseId: string | null }) {
  const tally = (counts[object] ??= { created: 0, updated: 0 });
  const id = payload.pulseId ? existing.get(payload.pulseId) : undefined;
  if (DRY_RUN) {
    tally[id ? 'updated' : 'created']++;
    return id ?? `dry-run:${payload.pulseId}`;
  }
  if (id) {
    await twenty('PATCH', `${object}/${id}`, payload);
    tally.updated++;
    return id;
  }
  const json = await twenty('POST', object, payload);
  const created = Object.values(json.data)[0] as { id: string };
  if (payload.pulseId) existing.set(payload.pulseId, created.id);
  tally.created++;
  return created.id;
}

async function main() {
  const [leads, customers, deals] = await Promise.all([
    supabaseAll<PulseLead>('leads'),
    supabaseAll<PulseCustomer>('customers'),
    supabaseAll<PulseDeal>('deals'),
  ]);
  console.log(`Pulse: ${leads.length} leads, ${customers.length} customers, ${deals.length} deals`);

  const [companies, people, opportunities] = await Promise.all([
    existingByPulseId('companies'),
    existingByPulseId('people'),
    existingByPulseId('opportunities'),
  ]);

  // Companies first, so people and deals can link to them.
  const companyIds = new Map<string, string>();
  const companySources = [
    ...leads.map((l) => ({ name: l.company, website: l.website, industry: l.industry })),
    ...customers.map((c) => ({ name: c.company, website: c.website, industry: c.industry })),
    ...deals.map((d) => ({ name: d.company, website: null, industry: null })),
  ];
  for (const source of companySources) {
    const key = companyKey(source.name);
    if (!key || companyIds.has(key)) continue;
    companyIds.set(key, await upsert('companies', companies, companyPayload(source.name!, source)));
  }

  const personIdByEmail = new Map<string, string>();
  for (const lead of leads) {
    const id = await upsert('people', people, leadToPerson(lead, companyIds.get(companyKey(lead.company) ?? '') ?? null));
    if (lead.email) personIdByEmail.set(lead.email.toLowerCase(), id);
  }
  for (const customer of customers) {
    const id = await upsert('people', people, customerToPerson(customer, companyIds.get(companyKey(customer.company) ?? '') ?? null));
    if (customer.email) personIdByEmail.set(customer.email.toLowerCase(), id);
  }

  let skippedLost = 0;
  for (const deal of deals) {
    const payload = dealToOpportunity(deal, {
      companyId: companyIds.get(companyKey(deal.company) ?? '') ?? null,
      pointOfContactId: personIdByEmail.get(deal.contact_email?.toLowerCase() ?? '') ?? null,
    });
    if (!payload) {
      skippedLost++;
      continue;
    }
    await upsert('opportunities', opportunities, payload);
  }

  console.log(DRY_RUN ? 'Dry run, nothing written:' : 'Done:', JSON.stringify(counts));
  if (skippedLost) console.log(`Skipped ${skippedLost} lost deals (Twenty has no "lost" stage by default).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
