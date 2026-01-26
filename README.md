# PulseKonnect (MVP)

PulseKonnect is a Next.js (App Router) + Supabase application for managing leads, recruitment, analytics, and organization settings.

## Prerequisites

- Node.js 20+
- npm (recommended) or pnpm/yarn
- A Supabase project

Optional (for background jobs / scrapers):

- Docker (for Redis + Celery-based scraper workers)

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in values.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL` (local dev usually `redis://localhost:6379`)
- `RESEND_API_KEY` (email sending)

Recommended (security for storing third-party secrets):

- `PK_ENCRYPTION_KEY` (32+ chars; do not commit)

Example:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=...
PK_ENCRYPTION_KEY=change-me-to-a-long-random-string
```

## 3) Set up Supabase (schema + migrations)

Migrations live in `supabase/migrations/`.

If you use the Supabase CLI, apply migrations to your local/project DB using your normal workflow (recommended for teams). If you are using the Supabase Dashboard, you can also run the SQL in the migration files in order.

Important migrations for Settings + scrapers:

- `supabase/migrations/20260112_add_settings_scraper_logs_and_security_tables.sql`

## 4) Run the web app

```bash
npm run dev
```

Then open:

- http://localhost:3000

## (Optional) Run Redis + scraper workers

There are docker-compose files to run Redis plus the Celery worker/beat services.

Lead scraper:

```bash
docker compose -f docker-compose.lead-scraper.yml up
```

Candidate scraper:

```bash
docker compose -f docker-compose.candidate-scraper.yml up
```

Note: the worker containers read env from:

- `services/lead-scraper/.env`
- `services/candidate-scraper/.env`

## App navigation (what to click)

- **Login**: `/login`
- **Dashboard area**: `src/app/(dashboard)/...`
- **Settings hub**: `/settings`
  - Organization tab is implemented and persists to Supabase.
  - Additional settings tabs are scaffolded for ongoing work.

## Codebase map (where to develop)

- **UI routes (Next.js App Router)**: `src/app/`
  - Auth pages: `src/app/(auth)/...`
  - Dashboard pages: `src/app/(dashboard)/...`
  - API routes: `src/app/api/...`

- **Settings APIs**: `src/app/api/settings/...`
  - Example: `src/app/api/settings/organization/route.ts`

- **Supabase clients**: `src/lib/db/supabase/`
  - Server: `src/lib/db/supabase/server.ts`
  - Browser: `src/lib/db/supabase/browser.ts`

- **State management**: `src/lib/store/` (Zustand)

- **Validation**: `src/lib/validation/` (Zod)

- **Scraper services (Python)**: `services/`
  - Lead scraper: `services/lead-scraper/`
  - Candidate scraper: `services/candidate-scraper/`

## Common scripts

- `npm run dev` - start Next.js dev server
- `npm run build` - production build
- `npm run lint` - lint
- `npm run worker:notifications` - run the notifications worker locally

## Sharing this repo with an intern (recommended workflow)

- Do not commit `.env.local`.
- Make sure the intern uses `.env.example` as the template.
- Have them create their own Supabase project (or give access to a dev/staging project).
