from __future__ import annotations

import os

from .celery_config import celery_app


def main() -> None:
  # Convenience entrypoint for the Dockerfile. Default behavior prints basic info.
  broker = celery_app.conf.broker_url
  print(f"candidate_scraper ready (broker={broker})")
  if os.getenv("RUN_ON_START", "").strip().lower() in {"1", "true", "yes"}:
    from .tasks import run_candidate_discovery

    run_candidate_discovery.delay()


if __name__ == "__main__":
  main()
