import Link from "next/link";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CandidateProfileLandingPage() {
  return (
    <DashboardShell title="Candidate Profile">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Candidate Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-700">
            <div>
              Candidate profiles are specific to an individual candidate. Please select a candidate from
              the pipeline to view their profile.
            </div>
            <Button asChild>
              <Link href="/candidates">Go to Candidate Pipeline</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
