"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type TimeToHireDatum = { title: string; avgDays: number | null };

export function TimeToHireChart({ data }: { data: TimeToHireDatum[] }) {
  const rows = data.filter((d) => d.avgDays != null).slice(0, 10) as Array<{ title: string; avgDays: number }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time-to-Hire (Avg Days by Position)</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="title" width={160} />
              <Tooltip />
              <Bar dataKey="avgDays" fill="#111827" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {rows.length ? <div className="mt-2 text-xs text-zinc-600">Filled positions only</div> : null}
      </CardContent>
    </Card>
  );
}
