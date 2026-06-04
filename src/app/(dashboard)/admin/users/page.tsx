import { DashboardShell } from "@/components/shared/dashboard-shell";
import { TeamSettingsCard } from "@/components/shared/team-settings-card";

export default function AdminUsersPage() {
  return (
    <DashboardShell title="User Management">
      <div className="space-y-4">
        <div>
          <div className="text-sm text-zinc-500">Admin</div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">User Management</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Invite team members and manage organization access.
          </p>
        </div>
        <TeamSettingsCard />
      </div>
    </DashboardShell>
  );
}
