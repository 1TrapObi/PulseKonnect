CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id_external TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  gender VARCHAR(20),
  city VARCHAR(100),
  zip_code VARCHAR(10),
  diagnosis_code_1 VARCHAR(50),
  diagnosis_code_2 VARCHAR(50),
  primary_payer VARCHAR(100),
  lead_quality_score INTEGER CHECK (lead_quality_score BETWEEN 0 AND 100),
  priority_level VARCHAR(20) CHECK (priority_level IN ('high', 'medium', 'low')),
  geographic_priority VARCHAR(20),
  age_category VARCHAR(20),
  diagnosis_priority VARCHAR(20),
  reasoning TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'checkpoint',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, client_id_external)
);

CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON clients (organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_quality_score ON clients (lead_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_clients_priority_level ON clients (priority_level);
CREATE INDEX IF NOT EXISTS idx_clients_city_zip ON clients (city, zip_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_clients_updated_at'
  ) THEN
    CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
