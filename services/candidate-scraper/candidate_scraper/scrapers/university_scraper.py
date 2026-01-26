from __future__ import annotations

from bs4 import BeautifulSoup

from ..models import Candidate
from .base import BaseScraper


class UniversityCareerScraper(BaseScraper):
  name = "university"

  def __init__(self, *, urls: list[str], rate_limit=None) -> None:
    super().__init__(rate_limit=rate_limit)
    self.urls = urls

  def scrape(self) -> list[Candidate]:
    # MVP: if urls not configured, return empty list.
    # If configured, scrape very conservatively: only extract publicly visible contact/license hints.
    if not self.urls:
      return []

    results: list[Candidate] = []

    for url in self.urls:
      try:
        html = self.get(url).text
      except Exception:
        continue

      soup = BeautifulSoup(html, "lxml")
      # Generic heuristic: look for job/candidate postings in links.
      for a in soup.select("a[href]")[:50]:
        text = (a.get_text() or "").strip()
        href = a.get("href")
        if not href:
          continue
        if "counsel" in text.lower() or "social work" in text.lower() or "therapy" in text.lower():
          results.append(
            Candidate(
              name=text[:255] or "University Candidate",
              source="university",
              source_url=href,
              location=None,
              raw_data={"page": url},
            )
          )

    return results
