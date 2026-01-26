"use client";

import * as React from "react";

import { Select } from "@/components/ui/select";
import { PRIORITY_OPTIONS } from "@/lib/constants/onboarding";

export type LeadSourceRow = {
  source: string;
  checked: boolean;
  priority: "high" | "medium" | "low" | null;
  onCheckedChange: (checked: boolean) => void;
  onPriorityChange: (priority: "high" | "medium" | "low" | null) => void;
};

export function LeadSourceSelector({ source, checked, priority, onCheckedChange, onPriorityChange }: LeadSourceRow) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3">
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-4 w-4"
        />
        <span>{source}</span>
      </label>

      <div className="w-36">
        <Select
          value={priority ?? ""}
          onChange={(e) => onPriorityChange((e.target.value as any) || null)}
          options={PRIORITY_OPTIONS as any}
          disabled={!checked}
        />
      </div>
    </div>
  );
}
