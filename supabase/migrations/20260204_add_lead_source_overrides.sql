-- Support per-organization overrides of global lead sources

ALTER TABLE lead_sources
  ADD COLUMN IF NOT EXISTS parent_source_id UUID REFERENCES lead_sources(id) ON DELETE CASCADE;

ALTER TABLE lead_sources
  ADD CONSTRAINT IF NOT EXISTS chk_lead_sources_parent_org
  CHECK (
    parent_source_id IS NULL OR organization_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_sources_org_parent
  ON lead_sources(organization_id, parent_source_id)
  WHERE parent_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_sources_parent
  ON lead_sources(parent_source_id);
