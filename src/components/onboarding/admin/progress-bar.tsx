"use client";

import * as React from "react";

const steps = ["Welcome", "Services", "Leads", "Recruitment", "Setup"];

export function ProgressBar({ currentStep }: { currentStep: number }) {
  const clamped = Math.min(5, Math.max(1, currentStep));
  const pct = (clamped / 5) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="text-zinc-700">
          Step {clamped} of 5 ({Math.round(pct)}%)
        </div>
        <div className="text-zinc-500">{steps[clamped - 1]}</div>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-200">
        <div className="h-2 rounded-full bg-[#40E0D0] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-5 gap-2 text-[11px] text-zinc-500">
        {steps.map((s, idx) => (
          <div key={s} className={idx + 1 === clamped ? "text-zinc-900 font-medium" : ""}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
