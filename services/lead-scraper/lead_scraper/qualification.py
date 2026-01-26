from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

from .models import Lead


@dataclass(frozen=True)
class GeoResult:
  in_area: bool
  distance_from_center_miles: float
  geographic_score: int
  matched_area: str | None = None


@dataclass(frozen=True)
class ServiceMatchResult:
  match_score: int
  matched_services: list[str]


@dataclass(frozen=True)
class QualificationResult:
  score: int
  status: str
  rejection_reason: str | None
  geo: GeoResult
  services: ServiceMatchResult
  urgency_score: int


_DEFAULT_SERVICE_AREAS = [
  "Durham County, NC",
  "Wayne County, NC",
  "Rocky Mount, NC",
  "Burlington, NC",
]

_DEFAULT_SERVICE_TYPES = [
  "Substance Abuse Treatment",
  "Mental Health Counseling",
  "Peer Support Services",
  "Intensive In-Home Services",
  "Crisis Intervention",
  "Family Therapy",
]

# Approximate centers (lat, lon) for distance estimates.
_AREA_CENTERS = {
  "Durham County, NC": (35.9940, -78.8986),
  "Wayne County, NC": (35.3849, -77.9928),  # Goldsboro
  "Rocky Mount, NC": (35.9382, -77.7905),
  "Burlington, NC": (36.0957, -79.4378),
}

_ADJACENT_HINTS = {
  "Durham County, NC": [
    "wake",
    "orange",
    "person",
    "granville",
    "chatham",
    "johnston",
  ],
  "Wayne County, NC": [
    "lenoir",
    "greene",
    "wilson",
    "johnston",
    "duplin",
    "sampson",
  ],
  "Rocky Mount, NC": [
    "nash",
    "edgecombe",
    "wilson",
    "halifax",
    "franklin",
    "johnston",
  ],
  "Burlington, NC": [
    "alamance",
    "orange",
    "caswell",
    "guilford",
    "randolph",
    "chatham",
  ],
}

_SERVICE_KEYWORDS = {
  "Substance Abuse Treatment": ["substance", "sud", "addiction", "recovery", "detox", "rehab", "opioid", "overdose"],
  "Mental Health Counseling": ["mental health", "counsel", "therapy", "depression", "anxiety", "psychiatric"],
  "Peer Support Services": ["peer", "support group", "group", "sponsor"],
  "Intensive In-Home Services": ["in-home", "intensive", "iih", "wraparound"],
  "Crisis Intervention": ["crisis", "suicidal", "overdose", "urgent", "hotline"],
  "Family Therapy": ["family", "parent", "couples", "marriage"],
}


def _haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
  lat1, lon1 = a
  lat2, lon2 = b
  r = 3958.7613
  phi1 = math.radians(lat1)
  phi2 = math.radians(lat2)
  dphi = math.radians(lat2 - lat1)
  dlambda = math.radians(lon2 - lon1)

  h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
  return 2 * r * math.asin(math.sqrt(h))


def _normalize_text(text: str) -> str:
  return re.sub(r"\s+", " ", (text or "").strip().lower())


def _extract_lead_coords(raw_data: dict[str, Any]) -> tuple[float, float] | None:
  candidates = [
    ("lat", "lng"),
    ("latitude", "longitude"),
    ("lat", "lon"),
  ]

  for a, b in candidates:
    if a in raw_data and b in raw_data:
      try:
        return (float(raw_data[a]), float(raw_data[b]))
      except Exception:
        return None
  return None


