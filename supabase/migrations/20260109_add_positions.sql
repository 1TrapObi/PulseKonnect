-- Adds positions table for CCSS-011.

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  employment_type VARCHAR(50) NOT NULL,
  num_openings INT DEFAULT 1,
  required_licenses JSONB NOT NULL,
  experience_level VARCHAR(50) NOT NULL,
  required_specializations JSONB,
  preferred_specializations JSONB,
  salary_min DECIMAL(10, 2),
  salary_max DECIMAL(10, 2),
  pay_frequency VARCHAR(20),
  benefits JSONB,
  description TEXT NOT NULL,
  responsibilities TEXT,
  work_schedule VARCHAR(255),
  work_locations JSONB NOT NULL,
  application_deadline DATE,
  status VARCHAR(50) DEFAULT 'active',
  internal_notes TEXT,
  posted_date DATE DEFAULT CURRENT_DATE,
  filled_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_organization_id ON positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_posted_date ON positions(posted_date);

-- updated_at trigger reuse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_positions_updated_at'
  ) THEN
    CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
