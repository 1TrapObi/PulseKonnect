from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from supabase import Client, create_client

from .config import Settings


def create_supabase(settings: Settings) -> Client:
  if not settings.supabase_url or not settings.supabase_service_role_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  return create_client(settings.supabase_url, settings.supabase_service_role_key)


def fetch_existing_candidates(supabase: Client, organization_id: str, limit: int = 10_000) -> list[dict[str, Any]]:
  resp = (
    supabase.table("candidates")
    .select("id,name,email,phone,license_type,license_number,location")
    .eq("organization_id", organization_id)
    .limit(limit)
    .execute()
  )
  return list(resp.data or [])


def insert_candidate(supabase: Client, row: dict[str, Any]) -> dict[str, Any] | None:
  resp = supabase.table("candidates").insert(row).execute()
  if resp.data:
    return resp.data[0]
  return None


def fetch_candidate_by_id(supabase: Client, candidate_id: str) -> dict[str, Any] | None:
  resp = supabase.table("candidates").select("*").eq("id", candidate_id).limit(1).execute()
  if resp.data:
    return resp.data[0]
  return None


def update_candidate(supabase: Client, candidate_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
  resp = supabase.table("candidates").update(fields).eq("id", candidate_id).execute()
  if resp.data:
    return resp.data[0]
  return None


def fetch_positions(supabase: Client, organization_id: str, limit: int = 10_000) -> list[dict[str, Any]]:
  try:
    resp = (
      supabase.table("positions")
      .select("id,license_required,experience_level,specializations")
      .eq("organization_id", organization_id)
      .limit(limit)
      .execute()
    )
    return list(resp.data or [])
  except Exception:
    return []


def upsert_candidate_position_matches(
  supabase: Client,
  *,
  candidate_id: str,
  matches: list[dict[str, Any]],
) -> None:
  if not matches:
    return
  try:
    supabase.table("candidate_position_matches").upsert(matches, on_conflict="candidate_id,position_id").execute()
  except Exception:
    return


def log_activity(supabase: Client, *, action: str, notes: dict[str, Any] | None = None) -> None:
  payload = {
    "action": action,
    "notes": json.dumps(notes or {}),
    "created_at": datetime.utcnow().isoformat(),
  }
  try:
    supabase.table("activities").insert(payload).execute()
  except Exception:
    return
