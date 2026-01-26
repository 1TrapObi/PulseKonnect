"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FunnelDatum = { status: string; count: number; pct: number };

function label(status: string) {
  const s = status.toLowerCase();
  if (s === "new") return "New";
  if (s === "screening") return "Screening";
  if (s === "interview") return "Interview";
  if (s === "offer") return "Offer";
  if (s === "hired") return "Hired";
  return status;
}

export function PipelineFunnelChart({ data }: { data: FunnelDatum[] }) {
  const total = data.find((d) => d.status === "new")?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-zinc-600">No data</div>
        ) : (
          <div className="space-y-3">
            {data.map((d) => {
              const pct = total === 0 ? 0 : Math.round((d.count / total) * 100);
              return (
                <div key={d.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium text-zinc-900">
                      {label(d.status)} ({d.count})
                    </div>
                    <div className="text-zinc-600">{pct}%</div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-200">
                    <div className="h-2 rounded-full bg-[#111827]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
