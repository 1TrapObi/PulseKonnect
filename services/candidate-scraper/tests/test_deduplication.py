from __future__ import annotations

from candidate_scraper.deduplication import is_duplicate_candidate
from candidate_scraper.models import Candidate


def test_dedupe_email_exact():
  existing = [{"email": "a@b.com", "phone": None, "license_number": None, "name": "X", "location": "Raleigh"}]
  cand = Candidate(name="Test", email="A@B.com", source="indeed")
  res = is_duplicate_candidate(cand, existing)
  assert res.is_duplicate
  assert res.reason == "email_exact"


def test_dedupe_license_number_exact():
  existing = [{"license_number": "NC-LCSW-123", "name": "Alex", "location": "Raleigh"}]
  cand = Candidate(name="Alex", license_number="nc lcsw 123", source="indeed")
  res = is_duplicate_candidate(cand, existing)
  assert res.is_duplicate
  assert res.reason == "license_number_exact"
