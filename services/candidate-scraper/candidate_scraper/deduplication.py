from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rapidfuzz import fuzz

from .models import Candidate


def normalize_email(email: str | None) -> str | None:
  if not email:
    return None
  return email.strip().lower()


def normalize_phone_digits(phone: str | None) -> str | None:
  if not phone:
    return None
  digits = "".join(ch for ch in phone if ch.isdigit())
  return digits or None


def normalize_license_number(value: str | None) -> str | None:
  if not value:
    return None
  v = value.strip().upper()
  v = "".join(ch for ch in v if ch.isalnum())
  return v or None


@dataclass(frozen=True)
class DedupeResult:
  is_duplicate: bool
  reason: str | None = None


def is_duplicate_candidate(
  candidate: Candidate,
  existing: list[dict[str, Any]],
  *,
  fuzzy_threshold: int = 90,
) -> DedupeResult:
  cand_email = normalize_email(candidate.email)
  cand_phone = normalize_phone_digits(candidate.phone)
  cand_license = normalize_license_number(candidate.license_number)
  cand_name = (candidate.name or "").strip().lower()

  for row in existing:
    row_license = normalize_license_number(row.get("license_number"))
    if cand_license and row_license and cand_license == row_license:
      row_name = (row.get("name") or "").strip().lower()
      if not row_name or not cand_name or row_name == cand_name:
        return DedupeResult(True, "license_number_exact")

    row_email = normalize_email(row.get("email"))
    if cand_email and row_email and cand_email == row_email:
      return DedupeResult(True, "email_exact")

    row_phone = normalize_phone_digits(row.get("phone"))
    if cand_phone and row_phone:
      if cand_phone == row_phone:
        return DedupeResult(True, "phone_digits_exact")
      score = fuzz.ratio(cand_phone, row_phone)
      if score >= fuzzy_threshold:
        return DedupeResult(True, f"phone_fuzzy_{score}")

    # secondary: name + location fuzzy
    row_name = (row.get("name") or "").strip().lower()
    row_loc = (row.get("location") or "").strip().lower()
    cand_loc = (candidate.location or "").strip().lower()
    if row_name and cand_name and row_loc and cand_loc and row_loc == cand_loc:
      score = fuzz.ratio(cand_name, row_name)
      if score >= 94:
        return DedupeResult(True, f"name_location_fuzzy_{score}")

  return DedupeResult(False, None)
