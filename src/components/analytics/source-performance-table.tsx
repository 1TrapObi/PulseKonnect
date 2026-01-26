"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type SourcePerformanceRow = {
  source: string;
  total: number;
  qualified: number;
  converted: number;
  conversionRate: number;
};

type SortKey = keyof SourcePerformanceRow;

export function SourcePerformanceTable({ data }: { data: SourcePerformanceRow[] }) {
  const [sortKey, setSortKey] = React.useState<SortKey>("total");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");

  const sorted = React.useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av: any = a[sortKey];
      const bv: any = b[sortKey];
      if (av === bv) return 0;
      const res = av > bv ? 1 : -1;
      return dir === "asc" ? res : -res;
    });
    return copy;
  }, [data, sortKey, dir]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("desc");
    }
  }

  const headerBtn = (key: SortKey, label: string) => (
    <Button type="button" variant="ghost" size="sm" onClick={() => toggle(key)}>
      {label}
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-zinc-600">No data</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-zinc-600">
                  <th className="py-2 pr-3">{headerBtn("source", "Source")}</th>
                  <th className="py-2 pr-3">{headerBtn("total", "Total")}</th>
                  <th className="py-2 pr-3">{headerBtn("qualified", "Qualified")}</th>
                  <th className="py-2 pr-3">{headerBtn("converted", "Converted")}</th>
                  <th className="py-2 pr-3">{headerBtn("conversionRate", "Conversion %")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.source} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{r.source}</td>
                    <td className="py-2 pr-3 text-zinc-700">{r.total}</td>
                    <td className="py-2 pr-3 text-zinc-700">{r.qualified}</td>
                    <td className="py-2 pr-3 text-zinc-700">{r.converted}</td>
                    <td className="py-2 pr-3 text-zinc-700">{Math.round(r.conversionRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
