-- Admin onboarding Step 2 schema additions for CCSS-014.

ALTER TABLE organization_profiles
  ADD COLUMN IF NOT EXISTS service_types JSONB,
  ADD COLUMN IF NOT EXISTS other_service_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS age_groups JSONB,
  ADD COLUMN IF NOT EXISTS insurance_types JSONB,
  ADD COLUMN IF NOT EXISTS other_insurance_type VARCHAR(255);
