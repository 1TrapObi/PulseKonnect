import { DashboardShell } from "@/components/shared/dashboard-shell";
import { LeadSourcesConfiguration } from "./lead-sources-configuration";

export default function LeadsConfigurationPage() {
  return (
    <DashboardShell title="Configuration">
      <LeadSourcesConfiguration />
    </DashboardShell>
  );
}
