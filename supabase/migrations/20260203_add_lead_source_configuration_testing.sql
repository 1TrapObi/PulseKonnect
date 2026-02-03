CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS lead_source_test_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_count INT NOT NULL DEFAULT 0,
  last_test_at TIMESTAMP WITH TIME ZONE,
  reset_at TIMESTAMP WITH TIME ZONE,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, test_date)
);

CREATE INDEX IF NOT EXISTS idx_test_usage_org_date ON lead_source_test_usage(organization_id, test_date);

CREATE TABLE IF NOT EXISTS lead_source_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES lead_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_type VARCHAR(50) DEFAULT 'manual',
  leads_found INT DEFAULT 0,
  test_leads JSONB,
  test_duration_ms INT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_org ON lead_source_test_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_test_results_source ON lead_source_test_results(source_id);
CREATE INDEX IF NOT EXISTS idx_test_results_created ON lead_source_test_results(created_at DESC);

ALTER TABLE lead_sources
  ADD COLUMN IF NOT EXISTS leads_this_week INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_score DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS scan_frequency VARCHAR(50) DEFAULT 'Every 4 hours',
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE;
