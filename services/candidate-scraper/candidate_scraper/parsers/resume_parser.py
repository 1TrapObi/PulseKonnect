from __future__ import annotations

import re


_SPECIALIZATION_KEYWORDS = {
  "substance abuse": ["substance", "addiction", "sud", "recovery"],
  "mental health": ["mental health", "depression", "anxiety", "ptsd"],
  "trauma-informed care": ["trauma-informed", "trauma", "ptsd", "emdr"],
  "family therapy": ["family therapy", "couples", "couples counseling", "marriage"],
  "crisis intervention": ["crisis", "suicide", "suicide prevention", "hotline"],
  "adolescent/youth services": ["adolescent", "youth", "teen", "child"],
  "group therapy": ["group therapy", "group facilitation"],
}


def extract_experience_years(text: str | None) -> int | None:
  if not text:
    return None

  t = text.lower()
  # patterns like "5+ years" or "3 years"
  m = re.search(r"(\d{1,2})\s*\+?\s*years", t)
  if m:
    try:
      return int(m.group(1))
    except Exception:
      return None

  # patterns like "two years" not handled for MVP
  return None


def extract_specializations(text: str | None) -> list[str]:
  if not text:
    return []

  t = text.lower()
  matched: list[str] = []
  for spec, keys in _SPECIALIZATION_KEYWORDS.items():
    if any(k in t for k in keys):
      matched.append(spec)

  return matched
