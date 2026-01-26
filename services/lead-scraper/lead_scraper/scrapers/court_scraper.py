from __future__ import annotations

from .base import BaseScraper
from ..models import Lead


class CourtScraper(BaseScraper):
  name = "court_dockets_durham_dummy"

  def scrape(self) -> list[Lead]:
    # Dummy/offline-capable dataset for MVP validation.
    # In future: replace with Durham County docket scraping.
    return [
      Lead(
        name="John Doe",
        email=None,
        phone="(919) 555-1200",
        need_type="court-mandated treatment referral",
        location="Durham County, NC",
        urgency="high",
        source="court",
        source_url="https://example.com/durham-court-dockets",
        raw_data={
          "case_number": "25-CM-000123",
          "description": "Court-mandated assessment required.",
        },
        status="new",
      ),
      Lead(
        name="Jane Smith",
        email="jane.smith@example.com",
        phone="9195551200",
        need_type="court ordered substance use evaluation",
        location="Durham County, NC",
        urgency="high",
        source="court",
        source_url="https://example.com/durham-court-dockets",
        raw_data={
          "case_number": "25-CM-000124",
          "description": "Defendant ordered to complete evaluation.",
        },
        status="new",
      ),
    ]
