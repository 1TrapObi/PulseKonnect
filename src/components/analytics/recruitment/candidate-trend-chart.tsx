"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type TrendDatum = { date: string; count: number };

export function CandidateTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Activity Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 8, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#111827" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
