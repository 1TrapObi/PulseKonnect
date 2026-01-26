from __future__ import annotations

from celery import Celery

from .config import get_settings


settings = get_settings()

celery_app = Celery(
  "lead_scraper",
  broker=settings.redis_url,
  backend=settings.redis_url,
  include=["lead_scraper.tasks"],
)

celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# Every 4 hours
celery_app.conf.beat_schedule = {
  "run-lead-discovery-every-4-hours": {
    "task": "lead_scraper.tasks.run_lead_discovery",
    "schedule": 60 * 60 * 4,
  },
  "qualify-unqualified-leads-every-10-min": {
    "task": "lead_scraper.tasks.qualify_unqualified_leads",
    "schedule": 60 * 10,
  },
}
