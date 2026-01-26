import { createSupabaseAdminClient } from "@/lib/db/supabase/server";
import { enqueueSendEmail } from "@/lib/queues/notification-queue";
import { defaultNotificationSettings, isWithinQuietHours, type NotificationSettingsRow } from "@/lib/notifications/settings";

export type NotificationType =
  | "high_priority_lead"
  | "lead_assigned"
  | "status_changed"
  | "reminder_due";

export async function getUserNotificationSettings(userId: string): Promise<NotificationSettingsRow> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("notification_settings")
    .select(
      "notify_high_priority_leads,notify_lead_assignments,notify_status_updates,notify_reminders,notify_daily_summary,frequency,quiet_hours_start,quiet_hours_end,daily_digest_time"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return defaultNotificationSettings();
  }

  return {
    ...defaultNotificationSettings(),
    ...(data as any),
  };
}

export function shouldSendForType(settings: NotificationSettingsRow, type: NotificationType) {
  if (type === "high_priority_lead") return settings.notify_high_priority_leads;
  if (type === "lead_assigned") return settings.notify_lead_assignments;
  if (type === "status_changed") return settings.notify_status_updates;
  if (type === "reminder_due") return settings.notify_reminders;
  return true;
}

export async function createNotificationAndMaybeEnqueueEmail({
  organizationId,
  userId,
  leadId,
  reminderId,
  type,
  title,
  message,
  link,
  emailTo,
}: {
  organizationId: string;
  userId: string;
  leadId?: string | null;
  reminderId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  emailTo?: string | null;
}) {
  const admin = createSupabaseAdminClient();

  const settings = await getUserNotificationSettings(userId);

  const shouldSend = shouldSendForType(settings, type);
  const withinQuiet = isWithinQuietHours(settings);
  const canSendNow = shouldSend && settings.frequency === "realtime" && !withinQuiet;

  const deliveryStatus = emailTo && canSendNow ? "queued" : emailTo && shouldSend ? "deferred" : "skipped";

  const { data: notif, error } = await admin
    .from("notifications")
    .insert([
      {
        organization_id: organizationId,
        user_id: userId,
        lead_id: leadId ?? null,
        reminder_id: reminderId ?? null,
        type,
        title,
        message,
        link: link ?? null,
        channel: "dashboard",
        delivery_status: deliveryStatus,
        email_to: emailTo ?? null,
      },
    ])
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const notificationId = String((notif as any)?.id ?? "");
  if (notificationId && deliveryStatus === "queued") {
    await enqueueSendEmail(notificationId);
  }

  return { notificationId, deliveryStatus };
}
