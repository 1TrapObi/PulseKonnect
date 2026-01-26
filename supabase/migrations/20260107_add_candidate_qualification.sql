-- Adds candidate qualification fields and candidate_position_matches table for CCSS-008.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_fit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS license_valid BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS matched_positions JSONB;

CREATE INDEX IF NOT EXISTS idx_candidates_qualification_status ON candidates(qualification_status);
CREATE INDEX IF NOT EXISTS idx_candidates_fit_score ON candidates(fit_score DESC);

DO $$
BEGIN
  IF to_regclass('public.candidate_position_matches') IS NULL THEN
    IF to_regclass('public.positions') IS NOT NULL THEN
      EXECUTE '
        CREATE TABLE candidate_position_matches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
          position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
          match_score INT,
          match_reasons JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(candidate_id, position_id)
        );
      ';
    ELSE
      EXECUTE '
        CREATE TABLE candidate_position_matches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
          position_id UUID,
          match_score INT,
          match_reasons JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(candidate_id, position_id)
        );
      ';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_candidate_id ON candidate_position_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_position_id ON candidate_position_matches(position_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON candidate_position_matches(match_score);
