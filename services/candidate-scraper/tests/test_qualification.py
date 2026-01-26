from __future__ import annotations

from candidate_scraper.qualification import qualify_candidate_data


def test_candidate_1_excellent_fit() -> None:
  res = qualify_candidate_data(
    license_type="LCSW",
    license_number="1234",
    resume_text="5+ years experience in addiction recovery and trauma-informed care.",
    experience_years=None,
    specializations=[],
    location="Durham, NC",
    required_experience_level="senior",
  )
  assert res.fit_score >= 75
  assert res.qualification_status == "excellent"


def test_candidate_2_good_fit() -> None:
  res = qualify_candidate_data(
    license_type="LPC",
    license_number=None,
    resume_text="2 years of experience treating depression and anxiety.",
    experience_years=None,
    specializations=[],
    location="Raleigh, NC",
    required_experience_level="mid",
  )
  assert res.fit_score >= 60
  assert res.qualification_status in {"good", "excellent"}


def test_candidate_3_fair_fit() -> None:
  res = qualify_candidate_data(
    license_type="LMSW",
    license_number=None,
    resume_text="1 years experience.",
    experience_years=None,
    specializations=[],
    location="Austin, TX",
    required_experience_level="mid",
  )
  assert res.fit_score >= 40
  assert res.qualification_status in {"fair", "good", "excellent"}


def test_candidate_4_poor_fit() -> None:
  res = qualify_candidate_data(
    license_type=None,
    license_number=None,
    resume_text="recent graduate",
    experience_years=0,
    specializations=[],
    location=None,
    required_experience_level="senior",
  )
  assert res.fit_score < 40
  assert res.qualification_status == "poor"
