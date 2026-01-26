from __future__ import annotations

from datetime import datetime, timezone

from ..models import Candidate
from .base import BaseScraper


class IndeedScraper(BaseScraper):
  name = "indeed"

  def __init__(self, *, api_key: str | None, query: str, location: str, rate_limit=None) -> None:
    super().__init__(rate_limit=rate_limit)
    self.api_key = api_key
    self.query = query
    self.location = location

  def scrape(self) -> list[Candidate]:
    # MVP: offline-capable dummy data.
    # If an official Indeed API is added later, implement it here.
    now = datetime.now(timezone.utc).isoformat()
    return [
      Candidate(
        name="Alex Johnson",
        email=None,
        phone=None,
        license_type="LCSW",
        license_number="NC-LCSW-12345",
        experience_years=5,
        specializations=["mental health", "trauma"],
        location="Raleigh, NC",
        current_employer="Community Wellness Group",
        resume_url=None,
        resume_text="5 years experience in mental health and trauma-informed care.",
        source="indeed",
        source_url=f"https://example.com/indeed/mock/{now}",
        raw_data={"mock": True},
      ),
      Candidate(
        name="Jordan Smith",
        email="jordan.smith@example.com",
        phone="(919) 555-0101",
        license_type="LPC",
        license_number=None,
        experience_years=2,
        specializations=["substance abuse"],
        location="Durham, NC",
        current_employer=None,
        resume_url=None,
        resume_text="2 years experience in addiction recovery and outpatient counseling.",
        source="indeed",
        source_url=f"https://example.com/indeed/mock/{now}/2",
        raw_data={"mock": True},
      ),
    ]
