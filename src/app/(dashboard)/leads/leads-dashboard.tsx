"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Grid3X3, List, Plus, Search, Upload, CheckSquare } from "lucide-react";

import { HelpTip } from "@/components/ui/help-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToastViewport, useToast } from "@/components/ui/toast";
import { markChecklistProgress } from "@/lib/onboarding/local-progress";
import { cn } from "@/lib/utils";
import { ImportLeadsModal } from "./import-leads-modal";

type Lead = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_home: string | null;
  date_of_birth: string | null;
  need_type: string | null;
  location: string | null;
  source: string | null;
  source_url: string | null;
  status: string | null;
  urgency: string | null;
  qualification_status?: string | null;
  qualification_score?: number | null;
  quality_score?: number | null;
  priority?: string | null;
  ai_reasoning?: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  insurance_type: string | null;
  insurance_payer: string | null;
  insurance_id: string | null;
  created_at: string;
};

type LeadStatus = "new" | "attempted_contact" | "contacted" | "qualified" | "converted" | "lost";

type LeadsResponse = {
  ok: boolean;
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  sources: SelectOption[];
};

type StatsResponse = {
  ok: boolean;
  new: number;
  attempted_contact: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
};

type CreateLeadBody = {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  need_type?: string;
  source?: string;
  source_url?: string;
  urgency?: "low" | "medium" | "high";
  notes?: string;
};

type ApiErrorResponse = { ok?: boolean; error?: string };
type UrgencyValue = "low" | "medium" | "high";
type RangePreset = "7d" | "30d" | "month" | "custom";

function isUrgencyValue(value: string): value is UrgencyValue {
  return value === "low" || value === "medium" || value === "high";
}

function isRangePreset(value: string): value is RangePreset {
  return value === "7d" || value === "30d" || value === "month" || value === "custom";
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function responseErrorMessage(value: LeadsResponse | StatsResponse | ApiErrorResponse | null) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return null;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function urgencyStyle(urgency: string | null | undefined) {
  const u = (urgency ?? "medium").toLowerCase();
  if (u === "high") {
    return {
      bg: "bg-[#FEE2E2]",
      border: "border-[#EF4444]",
      dot: "bg-[#EF4444]",
      label: "High",
    };
  }
  if (u === "low") {
    return {
      bg: "bg-[#D1FAE5]",
      border: "border-[#10B981]",
      dot: "bg-[#10B981]",
      label: "Low",
    };
  }
  return {
    bg: "bg-[#FEF3C7]",
    border: "border-[#F59E0B]",
    dot: "bg-[#F59E0B]",
    label: "Medium",
  };
}

function statusLabel(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "new") return "New";
  if (s === "attempted_contact") return "Attempted to Contact";
  if (s === "contacted") return "Contacted";
  if (s === "qualified") return "Qualified";
  if (s === "converted") return "Won";
  if (s === "lost") return "Lost";
  return "Unknown";
}

