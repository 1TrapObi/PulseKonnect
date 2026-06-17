"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Pencil } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTip } from "@/components/ui/help-tip";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { markChecklistProgress } from "@/lib/onboarding/local-progress";

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
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  insurance_type: string | null;
  insurance_payer: string | null;
  insurance_id: string | null;
  created_at: string;
  assigned_to?: string | null;
  contacted_at?: string | null;
  response_time_hours?: number | null;
  lost_reason?: string | null;
};

type LeadStatus = "new" | "attempted_contact" | "contacted" | "qualified" | "converted" | "lost";

type UserRow = { id: string; email: string; role: string };

type Activity = {
  id: string;
  action: string;
  notes: string | null;
  created_at: string;
  user_id: string | null;
};

type Note = {
  id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  user_id: string | null;
};

type Reminder = {
  id: string;
  type: string;
  due_at: string;
  email_notification: boolean;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  user_id: string | null;
};

type StatusPayload = {
  status: string;
  reason?: string;
};

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

function urgencyVariant(u: string | null | undefined) {
  const v = (u ?? "medium").toLowerCase();
  if (v === "high") return "danger" as const;
  if (v === "low") return "success" as const;
  return "warning" as const;
}

const statusOptions: SelectOption[] = [
  { value: "new", label: "New" },
  { value: "attempted_contact", label: "Attempted to Contact" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

const lostReasonOptions: SelectOption[] = [
  { value: "No Response", label: "No Response" },
  { value: "Declined Services", label: "Declined Services" },
  { value: "Out of Area", label: "Out of Area" },
  { value: "Other", label: "Other" },
];

const reminderTypeOptions: SelectOption[] = [
  { value: "Call back", label: "Call back" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Document request", label: "Document request" },
];

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

function activityLabel(a: Activity) {
  if (a.action === "lead_status_changed") {
    try {
      const n = a.notes ? JSON.parse(a.notes) : null;
      if (n?.to) {
        return `Status changed to ${statusLabel(String(n.to))}`;
      }
    } catch {
      // noop
    }
    return "Status changed";
  }

  if (a.action === "lead_assigned") {
    return "Assignment updated";
  }

  if (a.action === "note_added") {
    return "Note added";
  }

  if (a.action === "reminder_set") {
    return "Reminder set";
  }

  if (a.action === "reminder_completed") {
    return "Reminder completed";
  }

  return a.action;
}

export function LeadDetails({
  lead: initialLead,
  team,
  currentUserId,
}: {
  lead: Lead;
  team: UserRow[];
  currentUserId: string;
}) {
  const [tab, setTab] = React.useState("overview");
  const [lead, setLead] = React.useState<Lead>(initialLead);
  const [loading, setLoading] = React.useState(false);

  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);

  const [noteContent, setNoteContent] = React.useState("");
  const [noteInternal, setNoteInternal] = React.useState(true);

  const [reminderType, setReminderType] = React.useState(reminderTypeOptions[0]!.value);
  const [reminderDueAt, setReminderDueAt] = React.useState("");
  const [reminderEmail, setReminderEmail] = React.useState(false);

  const [lostReason, setLostReason] = React.useState(lostReasonOptions[0]!.value);

  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    phone: lead.phone ?? "",
    date_of_birth: lead.date_of_birth ?? "",
    insurance_id: lead.insurance_id ?? "",
    insurance_payer: lead.insurance_payer ?? "",
    address_line1: lead.address_line1 ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    zip: lead.zip ?? "",
  });

  React.useEffect(() => {
    setEditForm({
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      phone: lead.phone ?? "",
      date_of_birth: lead.date_of_birth ?? "",
      insurance_id: lead.insurance_id ?? "",
      insurance_payer: lead.insurance_payer ?? "",
      address_line1: lead.address_line1 ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      zip: lead.zip ?? "",
    });
  }, [lead]);

  const teamOptions: SelectOption[] = team.map((u) => ({ value: u.id, label: u.email }));

  async function refreshLead() {
    const res = await fetch(`/api/leads/${lead.id}`);
    const json = await res.json();
    if (json.ok && json.lead) {
      setLead(json.lead);
    }
  }

  async function fetchActivities() {
    const res = await fetch(`/api/leads/${lead.id}/activities`);
    const json = await res.json();
    setActivities(json.activities ?? []);
    requestAnimationFrame(() => {
      const el = document.getElementById("activity-bottom");
      el?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function fetchNotes() {
    const res = await fetch(`/api/leads/${lead.id}/notes`);
    const json = await res.json();
    setNotes(json.notes ?? []);
  }

  async function fetchReminders() {
    const res = await fetch(`/api/leads/${lead.id}/reminders`);
    const json = await res.json();
    setReminders(json.reminders ?? []);
  }

  React.useEffect(() => {
    fetchActivities();
    fetchNotes();
    fetchReminders();
  }, [lead.id]);

  async function assign(userId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/assign`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(json.error ?? "Failed to assign");
        return;
      }
      await refreshLead();
      await fetchActivities();
      markChecklistProgress("assignedLead");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(next: string) {
    setLoading(true);
    try {
      const payload: StatusPayload = { status: next };
      if (next === "lost") payload.reason = lostReason;

      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.ok) {
        alert(json.error ?? "Failed to update status");
        return;
      }

      await refreshLead();
      await fetchActivities();
      markChecklistProgress("statusUpdated");
    } finally {
      setLoading(false);
    }
  }

  async function saveLeadDetails() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const json = await res.json();
      if (!json.ok) {
        alert(json.error ?? "Failed to save lead details");
        return;
      }

      await refreshLead();
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  }

  function cancelEdit() {
    setEditForm({
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      phone: lead.phone ?? "",
      date_of_birth: lead.date_of_birth ?? "",
      insurance_id: lead.insurance_id ?? "",
      insurance_payer: lead.insurance_payer ?? "",
      address_line1: lead.address_line1 ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      zip: lead.zip ?? "",
    });
    setIsEditing(false);
  }

  async function addNote() {
    const content = noteContent.trim();
    if (!content) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, isInternal: noteInternal }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(json.error ?? "Failed to add note");
        return;
      }
      setNoteContent("");
      await fetchNotes();
      await fetchActivities();
      markChecklistProgress("addedNote");
    } finally {
      setLoading(false);
    }
  }

  async function addReminder() {
    const due = reminderDueAt ? new Date(reminderDueAt) : null;
    if (!due || Number.isNaN(due.getTime())) {
      alert("Please select a reminder date/time");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/reminders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: reminderType,
          dueAt: due.toISOString(),
          emailNotification: reminderEmail,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(json.error ?? "Failed to set reminder");
        return;
      }
      setReminderDueAt("");
      setReminderEmail(false);
      await fetchReminders();
      await fetchActivities();
    } finally {
      setLoading(false);
    }
  }

  async function markReminder(reminderId: string, isCompleted: boolean) {
    setLoading(true);
    try {
      await fetch(`/api/leads/${lead.id}/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      await fetchReminders();
      await fetchActivities();
    } finally {
      setLoading(false);
    }
  }

  const assignedLabel =
    team.find((u) => u.id === lead.assigned_to)?.email ?? "Unassigned";

  const createdAgo = timeAgo(lead.created_at);

  const responseText =
    lead.response_time_hours != null
      ? `Responded in ${lead.response_time_hours} hours`
      : null;

  const statusValue = ((lead.status ?? "new").toLowerCase() as LeadStatus);

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/leads">Back to Leads</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{lead.name}</CardTitle>
            <div className="mt-1 text-sm text-zinc-600">
              {lead.email ?? ""}
              {lead.email && lead.phone ? " • " : ""}
              {lead.phone ?? ""}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <Badge variant={statusVariant(lead.status)}>{statusLabel(lead.status)}</Badge>
              <Badge variant={urgencyVariant(lead.urgency)}>
                {(lead.urgency ?? "medium").toUpperCase()}
              </Badge>
              <span>Created {createdAgo}</span>
              {responseText ? <span>• {responseText}</span> : null}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-zinc-500">Assigned</div>
            <div className="text-sm font-medium text-zinc-900">{assignedLabel}</div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-950">
            <Info className="h-4 w-4" />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>
              Update the lead status to Attempted to Contact after leaving a voicemail or sending an email.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lead Details</CardTitle>
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    disabled={loading}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!isEditing ? (
                  <>
                    <div>
                      <span className="font-medium">First Name:</span>{" "}
                      {lead.first_name ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium">Last Name:</span>{" "}
                      {lead.last_name ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium">Mobile Number:</span>{" "}
                      {lead.phone ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium">DOB:</span>{" "}
                      {lead.date_of_birth ? new Date(lead.date_of_birth).toLocaleDateString() : "—"}
                    </div>
                    <div>
                      <span className="font-medium">Medicaid Number:</span>{" "}
                      {lead.insurance_id ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium">Medicaid Provider:</span>{" "}
                      {lead.insurance_payer ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium">Address:</span>{" "}
                      {lead.address_line1 || lead.city || lead.state || lead.zip
                        ? `${lead.address_line1 ?? ""}${lead.city ? `, ${lead.city}` : ""}${lead.state ? `, ${lead.state}` : ""} ${lead.zip ?? ""}`.trim()
                        : "—"}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">First Name</label>
                      <Input
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        placeholder="First name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Last Name</label>
                      <Input
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        placeholder="Last name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Mobile Number</label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">DOB</label>
                      <Input
                        type="date"
                        value={editForm.date_of_birth}
                        onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Medicaid Number</label>
                      <Input
                        value={editForm.insurance_id}
                        onChange={(e) => setEditForm({ ...editForm, insurance_id: e.target.value })}
                        placeholder="Medicaid number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Medicaid Provider</label>
                      <Input
                        value={editForm.insurance_payer}
                        onChange={(e) => setEditForm({ ...editForm, insurance_payer: e.target.value })}
                        placeholder="Medicaid provider"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Street Address</label>
                      <Input
                        value={editForm.address_line1}
                        onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                        placeholder="Street address"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">City</label>
                        <Input
                          value={editForm.city}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          placeholder="City"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">State</label>
                        <Input
                          value={editForm.state}
                          onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                          placeholder="State"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">ZIP</label>
                        <Input
                          value={editForm.zip}
                          onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                          placeholder="ZIP"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        onClick={saveLeadDetails}
                        disabled={loading}
                      >
                        {loading ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Assignment & Status</CardTitle>
                  <HelpTip text="Assign lead to a team member for follow-up." />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>Assign</span>
                    <HelpTip text="Assign lead to a team member for follow-up." />
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <Select
                        value={lead.assigned_to ?? ""}
                        onChange={(e) => assign(e.target.value)}
                        options={teamOptions}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={() => assign(currentUserId)}
                    >
                      Assign to Me
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>Status</span>
                    <HelpTip text="Update lead status as you progress through follow-up." />
                    <HelpTip text="Use Attempted to Contact when you've called or emailed but haven't connected yet." />
                  </div>
                  <div className="grid gap-2 md:grid-cols-3" data-tour="lead-status-dropdown">
                    <div className="md:col-span-2">
                      <Select
                        value={statusValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "converted" || v === "lost") {
                            setPendingStatus(v);
                          } else {
                            setPendingStatus(null);
                            setStatus(v);
                          }
                        }}
                        options={statusOptions}
                      />
                    </div>

                    {statusValue === "lost" ? (
                      <Button type="button" variant="outline" disabled>
                        Lost
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled
                      >
                        Current
                      </Button>
                    )}
                  </div>

                  {pendingStatus === "lost" ? (
                    <div className="grid gap-2 md:max-w-sm">
                      <div className="text-sm font-medium">Lost Reason</div>
                      <Select
                        value={lostReason}
                        onChange={(e) => setLostReason(e.target.value)}
                        options={lostReasonOptions}
                      />
                    </div>
                  ) : null}

                  {pendingStatus ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" disabled={loading}>
                          Confirm {pendingStatus}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm status change</DialogTitle>
                          <DialogDescription>
                            {pendingStatus === "lost"
                              ? "This will mark the lead as Lost."
                              : "This will mark the lead as Converted."}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" type="button">
                              Cancel
                            </Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button
                              type="button"
                              onClick={() => {
                                const v = pendingStatus;
                                setPendingStatus(null);
                                if (v) setStatus(v);
                              }}
                            >
                              Confirm
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : null}

                  {lead.lost_reason ? (
                    <div className="text-sm text-zinc-600">
                      Lost Reason: {lead.lost_reason}
                    </div>
                  ) : null}

                  {lead.contacted_at ? (
                    <div className="text-sm text-zinc-600">
                      Contacted at: {formatDateTime(lead.contacted_at)}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Activity Timeline</CardTitle>
                <HelpTip text="History of all actions taken on this lead." />
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[420px] space-y-3 overflow-auto rounded-md border bg-white p-3">
                {activities.length ? (
                  activities.map((a) => (
                    <div key={a.id} className="rounded-md border bg-zinc-50 p-3">
                      <div className="text-sm font-medium text-zinc-900">
                        {activityLabel(a)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        {formatDateTime(a.created_at)}
                      </div>
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

        <TabsContent value="notes">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Add Note</CardTitle>
                  <HelpTip text="Add internal notes about this lead (not visible to client)." />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  maxLength={500}
                  placeholder="Add a note (max 500 characters)"
                />
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={noteInternal}
                    onChange={(e) => setNoteInternal(e.target.checked)}
                  />
                  Internal only
                </label>
                <Button type="button" disabled={loading || !noteContent.trim()} onClick={addNote}>
                  Add Note
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notes.length ? (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-md border bg-white p-3">
                      <div className="text-sm text-zinc-900">{n.content}</div>
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
                        <span>{formatDateTime(n.created_at)}</span>
                        <Badge variant={n.is_internal ? "secondary" : "success"}>
                          {n.is_internal ? "Internal" : "Shareable"}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">No notes yet.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reminders">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Set Reminder</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Type</div>
                  <Select
                    value={reminderType}
                    onChange={(e) => setReminderType(e.target.value)}
                    options={reminderTypeOptions}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Due at</div>
                  <Input
                    type="datetime-local"
                    value={reminderDueAt}
                    onChange={(e) => setReminderDueAt(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={reminderEmail}
                    onChange={(e) => setReminderEmail(e.target.checked)}
                  />
                  Email notification
                </label>
                <Button type="button" disabled={loading} onClick={addReminder}>
                  Set Reminder
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Reminders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders.length ? (
                  reminders.map((r) => (
                    <div key={r.id} className="rounded-md border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-900">{r.type}</div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Due: {formatDateTime(r.due_at)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            Email: {r.email_notification ? "Yes" : "No"}
                          </div>
                        </div>
                        <Badge variant={r.is_completed ? "success" : "secondary"}>
                          {r.is_completed ? "Completed" : "Open"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {r.is_completed ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading}
                            onClick={() => markReminder(r.id, false)}
                          >
                            Reopen
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={loading}
                            onClick={() => markReminder(r.id, true)}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">No reminders yet.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
