from __future__ import annotations

import json

from celery.utils.log import get_task_logger

from .celery_config import celery_app
from .config import get_settings
from .deduplication import is_duplicate_candidate
from .models import Candidate
from .parsers.license_validator import is_acceptable_license
from .parsers.resume_parser import extract_experience_years, extract_specializations
from .qualification import qualify_candidate_data, score_position_match
from .scrapers.base import RateLimit
from .scrapers.indeed_scraper import IndeedScraper
from .scrapers.licensing_board_scraper import LicensingBoardScraper
from .scrapers.linkedin_scraper import LinkedInScraper
from .scrapers.nasw_scraper import NASWScraper
from .scrapers.university_scraper import UniversityCareerScraper
from .supabase_client import (
  create_supabase,
  fetch_candidate_by_id,
  fetch_existing_candidates,
  fetch_positions,
  insert_candidate,
  log_activity,
  update_candidate,
  upsert_candidate_position_matches,
)


logger = get_task_logger(__name__)


def _candidate_to_row(candidate: Candidate, organization_id: str) -> dict:
  return {
    "name": candidate.name,
    "email": candidate.email,
    "phone": candidate.phone,
    "license_type": candidate.license_type,
    "license_number": candidate.license_number,
    "experience_years": candidate.experience_years,
    "specializations": candidate.specializations,
    "location": candidate.location,
    "current_employer": candidate.current_employer,
    "resume_url": candidate.resume_url,
    "resume_text": candidate.resume_text,
    "source": candidate.source,
    "source_url": candidate.source_url,
    "raw_data": candidate.raw_data,
    "status": candidate.status,
    "organization_id": organization_id,
  }


def _enrich(candidate: Candidate) -> Candidate:
  exp = candidate.experience_years
  if exp is None:
    exp = extract_experience_years(candidate.resume_text)

  specs = candidate.specializations
  if not specs:
    specs = extract_specializations(candidate.resume_text)

  return Candidate(
    **{
      **candidate.__dict__,
      "experience_years": exp,
      "specializations": specs,
    }
  )


@celery_app.task(name="candidate_scraper.tasks.qualify_candidate")
def qualify_candidate(candidate_id: str) -> dict:
  settings = get_settings()
  supabase = create_supabase(settings)

  cand = fetch_candidate_by_id(supabase, candidate_id)
  if not cand:
    return {"candidate_id": candidate_id, "qualified": False, "reason": "not_found"}

  resume_text = cand.get("resume_text")
  experience_years = cand.get("experience_years")
  specializations = cand.get("specializations")
  if specializations is None:
    specializations = []

  positions = fetch_positions(supabase, cand.get("organization_id"))

  candidate_level = None
  if isinstance(experience_years, int):
    if experience_years <= 2:
      candidate_level = "entry"
    elif experience_years <= 5:
      candidate_level = "mid"
    else:
      candidate_level = "senior"

  position_matches: list[dict] = []
  match_rows: list[dict] = []
  if positions:
    for p in positions:
      score, reasons = score_position_match(
        candidate_license_type=cand.get("license_type"),
        candidate_experience_level=candidate_level,
        candidate_specializations=list(specializations or []),
        position_license_required=p.get("license_required"),
        position_experience_level=p.get("experience_level"),
        position_specializations=p.get("specializations") or [],
      )
      position_matches.append({"position_id": p.get("id"), "match_score": score, "match_reasons": reasons})

    position_matches.sort(key=lambda x: int(x.get("match_score") or 0), reverse=True)
    top = position_matches[:3]
    for m in top:
      if m.get("position_id"):
        match_rows.append(
          {
            "candidate_id": candidate_id,
            "position_id": m.get("position_id"),
            "match_score": m.get("match_score"),
            "match_reasons": m.get("match_reasons"),
          }
        )

  required_level = None
  if position_matches:
    best_id = position_matches[0].get("position_id")
    best = next((p for p in positions if p.get("id") == best_id), None)
    if best:
      required_level = best.get("experience_level")

  q = qualify_candidate_data(
    license_type=cand.get("license_type"),
    license_number=cand.get("license_number"),
    resume_text=resume_text,
    experience_years=experience_years,
    specializations=list(specializations or []),
    location=cand.get("location"),
    required_experience_level=required_level,
    matched_positions=position_matches[:3] if position_matches else [],
  )

  updated = update_candidate(
    supabase,
    candidate_id,
    {
      "experience_years": q.experience_years,
      "experience_level": q.experience_level,
      "location_fit": q.location_fit,
      "license_valid": q.license_valid,
      "qualification_status": q.qualification_status,
      "qualified_at": q.qualified_at,
      "matched_positions": q.matched_positions,
      "fit_score": q.fit_score,
    },
  )

  if match_rows:
    upsert_candidate_position_matches(supabase, candidate_id=candidate_id, matches=match_rows)

  log_activity(
    supabase,
    action="candidate_qualified",
    notes={
      "candidate_id": candidate_id,
      "fit_score": q.fit_score,
      "qualification_status": q.qualification_status,
      "license_level": q.license_level,
      "experience_level": q.experience_level,
      "location_fit": q.location_fit,
      "matched_specializations": q.matched_specializations,
      "matched_positions": q.matched_positions,
    },
  )

  return {"candidate_id": candidate_id, "qualified": bool(updated), "fit_score": q.fit_score}


