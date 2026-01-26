"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  title,
  value,
  change,
}: {
  title: string;
  value: number;
  change: number; // fraction: 0.23 = +23%
}) {
  const isUp = change >= 0;
  const pct = Math.round(Math.abs(change) * 100);

  return (
    <Card className={isUp ? "bg-[#ECFDF5]" : "bg-[#FEF2F2]"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-zinc-700">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</div>
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isUp ? (
            <ArrowUp className="h-3 w-3 text-[#10B981]" />
          ) : (
            <ArrowDown className="h-3 w-3 text-[#EF4444]" />
          )}
          <span className={isUp ? "text-[#047857]" : "text-[#991B1B]"}>
            {isUp ? "+" : "-"}
            {pct}%
          </span>
          <span className="text-zinc-600">vs previous</span>
        </div>
      </CardContent>
    </Card>
  );
}
