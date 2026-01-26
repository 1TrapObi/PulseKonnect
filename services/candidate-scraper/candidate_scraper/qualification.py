from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from rapidfuzz import fuzz

from .parsers.license_validator import normalize_license_type
from .parsers.resume_parser import extract_experience_years, extract_specializations


_IN_AREA = {
  "durham",
  "wayne",
  "rocky mount",
  "rocky mount, nc",
  "rocky mount nc",
  "burlington",
}

_ADJACENT = {
  "raleigh",
  "chapel hill",
  "greensboro",
}


@dataclass(frozen=True)
class QualificationResult:
  license_valid: bool
  license_level: str | None
  experience_level: str | None
  experience_years: int | None
  matched_specializations: list[str]
  match_count: int
  location_fit: str
  fit_score: int
  qualification_status: str
  qualified_at: str
  matched_positions: list[dict[str, Any]]


def _license_level(license_type: str | None) -> str | None:
  lt = normalize_license_type(license_type)
  if not lt:
    return None
  if lt in {"lcsw", "lpc", "lcas"}:
    return "clinical"
  if lt in {"lmsw"}:
    return "masters"
  return "other"


def assess_license(license_type: str | None, license_number: str | None) -> tuple[bool, str | None, int]:
  lt = normalize_license_type(license_type)
  if not lt:
    return False, None, 0

  level = _license_level(lt)

  if lt in {"lcsw", "lpc", "lcas"}:
    return True, level, 40
  if lt in {"lmsw"}:
    return True, level, 30

  return True, level, 0


def experience_level_from_years(years: int | None) -> str | None:
  if years is None:
    return None
  if years <= 2:
    return "entry"
  if years <= 5:
    return "mid"
  return "senior"


def _level_distance(a: str | None, b: str | None) -> int | None:
  order = {"entry": 0, "mid": 1, "senior": 2}
  if a not in order or b not in order:
    return None
  return abs(order[a] - order[b])


def score_experience(candidate_level: str | None, required_level: str | None) -> int:
  dist = _level_distance(candidate_level, required_level)
  if dist is None:
    return 10
  if dist == 0:
    return 30
  if dist == 1:
    return 20
  return 10


def _normalize_location(loc: str | None) -> str:
  return (loc or "").strip().lower()


def location_fit(location: str | None) -> str:
  loc = _normalize_location(location)
  if not loc:
    return "remote"

  for city in _IN_AREA:
    if city in loc:
      return "in-area"

  for city in _ADJACENT:
    if city in loc:
      return "adjacent"

  if "nc" in loc or "north carolina" in loc:
    return "remote"

  return "remote"


def score_location(fit: str) -> int:
  if fit == "in-area":
    return 10
  if fit == "adjacent":
    return 7
  return 5


_SPECIALIZATION_CANONICAL = [
  "substance abuse",
  "mental health",
  "trauma-informed care",
  "family therapy",
  "crisis intervention",
  "adolescent/youth services",
  "group therapy",
]


def match_specializations(extracted: list[str], *, fuzzy_threshold: int = 86) -> list[str]:
  found: list[str] = []
  lower = [s.strip().lower() for s in extracted if s and s.strip()]
  for canon in _SPECIALIZATION_CANONICAL:
    c = canon.lower()
    if any(c == s for s in lower):
      found.append(canon)
      continue
    if any(fuzz.partial_ratio(c, s) >= fuzzy_threshold for s in lower):
      found.append(canon)

  seen: set[str] = set()
  ordered: list[str] = []
  for s in found:
    if s not in seen:
      ordered.append(s)
      seen.add(s)
  return ordered


def score_specializations(match_count: int) -> int:
  if match_count >= 3:
    return 20
  if match_count == 2:
    return 15
  if match_count == 1:
    return 10
  return 0


def qualification_status_from_score(score: int) -> str:
  if score >= 75:
    return "excellent"
  if score >= 60:
    return "good"
  if score >= 40:
    return "fair"
  return "poor"


def qualify_candidate_data(
  *,
  license_type: str | None,
  license_number: str | None,
  resume_text: str | None,
  experience_years: int | None,
  specializations: list[str] | None,
  location: str | None,
  required_experience_level: str | None = None,
  extracted_specializations: list[str] | None = None,
  matched_positions: list[dict[str, Any]] | None = None,
) -> QualificationResult:
  years = experience_years
  if years is None:
    years = extract_experience_years(resume_text)

  specs = list(specializations or [])
  if not specs:
    specs = extract_specializations(resume_text)

  if extracted_specializations is not None:
    specs = extracted_specializations

  lic_valid, lic_level, lic_points = assess_license(license_type, license_number)

  cand_level = experience_level_from_years(years)
  exp_points = score_experience(cand_level, required_experience_level)

  matched_specs = match_specializations(specs)
  spec_points = score_specializations(len(matched_specs))

  loc_fit = location_fit(location)
  loc_points = score_location(loc_fit)

  total = max(0, min(100, lic_points + exp_points + spec_points + loc_points))
  status = qualification_status_from_score(total)

  return QualificationResult(
    license_valid=lic_valid,
    license_level=lic_level,
    experience_level=cand_level,
    experience_years=years,
    matched_specializations=matched_specs,
    match_count=len(matched_specs),
    location_fit=loc_fit,
    fit_score=total,
    qualification_status=status,
    qualified_at=datetime.utcnow().isoformat(),
    matched_positions=matched_positions or [],
  )


def score_position_match(
  *,
  candidate_license_type: str | None,
  candidate_experience_level: str | None,
  candidate_specializations: list[str],
  position_license_required: str | None,
  position_experience_level: str | None,
  position_specializations: list[str] | None,
) -> tuple[int, dict[str, Any]]:
  lic_valid, lic_level, lic_points = assess_license(candidate_license_type, None)
  reasons: dict[str, Any] = {
    "license_valid": lic_valid,
    "license_level": lic_level,
  }

  lic_req = normalize_license_type(position_license_required)
  cand_lic = normalize_license_type(candidate_license_type)

  if lic_req and cand_lic and lic_req == cand_lic:
    lic_match_points = 40
    reasons["license_match"] = "exact"
  elif lic_req and cand_lic:
    lic_match_points = 20 if lic_points > 0 else 0
    reasons["license_match"] = "partial"
  else:
    lic_match_points = 10 if lic_points > 0 else 0
    reasons["license_match"] = "unknown"

  exp_points = score_experience(candidate_experience_level, position_experience_level)
  reasons["experience_match"] = {
    "candidate": candidate_experience_level,
    "required": position_experience_level,
    "points": exp_points,
  }

  pos_specs = [s.strip().lower() for s in (position_specializations or []) if s and s.strip()]
  cand_specs = [s.strip().lower() for s in candidate_specializations if s and s.strip()]
  spec_overlap = sorted(set(pos_specs).intersection(set(cand_specs)))
  if len(spec_overlap) >= 3:
    spec_points = 20
  elif len(spec_overlap) == 2:
    spec_points = 15
  elif len(spec_overlap) == 1:
    spec_points = 10
  else:
    spec_points = 0

  reasons["specialization_overlap"] = spec_overlap

  total = max(0, min(100, lic_match_points + exp_points + spec_points))
  return total, reasons
