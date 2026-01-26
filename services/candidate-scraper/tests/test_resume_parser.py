from __future__ import annotations

from candidate_scraper.parsers.resume_parser import extract_experience_years, extract_specializations


def test_extract_experience_years():
  assert extract_experience_years("I have 5+ years of experience") == 5


def test_extract_specializations():
  specs = extract_specializations("Trauma informed mental health counseling")
  assert "trauma-informed care" in specs
  assert "mental health" in specs
