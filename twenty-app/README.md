# Pulse GTM on Twenty

Pulse rebuilt as a private app on top of [Twenty](https://twenty.com). Twenty runs unmodified; this folder adds Pulse's GTM fields, objects and views through the MIT `twenty-sdk`. The Next.js app at the repo root stays live until this reaches parity.

## What phase 1 adds

- People get **Lead status**, **Lead score**, **ICP grade**, **Lead source**, **AI summary** and a Prospeo id.
- A new **ICP** object (job titles, industries, locations, headcount, active flag).
- **Leads** and **ICPs** in the sidebar. Leads shows open leads sorted by score.
- `scripts/import-pulse`: copies a Pulse org's companies, leads, customers and deals from Supabase into Twenty. Safe to re-run; it updates by `pulseId`.

## Run it locally

Needs Node 24.5+, Yarn 4 (`corepack enable`) and Docker.

```bash
cd twenty-app
yarn install
yarn twenty docker:start          # Twenty at http://localhost:2020 (tim@apple.dev / tim@apple.dev)
# Settings > APIs & Webhooks > create an API key, then:
yarn twenty remote:add --as local --url http://localhost:2020 --api-key <key>
yarn twenty apply -f              # installs/updates the Pulse app
```

Checks: `yarn lint`, `yarn typecheck`, `yarn test:unit`.

## Import Pulse data

```bash
PULSE_SUPABASE_URL=... PULSE_SUPABASE_SERVICE_ROLE_KEY=... PULSE_ORG_ID=... \
TWENTY_URL=http://localhost:2020 TWENTY_API_KEY=... \
node scripts/import-pulse/run.ts [--dry-run]
```

Lost deals are skipped (Twenty's default pipeline has no lost stage). Order: companies, people, opportunities.

## Next phases

2. Prospeo lead finder and ICP scoring as logic functions.
3. Sequences and the Copilot as a Twenty agent.
4. Everything else, then hosting and cut-over.
