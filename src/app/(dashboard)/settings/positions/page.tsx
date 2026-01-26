"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

type PositionsResponse = {
  ok: boolean;
  positions: PositionRow[];
  count: number;
  error?: string;
};

const statusOptions: SelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
];

const departmentOptions: SelectOption[] = [
  { value: "all", label: "All departments" },
  { value: "Clinical", label: "Clinical" },
  { value: "Administrative", label: "Administrative" },
  { value: "Support Services", label: "Support Services" },
  { value: "Other", label: "Other" },
];

const employmentTypeOptions: SelectOption[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "per_diem", label: "Per Diem" },
];

const experienceLevelOptions: SelectOption[] = [
  { value: "entry", label: "Entry (0-2)" },
  { value: "mid", label: "Mid (2-5)" },
  { value: "senior", label: "Senior (5+)" },
  { value: "any", label: "Any" },
];

const payFrequencyOptions: SelectOption[] = [
  { value: "", label: "Pay frequency" },
  { value: "hourly", label: "Hourly" },
  { value: "annual", label: "Annual" },
];

function daysAgo(dateIso: string | null | undefined) {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days;
}

function statusBadge(status: string | null | undefined) {
  const s = String(status ?? "active").toLowerCase();
  if (s === "active") return { label: "ACTIVE", className: "bg-emerald-100 text-emerald-700 border-0" };
  if (s === "on_hold") return { label: "ON HOLD", className: "bg-amber-100 text-amber-700 border-0" };
  if (s === "filled") return { label: "FILLED", className: "bg-blue-100 text-blue-700 border-0" };
  return { label: "CLOSED", className: "bg-zinc-100 text-zinc-700 border-0" };
}

function parseCsv(v: string) {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function stringifyArray(v: any) {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join(", ");
  return "";
}

const PositionSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    department: z.string().optional(),
    employment_type: z.string().min(1, "Employment type is required"),
    num_openings: z.coerce.number().int().min(1).default(1),
    required_licenses: z.string().min(1, "At least 1 required license"),
    experience_level: z.string().min(1, "Experience level is required"),
    required_specializations: z.string().optional().default(""),
    preferred_specializations: z.string().optional().default(""),
    salary_min: z.coerce.number().optional().or(z.nan()).transform((v) => (Number.isNaN(v as any) ? null : v)),
    salary_max: z.coerce.number().optional().or(z.nan()).transform((v) => (Number.isNaN(v as any) ? null : v)),
    pay_frequency: z.string().optional().default(""),
    benefits: z.string().optional().default(""),
    description: z.string().min(100, "Description must be at least 100 characters"),
    responsibilities: z.string().optional().default(""),
    work_schedule: z.string().optional().default(""),
    work_locations: z.string().min(1, "At least 1 work location"),
    application_deadline: z.string().optional().default(""),
    status: z.string().min(1, "Status is required"),
    internal_notes: z.string().optional().default(""),
  })
  .refine(
    (x) => {
      if (x.salary_min == null || x.salary_max == null) return true;
      return Number(x.salary_min) <= Number(x.salary_max);
    },
    { message: "Salary min must be <= salary max", path: ["salary_max"] }
  );

type PositionForm = z.input<typeof PositionSchema>;

