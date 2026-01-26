from __future__ import annotations

from .base import BaseScraper
from ..models import Lead


class HospitalReferralScraper(BaseScraper):
  name = "hospital_referrals_dummy"

  def __init__(self, urls: list[str] | None = None):
    self.urls = urls or ["https://example.com/hospital-referrals"]

  def scrape(self) -> list[Lead]:
    # Dummy/offline-capable dataset. Future: fetch each URL and parse.
    return [
      Lead(
        name="Michael Johnson",
        email="mjohnson@example.com",
        phone="919-555-1200",
        need_type="standard referral - outpatient therapy",
        location="Raleigh, NC",
        urgency="medium",
        source="hospital",
        source_url=self.urls[0],
        raw_data={
          "description": "Patient discharged; recommends outpatient therapy.",
        },
        status="new",
      )
    ]