@celery_app.task(name="candidate_scraper.tasks.run_candidate_discovery")
def run_candidate_discovery() -> dict:
  settings = get_settings()

  if not settings.candidate_organization_id:
    raise ValueError("CANDIDATE_ORGANIZATION_ID is required")

  supabase = create_supabase(settings)
  existing = fetch_existing_candidates(supabase, settings.candidate_organization_id)
  logger.info("Loaded %s existing candidates", len(existing))

  scrapers = []
  if settings.scrape_enabled_indeed:
    scrapers.append(
      IndeedScraper(
        api_key=settings.indeed_api_key,
        query=settings.indeed_query,
        location=settings.indeed_location,
        rate_limit=RateLimit(settings.rate_limit_per_hour_indeed),
      )
    )
  if settings.scrape_enabled_university:
    scrapers.append(
      UniversityCareerScraper(
        urls=settings.university_career_urls,
        rate_limit=RateLimit(settings.rate_limit_per_hour_university),
      )
    )
  if settings.scrape_enabled_linkedin:
    scrapers.append(LinkedInScraper())
  if settings.scrape_enabled_nasw:
    scrapers.append(NASWScraper())
  if settings.scrape_enabled_licensing_board:
    scrapers.append(LicensingBoardScraper())

  discovered: list[Candidate] = []
  for scraper in scrapers:
    try:
      items = scraper.scrape()
      logger.info("Scraper %s produced %s candidates", scraper.name, len(items))
      discovered.extend(items)
    except Exception as e:
      logger.exception("Scraper %s failed: %s", getattr(scraper, "name", "unknown"), e)

  inserted_count = 0
  duplicate_count = 0
  rejected_count = 0

  for cand in discovered:
    enriched = _enrich(cand)

    if enriched.license_type and not is_acceptable_license(enriched.license_type):
      rejected_count += 1
      log_activity(
        supabase,
        action="candidate_discovery_rejected",
        notes={"reason": "license_not_acceptable", "name": enriched.name, "source": enriched.source},
      )
      continue

    dupe = is_duplicate_candidate(enriched, existing)
    if dupe.is_duplicate:
      duplicate_count += 1
      log_activity(
        supabase,
        action="candidate_discovery_duplicate_skipped",
        notes={
          "source": enriched.source,
          "name": enriched.name,
          "email": enriched.email,
          "phone": enriched.phone,
          "license_number": enriched.license_number,
          "reason": dupe.reason,
        },
      )
      continue

    row = _candidate_to_row(enriched, settings.candidate_organization_id)
    inserted = insert_candidate(supabase, row)

    if inserted and inserted.get("id"):
      inserted_count += 1
      existing.append(
        {
          "id": inserted.get("id"),
          "name": inserted.get("name"),
          "email": inserted.get("email"),
          "phone": inserted.get("phone"),
          "license_type": inserted.get("license_type"),
          "license_number": inserted.get("license_number"),
          "location": inserted.get("location"),
        }
      )
      log_activity(
        supabase,
        action="candidate_discovered",
        notes={
          "candidate_id": inserted.get("id"),
          "source": enriched.source,
          "source_url": enriched.source_url,
          "license_type": enriched.license_type,
          "experience_years": enriched.experience_years,
          "specializations": enriched.specializations,
        },
      )

      try:
        qualify_candidate.delay(str(inserted.get("id")))
      except Exception:
        continue

  summary = {
    "scraped": len(discovered),
    "inserted": inserted_count,
    "duplicates": duplicate_count,
    "rejected": rejected_count,
  }

  logger.info("Candidate discovery summary: %s", json.dumps(summary))
  return summary
