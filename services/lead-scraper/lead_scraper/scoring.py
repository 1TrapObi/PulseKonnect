from __future__ import annotations

from .models import Lead


def score_urgency(lead: Lead, crisis_keywords: list[str]) -> Lead:
  text = " ".join(
    [
      lead.need_type or "",
      lead.raw_data.get("description", "") if isinstance(lead.raw_data, dict) else "",
    ]
  ).lower()

  if lead.source.lower().find("court") >= 0:
    return lead.model_copy(update={"urgency": "high"})

  for kw in crisis_keywords:
    if kw and kw in text:
      return lead.model_copy(update={"urgency": "high"})

  if lead.urgency not in {"high", "medium", "low"}:
    return lead.model_copy(update={"urgency": "medium"})

  return lead
