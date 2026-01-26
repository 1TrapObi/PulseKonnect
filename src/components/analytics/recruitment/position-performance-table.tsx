"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";

export type PositionPerformanceRow = {
  positionId: string;
  title: string;
  status: string | null;
  totalCandidates: number;
  qualifiedCandidates: number;
  inInterview: number;
  offers: number;
  hires: number;
  daysToFill: number | null;
  conversionRate: number;
};

const statusOptions: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
];

type SortKey =
  | "title"
  | "status"
  | "totalCandidates"
  | "qualifiedCandidates"
  | "inInterview"
  | "offers"
  | "hires"
  | "daysToFill"
  | "conversionRate";

function cmp(a: any, b: any) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function PositionPerformanceTable({ data }: { data: PositionPerformanceRow[] }) {
  const [status, setStatus] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("totalCandidates");
  const [desc, setDesc] = React.useState(true);

  const filtered = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((r) => {
      const st = String(r.status ?? "").toLowerCase();
      if (status !== "all" && st !== status) return false;
      if (s && !String(r.title ?? "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [data, status, search]);

  const sorted = React.useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const v = cmp((a as any)[sortKey], (b as any)[sortKey]);
      return desc ? -v : v;
    });
    return rows;
  }, [filtered, sortKey, desc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setDesc((v) => !v);
    else {
      setSortKey(k);
      setDesc(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search positions…" />
          <div className="text-xs text-zinc-600 self-center">{sorted.length} rows</div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-700">
              <tr>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => toggleSort("title")}>Title</th>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => toggleSort("status")}>Status</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("totalCandidates")}>Candidates</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("qualifiedCandidates")}>Qualified</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("inInterview")}>Interview</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("offers")}>Offers</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("hires")}>Hires</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("daysToFill")}>Days to Fill</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => toggleSort("conversionRate")}>Conv.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-zinc-600">
                    No data
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.positionId} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-zinc-900">{r.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-700">{r.status ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.totalCandidates}</td>
                    <td className="px-3 py-2 text-right">{r.qualifiedCandidates}</td>
                    <td className="px-3 py-2 text-right">{r.inInterview}</td>
                    <td className="px-3 py-2 text-right">{r.offers}</td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-900">{r.hires}</td>
                    <td className="px-3 py-2 text-right">{r.daysToFill ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{Math.round((r.conversionRate ?? 0) * 1000) / 10}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