export default function PositionsPage() {
  const { items: toasts, push, remove } = useToast();

  const [status, setStatus] = React.useState("all");
  const [department, setDepartment] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (status && status !== "all") p.set("status", status);
    if (department && department !== "all") p.set("department", department);
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [status, department, search]);

  const fetcher = React.useCallback(async (url: string) => {
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as PositionsResponse;
    if (!res.ok || !json.ok) throw new Error((json as any).error ?? "Request failed");
    return json;
  }, []);

  const { data, error, isLoading, mutate } = useSWR<PositionsResponse>(
    `/api/positions${qs ? `?${qs}` : ""}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const positions = data?.positions ?? [];

  const stats = React.useMemo(() => {
    const base = { active: 0, filled: 0, closed: 0, on_hold: 0 };
    for (const p of positions) {
      const s = String(p.status ?? "active").toLowerCase();
      if (s in base) (base as any)[s] += 1;
    }
    return base;
  }, [positions]);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PositionRow | null>(null);

  const form = useForm<PositionForm>({
    resolver: zodResolver(PositionSchema),
    defaultValues: {
      title: "",
      department: "Clinical",
      employment_type: "full_time",
      num_openings: 1,
      required_licenses: "LCSW",
      experience_level: "any",
      required_specializations: "",
      preferred_specializations: "",
      salary_min: null,
      salary_max: null,
      pay_frequency: "",
      benefits: "",
      description: "",
      responsibilities: "",
      work_schedule: "",
      work_locations: "Durham",
      application_deadline: "",
      status: "active",
      internal_notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      setEditing(null);
      form.reset();
    }
  }, [open, form]);

  function startNew() {
    setEditing(null);
    form.reset();
    setOpen(true);
  }

  function startEdit(pos: PositionRow) {
    setEditing(pos);
    form.reset({
      title: pos.title ?? "",
      department: pos.department ?? "Clinical",
      employment_type: pos.employment_type ?? "full_time",
      num_openings: pos.num_openings ?? 1,
      required_licenses: stringifyArray(pos.required_licenses) || "LCSW",
      experience_level: pos.experience_level ?? "any",
      required_specializations: stringifyArray(pos.required_specializations) || "",
      preferred_specializations: stringifyArray(pos.preferred_specializations) || "",
      salary_min: pos.salary_min as any,
      salary_max: pos.salary_max as any,
      pay_frequency: pos.pay_frequency ?? "",
      benefits: stringifyArray(pos.benefits) || "",
      description: pos.description ?? "",
      responsibilities: pos.responsibilities ?? "",
      work_schedule: pos.work_schedule ?? "",
      work_locations: stringifyArray(pos.work_locations) || "",
      application_deadline: pos.application_deadline ?? "",
      status: String(pos.status ?? "active").toLowerCase(),
      internal_notes: pos.internal_notes ?? "",
    } as any);
    setOpen(true);
  }

  async function submit(values: PositionForm) {
    const payload: any = {
      ...values,
      required_licenses: parseCsv(values.required_licenses),
      required_specializations: values.required_specializations ? parseCsv(values.required_specializations) : null,
      preferred_specializations: values.preferred_specializations ? parseCsv(values.preferred_specializations) : null,
      benefits: values.benefits ? parseCsv(values.benefits) : null,
      work_locations: parseCsv(values.work_locations),
      salary_min: values.salary_min,
      salary_max: values.salary_max,
      pay_frequency: values.pay_frequency || null,
      responsibilities: values.responsibilities || null,
      work_schedule: values.work_schedule || null,
      application_deadline: values.application_deadline || null,
      internal_notes: values.internal_notes || null,
      department: values.department || null,
    };

    try {
      const res = await fetch(editing ? `/api/positions/${editing.id}` : "/api/positions", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        push({ title: "Save failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      push({ title: editing ? "Position updated" : "Position created" });
      setOpen(false);
      await mutate();
    } catch (e: any) {
      push({ title: "Save failed", description: String(e?.message ?? e), variant: "danger" });
    }
  }

  async function closePosition(id: string) {
    try {
      const res = await fetch(`/api/positions/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        push({ title: "Close failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      push({ title: "Position closed" });
      await mutate();
    } catch (e: any) {
      push({ title: "Close failed", description: String(e?.message ?? e), variant: "danger" });
    }
  }

  const saving = form.formState.isSubmitting;

  return (
    <DashboardShell title="Job Postings">
      <ToastViewport items={toasts} remove={remove} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900">Open Positions</div>
            <div className="mt-1 text-sm text-zinc-600">
              Overview: {stats.active} Active • {stats.on_hold} On Hold • {stats.filled} Filled • {stats.closed} Closed
            </div>
          </div>
          <Button type="button" onClick={startNew}>
            + New Position
          </Button>
        </div>

        <div className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} options={departmentOptions} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or department…" />
        </div>

        {isLoading ? (
          <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border bg-white p-5 text-sm text-red-600">{String(error.message)}</div>
        ) : positions.length ? (
          <div className="grid gap-3">
            {positions.map((p) => {
              const b = statusBadge(p.status);
              const postedAgo = daysAgo(p.posted_date ?? p.created_at);
              const licenses = stringifyArray(p.required_licenses);
              const exp = p.experience_level ? String(p.experience_level).toUpperCase() : "—";
              const emp = p.employment_type ? String(p.employment_type).replaceAll("_", " ") : "—";

              return (
                <Card key={p.id}>
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={b.className}>{b.label}</Badge>
                      <div className="text-xs text-zinc-500">
                        {postedAgo != null ? `Posted: ${postedAgo} days ago` : null}
                      </div>
                    </div>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <div className="text-sm text-zinc-600">
                      {licenses || "—"} • {exp} • {emp}
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-zinc-600">
                    {p.department ? <div>Department: {p.department}</div> : null}
                    {p.application_deadline ? <div>Closes: {p.application_deadline}</div> : null}
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/positions/${p.id}`}>View</Link>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => closePosition(p.id)}>
                      Close
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/settings/positions/${p.id}#candidates`}>View Candidates</Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-5 text-sm text-zinc-600">No positions yet.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Position" : "New Position"}</DialogTitle>
            <DialogDescription>Configure job posting requirements and recruiting settings.</DialogDescription>
          </DialogHeader>

          <form className="mt-3 space-y-4" onSubmit={form.handleSubmit(submit)}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Position Title *</div>
                <Input {...form.register("title")} />
                {form.formState.errors.title ? (
                  <div className="text-xs text-red-600">{form.formState.errors.title.message}</div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Department</div>
                <Select
                  value={form.watch("department") ?? ""}
                  onChange={(e) => form.setValue("department", e.target.value)}
                  options={departmentOptions.filter((x) => x.value !== "all")}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Employment Type *</div>
                <Select
                  value={form.watch("employment_type")}
                  onChange={(e) => form.setValue("employment_type", e.target.value)}
                  options={employmentTypeOptions}
                />
                {form.formState.errors.employment_type ? (
                  <div className="text-xs text-red-600">{form.formState.errors.employment_type.message}</div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Openings *</div>
                <Input type="number" min={1} {...form.register("num_openings")} />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Required Licenses * (comma-separated)</div>
                <Input {...form.register("required_licenses")} placeholder="LCSW, LPC" />
                {form.formState.errors.required_licenses ? (
                  <div className="text-xs text-red-600">{form.formState.errors.required_licenses.message}</div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Experience Level *</div>
                <Select
                  value={form.watch("experience_level")}
                  onChange={(e) => form.setValue("experience_level", e.target.value)}
                  options={experienceLevelOptions}
                />
                {form.formState.errors.experience_level ? (
                  <div className="text-xs text-red-600">{form.formState.errors.experience_level.message}</div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Work Locations * (comma-separated)</div>
                <Input {...form.register("work_locations")} placeholder="Durham, Remote" />
                {form.formState.errors.work_locations ? (
                  <div className="text-xs text-red-600">{form.formState.errors.work_locations.message}</div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Status *</div>
                <Select
                  value={form.watch("status")}
                  onChange={(e) => form.setValue("status", e.target.value)}
                  options={statusOptions.filter((x) => x.value !== "all")}
                />
                {form.formState.errors.status ? (
                  <div className="text-xs text-red-600">{form.formState.errors.status.message}</div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Salary Min</div>
                <Input type="number" step="0.01" {...form.register("salary_min")} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Salary Max</div>
                <Input type="number" step="0.01" {...form.register("salary_max")} />
                {form.formState.errors.salary_max ? (
                  <div className="text-xs text-red-600">{form.formState.errors.salary_max.message}</div>
                ) : null}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Pay Frequency</div>
                <Select
                  value={form.watch("pay_frequency") ?? ""}
                  onChange={(e) => form.setValue("pay_frequency", e.target.value)}
                  options={payFrequencyOptions}
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Benefits (comma-separated)</div>
                <Input {...form.register("benefits")} placeholder="Health, Dental, PTO" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Required Specializations (comma-separated)</div>
                <Input {...form.register("required_specializations")} placeholder="Trauma, Mental Health" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Preferred Specializations (comma-separated)</div>
                <Input {...form.register("preferred_specializations")} placeholder="Substance Abuse" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Job Description * (min 100 chars)</div>
              <Textarea {...form.register("description")} maxLength={2000} />
              {form.formState.errors.description ? (
                <div className="text-xs text-red-600">{form.formState.errors.description.message}</div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Key Responsibilities</div>
                <Textarea {...form.register("responsibilities")} maxLength={2000} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Internal Notes</div>
                <Textarea {...form.register("internal_notes")} maxLength={2000} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Work Schedule</div>
                <Input {...form.register("work_schedule")} placeholder="Monday-Friday, 9-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Application Deadline</div>
                <Input type="date" {...form.register("application_deadline")} />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
