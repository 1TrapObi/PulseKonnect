-- Adds indexes to speed up analytics queries (CCSS-006).

CREATE INDEX IF NOT EXISTS idx_leads_org_created_at ON leads(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_source ON leads(organization_id, source);
CREATE INDEX IF NOT EXISTS idx_leads_org_status_created_at ON leads(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_urgency ON leads(organization_id, urgency);