def validate_geography(
  location: str | None,
  service_areas: list[str],
  *,
  lead_coords: tuple[float, float] | None,
  hq_coords: tuple[float, float] | None,
  max_distance_miles: float | None,
) -> GeoResult:
  loc = _normalize_text(location or "")
  if not loc:
    return GeoResult(
      in_area=False, distance_from_center_miles=0.0, geographic_score=0, matched_area=None
    )

  distance = 0.0
  if lead_coords and hq_coords:
    try:
      distance = float(_haversine_miles(lead_coords, hq_coords))
    except Exception:
      distance = 0.0

  for area in service_areas:
    area_norm = _normalize_text(area)
    # direct substring hit (county/city)
    if area_norm and area_norm.split(",")[0] in loc:
      score = 100
      if max_distance_miles and distance > 0:
        # Taper up to 50% at (or beyond) max distance.
        ratio = min(1.0, max(0.0, distance / float(max_distance_miles)))
        score = int(round(score * (1.0 - (0.5 * ratio))))
      return GeoResult(
        in_area=True,
        distance_from_center_miles=distance,
        geographic_score=score,
        matched_area=area,
      )

  for area in service_areas:
    hints = _ADJACENT_HINTS.get(area, [])
    if any(h in loc for h in hints):
      # adjacent: partial geographic fit
      score = 60
      if max_distance_miles and distance > 0:
        ratio = min(1.0, max(0.0, distance / float(max_distance_miles)))
        score = int(round(score * (1.0 - (0.5 * ratio))))
      return GeoResult(
        in_area=False,
        distance_from_center_miles=distance,
        geographic_score=score,
        matched_area=area,
      )

  return GeoResult(
    in_area=False,
    distance_from_center_miles=distance,
    geographic_score=0,
    matched_area=None,
  )


def match_service_types(lead: Lead, service_types: list[str]) -> ServiceMatchResult:
  text = _normalize_text(
    " ".join(
      [
        lead.need_type or "",
        str(lead.raw_data) if isinstance(lead.raw_data, dict) else "",
      ]
    )
  )

  matched: list[str] = []
  for st in service_types:
    kws = _SERVICE_KEYWORDS.get(st, [])
    if any(kw in text for kw in kws):
      matched.append(st)

  if not service_types:
    return ServiceMatchResult(match_score=0, matched_services=[])

  # For MVP: treat any matched service as a strong fit.
  # This avoids diluting the score when the org offers many services.
  score = 100 if matched else 0
  return ServiceMatchResult(match_score=score, matched_services=matched)


def urgency_to_score(urgency: str) -> int:
  u = (urgency or "").strip().lower()
  if u == "high":
    return 100
  if u == "medium":
    return 60
  if u == "low":
    return 30
  return 50


def qualify_lead(
  lead: Lead,
  *,
  organization_settings: dict[str, Any] | None,
) -> QualificationResult:
  service_areas = list((organization_settings or {}).get("service_areas") or _DEFAULT_SERVICE_AREAS)
  service_types = list((organization_settings or {}).get("service_types") or _DEFAULT_SERVICE_TYPES)

  lead_coords = None
  if isinstance(lead.raw_data, dict):
    lead_coords = _extract_lead_coords(lead.raw_data)

  hq_lat = (organization_settings or {}).get("hq_lat")
  hq_lng = (organization_settings or {}).get("hq_lng")
  hq_coords = None
  if hq_lat is not None and hq_lng is not None:
    try:
      hq_coords = (float(hq_lat), float(hq_lng))
    except Exception:
      hq_coords = None

  max_distance_miles = (organization_settings or {}).get("max_distance_miles")
  try:
    max_distance_miles = float(max_distance_miles) if max_distance_miles is not None else None
  except Exception:
    max_distance_miles = None

  geo = validate_geography(
    lead.location,
    service_areas,
    lead_coords=lead_coords,
    hq_coords=hq_coords,
    max_distance_miles=max_distance_miles,
  )
  services = match_service_types(lead, service_types)
  urgency_score = urgency_to_score(lead.urgency)

  score = round((geo.geographic_score * 0.4) + (services.match_score * 0.4) + (urgency_score * 0.2))

  if score >= 80:
    status = "high"
  elif score >= 50:
    status = "medium"
  elif score >= 25:
    status = "low"
  else:
    status = "rejected"

  rejection_reason = None
  if status == "rejected":
    parts = []
    if geo.geographic_score == 0:
      parts.append("out_of_service_area")
    if services.match_score == 0:
      parts.append("no_service_match")
    rejection_reason = ",".join(parts) or "score_below_threshold"

  return QualificationResult(
    score=int(score),
    status=status,
    rejection_reason=rejection_reason,
    geo=geo,
    services=services,
    urgency_score=urgency_score,
  )
