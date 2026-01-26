"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export function OnboardingButtons({
  backDisabled,
  continueDisabled,
  loading,
  onBack,
  onContinue,
}: {
  backDisabled?: boolean;
  continueDisabled?: boolean;
  loading?: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button type="button" variant="outline" onClick={onBack} disabled={backDisabled || loading}>
        Back
      </Button>
      <Button type="button" onClick={onContinue} disabled={continueDisabled || loading}>
        {loading ? "Saving…" : "Save & Continue →"}
      </Button>
    </div>
  );
}
