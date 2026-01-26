import * as React from "react";
import { Worker } from "bullmq";

import { createSupabaseAdminClient } from "@/lib/db/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { HighPriorityLeadEmail } from "@/lib/email/templates/high-priority-lead";
import { LeadAssignedEmail } from "@/lib/email/templates/lead-assigned";
import { ReminderDueEmail } from "@/lib/email/templates/reminder-due";
import { getRedisConnection } from "@/lib/queues/redis";
import type { NotificationJobPayload } from "@/lib/queues/notification-queue";

function appBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

export function startNotificationWorker() {
  return new Worker<NotificationJobPayload>(
    "notification-queue",
    async (job) => {
      const admin = createSupabaseAdminClient();

      const notificationId = job.data.notificationId;
      const { data: notif, error } = await admin
        .from("notifications")
        .select(
          "id,type,title,message,link,email_to,lead_id,reminder_id,organization_id,user_id"
        )
        .eq("id", notificationId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!notif) {
        return;
      }

      const emailTo = String((notif as any).email_to ?? "").trim();
      if (!emailTo) {
        await admin
          .from("notifications")
          .update({ delivery_status: "skipped", delivery_error: "Missing email_to" })
          .eq("id", notificationId);
        return;
      }

      const leadId = (notif as any).lead_id as string | null;
      const reminderId = (notif as any).reminder_id as string | null;

      let react: any = null;

      if ((notif as any).type === "high_priority_lead" && leadId) {
        const { data: lead } = await admin
          .from("leads")
          .select("id,name,email,phone,need_type,source,location")
          .eq("id", leadId)
          .maybeSingle();

        if (lead) {
          react = React.createElement(HighPriorityLeadEmail as any, {
            leadName: (lead as any).name,
            needType: (lead as any).need_type,
            source: (lead as any).source,
            location: (lead as any).location,
            email: (lead as any).email,
            phone: (lead as any).phone,
            href: `${appBaseUrl()}/leads/${(lead as any).id}`,
          });
        }
      }

      if ((notif as any).type === "lead_assigned" && leadId) {
        const { data: lead } = await admin
          .from("leads")
          .select("id,name,need_type,source,location")
          .eq("id", leadId)
          .maybeSingle();

        if (lead) {
          react = React.createElement(LeadAssignedEmail as any, {
            leadName: (lead as any).name,
            needType: (lead as any).need_type,
            source: (lead as any).source,
            location: (lead as any).location,
            assignedBy: null,
            href: `${appBaseUrl()}/leads/${(lead as any).id}`,
          });
        }
      }

      if ((notif as any).type === "reminder_due" && leadId && reminderId) {
        const [{ data: lead }, { data: reminder }] = await Promise.all([
          admin.from("leads").select("id,name").eq("id", leadId).maybeSingle(),
          admin
            .from("reminders")
            .select("id,type,due_at")
            .eq("id", reminderId)
            .maybeSingle(),
        ]);

        if (lead && reminder) {
          react = React.createElement(ReminderDueEmail as any, {
            leadName: (lead as any).name,
            reminderType: (reminder as any).type,
            dueAt: String((reminder as any).due_at),
            href: `${appBaseUrl()}/leads/${(lead as any).id}`,
          });
        }
      }

      if (!react) {
        await admin
          .from("notifications")
          .update({ delivery_status: "skipped", delivery_error: "Missing template data" })
          .eq("id", notificationId);
        return;
      }

      try {
        const res: any = await sendEmail({
          to: emailTo,
          subject: String((notif as any).title ?? "Notification"),
          react,
        });

        await admin
          .from("notifications")
          .update({
            delivery_status: "sent",
            external_id: res?.data?.id ?? null,
            delivery_error: null,
          })
          .eq("id", notificationId);
      } catch (e: any) {
        await admin
          .from("notifications")
          .update({
            delivery_status: "failed",
            delivery_error: e?.message ?? "Unknown error",
          })
          .eq("id", notificationId);
        throw e;
      }
    },
    {
      connection: getRedisConnection(),
    }
  );
}

if (require.main === module) {
  startNotificationWorker();
  // eslint-disable-next-line no-console
  console.log("Notification worker started");
}
