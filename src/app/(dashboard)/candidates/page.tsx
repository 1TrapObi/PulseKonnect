import { DashboardShell } from "@/components/shared/dashboard-shell";
import { CandidatePipeline } from "./candidate-pipeline";

export default function CandidatesPage() {
  return (
    <DashboardShell title="Candidates">
      <CandidatePipeline />
    </DashboardShell>
  );
}
