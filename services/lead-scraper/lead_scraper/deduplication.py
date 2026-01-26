from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rapidfuzz import fuzz

from .models import Lead


def normalize_email(email: str | None) -> str | None:
  if not email:
    return None
  return email.strip().lower()


def normalize_phone_digits(phone: str | None) -> str | None:
  if not phone:
    return None
  digits = "".join(ch for ch in phone if ch.isdigit())
  return digits or None


@dataclass(frozen=True)
class DedupeResult:
  is_duplicate: bool
  reason: str | None = None


def is_duplicate_candidate(
  candidate: Lead,
  existing: list[dict[str, Any]],
  *,
  fuzzy_threshold: int = 92,
) -> DedupeResult:
  cand_email = normalize_email(candidate.email)
  cand_phone = normalize_phone_digits(candidate.phone)

  for row in existing:
    row_email = normalize_email(row.get("email"))
    if cand_email and row_email and cand_email == row_email:
      return DedupeResult(True, "email_exact")

    row_phone = normalize_phone_digits(row.get("phone"))
    if cand_phone and row_phone:
      if cand_phone == row_phone:
        return DedupeResult(True, "phone_digits_exact")

      # fuzzy compare digits-only strings
      score = fuzz.ratio(cand_phone, row_phone)
      if score >= fuzzy_threshold:
        return DedupeResult(True, f"phone_fuzzy_{score}")

  return DedupeResult(False, None)
