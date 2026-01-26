from __future__ import annotations

from .tasks import run_lead_discovery


if __name__ == "__main__":
  # Local entrypoint for quick manual run without Celery.
  print(run_lead_discovery())
