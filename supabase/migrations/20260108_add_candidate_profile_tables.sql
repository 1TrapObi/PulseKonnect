-- Adds candidate profile management tables for CCSS-010.

-- 0) activities: add candidate_id for candidate timeline support
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activities_candidate_id ON activities(candidate_id);

-- 1) candidate_documents
CREATE TABLE IF NOT EXISTS candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_candidate_id ON candidate_documents(candidate_id);

-- 2) interviews
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  position_id UUID,
  interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
  interview_type VARCHAR(50),
  interviewers JSONB,
  location_or_link TEXT,
  agenda TEXT,
  notes TEXT,
  rating INT,
  feedback TEXT,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(interview_date);

-- 3) candidate_notes
CREATE TABLE IF NOT EXISTS candidate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note_type VARCHAR(50),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_candidate_id ON candidate_notes(candidate_id);

-- 4) updated_at trigger reuse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_interviews_updated_at'
  ) THEN
    CREATE TRIGGER update_interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_candidate_notes_updated_at'
  ) THEN
    CREATE TRIGGER update_candidate_notes_updated_at
    BEFORE UPDATE ON candidate_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
