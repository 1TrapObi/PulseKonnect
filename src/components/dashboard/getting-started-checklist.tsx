"use client";

import * as React from "react";

import { requestOnboardingTourStart } from "@/components/onboarding/tour";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getChecklistProgress,
  isChecklistDismissed,
  setChecklistDismissed,
  type ChecklistProgress,
} from "@/lib/onboarding/local-progress";

function emptyProgress(): ChecklistProgress {
  return {
    firstLead: false,
    statusUpdated: false,
    assignedLead: false,
    addedNote: false,
  };
}

export function GettingStartedChecklist() {
  const [progress, setProgress] = React.useState<ChecklistProgress>(emptyProgress);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      setProgress(getChecklistProgress());
      setDismissed(isChecklistDismissed());
    };

    sync();
    window.addEventListener("pk:onboarding-progress-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pk:onboarding-progress-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const completedCount = Object.values(progress).filter(Boolean).length;
  const allDone = completedCount === 4;

  if (dismissed || allDone) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting Started</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-zinc-600">Complete these quick steps to get comfortable in PulseKonnect.</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={progress.firstLead} disabled aria-label="Add your first lead" />
            <label className="text-sm text-zinc-800">Add your first lead</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={progress.statusUpdated} disabled aria-label="Update a lead status" />
            <label className="text-sm text-zinc-800">Update a lead status</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={progress.assignedLead} disabled aria-label="Assign a lead to yourself" />
            <label className="text-sm text-zinc-800">Assign a lead to yourself</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={progress.addedNote} disabled aria-label="Add a note to a lead" />
            <label className="text-sm text-zinc-800">Add a note to a lead</label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={requestOnboardingTourStart}>
            Take Tour Again
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setChecklistDismissed(true);
              setDismissed(true);
            }}
          >
            Dismiss
          </Button>
          <span className="ml-auto text-xs text-zinc-500">{completedCount}/4 complete</span>
        </div>
      </CardContent>
    </Card>
  );
}
