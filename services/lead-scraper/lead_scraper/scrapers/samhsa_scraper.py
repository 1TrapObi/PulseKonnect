from __future__ import annotations

from .base import BaseScraper
from ..models import Lead


class SAMHSATreatmentLocatorScraper(BaseScraper):
  name = "samhsa_locator"

  def __init__(self, base_url: str):
    self.base_url = base_url

  def scrape(self) -> list[Lead]:
    # Placeholder: Ticket asks for SAMHSA locator API.
    # Implementation can be added once endpoint/params are finalized.
    # For MVP, return empty to avoid external dependency.
    return []
