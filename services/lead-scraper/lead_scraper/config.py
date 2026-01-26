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


@dataclass(frozen=True)
class Settings:
  supabase_url: str
  supabase_service_role_key: str
  lead_organization_id: str
  redis_url: str

  scrape_enabled_court: bool
  scrape_enabled_hospital: bool
  scrape_enabled_samhsa: bool
  scrape_enabled_community: bool

  hospital_urls: list[str]
  samhsa_base_url: str
  crisis_keywords: list[str]


def get_settings() -> Settings:
  supabase_url = os.getenv("SUPABASE_URL", "").strip()
  supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
  lead_organization_id = os.getenv("LEAD_ORGANIZATION_ID", "").strip()

  redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()

  hospital_urls_raw = os.getenv("HOSPITAL_URLS", "").strip()
  hospital_urls = [u.strip() for u in hospital_urls_raw.split(",") if u.strip()]

  crisis_raw = os.getenv("CRISIS_KEYWORDS", "crisis,overdose,suicidal").strip()
  crisis_keywords = [k.strip().lower() for k in crisis_raw.split(",") if k.strip()]

  return Settings(
    supabase_url=supabase_url,
    supabase_service_role_key=supabase_service_role_key,
    lead_organization_id=lead_organization_id,
    redis_url=redis_url,
    scrape_enabled_court=_get_bool("SCRAPE_ENABLED_COURT", True),
    scrape_enabled_hospital=_get_bool("SCRAPE_ENABLED_HOSPITAL", True),
    scrape_enabled_samhsa=_get_bool("SCRAPE_ENABLED_SAMHSA", True),
    scrape_enabled_community=_get_bool("SCRAPE_ENABLED_COMMUNITY", True),
    hospital_urls=hospital_urls,
    samhsa_base_url=os.getenv("SAMHSA_BASE_URL", "https://findtreatment.gov/locator").strip(),
    crisis_keywords=crisis_keywords,
  )
