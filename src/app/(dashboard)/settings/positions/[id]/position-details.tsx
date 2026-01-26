"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastViewport, useToast } from "@/components/ui/toast";

type PositionRow = {
  id: string;
  title: string;
  department: string | null;
  employment_type: string;
  num_openings: number | null;
  required_licenses: any;
  experience_level: string;
  required_specializations: any;
  preferred_specializations: any;
  salary_min: number | string | null;
  salary_max: number | string | null;
  pay_frequency: string | null;
  benefits: any;
  description: string;
  responsibilities: string | null;
  work_schedule: string | null;
  work_locations: any;
  application_deadline: string | null;
  status: string | null;
  internal_notes: string | null;
  posted_date: string | null;
  filled_date: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  candidate_id: string;
  position_id: string;
  match_score: number | null;
  match_reasons: any;
  created_at: string;
  candidate: any;
};

function stringifyArray(v: any) {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join(", ");
  return "";
}

function statusBadge(status: string | null | undefined) {
  const s = String(status ?? "active").toLowerCase();
  if (s === "active") return { label: "ACTIVE", className: "bg-emerald-100 text-emerald-700 border-0" };
  if (s === "on_hold") return { label: "ON HOLD", className: "bg-amber-100 text-amber-700 border-0" };
  if (s === "filled") return { label: "FILLED", className: "bg-blue-100 text-blue-700 border-0" };
  return { label: "CLOSED", className: "bg-zinc-100 text-zinc-700 border-0" };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export function PositionDetails({ position: initial }: { position: PositionRow }) {
  const { items: toasts, push, remove } = useToast();
  const [tab, setTab] = React.useState("overview");
  const [matches, setMatches] = React.useState<MatchRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  async function fetchMatches() {
    const res = await fetch(`/api/positions/${initial.id}/candidates`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      push({ title: "Failed to load candidates", description: json.error ?? "Request failed", variant: "danger" });
      return;
    }
    setMatches(json.matches ?? []);
  }

  React.useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  async function rematch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/positions/${initial.id}/rematch`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        push({ title: "Rematch failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      push({ title: "Rematch complete", description: `Updated: ${json.updated ?? 0}` });
      await fetchMatches();
    } finally {
      setLoading(false);
    }
  }

  const b = statusBadge(initial.status);
  const emp = String(initial.employment_type ?? "").replaceAll("_", " ");

  return (
    <div className="space-y-4">
      <ToastViewport items={toasts} remove={remove} />

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/positions">Back to Job Postings</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge className={b.className}>{b.label}</Badge>
              <CardTitle className="mt-2">{initial.title}</CardTitle>
              <div className="mt-1 text-sm text-zinc-600">
                {stringifyArray(initial.required_licenses) || "—"} • {initial.experience_level.toUpperCase()} • {emp}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={rematch} disabled={loading}>
                {loading ? "Rematching…" : "Re-match Candidates"}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/settings/positions#edit-${initial.id}`}>Edit</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="candidates">Matched Candidates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Position Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Department:</span> {initial.department ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Openings:</span> {initial.num_openings ?? 1}
                </div>
                <div>
                  <span className="font-medium">Work Locations:</span> {stringifyArray(initial.work_locations) || "—"}
                </div>
                <div>
                  <span className="font-medium">Work Schedule:</span> {initial.work_schedule ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Application Deadline:</span> {initial.application_deadline ?? "—"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Experience:</span> {initial.experience_level}
                </div>
                <div>
                  <span className="font-medium">Required Specializations:</span> {stringifyArray(initial.required_specializations) || "—"}
                </div>
                <div>
                  <span className="font-medium">Preferred Specializations:</span> {stringifyArray(initial.preferred_specializations) || "—"}
                </div>
                <div>
                  <span className="font-medium">Benefits:</span> {stringifyArray(initial.benefits) || "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-700 whitespace-pre-wrap">{initial.description}</CardContent>
          </Card>

          {initial.responsibilities ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Responsibilities</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-700 whitespace-pre-wrap">{initial.responsibilities}</CardContent>
            </Card>
          ) : null}

          {initial.internal_notes ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-700 whitespace-pre-wrap">{initial.internal_notes}</CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="candidates">
          <div id="candidates" className="space-y-3">
            {matches.length ? (
              matches.map((m) => (
                <Card key={`${m.position_id}-${m.candidate_id}`}>
                  <CardHeader className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{m.candidate?.name ?? m.candidate_id}</CardTitle>
                        <div className="mt-1 text-sm text-zinc-600">
                          {(m.candidate?.license_type ?? "—") +
                            (m.candidate?.experience_years != null ? ` • ${m.candidate.experience_years} yrs` : "") +
                            (m.candidate?.location ? ` • ${m.candidate.location}` : "")}
                        </div>
                      </div>
                      <Badge variant="secondary">{m.match_score != null ? `${m.match_score}/100` : "—"}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500">Matched: {formatDateTime(m.created_at)}</div>
                  </CardHeader>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/candidates/${m.candidate_id}`}>View Candidate</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">No matches yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
