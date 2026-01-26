-- Settings & Configuration schema additions (Option 2 full spec)

-- Extend lead_sources for per-source configuration
ALTER TABLE lead_sources
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS urls JSONB,
  ADD COLUMN IF NOT EXISTS search_parameters JSONB,
  ADD COLUMN IF NOT EXISTS run_frequency VARCHAR(50),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20),
  ADD COLUMN IF NOT EXISTS max_results_per_run INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS dedup_window_days INT DEFAULT 90,
  ADD COLUMN IF NOT EXISTS auto_qualify BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reject_below_score INT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_lead_sources_org_id ON lead_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_is_active ON lead_sources(is_active);

-- Extend candidate_sources for per-source configuration and encrypted credentials
ALTER TABLE candidate_sources
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS search_parameters JSONB,
  ADD COLUMN IF NOT EXISTS api_credentials JSONB,
  ADD COLUMN IF NOT EXISTS max_results_per_run INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_candidate_sources_org_id ON candidate_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_sources_enabled ON candidate_sources(enabled);

-- Scraper run logs
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  status VARCHAR(50) NOT NULL,
  results_found INT DEFAULT 0,
  results_qualified INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_org_id ON scraper_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_source_type ON scraper_runs(source_type);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_started_at ON scraper_runs(started_at);

-- User activity log
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON user_activity_log(created_at);

-- User sessions (security tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  ip_address INET,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON user_sessions(last_active_at);
