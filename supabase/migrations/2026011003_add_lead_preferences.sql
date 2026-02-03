-- Admin onboarding Step 3 schema for CCSS-015.

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS lead_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  lead_sources JSONB NOT NULL,
  volume_goal VARCHAR(20) NOT NULL,
  assignment_method VARCHAR(50) NOT NULL DEFAULT 'manual',
  email_high_priority BOOLEAN DEFAULT true,
  daily_digest BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_prefs_org_id ON lead_preferences(organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_lead_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_lead_preferences_updated_at
    BEFORE UPDATE ON lead_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
