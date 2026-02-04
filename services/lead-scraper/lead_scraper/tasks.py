from __future__ import annotations

import json
from datetime import datetime, timezone

from celery.utils.log import get_task_logger

from .celery_config import celery_app
from .config import get_settings
from .deduplication import is_duplicate_candidate
from .models import Lead
from .qualification import qualify_lead as qualify_lead_engine
from .scoring import score_urgency
from .scrapers.community_scraper import CommunityDirectoryScraper
from .scrapers.court_scraper import CourtScraper
from .scrapers.hospital_scraper import HospitalReferralScraper
from .scrapers.samhsa_scraper import SAMHSATreatmentLocatorScraper
from .supabase_client import (
  create_supabase,
  fetch_existing_leads,
  fetch_lead_by_id,
  fetch_organization_settings,
  fetch_unqualified_lead_ids,
  insert_lead,
  log_activity,
  update_lead_qualification,
)


logger = get_task_logger(__name__)


def _build_scrapers_from_source_rows(source_rows: list[dict], settings) -> list:
  scrapers = []

  for row in source_rows:
    source_type = str(row.get("source_type") or "").strip().lower()
    if source_type in {"court", "court_dockets"}:
      scrapers.append(CourtScraper())
      continue

    if source_type in {"hospital", "hospitals"}:
      urls_val = row.get("urls")
      urls: list[str] = []
      if isinstance(urls_val, list):
        urls = [str(u).strip() for u in urls_val if str(u).strip()]
      elif isinstance(urls_val, str):
        urls = [u.strip() for u in urls_val.split(",") if u.strip()]

      if not urls:
        base = str(row.get("base_url") or "").strip()
        if base:
          urls = [base]

      scrapers.append(HospitalReferralScraper(urls or settings.hospital_urls))
      continue

    if source_type in {"samhsa", "findtreatment", "treatment_locator"}:
      base = str(row.get("base_url") or "").strip() or settings.samhsa_base_url
      scrapers.append(SAMHSATreatmentLocatorScraper(base))
      continue

    if source_type in {"community", "community_directory", "directory"}:
      scrapers.append(CommunityDirectoryScraper())
      continue

  return scrapers


def _run_discovery_for_org(*, organization_id: str, scrapers: list, settings) -> dict:
  supabase = create_supabase(settings)

  existing = fetch_existing_leads(supabase, organization_id)
  logger.info("Loaded %s existing leads", len(existing))

  discovered: list[Lead] = []
  for scraper in scrapers:
    try:
      leads = scraper.scrape()
      logger.info("Scraper %s produced %s leads", scraper.name, len(leads))
      discovered.extend(leads)
    except Exception as e:
      logger.exception("Scraper %s failed: %s", getattr(scraper, "name", "unknown"), e)

  inserted_count = 0
  duplicate_count = 0

  for lead in discovered:
    lead_scored = score_urgency(lead, settings.crisis_keywords)
    dupe = is_duplicate_candidate(lead_scored, existing)

    if dupe.is_duplicate:
      duplicate_count += 1
      log_activity(
        supabase,
        lead_id=None,
        user_id=None,
        action="lead_discovery_duplicate_skipped",
        notes=json.dumps(
          {
            "source": lead_scored.source,
            "name": lead_scored.name,
            "email": lead_scored.email,
            "phone": lead_scored.phone,
            "reason": dupe.reason,
          }
        ),
      )
      continue

    row = _lead_to_row(lead_scored, organization_id)
    inserted = insert_lead(supabase, row)

    if inserted and inserted.get("id"):
      inserted_count += 1
      existing.append(
        {
          "id": inserted.get("id"),
          "name": inserted.get("name"),
          "email": inserted.get("email"),
          "phone": inserted.get("phone"),
        }
      )
      log_activity(
        supabase,
        lead_id=inserted.get("id"),
        user_id=None,
        action="lead_discovered",
        notes=json.dumps(
          {
            "source": lead_scored.source,
            "source_url": lead_scored.source_url,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
          }
        ),
      )

      try:
        qualify_lead.delay(inserted.get("id"), organization_id)
      except Exception as e:
        logger.exception("Failed to enqueue qualification for lead %s: %s", inserted.get("id"), e)
        log_activity(
          supabase,
          lead_id=inserted.get("id"),
          user_id=None,
          action="lead_qualification_failed",
          notes=json.dumps({"error": str(e)}),
        )

  summary = {
    "inserted": inserted_count,
    "duplicates": duplicate_count,
    "total": len(discovered),
  }

  logger.info("Lead discovery summary: %s", summary)
  return summary


def _lead_to_row(lead: Lead, organization_id: str) -> dict:
  return {
    "name": lead.name,
    "email": lead.email,
    "phone": lead.phone,
    "need_type": lead.need_type,
    "source": lead.source,
    "status": lead.status,
    "urgency": lead.urgency,
    "notes": None,
    "organization_id": organization_id,
    "location": lead.location,
    "source_url": lead.source_url,
    "raw_data": lead.raw_data,
  }


