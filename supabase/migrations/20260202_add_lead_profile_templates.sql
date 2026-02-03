-- Lead profile templates system for CCSS-024.

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS lead_profile_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  configuration JSONB NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_profile_templates_org_id ON lead_profile_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_profile_templates_active ON lead_profile_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lead_profile_templates_system_defaults ON lead_profile_templates(is_system_default) WHERE is_system_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_profile_templates_system_name
ON lead_profile_templates(name)
WHERE organization_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_lead_profile_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_lead_profile_templates_updated_at
    BEFORE UPDATE ON lead_profile_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed system templates (insert only if not already present)
INSERT INTO lead_profile_templates (
  organization_id,
  name,
  description,
  is_system_default,
  configuration,
  tags
)
SELECT
  NULL,
  t.name,
  t.description,
  true,
  t.configuration,
  t.tags
FROM (
  VALUES
    (
      'Urgent Care',
      'High-value, fast-moving leads. Best for agencies prioritizing immediate placements and higher urgency cases.',
      '{
        "leadSources": [
          {"source":"Hospital Discharge Programs","priority":"high"},
          {"source":"Treatment Facility Referrals","priority":"high"},
          {"source":"Court-Mandated Referrals","priority":"medium"}
        ],
        "volumeGoal": "high",
        "assignmentMethod": "manual",
        "emailHighPriority": true,
        "dailyDigest": false,
        "weeklyReport": true,
        "highlights": {
          "focus": "Fast hiring",
          "minPayRate": 22,
          "urgency": "high"
        }
      }'::jsonb,
      ARRAY['high_value','fast_hiring','premium_rates']::text[]
    ),
    (
      'Respite Care',
      'Family caregiver support and respite-focused leads. Best for agencies looking for steadier demand and family support cases.',
      '{
        "leadSources": [
          {"source":"Community Organizations","priority":"high"},
          {"source":"Direct Website Inquiries","priority":"medium"},
          {"source":"Social Media Outreach","priority":"low"}
        ],
        "volumeGoal": "medium",
        "assignmentMethod": "manual",
        "emailHighPriority": true,
        "dailyDigest": true,
        "weeklyReport": true,
        "highlights": {
          "focus": "Family support",
          "minPayRate": 16,
          "urgency": "medium"
        }
      }'::jsonb,
      ARRAY['family_focused','flexible','respite']::text[]
    ),
    (
      'Young Adults',
      'Optimized for adolescent/young adult need types. Best for agencies specializing in youth and young adult behavioral health.',
      '{
        "leadSources": [
          {"source":"Community Organizations","priority":"high"},
          {"source":"Social Media Outreach","priority":"high"},
          {"source":"Direct Website Inquiries","priority":"medium"}
        ],
        "volumeGoal": "medium",
        "assignmentMethod": "manual",
        "emailHighPriority": true,
        "dailyDigest": false,
        "weeklyReport": true,
        "highlights": {
          "focus": "Youth",
          "minPayRate": 18,
          "urgency": "medium"
        }
      }'::jsonb,
      ARRAY['youth_focused','mental_health','substance_abuse']::text[]
    ),
    (
      'High Pay Rate Priority',
      'Filters for revenue-first outcomes. Best for agencies that only want higher-paying opportunities.',
      '{
        "leadSources": [
          {"source":"Insurance Provider Networks","priority":"high"},
          {"source":"Hospital Discharge Programs","priority":"medium"},
          {"source":"Direct Website Inquiries","priority":"low"}
        ],
        "volumeGoal": "low",
        "assignmentMethod": "manual",
        "emailHighPriority": true,
        "dailyDigest": false,
        "weeklyReport": true,
        "highlights": {
          "focus": "Premium rates",
          "minPayRate": 20,
          "urgency": "medium"
        }
      }'::jsonb,
      ARRAY['premium_rates','high_revenue','flexible_location']::text[]
    ),
    (
      'Balanced Approach',
      'A well-rounded default. Best for agencies who want a steady flow without over-optimizing for any single factor.',
      '{
        "leadSources": [
          {"source":"Treatment Facility Referrals","priority":"medium"},
          {"source":"Community Organizations","priority":"medium"},
          {"source":"Direct Website Inquiries","priority":"medium"}
        ],
        "volumeGoal": "medium",
        "assignmentMethod": "manual",
        "emailHighPriority": true,
        "dailyDigest": false,
        "weeklyReport": true,
        "highlights": {
          "focus": "Balanced",
          "minPayRate": 17,
          "urgency": "medium"
        }
      }'::jsonb,
      ARRAY['balanced','moderate_volume','quality_focus']::text[]
    )
) AS t(name, description, configuration, tags)
WHERE NOT EXISTS (
  SELECT 1
  FROM lead_profile_templates existing
  WHERE existing.organization_id IS NULL
    AND existing.name = t.name
);
