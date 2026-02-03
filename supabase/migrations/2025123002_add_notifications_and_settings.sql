CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  reminder_id UUID REFERENCES reminders(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  channel TEXT NOT NULL DEFAULT 'dashboard',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT NOT NULL DEFAULT 'queued',
  delivery_error TEXT,
  email_to TEXT,
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org_created_at ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reminder_id ON notifications(reminder_id);

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_high_priority_leads BOOLEAN NOT NULL DEFAULT TRUE,
  notify_lead_assignments BOOLEAN NOT NULL DEFAULT TRUE,
  notify_status_updates BOOLEAN NOT NULL DEFAULT TRUE,
  notify_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  notify_daily_summary BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT NOT NULL DEFAULT 'realtime',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  daily_digest_time TIME NOT NULL DEFAULT '08:00',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
