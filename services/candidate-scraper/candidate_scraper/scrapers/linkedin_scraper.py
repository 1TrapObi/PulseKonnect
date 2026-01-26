from __future__ import annotations

from ..models import Candidate
from .base import BaseScraper


class LinkedInScraper(BaseScraper):
  name = "linkedin"

  def scrape(self) -> list[Candidate]:
    # Disabled by default. Use official APIs where possible.
    return []
