import { DashboardShell } from "@/components/shared/dashboard-shell";
import { LeadsDashboard } from "./leads-dashboard";

export default function LeadsPage() {
  return (
    <DashboardShell title="Leads">
      <LeadsDashboard />
    </DashboardShell>
  );
}
