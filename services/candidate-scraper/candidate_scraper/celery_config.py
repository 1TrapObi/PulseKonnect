from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from .config import get_settings


settings = get_settings()

celery_app = Celery(
  "candidate_scraper",
  broker=settings.redis_url,
  backend=settings.redis_url,
  include=["candidate_scraper.tasks"],
)

celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# Daily at 2:00 AM UTC (use off-peak; adjust as needed)
celery_app.conf.beat_schedule = {
  "run-candidate-discovery-daily": {
    "task": "candidate_scraper.tasks.run_candidate_discovery",
    "schedule": crontab(minute=0, hour=2),
  }
}
