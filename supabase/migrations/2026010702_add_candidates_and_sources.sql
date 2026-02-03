-- Adds candidates and candidate_sources tables for CCSS-007.

-- 1) candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  license_type VARCHAR(50),
  license_number VARCHAR(100),
  experience_years INT,
  specializations JSONB,
  location VARCHAR(255),
  current_employer VARCHAR(255),
  resume_url TEXT,
  resume_text TEXT,
  source VARCHAR(100),
  source_url TEXT,
  raw_data JSONB,
  status VARCHAR(50) DEFAULT 'new',
  fit_score INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) candidate_sources table
CREATE TABLE IF NOT EXISTS candidate_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  url TEXT,
  enabled BOOLEAN DEFAULT true,
  frequency_hours INT DEFAULT 24,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  rate_limit_per_hour INT DEFAULT 100,
  config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) indexes
CREATE INDEX IF NOT EXISTS idx_candidates_org_created_at ON candidates(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);
CREATE INDEX IF NOT EXISTS idx_candidates_license_number ON candidates(license_number);
CREATE INDEX IF NOT EXISTS idx_candidates_license_type ON candidates(license_type);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at);

-- 4) updated_at trigger reuse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_candidates_updated_at'
  ) THEN
    CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
