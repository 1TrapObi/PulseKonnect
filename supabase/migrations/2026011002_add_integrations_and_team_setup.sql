-- Admin onboarding Step 5 schema for CCSS-017.

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users: track onboarding completion at user level (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE;

-- organizations: Post integration settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS post_api_key VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS post_connected BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS email_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  high_priority_leads BOOLEAN DEFAULT true,
  new_candidates BOOLEAN DEFAULT true,
  weekly_summary BOOLEAN DEFAULT false,
  system_updates BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_email_notification_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_email_notification_settings_updated_at
    BEFORE UPDATE ON email_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON team_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON team_invitations(token);
