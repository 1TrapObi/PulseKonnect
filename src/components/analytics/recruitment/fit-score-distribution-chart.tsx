"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FitDistributionDatum = {
  bucket: string;
  label: string;
  count: number;
  pct: number;
  color: string;
};

export function FitScoreDistributionChart({ data }: { data: FitDistributionDatum[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fit Score Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip />
              <Pie data={data} dataKey="count" nameKey="label" innerRadius={60} outerRadius={96} paddingAngle={2}>
                {data.map((d, idx) => (
                  <Cell key={idx} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
