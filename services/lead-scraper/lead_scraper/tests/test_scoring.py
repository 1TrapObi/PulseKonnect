from __future__ import annotations

from lead_scraper.models import Lead
from lead_scraper.scoring import score_urgency


def test_score_court_is_high() -> None:
  lead = Lead(name="A", email=None, phone=None, need_type="anything", source="court")
  scored = score_urgency(lead, crisis_keywords=["crisis"])
  assert scored.urgency == "high"


def test_score_crisis_keywords_high() -> None:
  lead = Lead(
    name="A",
    email=None,
    phone=None,
    need_type="standard referral",
    source="hospital",
    raw_data={"description": "patient is suicidal"},
  )
  scored = score_urgency(lead, crisis_keywords=["suicidal", "overdose"])
  assert scored.urgency == "high"