function statusVariant(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "new") return "secondary" as const;
  if (s === "attempted_contact") return "warning" as const;
  if (s === "contacted") return "info" as const;
  if (s === "qualified") return "accent" as const;
  if (s === "converted") return "success" as const;
  if (s === "lost") return "danger" as const;
  return "secondary" as const;
}

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function LeadsDashboard() {
  const router = useRouter();
  const [view, setView] = React.useState<"grid" | "list">("list");

  const [newLeadOpen, setNewLeadOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [selectingAll, setSelectingAll] = React.useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [leadName, setLeadName] = React.useState("");
  const [leadEmail, setLeadEmail] = React.useState("");
  const [leadPhone, setLeadPhone] = React.useState("");
  const [leadLocation, setLeadLocation] = React.useState("");
  const [leadNeedType, setLeadNeedType] = React.useState("");
  const [leadSource, setLeadSource] = React.useState("");
  const [leadSourceUrl, setLeadSourceUrl] = React.useState("");
  const [leadUrgency, setLeadUrgency] = React.useState<UrgencyValue>("medium");
  const [leadNotes, setLeadNotes] = React.useState("");

  const [status, setStatus] = React.useState("all");
  const [urgency, setUrgency] = React.useState("all");
  const [source, setSource] = React.useState("all");

  const [rangePreset, setRangePreset] = React.useState<RangePreset>("7d");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounced(search, 350);

  const [page, setPage] = React.useState(1);

  const [data, setData] = React.useState<LeadsResponse | null>(null);
  const [stats, setStats] = React.useState<StatsResponse | null>(null);
  const [leadsError, setLeadsError] = React.useState<string | null>(null);
  const [statsError, setStatsError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const lastHighLeadIdRef = React.useRef<string | null>(null);
  const { items: toasts, push, remove } = useToast();

  const dateRange = React.useMemo(() => {
    if (rangePreset === "custom") {
      return { startDate: customStart || null, endDate: customEnd || null };
    }

    const now = new Date();
    const endDate = now.toISOString();

    if (rangePreset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString(), endDate };
    }

    const days = rangePreset === "7d" ? 7 : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate };
  }, [rangePreset, customStart, customEnd]);

  const sourcesOptions = React.useMemo<SelectOption[]>(() => {
    return [{ value: "all", label: "All Sources" }, ...(data?.sources ?? [])];
  }, [data]);

  const fetchLeads = React.useCallback(async () => {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("urgency", urgency);
    params.set("source", source);
    params.set("page", String(page));
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (dateRange.startDate) params.set("startDate", dateRange.startDate);
    if (dateRange.endDate) params.set("endDate", dateRange.endDate);

    setLoading(true);
    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      const json = (await res.json().catch(() => null)) as LeadsResponse | ApiErrorResponse | null;

      if (!res.ok || !json?.ok) {
        setLeadsError(responseErrorMessage(json) ?? `Failed to load leads (${res.status})`);
        setData({ ok: false, leads: [], total: 0, page, totalPages: 1, sources: [] });
        return;
      }

      setLeadsError(null);
      setData(json as LeadsResponse);

      // toast if a new high urgency lead appears at the top
      const first = (json as LeadsResponse).leads?.[0];
      const isHigh = (first?.urgency ?? "").toLowerCase() === "high";
      if (first?.id && isHigh) {
        if (lastHighLeadIdRef.current && lastHighLeadIdRef.current !== first.id) {
          push({
            title: "New high-priority lead",
            description: `${first.name ?? "New lead"} (${first.location ?? ""})`,
            variant: "danger",
          });
        }
        lastHighLeadIdRef.current = first.id;
      }
    } finally {
      setLoading(false);
    }
  }, [status, urgency, source, page, debouncedSearch, dateRange, push]);

  const fetchStats = React.useCallback(async () => {
    const res = await fetch(`/api/leads/stats`);
    const json = (await res.json().catch(() => null)) as StatsResponse | ApiErrorResponse | null;

    if (!res.ok || !json?.ok) {
      setStatsError(responseErrorMessage(json) ?? `Failed to load stats (${res.status})`);
      setStats(null);
      return;
    }

    setStatsError(null);
    setStats(json as StatsResponse);
  }, []);

  React.useEffect(() => {
    setPage(1);
  }, [status, urgency, source, debouncedSearch, dateRange.startDate, dateRange.endDate]);

  React.useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [fetchLeads, fetchStats]);

  React.useEffect(() => {
    const t = window.setInterval(() => {
      fetchLeads();
      fetchStats();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [fetchLeads, fetchStats]);

  const statusOptions: SelectOption[] = [
    { value: "all", label: "All Statuses" },
    { value: "new", label: "New" },
    { value: "attempted_contact", label: "Attempted to Contact" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
    { value: "converted", label: "Converted" },
    { value: "lost", label: "Lost" },
  ];

  const urgencyOptions: SelectOption[] = [
    { value: "all", label: "All Urgency" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const rangeOptions: SelectOption[] = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "month", label: "This month" },
    { value: "custom", label: "Custom" },
  ];

  const leads = React.useMemo(() => data?.leads ?? [], [data?.leads]);
  const selectedCount = selectedIds.size;

  const allOnPageSelected = React.useMemo(() => {
    if (!leads.length) return false;
    for (const lead of leads) {
      if (!selectedIds.has(lead.id)) return false;
    }
    return true;
  }, [leads, selectedIds]);

  async function assignToMe(leadId: string) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignToMe: true }),
      });
      const json = (await res.json().catch(() => null)) as ApiErrorResponse | null;

      if (!res.ok || !json?.ok) {
        push({
          title: "Assignment failed",
          description: json?.error ?? `Failed to assign lead (${res.status})`,
          variant: "danger",
        });
        return;
      }

      push({
        title: "Assigned",
        description: "This lead has been assigned to you.",
        variant: "default",
      });
      markChecklistProgress("assignedLead");

      fetchLeads();
    } catch (e: unknown) {
      push({
        title: "Assignment failed",
        description: messageFromError(e),
        variant: "danger",
      });
    }
  }

  function resetNewLeadForm() {
    setCreateError(null);
    setLeadName("");
    setLeadEmail("");
    setLeadPhone("");
    setLeadLocation("");
    setLeadNeedType("");
    setLeadSource("");
    setLeadSourceUrl("");
    setLeadUrgency("medium");
    setLeadNotes("");
  }

  async function createLead() {
    if (!leadName.trim()) {
      setCreateError("Name is required");
      return;
    }

    const payload: CreateLeadBody = {
      name: leadName.trim(),
      email: leadEmail.trim() || undefined,
      phone: leadPhone.trim() || undefined,
      location: leadLocation.trim() || undefined,
      need_type: leadNeedType.trim() || undefined,
      source: leadSource.trim() || undefined,
      source_url: leadSourceUrl.trim() || undefined,
      urgency: leadUrgency,
      notes: leadNotes.trim() || undefined,
    };

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ApiErrorResponse | null;

      if (!res.ok || !json?.ok) {
        setCreateError(json?.error ?? `Failed to create lead (${res.status})`);
        return;
      }

      push({
        title: "Lead created",
        description: `${payload.name} has been added to Leads`,
      });
      markChecklistProgress("firstLead");

      setNewLeadOpen(false);
      resetNewLeadForm();
      await fetchLeads();
      await fetchStats();
    } finally {
      setCreating(false);
    }
  }

  async function handleImportComplete(result: {
    imported: number;
    skipped: number;
    duplicates: number;
    errors: string[];
  }) {
    if (result.imported > 0) {
      push({
        title: "Import complete",
        description: `Imported ${result.imported} leads. Skipped ${result.skipped}. Duplicates found: ${result.duplicates}.`,
      });
    } else {
      push({
        title: "Import finished",
        description: `No leads imported. Skipped ${result.skipped}. Duplicates found: ${result.duplicates}.`,
        variant: "default",
      });
    }

    if (result.errors.length) {
      push({
        title: "Some rows failed",
        description: result.errors[0] ?? "One or more rows could not be imported.",
        variant: "default",
      });
    }

    await fetchLeads();
    await fetchStats();
    router.refresh();
  }

  function toggleSelected(leadId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const lead of leads) next.add(lead.id);
      return next;
    });
  }

  async function selectAllMatching() {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("urgency", urgency);
    params.set("source", source);
    params.set("idsOnly", "1");
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (dateRange.startDate) params.set("startDate", dateRange.startDate);
    if (dateRange.endDate) params.set("endDate", dateRange.endDate);

    setSelectingAll(true);
    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      const json = (await res.json().catch(() => null)) as { ok?: boolean; ids?: string[]; total?: number; error?: string } | null;

      if (!res.ok || !json?.ok) {
        push({
          title: "Selection failed",
          description: json?.error ?? `Failed to select leads (${res.status})`,
          variant: "danger",
        });
        return;
      }

      const ids = json.ids ?? [];
      setSelectedIds(new Set(ids));
      push({
        title: "Leads selected",
        description: `Selected ${ids.length} lead${ids.length === 1 ? "" : "s"} matching the current filters.`,
      });
    } catch (e: unknown) {
      push({
        title: "Selection failed",
        description: messageFromError(e),
        variant: "danger",
      });
    } finally {
      setSelectingAll(false);
    }
  }

  async function bulkDeleteSelected() {
    if (!selectedIds.size) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; deleted?: number; error?: string } | null;
      if (!res.ok || !json?.ok) {
        push({
          title: "Delete failed",
          description: json?.error ?? `Failed to delete leads (${res.status})`,
          variant: "danger",
        });
        return;
      }

      push({
        title: "Leads deleted",
        description: `Deleted ${json.deleted ?? 0} lead(s).`,
      });

      setBulkDeleteOpen(false);
      clearSelection();
      setSelectMode(false);
      await fetchLeads();
      await fetchStats();
      router.refresh();
    } catch (e: unknown) {
      push({
        title: "Delete failed",
        description: messageFromError(e),
        variant: "danger",
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ImportLeadsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImportComplete}
      />

      <Dialog
        open={newLeadOpen}
        onOpenChange={(open) => {
          setNewLeadOpen(open);
          if (open) resetNewLeadForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
            <DialogDescription>
              Manually add a lead to test sources and verify they appear in Leads and Analytics.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid gap-3">
            {createError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {createError}
              </div>
            ) : null}

            <div className="grid gap-1">
              <div className="text-sm font-medium text-zinc-900">Name</div>
              <Input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Jane Doe" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <div className="text-sm font-medium text-zinc-900">Email</div>
                <Input
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="grid gap-1">
                <div className="text-sm font-medium text-zinc-900">Phone</div>
                <Input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <div className="text-sm font-medium text-zinc-900">Location</div>
                <Input
                  value={leadLocation}
                  onChange={(e) => setLeadLocation(e.target.value)}
                  placeholder="County / City"
                />
              </div>
              <div className="grid gap-1">
                <div className="text-sm font-medium text-zinc-900">Need Type</div>
                <Input
                  value={leadNeedType}
                  onChange={(e) => setLeadNeedType(e.target.value)}
                  placeholder="Housing, Food, Employment…"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <div className="text-sm font-medium text-zinc-900">Source</div>
                <Input
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  placeholder="Website / Referral / Walk-in…"
                  list="lead-source-suggestions"
                />
                <datalist id="lead-source-suggestions">
                  {(data?.sources ?? [])
                    .filter((s) => s.value !== "all")
                    .slice(0, 40)
                    .map((s) => (
                      <option key={s.value} value={s.value} />
                    ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <div className="text-sm font-medium text-zinc-900">Source URL (optional)</div>
                <Input
                  value={leadSourceUrl}
                  onChange={(e) => setLeadSourceUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-sm font-medium text-zinc-900">Urgency</div>
              <Select
                value={leadUrgency}
                onChange={(e) => setLeadUrgency(isUrgencyValue(e.target.value) ? e.target.value : "medium")}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
            </div>

            <div className="grid gap-1">
              <div className="text-sm font-medium text-zinc-900">Notes (optional)</div>
              <Textarea
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                placeholder="Any context about the lead…"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={creating}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={createLead} disabled={creating}>
              {creating ? "Creating…" : "Create lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          setBulkDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected leads?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedCount} lead(s) and any related notes, reminders, and activities.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={bulkDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void bulkDeleteSelected()}
              disabled={bulkDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {bulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {leadsError || statsError ? (
        <Card className="border-[#EF4444] bg-[#FEF2F2]">
          <CardHeader>
            <CardTitle className="text-[#991B1B]">Dashboard data error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#7F1D1D]">
            {leadsError ? <div>Leads: {leadsError}</div> : null}
            {statsError ? <div>Stats: {statsError}</div> : null}
            <div className="pt-2">
              <Button type="button" variant="outline" onClick={() => {
                fetchLeads();
                fetchStats();
              }}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="sticky top-0 z-10 -mx-4 border-b bg-zinc-50 px-4 py-3 md:-mx-6 md:px-6">
        <div className="grid gap-3 md:grid-cols-14">
          <div className="md:col-span-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />
          </div>
          <div className="md:col-span-2">
            <Select value={urgency} onChange={(e) => setUrgency(e.target.value)} options={urgencyOptions} />
          </div>
          <div className="md:col-span-2">
            <Select value={source} onChange={(e) => setSource(e.target.value)} options={sourcesOptions.length ? sourcesOptions : [{ value: "all", label: "All Sources" }]} />
          </div>
          <div className="md:col-span-2">
            <Select
              value={rangePreset}
              onChange={(e) => setRangePreset(isRangePreset(e.target.value) ? e.target.value : "7d")}
              options={rangeOptions}
            />
          </div>
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name/email/phone"
                className="pl-8"
                aria-label="Search leads by name, email, or phone number"
              />
              <div className="absolute right-2.5 top-2.5">
                <HelpTip text="Search by name, email, or phone number." />
              </div>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  style={{ backgroundColor: "#40E0D0", color: "#062925" }}
                  data-tour="new-lead-button"
                >
                  <span>Actions</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setNewLeadOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Leads
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectMode((prev) => {
                      const next = !prev;
                      if (!next) clearSelection();
                      return next;
                    });
                  }}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {selectMode ? "Done Selecting" : "Select Leads"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <HelpTip text="Click here to manually add a new lead." />
            <Button
              variant={view === "grid" ? "secondary" : "outline"}
              size="icon"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "outline"}
              size="icon"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {rangePreset === "custom" ? (
            <div className="md:col-span-12 grid gap-2 md:grid-cols-4">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
              <div className="md:col-span-2 text-xs text-zinc-500">
                Use custom date range (UTC).
              </div>
            </div>
          ) : null}
        </div>
        {selectMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-white p-2">
            <div className="text-sm text-zinc-700">
              Selected: <span className="font-semibold">{selectedCount}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={allOnPageSelected ? clearSelection : selectAllOnPage}
              disabled={!leads.length}
            >
              {allOnPageSelected ? "Clear page" : "Select page"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllMatching}
              disabled={selectingAll || !(data?.total ?? 0)}
            >
              {selectingAll ? "Selecting…" : `Select all ${data?.total ?? 0}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={!selectedCount}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedCount}
              onClick={() => setBulkDeleteOpen(true)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete selected
            </Button>
            <div className="ml-auto text-xs text-zinc-500">Deletion is organization-scoped.</div>
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
          <HelpTip text="Filter leads by status, urgency, or source." />
          <span>Use filters to narrow the list.</span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Lead Overview</CardTitle>
            <HelpTip text="Total number of leads in this status." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white" variant="secondary">
              {`${stats?.new ?? 0} New`}
            </Badge>
            <Badge className="bg-white" variant="warning">
              {`${stats?.attempted_contact ?? 0} Attempted`}
            </Badge>
            <Badge className="bg-white" variant="info">
              {`${stats?.contacted ?? 0} Contacted`}
            </Badge>
            <Badge className="bg-white" variant="accent">
              {`${stats?.qualified ?? 0} Qualified`}
            </Badge>
            <Badge className="bg-white" variant="success">
              {`${stats?.converted ?? 0} Won`}
            </Badge>
            <Badge className="bg-white" variant="danger">
              {`${stats?.lost ?? 0} Lost`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-zinc-600">
            {loading ? "Refreshing…" : `Showing ${leads.length} of ${data?.total ?? 0} leads`}
          </div>
        </CardContent>
      </Card>

      <div
        className={cn(
          view === "grid"
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "space-y-3"
        )}
      >
        {!loading && leads.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="p-8 text-center">
              <p className="mb-4 text-sm text-zinc-600">
                No leads yet. Leads will appear here automatically from your website form and referral sources.
              </p>
              <Button type="button" onClick={() => setNewLeadOpen(true)}>
                Add Your First Lead
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {leads.map((lead) => {
          const u = urgencyStyle(lead.urgency);
          const leadStatus = ((lead.status ?? "new").toLowerCase() as LeadStatus);
          const displayScore = lead.quality_score ?? lead.qualification_score ?? 0;
          const checked = selectedIds.has(lead.id);
          return (
            <Card
              key={lead.id}
              className={cn(
                "border",
                u.border,
                u.bg,
                view === "list" ? "overflow-hidden" : ""
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {selectMode ? (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleSelected(lead.id, Boolean(value))}
                          aria-label={`Select lead ${lead.name}`}
                        />
                      ) : null}
                      <span className={cn("h-2.5 w-2.5 rounded-full", u.dot)} />
                      <div className="text-base font-semibold leading-5 text-zinc-900">
                        {lead.name}
                      </div>
                      <Badge variant={statusVariant(leadStatus)} className="px-2.5 py-0.5 text-[12px]">
                        {statusLabel(leadStatus)}
                      </Badge>
                      <Badge
                        variant={u.label === "High" ? "danger" : u.label === "Low" ? "success" : "warning"}
                        className="px-2.5 py-0.5 text-[12px]"
                      >
                        {u.label}
                      </Badge>
                      <HelpTip text="High priority leads should be contacted first." />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span />  
                        </TooltipTrigger>
                        <TooltipContent sideOffset={8} className="max-w-xs bg-zinc-900 text-zinc-50">
                          <p>{lead.ai_reasoning ?? "AI-calculated quality score (0-100). Higher means a better match."}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-sm leading-5 text-zinc-600">
                      {lead.email ?? ""}{lead.email && lead.phone ? " • " : ""}{lead.phone ?? ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs leading-5 text-zinc-600">{timeAgo(lead.created_at)}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-0">
                <div className="text-sm leading-6 text-zinc-900">
                  <span className="font-medium">Name:</span>{" "}
                  {lead.first_name || lead.last_name
                    ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                    : lead.name}
                </div>
                <div className="text-sm leading-6 text-zinc-700">
                  <span className="font-medium">Phone:</span>{" "}
                  {lead.phone_home || lead.phone
                    ? [lead.phone_home, lead.phone].filter(Boolean).join(" / ")
                    : "—"}
                </div>
                <div className="text-sm leading-6 text-zinc-700">
                  <span className="font-medium">DOB:</span>{" "}
                  {lead.date_of_birth ? new Date(lead.date_of_birth).toLocaleDateString() : "—"}
                </div>
                <div className="text-sm leading-6 text-zinc-700">
                  <span className="font-medium">Medicaid #:</span>{" "}
                  {lead.insurance_id ?? "—"}
                </div>
                <div className="text-sm leading-6 text-zinc-700">
                  <span className="font-medium">Insurance:</span>{" "}
                  {lead.insurance_type ?? "—"}
                </div>
                <div className="text-sm leading-6 text-zinc-700">
                  <span className="font-medium">Address:</span>{" "}
                  {lead.address_line1 || lead.city || lead.state || lead.zip
                    ? `${lead.address_line1 ?? ""}${lead.city ? `, ${lead.city}` : ""}${lead.state ? `, ${lead.state}` : ""} ${lead.zip ?? ""}`.trim()
                    : "—"}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm" className="h-9 px-3 text-sm">
                    <Link href={`/leads/${lead.id}`}>View Details</Link>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 px-3 text-sm"
                        onClick={() => assignToMe(lead.id)}
                      >
                        Assign to Me
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={8} className="bg-zinc-900 text-zinc-50">
                      <p>Assign this lead to yourself for follow-up.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-600">
          Page {data?.page ?? page} of {data?.totalPages ?? 1}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={(data?.page ?? page) <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setPage((p) => Math.min(data?.totalPages ?? p + 1, p + 1))
            }
            disabled={(data?.page ?? page) >= (data?.totalPages ?? 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <ToastViewport items={toasts} remove={remove} />
    </div>
  );
}
