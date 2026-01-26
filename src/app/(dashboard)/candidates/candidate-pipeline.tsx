"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { MoreHorizontal, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { ToastViewport, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  license_type: string | null;
  license_number: string | null;
  experience_years: number | null;
  experience_level?: string | null;
  specializations: string[] | null;
  location: string | null;
  current_employer: string | null;
  source: string | null;
  source_url: string | null;
  status: string | null;
  fit_score: number | null;
  qualification_status: string | null;
  matched_positions?: any;
  created_at: string;
};

type CandidatesResponse = {
  ok: boolean;
  candidates: Candidate[];
  stats: Record<string, number>;
  positions: SelectOption[];
  licenses: SelectOption[];
  statuses: string[];
};

const STATUSES = [
  { key: "new", label: "New", color: "text-blue-600" },
  { key: "screening", label: "Screening", color: "text-purple-600" },
  { key: "interview", label: "Interview", color: "text-orange-600" },
  { key: "offer", label: "Offer", color: "text-yellow-600" },
  { key: "hired", label: "Hired", color: "text-emerald-600" },
  { key: "rejected", label: "Rejected", color: "text-red-600" },
] as const;

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

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function fitBadge(score: number | null | undefined) {
  const s = typeof score === "number" ? score : 0;
  if (s >= 75) return { label: "Excellent Fit", bg: "bg-[#D1FAE5]", text: "text-[#065F46]", icon: Star };
  if (s >= 60) return { label: "Good Fit", bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", icon: null };
  if (s >= 40) return { label: "Fair Fit", bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: null };
  return { label: "Poor Fit", bg: "bg-[#F4F4F5]", text: "text-[#52525B]", icon: null };
}

function CandidateCard({
  candidate,
  onMove,
}: {
  candidate: Candidate;
  onMove: (id: string, toStatus: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    data: { type: "candidate", candidate },
  });

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const b = fitBadge(candidate.fit_score);
  const Icon = b.icon;

  const spec = (candidate.specializations ?? [])[0] ?? "";
  const exp = typeof candidate.experience_years === "number" ? `${candidate.experience_years} yrs` : "—";

  const matchTitle = (() => {
    const mp = candidate.matched_positions as any;
    if (Array.isArray(mp) && mp.length) {
      return mp[0]?.title ?? mp[0]?.position_title ?? null;
    }
    return null;
  })();

  const matchScore = (() => {
    const mp = candidate.matched_positions as any;
    if (Array.isArray(mp) && mp.length) {
      const v = mp[0]?.match_score;
      return typeof v === "number" ? v : null;
    }
    return null;
  })();

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-60")}
      {...attributes}
      {...listeners}
    >
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <Badge className={cn("border-0", b.bg, b.text)}>
              {Icon ? <Icon className="mr-1 h-3.5 w-3.5" /> : null}
              {b.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onMove(candidate.id, "screening")}>Move to Screening</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(candidate.id, "interview")}>Move to Interview</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(candidate.id, "offer")}>Move to Offer</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onMove(candidate.id, "hired")}>Mark Hired…</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(candidate.id, "rejected")}>Reject…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-sm font-semibold text-zinc-900">
            {candidate.name}
            {candidate.license_type ? `, ${candidate.license_type}` : ""}
          </div>
          <div className="text-xs text-zinc-600">
            {exp}
            {spec ? ` • ${spec}` : ""}
          </div>
          <div className="text-xs text-zinc-600">{candidate.location ?? ""}</div>

          {matchTitle ? (
            <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-700">
              <div className="font-medium text-zinc-900">Match: {matchTitle}</div>
              <div>Score: {matchScore ?? candidate.fit_score ?? "—"}</div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="p-0" />
        <CardFooter className="flex items-center justify-between p-3 pt-0">
          <div className="text-xs text-zinc-500">Added: {timeAgo(candidate.created_at)}</div>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={`/candidates/${candidate.id}`}>View Profile</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function Column({
  status,
  title,
  count,
  children,
}: {
  status: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });

  return (
    <div className="min-w-[280px] flex-1">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">
          {title} <span className="text-zinc-500">({count})</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] rounded-xl border border-zinc-200 bg-zinc-50/50 p-2",
          isOver && "ring-2 ring-zinc-300"
        )}
      >
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}

