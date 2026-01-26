from __future__ import annotations

from ..models import Candidate
from .base import BaseScraper


class NASWScraper(BaseScraper):
  name = "nasw"

  def scrape(self) -> list[Candidate]:
    return []
