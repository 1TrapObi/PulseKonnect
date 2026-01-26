from __future__ import annotations

from .base import BaseScraper
from ..models import Lead


class CommunityDirectoryScraper(BaseScraper):
  name = "community_directories_dummy"

  def scrape(self) -> list[Lead]:
    # Dummy/offline-capable dataset. Future: scrape community org directories.
    return [
      Lead(
        name="Crisis Hotline Referral",
        email=None,
        phone="(984) 555-9911",
        need_type="crisis referral - suicidal ideation",
        location="Wake County, NC",
        urgency="high",
        source="community",
        source_url="https://example.com/community-directory",
        raw_data={
          "description": "Caller reported suicidal thoughts; needs immediate follow-up.",
        },
        status="new",
      )
    ]
