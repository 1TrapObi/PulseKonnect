-- Add fields required for Carolina CSS bulk lead imports

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS race TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS phone_home TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS insurance_payer TEXT,
  ADD COLUMN IF NOT EXISTS insurance_id TEXT,
  ADD COLUMN IF NOT EXISTS secondary_insurance_type TEXT,
  ADD COLUMN IF NOT EXISTS secondary_insurance_payer TEXT,
  ADD COLUMN IF NOT EXISTS mco TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN,
  ADD COLUMN IF NOT EXISTS activated_date DATE,
  ADD COLUMN IF NOT EXISTS assigned_staff_name TEXT,
  ADD COLUMN IF NOT EXISTS therapist_name TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS referral_type TEXT,
  ADD COLUMN IF NOT EXISTS office TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_1 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_2 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_3 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_4 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_5 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_6 TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis_7 TEXT,
  ADD COLUMN IF NOT EXISTS external_record_id TEXT,
  ADD COLUMN IF NOT EXISTS external_client_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_external_client_id ON leads(external_client_id);
CREATE INDEX IF NOT EXISTS idx_leads_external_record_id ON leads(external_record_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_external_client_id ON leads(organization_id, external_client_id);
