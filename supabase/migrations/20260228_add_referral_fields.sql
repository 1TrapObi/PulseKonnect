-- Add referral-specific fields to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS referral_agency VARCHAR(255),
ADD COLUMN IF NOT EXISTS referral_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS referral_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS medicaid_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_type VARCHAR(100);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_organization_status ON leads(organization_id, status);

-- Add slug support to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- Set CCSS slug (update with actual organization name if different)
UPDATE organizations 
SET slug = 'ccss' 
WHERE name ILIKE '%Carolina Community Support%';

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
