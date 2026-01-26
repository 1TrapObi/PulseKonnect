from __future__ import annotations

from lead_scraper.deduplication import is_duplicate_candidate
from lead_scraper.models import Lead


def test_dedup_email_exact() -> None:
  existing = [{"email": "Test@Email.com", "phone": None}]
  cand = Lead(name="A", email="test@email.com", phone=None, need_type="x", source="court")
  res = is_duplicate_candidate(cand, existing)
  assert res.is_duplicate
  assert res.reason == "email_exact"


def test_dedup_phone_digits_exact() -> None:
  existing = [{"email": None, "phone": "(919) 555-1200"}]
  cand = Lead(name="A", email=None, phone="9195551200", need_type="x", source="hospital")
  res = is_duplicate_candidate(cand, existing)
  assert res.is_duplicate
  assert res.reason == "phone_digits_exact"


def test_dedup_phone_fuzzy() -> None:
  existing = [{"email": None, "phone": "9195551200"}]
  cand = Lead(name="A", email=None, phone="919-555-1201", need_type="x", source="hospital")
  res = is_duplicate_candidate(cand, existing, fuzzy_threshold=90)
  assert res.is_duplicate
  assert res.reason and res.reason.startswith("phone_fuzzy_")