export function CandidatePipeline() {
  const { items: toasts, push, remove } = useToast();

  const [position, setPosition] = React.useState("all");
  const [license, setLicense] = React.useState("all");
  const [experience, setExperience] = React.useState("all");
  const [fitScore, setFitScore] = React.useState("all");
  const [locationFit, setLocationFit] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounced(search, 250);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<{
    candidateId: string;
    toStatus: string;
  } | null>(null);
  const [confirmReason, setConfirmReason] = React.useState("");

  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (position && position !== "all") p.set("position", position);
    if (license && license !== "all") p.set("license", license);
    if (experience && experience !== "all") p.set("experience", experience);
    if (fitScore && fitScore !== "all") p.set("fitScore", fitScore);
    if (locationFit && locationFit !== "all") p.set("location", locationFit);
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    return p.toString();
  }, [position, license, experience, fitScore, locationFit, debouncedSearch]);

  const fetcher = React.useCallback(async (url: string) => {
    const res = await fetch(url);
    const json = (await res.json()) as CandidatesResponse;
    if (!res.ok || !json.ok) {
      throw new Error((json as any).error ?? "Request failed");
    }
    return json;
  }, []);

  const { data, error, isLoading, mutate } = useSWR<CandidatesResponse>(
    `/api/candidates${qs ? `?${qs}` : ""}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const candidates = data?.candidates ?? [];

  const byStatus = React.useMemo(() => {
    const map: Record<string, Candidate[]> = {
      new: [],
      screening: [],
      interview: [],
      offer: [],
      hired: [],
      rejected: [],
    };
    for (const c of candidates) {
      const s = String(c.status ?? "new").toLowerCase();
      if (s in map) map[s].push(c);
    }
    return map;
  }, [candidates]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const [activeCandidate, setActiveCandidate] = React.useState<Candidate | null>(null);

  const doUpdateStatus = React.useCallback(
    async (candidateId: string, toStatus: string, reason: string | null) => {
      const res = await fetch(`/api/candidates/${candidateId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: toStatus, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Update failed");
      }
    },
    []
  );

  const requestMove = React.useCallback(
    (candidateId: string, toStatus: string) => {
      if (toStatus === "hired" || toStatus === "rejected") {
        setConfirmTarget({ candidateId, toStatus });
        setConfirmReason("");
        setConfirmOpen(true);
        return;
      }

      const prev = data;
      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            candidates: current.candidates.map((c) =>
              c.id === candidateId ? { ...c, status: toStatus } : c
            ),
          };
        },
        { revalidate: false }
      );

      doUpdateStatus(candidateId, toStatus, null)
        .then(() => {
          push({ title: "Candidate moved", description: `Moved to ${toStatus}` });
          mutate();
        })
        .catch((e: any) => {
          mutate(prev, { revalidate: false });
          push({
            title: "Update failed",
            description: String(e?.message ?? e),
            variant: "danger",
          });
        });
    },
    [data, doUpdateStatus, mutate, push]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const overId = event.over?.id;
      const activeId = event.active?.id;
      setActiveCandidate(null);
      if (!overId || !activeId) return;
      const toStatus = String(overId);
      const candidateId = String(activeId);

      const cand = candidates.find((c) => c.id === candidateId);
      const fromStatus = String(cand?.status ?? "new").toLowerCase();
      if (fromStatus === toStatus) return;

      requestMove(candidateId, toStatus);
    },
    [candidates, requestMove]
  );

  const onDragStart = React.useCallback((event: any) => {
    const c = (event.active?.data?.current?.candidate as Candidate | undefined) ?? null;
    setActiveCandidate(c);
  }, []);

  const confirmSubmit = React.useCallback(() => {
    if (!confirmTarget) return;
    const { candidateId, toStatus } = confirmTarget;
    const reason = confirmReason.trim();
    if (!reason) return;

    setConfirmOpen(false);

    const prev = data;
    mutate(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          candidates: current.candidates.map((c) =>
            c.id === candidateId ? { ...c, status: toStatus } : c
          ),
        };
      },
      { revalidate: false }
    );

    doUpdateStatus(candidateId, toStatus, reason)
      .then(() => {
        push({ title: "Candidate updated", description: `Marked ${toStatus}` });
        mutate();
      })
      .catch((e: any) => {
        mutate(prev, { revalidate: false });
        push({
          title: "Update failed",
          description: String(e?.message ?? e),
          variant: "danger",
        });
      });
  }, [confirmReason, confirmTarget, data, doUpdateStatus, mutate, push]);

  const positionOptions: SelectOption[] = React.useMemo(() => {
    return [{ value: "all", label: "All positions" }, ...(data?.positions ?? [])];
  }, [data?.positions]);

  const licenseOptions: SelectOption[] = React.useMemo(() => {
    return [{ value: "all", label: "All licenses" }, ...(data?.licenses ?? [])];
  }, [data?.licenses]);

  const experienceOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "all", label: "All experience" },
      { value: "entry", label: "Entry (0-2)" },
      { value: "mid", label: "Mid (2-5)" },
      { value: "senior", label: "Senior (5+)" },
    ],
    []
  );

  const fitScoreOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "all", label: "All fit scores" },
      { value: "excellent", label: "Excellent (75+)" },
      { value: "good", label: "Good (60-74)" },
      { value: "fair", label: "Fair (40-59)" },
      { value: "poor", label: "Poor (<40)" },
    ],
    []
  );

  const locationOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "all", label: "All locations" },
      { value: "in-area", label: "In-Area" },
      { value: "adjacent", label: "Adjacent" },
      { value: "remote", label: "Remote" },
    ],
    []
  );

  const stats = data?.stats ?? {
    new: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    hired: 0,
    rejected: 0,
  };

  return (
    <div>
      <ToastViewport items={toasts} remove={remove} />

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Pipeline Stats</div>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {STATUSES.map((s) => (
                <div key={s.key} className={cn("font-medium", s.color)}>
                  {stats[s.key] ?? 0} {s.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-6">
          <Select value={position} onChange={(e) => setPosition(e.target.value)} options={positionOptions} />
          <Select value={license} onChange={(e) => setLicense(e.target.value)} options={licenseOptions} />
          <Select value={experience} onChange={(e) => setExperience(e.target.value)} options={experienceOptions} />
          <Select value={fitScore} onChange={(e) => setFitScore(e.target.value)} options={fitScoreOptions} />
          <Select value={locationFit} onChange={(e) => setLocationFit(e.target.value)} options={locationOptions} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, license" />
        </div>
      </div>

      <div className="mt-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load candidates: {String((error as any)?.message ?? error)}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="h-24 rounded-xl border bg-white" />
            <div className="h-24 rounded-xl border bg-white" />
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border bg-white p-3">
          <div className="h-[calc(100vh-320px)] overflow-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
            >
              <div className="flex w-full min-w-max gap-3 pb-2">
                {STATUSES.map((s) => (
                  <Column
                    key={s.key}
                    status={s.key}
                    title={s.label}
                    count={stats[s.key] ?? byStatus[s.key]?.length ?? 0}
                  >
                    {(byStatus[s.key] ?? []).map((c) => (
                      <CandidateCard key={c.id} candidate={c} onMove={requestMove} />
                    ))}
                  </Column>
                ))}
              </div>

              <DragOverlay>
                {activeCandidate ? (
                  <div className="w-[280px]">
                    <Card className="border-zinc-200 shadow-lg">
                      <CardHeader className="p-3">
                        <div className="text-sm font-semibold text-zinc-900">{activeCandidate.name}</div>
                        <div className="text-xs text-zinc-600">Dragging…</div>
                      </CardHeader>
                    </Card>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm status change</DialogTitle>
            <DialogDescription>
              {confirmTarget?.toStatus === "hired"
                ? "Mark candidate as hired (final stage)."
                : "Reject candidate (final stage)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-900">Reason</div>
            <Input value={confirmReason} onChange={(e) => setConfirmReason(e.target.value)} placeholder="Add a reason" />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={confirmSubmit} disabled={!confirmReason.trim()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
