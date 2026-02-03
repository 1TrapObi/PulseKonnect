-- Adds CCSS home base / HQ fields for distance-based geo scoring (CCSS-002 follow-up).

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS hq_address TEXT,
  ADD COLUMN IF NOT EXISTS hq_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hq_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS max_distance_miles DOUBLE PRECISION;
