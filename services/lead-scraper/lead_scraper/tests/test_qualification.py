from __future__ import annotations

import json

import pytest

from lead_scraper.models import Lead
from lead_scraper.qualification import qualify_lead
import lead_scraper.tasks as tasks


def test_qualification_sample_cases() -> None:
  settings = {
    "service_areas": [
      "Durham County, NC",
      "Wayne County, NC",
      "Rocky Mount, NC",
      "Burlington, NC",
    ],
    "service_types": [
      "Substance Abuse Treatment",
      "Mental Health Counseling",
      "Peer Support Services",
      "Intensive In-Home Services",
      "Crisis Intervention",
      "Family Therapy",
    ],
  }

  lead1 = Lead(
    name="A",
    email=None,
    phone=None,
    need_type="Substance abuse treatment needed",
    location="Durham County, NC",
    urgency="high",
    source="community",
    raw_data={"description": "opioid recovery"},
  )
  r1 = qualify_lead(lead1, organization_settings=settings)
  assert r1.status == "high"
  assert r1.score >= 80

  lead2 = Lead(
    name="B",
    email=None,
    phone=None,
    need_type="Mental health counseling referral",
    location="Wake County, NC",
    urgency="medium",
    source="hospital",
    raw_data={"description": "anxiety"},
  )
  r2 = qualify_lead(lead2, organization_settings=settings)
  assert r2.status in {"medium", "high"}
  assert r2.score >= 50

  lead3 = Lead(
    name="C",
    email=None,
    phone=None,
    need_type="General inquiry",
    location="New York, NY",
    urgency="low",
    source="web",
    raw_data={"description": ""},
  )
  r3 = qualify_lead(lead3, organization_settings=settings)
  assert r3.status == "rejected"
  assert r3.score < 25
  assert r3.rejection_reason


def test_geo_distance_tapers_geographic_score_when_hq_coords_present() -> None:
  # Durham-area lead but far away should reduce geo score when max_distance_miles is configured.
  settings = {
    "service_areas": ["Durham County, NC"],
    "service_types": ["Crisis Intervention"],
    "hq_lat": 35.893,  # approx south Durham
    "hq_lng": -78.857,
    "max_distance_miles": 50,
  }

  near = Lead(
    name="N",
    email=None,
    phone=None,
    need_type="crisis intervention",
    location="Durham County, NC",
    urgency="high",
    source="web",
    raw_data={"lat": 35.893, "lng": -78.857},
  )

  far = Lead(
    name="F",
    email=None,
    phone=None,
    need_type="crisis intervention",
    location="Durham County, NC",
    urgency="high",
    source="web",
    # ~90 miles away
    raw_data={"lat": 36.4, "lng": -80.0},
  )

  r_near = qualify_lead(near, organization_settings=settings)
  r_far = qualify_lead(far, organization_settings=settings)

  assert r_near.geo.distance_from_center_miles <= r_far.geo.distance_from_center_miles
  assert r_near.geo.geographic_score >= r_far.geo.geographic_score


def test_run_lead_discovery_enqueues_qualification(monkeypatch: pytest.MonkeyPatch) -> None:
  calls: list[tuple[str, str]] = []

  class _Delay:
    def __call__(self, lead_id: str, org_id: str):
      calls.append((lead_id, org_id))

  class _FakeSupabase:
    def __init__(self):
      self.existing = []
      self.inserted: list[dict] = []
      self.activities: list[dict] = []

    def table(self, name: str):
      return _FakeQuery(self, name)

  class _FakeQuery:
    def __init__(self, parent: _FakeSupabase, name: str):
      self.parent = parent
      self.name = name
      self.data = []

    def select(self, *_args, **_kwargs):
      if self.name == "leads":
        self.data = list(self.parent.existing)
      return self

    def eq(self, *_args, **_kwargs):
      return self

    def limit(self, *_args, **_kwargs):
      return self

    def insert(self, rows):
      if self.name == "leads":
        inserted = dict(rows[0])
        inserted["id"] = inserted.get("id", f"lead-{len(self.parent.inserted)+1}")
        self.parent.inserted.append(inserted)
        self.data = [inserted]
      elif self.name == "activities":
        self.parent.activities.append(rows[0])
        self.data = rows
      return self

    def execute(self):
      class _Resp:
        def __init__(self, data):
          self.data = data

      return _Resp(self.data)

  fake_supabase = _FakeSupabase()

  settings = tasks.get_settings()
  settings = type(settings)(
    supabase_url="https://example.supabase.co",
    supabase_service_role_key="service",
    lead_organization_id="org-1",
    redis_url=settings.redis_url,
    scrape_enabled_court=True,
    scrape_enabled_hospital=False,
    scrape_enabled_samhsa=False,
    scrape_enabled_community=False,
    hospital_urls=[],
    samhsa_base_url=settings.samhsa_base_url,
    crisis_keywords=settings.crisis_keywords,
  )

  monkeypatch.setattr(tasks, "get_settings", lambda: settings)
  monkeypatch.setattr(tasks, "create_supabase", lambda _settings: fake_supabase)
  monkeypatch.setattr(tasks, "fetch_existing_leads", lambda _sb, _org: [])
  monkeypatch.setattr(tasks.qualify_lead, "delay", _Delay())

  result = tasks.run_lead_discovery()
  assert result["inserted"] >= 1
  assert len(calls) >= 1
  assert calls[0][1] == "org-1"

  # ensure discovery activity still logged
  assert any(a.get("action") == "lead_discovered" for a in fake_supabase.activities)


def test_qualification_log_activity_payload_is_json(monkeypatch: pytest.MonkeyPatch) -> None:
  recorded_notes: list[str] = []

  def _fake_log_activity(_sb, *, lead_id, user_id, action, notes=None):
    if action == "lead_qualification_decision" and notes:
      recorded_notes.append(notes)

  monkeypatch.setattr(tasks, "log_activity", _fake_log_activity)

  # call the engine payload formatting directly (no Supabase)
  lead = Lead(
    name="A",
    email=None,
    phone=None,
    need_type="crisis intervention",
    location="Durham County, NC",
    urgency="high",
    source="court",
  )
  r = qualify_lead(lead, organization_settings=None)

  payload = {
    "qualification_score": r.score,
    "qualification_status": r.status,
    "rejection_reason": r.rejection_reason,
    "geo": {
      "in_area": r.geo.in_area,
      "distance_from_center_miles": r.geo.distance_from_center_miles,
      "geographic_score": r.geo.geographic_score,
      "matched_area": r.geo.matched_area,
    },
    "services": {
      "match_score": r.services.match_score,
      "matched_services": r.services.matched_services,
    },
    "urgency_score": r.urgency_score,
  }

  tasks.log_activity(
    None,
    lead_id="lead-1",
    user_id=None,
    action="lead_qualification_decision",
    notes=json.dumps(payload),
  )

  assert recorded_notes
  json.loads(recorded_notes[0])
