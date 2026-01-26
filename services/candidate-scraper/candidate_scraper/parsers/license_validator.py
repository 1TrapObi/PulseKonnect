from __future__ import annotations

import re


_ALLOWED_LICENSES = {
  "lcsw",
  "lpc",
  "lcas",
  "lmsw",
  "lmft",
  "csac",
}


def normalize_license_type(value: str | None) -> str | None:
  if not value:
    return None
  v = value.strip().lower()
  v = re.sub(r"[^a-z0-9]", "", v)
  return v or None


def is_acceptable_license(license_type: str | None) -> bool:
  lt = normalize_license_type(license_type)
  if not lt:
    return False
  return lt in _ALLOWED_LICENSES
