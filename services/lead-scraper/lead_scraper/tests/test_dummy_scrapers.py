from __future__ import annotations

from lead_scraper.scrapers.court_scraper import CourtScraper
from lead_scraper.scrapers.hospital_scraper import HospitalReferralScraper


def test_court_scraper_returns_leads() -> None:
  leads = CourtScraper().scrape()
  assert len(leads) >= 1


def test_hospital_scraper_returns_leads() -> None:
  leads = HospitalReferralScraper(["https://example.com"]).scrape()
  assert len(leads) >= 1
