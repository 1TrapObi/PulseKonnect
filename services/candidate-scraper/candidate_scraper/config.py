from __future__ import annotations

from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


def _get_bool(name: str, default: bool) -> bool:
  val = os.getenv(name)
  if val is None:
    return default
  return val.strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_int(name: str, default: int) -> int:
  raw = os.getenv(name)
  if raw is None:
    return default
  try:
    return int(raw)
  except Exception:
    return default


@dataclass(frozen=True)
class Settings:
  supabase_url: str
  supabase_service_role_key: str
  candidate_organization_id: str
  redis_url: str

  scrape_enabled_indeed: bool
  scrape_enabled_university: bool
  scrape_enabled_linkedin: bool
  scrape_enabled_nasw: bool
  scrape_enabled_licensing_board: bool

  indeed_api_key: str | None
  indeed_query: str
  indeed_location: str

  university_career_urls: list[str]

  rate_limit_per_hour_indeed: int
  rate_limit_per_hour_university: int


def get_settings() -> Settings:
  supabase_url = os.getenv("SUPABASE_URL", "").strip()
  supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
  candidate_organization_id = os.getenv("CANDIDATE_ORGANIZATION_ID", "").strip()

  redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()

  university_urls_raw = os.getenv("UNIVERSITY_CAREER_URLS", "").strip()
  university_career_urls = [u.strip() for u in university_urls_raw.split(",") if u.strip()]

  return Settings(
    supabase_url=supabase_url,
    supabase_service_role_key=supabase_service_role_key,
    candidate_organization_id=candidate_organization_id,
    redis_url=redis_url,
    scrape_enabled_indeed=_get_bool("SCRAPE_ENABLED_INDEED", True),
    scrape_enabled_university=_get_bool("SCRAPE_ENABLED_UNIVERSITY", True),
    scrape_enabled_linkedin=_get_bool("SCRAPE_ENABLED_LINKEDIN", False),
    scrape_enabled_nasw=_get_bool("SCRAPE_ENABLED_NASW", False),
    scrape_enabled_licensing_board=_get_bool("SCRAPE_ENABLED_LICENSING_BOARD", False),
    indeed_api_key=os.getenv("INDEED_API_KEY", "").strip() or None,
    indeed_query=os.getenv(
      "INDEED_QUERY",
      "(LCSW OR LPC OR LCAS OR LMSW OR therapist OR counselor OR case manager)",
    ).strip(),
    indeed_location=os.getenv("INDEED_LOCATION", "North Carolina").strip(),
    university_career_urls=university_career_urls,
    rate_limit_per_hour_indeed=_get_int("RATE_LIMIT_PER_HOUR_INDEED", 100),
    rate_limit_per_hour_university=_get_int("RATE_LIMIT_PER_HOUR_UNIVERSITY", 60),
  )