@celery_app.task(name="lead_scraper.tasks.qualify_lead")
def qualify_lead(lead_id: str, organization_id: str) -> dict:
  settings = get_settings()
  supabase = create_supabase(settings)

  lead_row = fetch_lead_by_id(supabase, lead_id)
  if not lead_row:
    raise ValueError(f"Lead not found: {lead_id}")

  org_settings = fetch_organization_settings(supabase, organization_id)

  lead = Lead(
    name=str(lead_row.get("name") or ""),
    email=lead_row.get("email"),
    phone=lead_row.get("phone"),
    need_type=str(lead_row.get("need_type") or ""),
    location=lead_row.get("location"),
    urgency=str(lead_row.get("urgency") or "medium"),
    source=str(lead_row.get("source") or "unknown"),
    source_url=lead_row.get("source_url"),
    raw_data=lead_row.get("raw_data") or {},
    status=str(lead_row.get("status") or "new"),
  )

  result = qualify_lead_engine(lead, organization_settings=org_settings)

  update_lead_qualification(
    supabase,
    lead_id=lead_id,
    qualification_score=result.score,
    qualification_status=result.status,
    rejection_reason=result.rejection_reason,
  )

  log_activity(
    supabase,
    lead_id=lead_id,
    user_id=None,
    action="lead_qualification_decision",
    notes=json.dumps(
      {
        "qualification_score": result.score,
        "qualification_status": result.status,
        "rejection_reason": result.rejection_reason,
        "geo": {
          "in_area": result.geo.in_area,
          "distance_from_center_miles": result.geo.distance_from_center_miles,
          "geographic_score": result.geo.geographic_score,
          "matched_area": result.geo.matched_area,
        },
        "services": {
          "match_score": result.services.match_score,
          "matched_services": result.services.matched_services,
        },
        "urgency_score": result.urgency_score,
      }
    ),
  )

  return {
    "lead_id": lead_id,
    "qualification_score": result.score,
    "qualification_status": result.status,
  }


@celery_app.task(name="lead_scraper.tasks.qualify_unqualified_leads")
def qualify_unqualified_leads(limit: int = 50) -> dict:
  settings = get_settings()
  if not settings.lead_organization_id:
    raise ValueError("LEAD_ORGANIZATION_ID is required")

  supabase = create_supabase(settings)
  ids = fetch_unqualified_lead_ids(
    supabase, organization_id=settings.lead_organization_id, limit=limit
  )

  processed = 0
  for lead_id in ids:
    try:
      qualify_lead(lead_id, settings.lead_organization_id)
      processed += 1
    except Exception as e:
      logger.exception("Failed to enqueue qualification for lead %s: %s", lead_id, e)
      log_activity(
        supabase,
        lead_id=lead_id,
        user_id=None,
        action="lead_qualification_failed",
        notes=json.dumps({"error": str(e)}),
      )

  return {"scanned": len(ids), "processed": processed}


@celery_app.task(name="lead_scraper.tasks.run_lead_discovery")
def run_lead_discovery() -> dict:
  settings = get_settings()

  if not settings.lead_organization_id:
    raise ValueError("LEAD_ORGANIZATION_ID is required")

  scrapers = []
  if settings.scrape_enabled_court:
    scrapers.append(CourtScraper())
  if settings.scrape_enabled_hospital:
    scrapers.append(HospitalReferralScraper(settings.hospital_urls))
  if settings.scrape_enabled_samhsa:
    scrapers.append(SAMHSATreatmentLocatorScraper(settings.samhsa_base_url))
  if settings.scrape_enabled_community:
    scrapers.append(CommunityDirectoryScraper())

  return _run_discovery_for_org(
    organization_id=settings.lead_organization_id,
    scrapers=scrapers,
    settings=settings,
  )


@celery_app.task(name="lead_scraper.tasks.run_lead_discovery_for_sources")
def run_lead_discovery_for_sources(source_ids: list[str], organization_id: str) -> dict:
  settings = get_settings()

  if not organization_id:
    raise ValueError("organization_id is required")
  if not isinstance(source_ids, list) or not source_ids:
    raise ValueError("source_ids is required")

  supabase = create_supabase(settings)

  resp = (
    supabase.table("lead_sources")
    .select("id,source_type,base_url,urls,is_active,is_enabled")
    .in_("id", source_ids)
    .eq("is_active", True)
    .execute()
  )

  rows = list(resp.data or [])
  rows = [r for r in rows if bool((r or {}).get("is_enabled", True))]

  scrapers = _build_scrapers_from_source_rows(rows, settings)
  if not scrapers:
    return {"inserted": 0, "duplicates": 0, "total": 0}

  return _run_discovery_for_org(
    organization_id=organization_id,
    scrapers=scrapers,
    settings=settings,
  )
