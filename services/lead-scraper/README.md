# CCSS-001 Lead Scraper Service

Python service for automated lead discovery.

## What this service does

- Runs multiple lead scrapers (court, hospital, SAMHSA, community)
- Deduplicates against existing leads
- Scores urgency
- Inserts new leads into Supabase/Postgres
- Logs scraping activity into `activities`
- Runs on a Celery schedule (every 4 hours)

## Local setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEAD_ORGANIZATION_ID`

3. Start Redis + worker + beat:

```bash
docker compose -f ../../docker-compose.lead-scraper.yml up --build
```

4. Trigger a run manually (optional):

```bash
docker compose -f ../../docker-compose.lead-scraper.yml exec lead-scraper-worker celery -A lead_scraper.celery_config call lead_scraper.tasks.run_lead_discovery
```

## Tests

```bash
pytest -q --cov=lead_scraper
```

## Notes

- Two scrapers are offline-capable dummy sources so you can validate the pipeline immediately.
- SAMHSA scraper is implemented defensively and can be disabled via env.
