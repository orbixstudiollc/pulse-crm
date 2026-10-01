# Pulse CRM

A Next.js 16 (App Router) CRM backed by Supabase, with AI features (Anthropic, OpenAI, OpenRouter, Groq, Ollama), a Lead Finder that scrapes through Apify, and email, LinkedIn and WhatsApp outreach.

## Requirements

- Node.js 22 (pinned in `.nvmrc` and `package.json` `engines`; run `nvm use` if you use nvm) and npm. The repo ships a `package-lock.json`, so use npm.
- A Supabase project. The app will not start without one: every request goes through `middleware.ts`, which builds a Supabase client and returns a 500 if the Supabase URL or anon key is missing.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create your env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   `.env.example` documents every variable. To get the app running you need:

   | Variable | Why |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only; used by guest workspaces, cron routes and the Lead Finder worker |
   | `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; used for OAuth callbacks, CSRF origin checks and email links |
   | `ENCRYPTION_KEY` | Encrypts stored OAuth tokens and API keys. Generate with `openssl rand -hex 32` |

   Everything else is optional and only turns on the feature it names: an AI provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) for AI features, `APIFY_API_TOKEN` for Lead Finder, Google/Microsoft OAuth for sending email, and so on. AI keys can also be set per workspace on the Lead Finder settings page.

3. Set up the database. Migrations live in `supabase/migrations/` and are applied by hand in the Supabase SQL editor (the repo is not linked to the Supabase CLI). On a new project, run every file in filename order, `001` through the highest number. A fresh database builds cleanly that way.

   When you pull a new migration, apply it in the SQL editor before or with the deploy that needs it.

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign up, and complete onboarding to create your workspace.

### Open access (guest) mode

Set `NEXT_PUBLIC_OPEN_ACCESS="true"` to skip login: each visitor gets an anonymous Supabase user and their own seeded guest workspace. This needs **Anonymous sign-ins** enabled in Supabase (Authentication → Sign In / Providers) and `SUPABASE_SERVICE_ROLE_KEY` set. The flag is read at build time, so restart the dev server or redeploy after changing it. `GUEST_SIGNUPS_PER_HOUR`, `GUEST_RETENTION_DAYS` and `GUEST_SEED_DEMO_DATA` tune it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 (`npx next dev -p 3001` for another port) |
| `npm run build` | Production build. `NEXT_PUBLIC_*` values are inlined at build time, so set them before building |
| `npm start` | Serves the production build |
| `npm test` | Unit tests with Vitest (`tests/**/*.test.ts`); no database or env needed |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `node scripts/check-vercel-config.mjs` | Sanity-checks `vercel.json` |

## Background jobs

Several features run from cron routes under `app/api/cron/`, all protected by `Authorization: Bearer $CRON_SECRET`:

- Vercel runs `sequence-executor` and `daily-reset` once a day (`vercel.json`).
- `.github/workflows/lead-finder-cron.yml` calls `lead-finder-worker`, `lead-finder`, `automation-executor` and `sequence-executor` every 5 minutes against the production URL. It needs a `CRON_SECRET` repository secret matching the one on Vercel.

Locally nothing schedules these. The Lead Finder worker also starts on server boot (`instrumentation.ts`), and you can trigger any cron route by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sequence-executor
```

## Deploying

The app deploys to Vercel (region `sin1`). Set the same variables as in `.env.example` in the Vercel project, with `NEXT_PUBLIC_APP_URL` and the OAuth redirect URIs pointing at the production domain. Apply any new migration in the Supabase SQL editor when you deploy the code that needs it.
