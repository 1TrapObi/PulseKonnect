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

export type CandidatesBySourceDatum = { source: string; total: number };

export function CandidatesBySourceChart({ data }: { data: CandidatesBySourceDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidates by Source</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="source" width={160} />
              <Tooltip />
              <Bar dataKey="total" fill="#111827" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
