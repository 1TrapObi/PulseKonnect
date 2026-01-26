-- Admin onboarding Step 4 schema for CCSS-016.

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS recruitment_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_sources JSONB NOT NULL,
  hiring_volume VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_prefs_org_id ON recruitment_preferences(organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_recruitment_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_recruitment_preferences_updated_at
    BEFORE UPDATE ON recruitment_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
