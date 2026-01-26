from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Candidate:
  name: str
  email: str | None = None
  phone: str | None = None

  license_type: str | None = None
  license_number: str | None = None

  experience_years: int | None = None
  specializations: list[str] = field(default_factory=list)

  location: str | None = None
  current_employer: str | None = None

  resume_url: str | None = None
  resume_text: str | None = None

  source: str = "unknown"
  source_url: str | None = None
  raw_data: dict[str, Any] = field(default_factory=dict)

  status: str = "new"
