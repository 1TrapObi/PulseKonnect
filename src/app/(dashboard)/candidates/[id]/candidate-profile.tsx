"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  resume_url: string | null;
  resume_text: string | null;
  source: string | null;
  source_url: string | null;
  status: string | null;
  fit_score: number | null;
  qualification_status: string | null;
  matched_positions?: any;
  created_at: string;
  updated_at?: string;
};

type UserRow = { id: string; email: string; role: string };

type Activity = {
  id: string;
  action: string;
  notes: string | null;
  created_at: string;
  user_id: string | null;
};

type CandidateNote = {
  id: string;
  candidate_id: string;
  user_id: string | null;
  note_type: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
};

type Interview = {
  id: string;
  candidate_id: string;
  position_id: string | null;
  interview_date: string;
  interview_type: string | null;
  interviewers: any;
  location_or_link: string | null;
  agenda: string | null;
  notes: string | null;
  rating: number | null;
  feedback: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CandidateDocument = {
  id: string;
  candidate_id: string;
  filename: string;
  file_url: string;
  file_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

type PositionMatch = {
  id: string;
  candidate_id: string;
  position_id: string;
  position_title?: string | null;
  match_score: number | null;
  match_reasons: any;
  created_at: string;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function fitBadge(score: number | null | undefined) {
  const s = typeof score === "number" ? score : 0;
  if (s >= 75) return { label: "Excellent Fit", bg: "bg-[#D1FAE5]", text: "text-[#065F46]", icon: Star };
  if (s >= 60) return { label: "Good Fit", bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", icon: null };
  if (s >= 40) return { label: "Fair Fit", bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: null };
  return { label: "Poor Fit", bg: "bg-[#F4F4F5]", text: "text-[#52525B]", icon: null };
}

const statusOptions: SelectOption[] = [
  { value: "new", label: "New" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const noteTypeOptions: SelectOption[] = [
  { value: "general", label: "General" },
  { value: "interview_feedback", label: "Interview Feedback" },
  { value: "reference_check", label: "Reference Check" },
  { value: "other", label: "Other" },
];

const interviewTypeOptions: SelectOption[] = [
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video" },
  { value: "in_person", label: "In-Person" },
];

export function CandidateProfile({
  candidate: initialCandidate,
  team,
  positions,
  currentUserId,
}: {
  candidate: Candidate;
  team: UserRow[];
  positions: Array<{ id: string; title: string }>;
  currentUserId: string;
}) {
  const { items: toasts, push, remove } = useToast();

  const [tab, setTab] = React.useState("overview");
  const [candidate, setCandidate] = React.useState<Candidate>(initialCandidate);
  const [loading, setLoading] = React.useState(false);

  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [notes, setNotes] = React.useState<CandidateNote[]>([]);
  const [interviews, setInterviews] = React.useState<Interview[]>([]);
  const [documents, setDocuments] = React.useState<CandidateDocument[]>([]);
  const [positionMatches, setPositionMatches] = React.useState<PositionMatch[]>([]);

  const [noteContent, setNoteContent] = React.useState("");
  const [noteType, setNoteType] = React.useState(noteTypeOptions[0]!.value);
  const [noteInternal, setNoteInternal] = React.useState(true);

  const [interviewOpen, setInterviewOpen] = React.useState(false);
  const [interviewDateTime, setInterviewDateTime] = React.useState("");
  const [interviewType, setInterviewType] = React.useState(interviewTypeOptions[0]!.value);
  const [interviewLocation, setInterviewLocation] = React.useState("");
  const [interviewAgenda, setInterviewAgenda] = React.useState("");

  const [docType, setDocType] = React.useState("resume");
  const [docFile, setDocFile] = React.useState<File | null>(null);

  const [addToPositionId, setAddToPositionId] = React.useState(positions[0]?.id ?? "");
  const positionOptions: SelectOption[] = positions.map((p) => ({ value: p.id, label: p.title }));

  const teamOptions: SelectOption[] = team.map((u) => ({ value: u.id, label: u.email }));
  const [selectedInterviewers, setSelectedInterviewers] = React.useState<string[]>([]);

  const fit = fitBadge(candidate.fit_score);
  const FitIcon = fit.icon;

  const bestMatch = React.useMemo(() => {
    const mp = candidate.matched_positions as any;
    if (Array.isArray(mp) && mp.length) {
      return {
        title: mp[0]?.title ?? mp[0]?.position_title ?? null,
        score: typeof mp[0]?.match_score === "number" ? mp[0].match_score : null,
      };
    }
    return { title: null, score: null };
  }, [candidate.matched_positions]);

  async function refreshCandidate() {
    const res = await fetch(`/api/candidates/${candidate.id}`);
    const json = await res.json();
    if (json.ok && json.candidate) {
      setCandidate(json.candidate);
      setPositionMatches(json.positionMatches ?? []);
    }
  }

  async function fetchActivities() {
    const res = await fetch(`/api/candidates/${candidate.id}/activities`);
    const json = await res.json();
    setActivities(json.activities ?? []);
    requestAnimationFrame(() => {
      const el = document.getElementById("activity-bottom");
      el?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function fetchNotes() {
    const res = await fetch(`/api/candidates/${candidate.id}/notes`);
    const json = await res.json();
    setNotes(json.notes ?? []);
  }

  async function fetchInterviews() {
    const res = await fetch(`/api/candidates/${candidate.id}/interviews`);
    const json = await res.json();
    setInterviews(json.interviews ?? []);
  }

  async function fetchDocuments() {
    const res = await fetch(`/api/candidates/${candidate.id}/documents`);
    const json = await res.json();
    setDocuments(json.documents ?? []);
  }

  React.useEffect(() => {
    refreshCandidate();
    fetchActivities();
    fetchNotes();
    fetchInterviews();
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id]);

  async function setStatus(next: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, reason: next === "hired" || next === "rejected" ? "Updated in profile" : null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ title: "Status update failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      await refreshCandidate();
      await fetchActivities();
      push({ title: "Status updated", description: `Moved to ${next}` });
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    const content = noteContent.trim();
    if (!content) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, type: noteType, isInternal: noteInternal }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ title: "Failed to add note", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      setNoteContent("");
      await fetchNotes();
      await fetchActivities();
      push({ title: "Note added" });
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument() {
    if (!docFile) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", docFile);
      fd.set("fileType", docType);

      const res = await fetch(`/api/candidates/${candidate.id}/documents`, {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ title: "Upload failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }

      setDocFile(null);
      await fetchDocuments();
      await fetchActivities();
      push({ title: "Document uploaded" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteDocument(docId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/documents/${docId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ title: "Delete failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      await fetchDocuments();
      await fetchActivities();
      push({ title: "Document deleted" });
    } finally {
      setLoading(false);
    }
  }

  async function scheduleInterview() {
    const d = interviewDateTime ? new Date(interviewDateTime) : null;
    if (!d || Number.isNaN(d.getTime())) {
      push({ title: "Invalid date/time", description: "Please select a date/time", variant: "danger" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/interviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: d.toISOString(),
          type: interviewType,
          interviewers: selectedInterviewers,
          location: interviewLocation || null,
          agenda: interviewAgenda || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ title: "Failed to schedule", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }

      setInterviewOpen(false);
      setInterviewDateTime("");
      setInterviewLocation("");
      setInterviewAgenda("");
      setSelectedInterviewers([]);

      await fetchInterviews();
      await fetchActivities();
      push({ title: "Interview scheduled" });
    } finally {
      setLoading(false);
    }
  }

  async function addToPosition() {
    if (!addToPositionId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/position-matches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positionId: addToPositionId, action: "add" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ title: "Failed", description: json.error ?? "Request failed", variant: "danger" });
        return;
      }
      await refreshCandidate();
      await fetchActivities();
      push({ title: "Added to position" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ToastViewport items={toasts} remove={remove} />

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/candidates">Back to Pipeline</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-0", fit.bg, fit.text)}>
                {FitIcon ? <FitIcon className="mr-1 h-3.5 w-3.5" /> : null}
                {fit.label}
                {typeof candidate.fit_score === "number" ? ` (${candidate.fit_score})` : ""}
              </Badge>

              <div className="w-44">
                <Select
                  value={String(candidate.status ?? "new").toLowerCase()}
                  onChange={(e) => setStatus(e.target.value)}
                  options={statusOptions}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Quick Actions <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setInterviewOpen(true)}>
                    Schedule Interview
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => push({ title: "Not wired", description: "Send Email not implemented yet" })}>
                    Send Email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div>
            <CardTitle className="text-xl">{candidate.name}</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">
              {candidate.email ? <span>{candidate.email}</span> : null}
              {candidate.email && candidate.phone ? " • " : null}
              {candidate.phone ? <span>{candidate.phone}</span> : null}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              {candidate.location ? <span>{candidate.location}</span> : null}
              {candidate.location && candidate.experience_years != null ? " • " : null}
              {candidate.experience_years != null ? (
                <span>{candidate.experience_years} years experience</span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-sm text-zinc-700">
              <span className="font-medium">Specializations:</span>{" "}
              {(candidate.specializations ?? []).length
                ? (candidate.specializations ?? []).join(", ")
                : "—"}
            </div>

            {bestMatch.title ? (
              <div className="text-sm text-zinc-700">
                <span className="font-medium">Best Match:</span> {bestMatch.title}
                {bestMatch.score != null ? ` (${bestMatch.score}% match)` : ""}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
              <DialogTrigger asChild>
                <Button disabled={loading}>Schedule Interview</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Interview</DialogTitle>
                  <DialogDescription>Create an interview event for this candidate.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Date/Time</div>
                    <Input
                      type="datetime-local"
                      value={interviewDateTime}
                      onChange={(e) => setInterviewDateTime(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Type</div>
                    <Select value={interviewType} onChange={(e) => setInterviewType(e.target.value)} options={interviewTypeOptions} />
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Interviewer</div>
                    <Select
                      value={selectedInterviewers[0] ?? ""}
                      onChange={(e) => setSelectedInterviewers(e.target.value ? [e.target.value] : [])}
                      options={teamOptions}
                    />
                    <div className="text-xs text-zinc-500">Single-select for now (can expand to multi-select).</div>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Location / Link</div>
                    <Input value={interviewLocation} onChange={(e) => setInterviewLocation(e.target.value)} placeholder="Zoom link, office address, etc." />
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm font-medium">Agenda</div>
                    <Textarea value={interviewAgenda} onChange={(e) => setInterviewAgenda(e.target.value)} maxLength={500} />
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="button" disabled={loading} onClick={scheduleInterview}>
                    Schedule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              disabled={loading}
              onClick={() => push({ title: "Not wired", description: "Send Email not implemented yet" })}
            >
              Send Email
            </Button>

            {positions.length ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="min-w-[220px]">
                  <Select value={addToPositionId} onChange={(e) => setAddToPositionId(e.target.value)} options={positionOptions} />
                </div>
                <Button type="button" variant="outline" disabled={loading || !addToPositionId} onClick={addToPosition}>
                  Add to Position
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resume">Resume & Documents</TabsTrigger>
          <TabsTrigger value="interviews">Interview & Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
          <TabsTrigger value="matches">Position Matches</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Email:</span> {candidate.email ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {candidate.phone ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Location:</span> {candidate.location ?? "—"}
                </div>
                <div>
                  <span className="font-medium">Current Employer:</span> {candidate.current_employer ?? "—"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credentials & Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">License:</span>{" "}
                  {candidate.license_type ? `${candidate.license_type}` : "—"}
                  {candidate.license_number ? ` (${candidate.license_number})` : ""}
                </div>
                <div>
                  <span className="font-medium">Experience:</span>{" "}
                  {candidate.experience_years != null ? `${candidate.experience_years} years` : "—"}
                  {candidate.experience_level ? ` • ${candidate.experience_level}` : ""}
                </div>
                <div>
                  <span className="font-medium">Specializations:</span>{" "}
                  {(candidate.specializations ?? []).length
                    ? (candidate.specializations ?? []).join(", ")
                    : "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resume">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Resume</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {candidate.resume_url ? (
                  <a className="text-sm font-medium text-zinc-900 underline" href={candidate.resume_url} target="_blank" rel="noreferrer">
                    Download resume
                  </a>
                ) : (
                  <div className="text-sm text-zinc-600">No resume file uploaded.</div>
                )}

                {candidate.resume_text ? (
                  <div className="max-h-[340px] overflow-auto rounded-md border bg-white p-3 text-sm text-zinc-800 whitespace-pre-wrap">
                    {candidate.resume_text}
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => push({ title: "Not wired", description: "Re-parse resume not implemented yet" })}
                >
                  Re-parse Resume
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Upload</div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="md:col-span-1">
                      <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="resume, cover_letter, ..." />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        type="file"
                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  <Button type="button" disabled={loading || !docFile} onClick={uploadDocument}>
                    Upload Document
                  </Button>
                  <div className="text-xs text-zinc-500">
                    Requires Supabase Storage bucket: <span className="font-medium">candidate-documents</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {documents.length ? (
                    documents.map((d) => (
                      <div key={d.id} className="rounded-md border bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-zinc-900">{d.filename}</div>
                            <div className="mt-1 text-xs text-zinc-600">
                              {d.file_type ?? "other"} • {formatDateTime(d.uploaded_at)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                              <a href={d.file_url} target="_blank" rel="noreferrer">
                                Download
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={loading}
                              onClick={() => deleteDocument(d.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-600">No documents yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="interviews">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Interview History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {interviews.length ? (
                  interviews.map((i) => (
                    <div key={i.id} className="rounded-md border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-900">
                            {i.interview_type ?? "interview"} • {formatDateTime(i.interview_date)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Status: {i.status ?? "scheduled"}
                            {i.location_or_link ? ` • ${i.location_or_link}` : ""}
                          </div>
                        </div>
                        <Badge variant="secondary">{(i.status ?? "scheduled").toUpperCase()}</Badge>
                      </div>
                      {i.notes ? <div className="mt-2 text-sm text-zinc-700">{i.notes}</div> : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">No interviews yet.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Type</div>
                  <Select value={noteType} onChange={(e) => setNoteType(e.target.value)} options={noteTypeOptions} />
                </div>

                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  maxLength={500}
                  placeholder="Add a note (max 500 characters)"
                />

                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={noteInternal} onChange={(e) => setNoteInternal(e.target.checked)} />
                  Internal only
                </label>

                <Button type="button" disabled={loading || !noteContent.trim()} onClick={addNote}>
                  Add Note
                </Button>

                <div className="space-y-2">
                  {notes.length ? (
                    notes.map((n) => (
                      <div key={n.id} className="rounded-md border bg-white p-3">
                        <div className="text-sm text-zinc-900 whitespace-pre-wrap">{n.content}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
                          <span>
                            {n.note_type ?? "general"} • {formatDateTime(n.created_at)}
                          </span>
                          <Badge variant={n.is_internal ? "secondary" : "success"}>
                            {n.is_internal ? "Internal" : "Shareable"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-600">No notes yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[520px] space-y-3 overflow-auto rounded-md border bg-white p-3">
                {activities.length ? (
                  activities.map((a) => (
                    <div key={a.id} className="rounded-md border bg-zinc-50 p-3">
                      <div className="text-sm font-medium text-zinc-900">{a.action}</div>
                      {a.notes ? (
                        <div className="mt-1 text-xs text-zinc-700 whitespace-pre-wrap">{a.notes}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-zinc-600">{formatDateTime(a.created_at)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">No activities yet.</div>
                )}
                <div id="activity-bottom" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Position Matches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {positionMatches.length ? (
                  positionMatches.map((m) => (
                    <div key={m.id} className="rounded-md border bg-white p-3">
                      <div className="text-sm font-semibold text-zinc-900">
                        {m.position_title ?? m.position_id}
                      </div>
                      <div className="mt-1 text-sm text-zinc-700">
                        Match Score: {m.match_score != null ? `${m.match_score}/100` : "—"}
                      </div>
                      <div className="mt-2 text-xs text-zinc-600">Added: {formatDateTime(m.created_at)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">No matches yet.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manage Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {positions.length ? (
                  <>
                    <Select value={addToPositionId} onChange={(e) => setAddToPositionId(e.target.value)} options={positionOptions} />
                    <Button type="button" variant="outline" disabled={loading || !addToPositionId} onClick={addToPosition}>
                      Add to Position
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-zinc-600">No positions available.</div>
                )}

                <div className="text-xs text-zinc-500">
                  Remove is supported via API but not yet surfaced in UI (can add next).
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
