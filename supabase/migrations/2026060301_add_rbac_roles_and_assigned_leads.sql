ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'staff'));

UPDATE users SET role = 'admin' WHERE role IS NULL OR role NOT IN ('super_admin', 'admin', 'staff');

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'deactivated'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS assigned_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_assigned_leads_user_id ON assigned_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_assigned_leads_lead_id ON assigned_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_assigned_leads_org_id ON assigned_leads(organization_id);

CREATE OR REPLACE FUNCTION current_app_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM users WHERE id = auth.uid()), 'staff')
$$;

CREATE OR REPLACE FUNCTION current_app_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION current_app_is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_app_user_role() = 'super_admin'
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_super_admin_all ON users;
CREATE POLICY users_super_admin_all ON users
  FOR ALL
  USING (current_app_is_super_admin())
  WITH CHECK (current_app_is_super_admin());

DROP POLICY IF EXISTS users_admin_org_all ON users;
CREATE POLICY users_admin_org_all ON users
  FOR ALL
  USING (current_app_user_role() = 'admin' AND organization_id = current_app_org_id())
  WITH CHECK (current_app_user_role() = 'admin' AND organization_id = current_app_org_id());

DROP POLICY IF EXISTS leads_super_admin_all ON leads;
CREATE POLICY leads_super_admin_all ON leads
  FOR ALL
  USING (current_app_is_super_admin())
  WITH CHECK (current_app_is_super_admin());

DROP POLICY IF EXISTS leads_admin_org_all ON leads;
CREATE POLICY leads_admin_org_all ON leads
  FOR ALL
  USING (current_app_user_role() = 'admin' AND organization_id = current_app_org_id())
  WITH CHECK (current_app_user_role() = 'admin' AND organization_id = current_app_org_id());

DROP POLICY IF EXISTS leads_staff_select_assigned ON leads;
CREATE POLICY leads_staff_select_assigned ON leads
  FOR SELECT
  USING (
    current_app_user_role() = 'staff'
    AND organization_id = current_app_org_id()
    AND id IN (SELECT lead_id FROM assigned_leads WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS leads_staff_update_assigned ON leads;
CREATE POLICY leads_staff_update_assigned ON leads
  FOR UPDATE
  USING (
    current_app_user_role() = 'staff'
    AND organization_id = current_app_org_id()
    AND id IN (SELECT lead_id FROM assigned_leads WHERE user_id = auth.uid())
  )
  WITH CHECK (
    current_app_user_role() = 'staff'
    AND organization_id = current_app_org_id()
    AND id IN (SELECT lead_id FROM assigned_leads WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS assigned_leads_super_admin_all ON assigned_leads;
CREATE POLICY assigned_leads_super_admin_all ON assigned_leads
  FOR ALL
  USING (current_app_is_super_admin())
  WITH CHECK (current_app_is_super_admin());

DROP POLICY IF EXISTS assigned_leads_admin_org_all ON assigned_leads;
CREATE POLICY assigned_leads_admin_org_all ON assigned_leads
  FOR ALL
  USING (current_app_user_role() = 'admin' AND organization_id = current_app_org_id())
  WITH CHECK (current_app_user_role() = 'admin' AND organization_id = current_app_org_id());

DROP POLICY IF EXISTS assigned_leads_staff_read_own ON assigned_leads;
CREATE POLICY assigned_leads_staff_read_own ON assigned_leads
  FOR SELECT
  USING (current_app_user_role() = 'staff' AND user_id = auth.uid());
