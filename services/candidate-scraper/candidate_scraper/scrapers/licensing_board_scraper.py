from __future__ import annotations

from ..models import Candidate
from .base import BaseScraper


class LicensingBoardScraper(BaseScraper):
  name = "licensing_board"

  def scrape(self) -> list[Candidate]:
    return []
