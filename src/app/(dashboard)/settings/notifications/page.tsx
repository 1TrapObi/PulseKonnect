"use client";

import * as React from "react";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { NotificationSettingsCard } from "@/components/notifications/notification-settings-card";

export default function NotificationSettingsPage() {
  return (
    <DashboardShell title="Notification Settings">
      <NotificationSettingsCard />
    </DashboardShell>
  );
}
