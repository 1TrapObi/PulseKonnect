-- Adds lead qualification fields and organization settings needed for CCSS-002.

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) organization_settings table
CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  service_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) leads table additions
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS qualification_score INTEGER,
  ADD COLUMN IF NOT EXISTS qualification_status TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3) Trigger to update updated_at on organization_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_organization_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
