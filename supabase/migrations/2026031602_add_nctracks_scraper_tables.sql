-- NCTracks scraper architecture (Phase 1)

-- Update leads table with scraper-specific fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) CHECK (priority IN ('High', 'Medium', 'Low')),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS scraper_metadata JSONB;

-- Create scraper_runs table to track scraper execution
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scraper_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  leads_found INTEGER DEFAULT 0,
  leads_imported INTEGER DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  config JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create scraper_config table for storing scraper settings per organization
CREATE TABLE IF NOT EXISTS scraper_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scraper_type VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('hourly', 'daily', 'weekly')),
  target_volume INTEGER DEFAULT 15,
  filters JSONB,
  keywords TEXT[],
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, scraper_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_quality_score ON leads(quality_score);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_org_type ON scraper_runs(organization_id, scraper_type);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_config_org ON scraper_config(organization_id);

-- Create function to update next_run_at based on frequency
CREATE OR REPLACE FUNCTION update_next_run_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_run_at := CASE NEW.frequency
    WHEN 'hourly' THEN NEW.last_run_at + INTERVAL '1 hour'
    WHEN 'daily' THEN NEW.last_run_at + INTERVAL '1 day'
    WHEN 'weekly' THEN NEW.last_run_at + INTERVAL '7 days'
    ELSE NEW.last_run_at + INTERVAL '1 day'
  END;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating next_run_at
DROP TRIGGER IF EXISTS trigger_update_next_run_time ON scraper_config;
CREATE TRIGGER trigger_update_next_run_time
BEFORE UPDATE OF last_run_at ON scraper_config
FOR EACH ROW
EXECUTE FUNCTION update_next_run_time();
