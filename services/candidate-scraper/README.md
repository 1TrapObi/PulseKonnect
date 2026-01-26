# CCSS-007 Candidate Scraper Service

Python service for automated candidate discovery.

## Local setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CANDIDATE_ORGANIZATION_ID`

## Database migration

Apply the Supabase migration:

- `supabase/migrations/20260107_add_candidates_and_sources.sql`

## Run with Docker Compose

Start Redis + worker + beat:

```bash
docker compose -f ../../docker-compose.candidate-scraper.yml up --build
```

## Manual trigger

```bash
docker compose -f ../../docker-compose.candidate-scraper.yml exec candidate-scraper-worker \
  celery -A candidate_scraper.celery_config call candidate_scraper.tasks.run_candidate_discovery
```

## Tests

```bash
pytest -q --cov=candidate_scraper
```
