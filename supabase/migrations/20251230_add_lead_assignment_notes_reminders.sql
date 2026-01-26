-- Adds lead assignment + tracking fields and introduces notes/reminders tables (CCSS-004).

-- 1) leads table additions for assignment + response tracking
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS response_time_hours DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- 2) notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);

-- 3) reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  email_notification BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_lead_id ON reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON reminders(due_at);
