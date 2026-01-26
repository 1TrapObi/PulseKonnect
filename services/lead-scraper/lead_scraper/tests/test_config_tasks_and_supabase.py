from __future__ import annotations

from dataclasses import replace

import pytest

import lead_scraper.celery_config as celery_config
from lead_scraper.config import Settings, get_settings
from lead_scraper.models import Lead
import lead_scraper.supabase_client as supabase_client
import lead_scraper.tasks as tasks


def test_get_settings_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
  monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
  monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
  monkeypatch.setenv("LEAD_ORGANIZATION_ID", "org")
  monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/9")
  monkeypatch.setenv("SCRAPE_ENABLED_COURT", "false")
  monkeypatch.setenv("SCRAPE_ENABLED_HOSPITAL", "true")
  monkeypatch.setenv("HOSPITAL_URLS", "https://a.com, https://b.com")
  monkeypatch.setenv("CRISIS_KEYWORDS", "crisis,overdose")

  s = get_settings()
  assert s.supabase_url == "https://example.supabase.co"
  assert s.redis_url.endswith("/9")
  assert s.scrape_enabled_court is False
  assert s.scrape_enabled_hospital is True
  assert s.hospital_urls == ["https://a.com", "https://b.com"]
  assert s.crisis_keywords == ["crisis", "overdose"]


def test_create_supabase_requires_env() -> None:
  s = Settings(
    supabase_url="",
    supabase_service_role_key="",
    lead_organization_id="org",
    redis_url="redis://localhost:6379/0",
    scrape_enabled_court=True,
    scrape_enabled_hospital=True,
    scrape_enabled_samhsa=False,
    scrape_enabled_community=False,
    hospital_urls=[],
    samhsa_base_url="",
    crisis_keywords=[],
  )
  with pytest.raises(ValueError):
    supabase_client.create_supabase(s)


def test_celery_config_has_schedule() -> None:
  assert "run-lead-discovery-every-4-hours" in celery_config.celery_app.conf.beat_schedule


class _FakeQuery:
  def __init__(self, data=None):
    self.data = data

  def select(self, *_args, **_kwargs):
    return self

  def eq(self, *_args, **_kwargs):
    return self

  def limit(self, *_args, **_kwargs):
    return self

  def insert(self, rows):
    self._insert_rows = rows
    return self

  def execute(self):
    class _Resp:
      def __init__(self, data):
        self.data = data

    return _Resp(self.data)


class _FakeSupabase:
  def __init__(self, existing=None):
    self.existing = existing or []
    self.inserted = []
    self.activities = []

  def table(self, name: str):
    if name == "leads":
      return _FakeLeadsTable(self)
    if name == "activities":
      return _FakeActivitiesTable(self)
    return _FakeQuery([])


class _FakeLeadsTable(_FakeQuery):
  def __init__(self, parent: _FakeSupabase):
    super().__init__(parent.existing)
    self.parent = parent

  def insert(self, rows):
    row = rows[0]
    inserted = dict(row)
    inserted["id"] = inserted.get("id", "lead-1")
    self.parent.inserted.append(inserted)
    self.data = [inserted]
    return self


class _FakeActivitiesTable(_FakeQuery):
  def __init__(self, parent: _FakeSupabase):
    super().__init__([])
    self.parent = parent

  def insert(self, rows):
    self.parent.activities.append(rows[0])
    self.data = rows
    return self


def test_run_lead_discovery_inserts_and_dedupes(monkeypatch: pytest.MonkeyPatch) -> None:
  fake_supabase = _FakeSupabase(existing=[{"email": "mjohnson@example.com", "phone": None}])

  settings = get_settings()
  settings = replace(
    settings,
    supabase_url="https://example.supabase.co",
    supabase_service_role_key="service",
    lead_organization_id="org-1",
    scrape_enabled_court=True,
    scrape_enabled_hospital=True,
    scrape_enabled_samhsa=False,
    scrape_enabled_community=False,
    hospital_urls=["https://example.com"],
  )

  monkeypatch.setattr(tasks, "get_settings", lambda: settings)
  monkeypatch.setattr(tasks, "create_supabase", lambda _settings: fake_supabase)
  monkeypatch.setattr(tasks, "fetch_existing_leads", lambda _sb, _org: list(fake_supabase.existing))

  # Make sure we also cover duplicate path: hospital scraper lead uses mjohnson@example.com
  result = tasks.run_lead_discovery()

  assert result["total"] >= 1
  assert result["duplicates"] >= 1
  assert result["inserted"] >= 1

  # One lead inserted, and at least one activity logged
  assert len(fake_supabase.inserted) >= 1
  assert len(fake_supabase.activities) >= 1


def test_lead_to_row_maps_fields() -> None:
  lead = Lead(
    name="X",
    email="x@example.com",
    phone="123",
    need_type="standard",
    location="NC",
    urgency="medium",
    source="hospital",
    source_url="https://source",
    raw_data={"k": "v"},
    status="new",
  )
  row = tasks._lead_to_row(lead, "org")
  assert row["organization_id"] == "org"
  assert row["raw_data"] == {"k": "v"}
