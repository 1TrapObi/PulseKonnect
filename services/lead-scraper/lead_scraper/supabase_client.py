from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from .config import Settings


def create_supabase(settings: Settings) -> Client:
  if not settings.supabase_url or not settings.supabase_service_role_key:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return create_client(settings.supabase_url, settings.supabase_service_role_key)


def fetch_existing_leads(supabase: Client, organization_id: str) -> list[dict[str, Any]]:
  resp = (
    supabase.table("leads")
    .select("id,name,email,phone,organization_id")
    .eq("organization_id", organization_id)
    .execute()
  )
  data = resp.data or []
  return list(data)


def insert_lead(supabase: Client, lead_row: dict[str, Any]) -> dict[str, Any]:
  resp = supabase.table("leads").insert([lead_row]).execute()
  if not resp.data:
    return {}
  return resp.data[0]


def fetch_organization_settings(supabase: Client, organization_id: str) -> dict[str, Any] | None:
  resp = (
    supabase.table("organization_settings")
    .select(
      "organization_id,service_areas,service_types,hq_address,hq_lat,hq_lng,max_distance_miles"
    )
    .eq("organization_id", organization_id)
    .limit(1)
    .execute()
  )
  data = resp.data or []
  if not data:
    return None
  return dict(data[0])


def fetch_lead_by_id(supabase: Client, lead_id: str) -> dict[str, Any] | None:
  resp = supabase.table("leads").select("*").eq("id", lead_id).limit(1).execute()
  data = resp.data or []
  if not data:
    return None
  return dict(data[0])


def fetch_unqualified_lead_ids(
  supabase: Client,
  *,
  organization_id: str,
  limit: int = 50,
) -> list[str]:
  resp = (
    supabase.table("leads")
    .select("id")
    .eq("organization_id", organization_id)
    .is_("qualification_status", None)
    .limit(limit)
    .execute()
  )
  data = resp.data or []
  return [str(row.get("id")) for row in data if row.get("id")]


def update_lead_qualification(
  supabase: Client,
  *,
  lead_id: str,
  qualification_score: int,
  qualification_status: str,
  rejection_reason: str | None,
) -> None:
  update_row: dict[str, Any] = {
    "qualification_score": qualification_score,
    "qualification_status": qualification_status,
    "rejection_reason": rejection_reason,
  }
  supabase.table("leads").update(update_row).eq("id", lead_id).execute()


def log_activity(
  supabase: Client,
  *,
  lead_id: str | None,
  user_id: str | None,
  action: str,
  notes: str | None = None,
) -> None:
  supabase.table("activities").insert(
    [
      {
        "lead_id": lead_id,
        "user_id": user_id,
        "action": action,
        "notes": notes,
      }
    ]
  ).execute()
