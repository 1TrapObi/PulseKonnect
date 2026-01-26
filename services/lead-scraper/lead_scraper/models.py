from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


Urgency = Literal["high", "medium", "low"]
LeadStatus = Literal["new", "contacted", "qualified", "disqualified", "converted"]


class Lead(BaseModel):
  name: str
  email: str | None = None
  phone: str | None = None
  need_type: str
  location: str | None = None
  urgency: Urgency = "medium"
  source: str
  source_url: str | None = None
  raw_data: dict[str, Any] = Field(default_factory=dict)
  status: LeadStatus = "new"

  def normalized_email(self) -> str | None:
    if not self.email:
      return None
    return self.email.strip().lower()

  def normalized_phone_digits(self) -> str | None:
    if not self.phone:
      return None
    digits = "".join(ch for ch in self.phone if ch.isdigit())
    return digits or None
