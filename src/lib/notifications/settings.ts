export type NotificationFrequency = "realtime" | "hourly" | "daily";

export type NotificationSettingsRow = {
  notify_high_priority_leads: boolean;
  notify_lead_assignments: boolean;
  notify_status_updates: boolean;
  notify_reminders: boolean;
  notify_daily_summary: boolean;
  frequency: NotificationFrequency;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  daily_digest_time: string | null;
};

export function defaultNotificationSettings(): NotificationSettingsRow {
  return {
    notify_high_priority_leads: true,
    notify_lead_assignments: true,
    notify_status_updates: true,
    notify_reminders: true,
    notify_daily_summary: false,
    frequency: "realtime",
    quiet_hours_start: null,
    quiet_hours_end: null,
    daily_digest_time: "08:00:00",
  };
}

function parseTimeToMinutes(t: string) {
  const [hh, mm] = t.split(":");
  const h = Number(hh ?? 0);
  const m = Number(mm ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function isWithinQuietHours(settings: NotificationSettingsRow, now = new Date()) {
  const start = settings.quiet_hours_start;
  const end = settings.quiet_hours_end;
  if (!start || !end) return false;

  const startM = parseTimeToMinutes(start);
  const endM = parseTimeToMinutes(end);
  if (startM == null || endM == null) return false;

  const nowM = now.getHours() * 60 + now.getMinutes();

  if (startM === endM) return false;

  if (startM < endM) {
    return nowM >= startM && nowM < endM;
  }

  return nowM >= startM || nowM < endM;
}
