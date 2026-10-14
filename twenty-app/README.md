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

## Copilot, Overview, Analytics, Website Visitors

- **Pulse Copilot** agent (`src/agents/insights`) with skills `lead-triage`, `account-summary`, `outreach-drafting`, `next-best-actions`. It calls the `findLeads`, `enrichLead`, `scoreLeads` and `enrollInSequence` tools when they are installed.
- **Overview** and **Analytics** pages: front-component widgets for pipeline value by stage, leads by status / ICP grade / source, new leads per week and win rate. Win rate counts overdue open deals as lost, since Twenty has no lost stage. Widgets read up to 5,000 records per object through REST.
- **Website Visitors**: one `websiteVisit` record per visitor. Latest page and visit time are updated on each hit, UTMs and referrer keep the first touch, and a known email links the visit to a Person.

Tracking: paste this before `</body>`, replacing the URL with your Twenty server. The public route is `POST /s/track`. It is rate-limited to 30 hits per visitor per minute.

```html
<script>
(function(w,d,k,e){try{var s=w.localStorage,id=s.getItem(k);if(!id){id=w.crypto&&crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2));s.setItem(k,id)}
w.pulseTrack=function(m){var b=JSON.stringify({visitorId:id,url:location.href,referrer:d.referrer||null,email:m||null});
navigator.sendBeacon?navigator.sendBeacon(e,b):fetch(e,{method:'POST',body:b,keepalive:true,mode:'no-cors'})};w.pulseTrack()}catch(_){}})
(window,document,'pulse_vid','https://YOUR-TWENTY-HOST/s/track');
</script>
```

After a form submit, call `pulseTrack(email)` to link the visitor to a Person. `trackingSnippet(url)` in `src/insights/tracking-snippet.ts` builds the same tag.
