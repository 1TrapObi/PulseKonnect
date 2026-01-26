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

export type HiresByPositionDatum = { title: string; hires: number };

export function HiresByPositionChart({ data }: { data: HiresByPositionDatum[] }) {
  const trimmed = data.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hires by Position</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {trimmed.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trimmed} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="title" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="hires" fill="#111827" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {trimmed.length ? (
          <div className="mt-2 text-xs text-zinc-600">Top positions by hires (showing up to 10)</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
