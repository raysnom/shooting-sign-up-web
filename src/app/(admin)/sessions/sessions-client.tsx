"use client";

import { useState } from "react";
import Link from "next/link";
import type { Semester, Week, Session, DayType, WeekStatus } from "@/types/database";
import { DAY_LABELS, DEFAULT_LIVE_LANES, DEFAULT_DRY_LANES } from "@/lib/constants";
import {
  createWeek,
  generateSessionsFromTemplates,
  updateSession,
  cancelSession,
  uncancelSession,
  deleteWeek,
  updateWeekStatus,
} from "./actions";
import { runDraft } from "./draft-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const DAYS: DayType[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

const DAY_ORDER: Record<DayType, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
};

const STATUS_VARIANT: Record<WeekStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  closed: "destructive",
  drafted: "secondary",
  published: "outline",
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDeadline(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type CreateWeekForm = {
  semester_id: string;
  start_date: string;
  end_date: string;
  max_live_per_member: string;
};

type EditSessionForm = {
  name: string;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function SessionsClient({
  semesters,
  weeks,
  sessions,
}: {
  semesters: Semester[];
  weeks: Week[];
  sessions: Session[];
}) {
  // State
  const [selectedWeekId, setSelectedWeekId] = useState<string>(
    weeks.length > 0 ? weeks[0].id : ""
  );
  const [showCreateWeek, setShowCreateWeek] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Create Week form
  const [createForm, setCreateForm] = useState<CreateWeekForm>({
    semester_id: semesters.length > 0 ? semesters[0].id : "",
    start_date: "",
    end_date: "",
    max_live_per_member: "",
  });

  // Edit Session form
  const [editForm, setEditForm] = useState<EditSessionForm>({
    name: "",
    time_start: "",
    time_end: "",
    live_lanes: DEFAULT_LIVE_LANES,
    dry_lanes: DEFAULT_DRY_LANES,
  });

  // Derived data
  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || null;
  const weekSessions = sessions
    .filter((s) => s.week_id === selectedWeekId)
    .sort((a, b) => {
      const dayDiff = DAY_ORDER[a.day] - DAY_ORDER[b.day];
      if (dayDiff !== 0) return dayDiff;
      return a.time_start.localeCompare(b.time_start);
    });

  // Group sessions by day
  const grouped = DAYS.map((day) => ({
    day,
    label: DAY_LABELS[day],
    sessions: weekSessions.filter((s) => s.day === day),
  })).filter((g) => g.sessions.length > 0);

  // ──────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────

  async function handleCreateWeek(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createWeek(createForm);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Week created successfully.");
      setCreateForm({
        semester_id: semesters.length > 0 ? semesters[0].id : "",
        start_date: "",
        end_date: "",
        max_live_per_member: "",
      });
      setShowCreateWeek(false);
    }
    setLoading(false);
  }

  async function handleGenerateSessions() {
    if (!selectedWeekId) return;
    setLoading(true);
    setMessage(null);

    const result = await generateSessionsFromTemplates(selectedWeekId);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage(`${result.count} sessions generated from templates.`);
    }
    setShowGenerateConfirm(false);
    setLoading(false);
  }

  async function handleDeleteWeek() {
    if (!selectedWeekId) return;
    setLoading(true);
    setMessage(null);

    const result = await deleteWeek(selectedWeekId);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Week deleted.");
      setSelectedWeekId(weeks.length > 1 ? weeks.find((w) => w.id !== selectedWeekId)?.id || "" : "");
    }
    setShowDeleteConfirm(false);
    setLoading(false);
  }

  async function handleToggleWeekStatus() {
    if (!selectedWeek) return;
    setLoading(true);
    setMessage(null);

    const newStatus: WeekStatus = selectedWeek.status === "open" ? "closed" : "open";
    const result = await updateWeekStatus(selectedWeekId, newStatus);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage(`Week status changed to ${newStatus}.`);
    }
    setLoading(false);
  }

  async function handleRunDraft() {
    if (!selectedWeekId || !selectedWeek) return;
    if (selectedWeek.status !== "closed") {
      setMessage("Error: Draft can only run on weeks with status 'closed'.");
      return;
    }
    setLoading(true);
    setMessage(null);

    const result = await runDraft(selectedWeekId);

    if ("error" in result) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage(
        `Draft completed! ${result.allocations} allocations and ${result.excoDuties} EXCO duties assigned.`
      );
    }
    setLoading(false);
  }

  function openEditSession(session: Session) {
    setEditingSession(session);
    setEditForm({
      name: session.name,
      time_start: session.time_start.slice(0, 5),
      time_end: session.time_end.slice(0, 5),
      live_lanes: session.live_lanes,
      dry_lanes: session.dry_lanes,
    });
  }

  async function handleUpdateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSession) return;
    setLoading(true);
    setMessage(null);

    const result = await updateSession(editingSession.id, editForm);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Session updated successfully.");
      setEditingSession(null);
    }
    setLoading(false);
  }

  async function handleToggleCancel(session: Session) {
    setLoading(true);
    setMessage(null);

    const result = session.is_cancelled
      ? await uncancelSession(session.id)
      : await cancelSession(session.id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage(
        session.is_cancelled
          ? "Session reactivated."
          : "Session cancelled."
      );
    }
    setLoading(false);
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions / Weeks</h1>
        <Dialog open={showCreateWeek} onOpenChange={setShowCreateWeek}>
          <DialogTrigger render={<Button />}>Create Week</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Week</DialogTitle>
              <DialogDescription>
                Add a new training week. The submission deadline will be
                auto-set to Saturday at 5:00 PM of the selected week.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateWeek} className="space-y-4">
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select
                  value={createForm.semester_id}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, semester_id: v ?? "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select semester">
                      {(value) => {
                        const s = semesters.find((sem) => sem.id === value);
                        return s ? s.name : "Select semester";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date (Monday)</Label>
                  <Input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, start_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (Sunday)</Label>
                  <Input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, end_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max Live Fire Per Member (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.max_live_per_member}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, max_live_per_member: e.target.value })
                  }
                  placeholder="No limit"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Set a maximum number of live fire slots each member can
                  receive this week. Leave blank for no limit.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Submission deadline is automatically calculated as Saturday 5:00 PM
                of the selected week.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Week"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Message ── */}
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* ── Week Selector ── */}
      {weeks.length === 0 ? (
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No weeks created yet</p>
          <p className="mt-1 text-sm">
            Click &quot;Create Week&quot; to add a training week.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Label className="shrink-0">Select Week</Label>
            <Select
              value={selectedWeekId}
              onValueChange={(v) => {
                if (v) {
                  setSelectedWeekId(v);
                  setMessage(null);
                }
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a week">
                  {(value) => {
                    const w = weeks.find((wk) => wk.id === value);
                    return w ? `${formatDate(w.start_date)} – ${formatDate(w.end_date)}` : "Select a week";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => {
                  const weekLabel = `${formatDate(w.start_date)} – ${formatDate(w.end_date)}`;
                  return (
                    <SelectItem key={w.id} value={w.id}>
                      {weekLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* ── Selected Week Info ── */}
          {selectedWeek && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        Week: {formatDate(selectedWeek.start_date)} &ndash;{" "}
                        {formatDate(selectedWeek.end_date)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Deadline: {formatDeadline(selectedWeek.submission_deadline)}
                      </CardDescription>
                    </div>
                    <Badge variant={STATUS_VARIANT[selectedWeek.status]}>
                      {selectedWeek.status.charAt(0).toUpperCase() +
                        selectedWeek.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {weekSessions.length === 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setShowGenerateConfirm(true)}
                        disabled={loading}
                      >
                        Generate from Templates
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleToggleWeekStatus}
                      disabled={loading}
                    >
                      {selectedWeek.status === "open"
                        ? "Close Week"
                        : "Open Week"}
                    </Button>
                    {selectedWeek.status === "closed" && (
                      <Button
                        variant="outline"
                        onClick={handleRunDraft}
                        disabled={loading}
                      >
                        {loading ? "Running Draft..." : "Run Draft"}
                      </Button>
                    )}
                    {selectedWeek.status === "drafted" && (
                      <Link href={`/sessions/draft-review?weekId=${selectedWeek.id}`}>
                        <Button variant="outline">Review Results</Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={loading}
                    >
                      Delete Week
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* ── Sessions grouped by day ── */}
              {weekSessions.length === 0 ? (
                <div className="rounded-md border bg-white p-8 text-center text-gray-500">
                  <p className="text-lg font-medium">No sessions in this week</p>
                  <p className="mt-1 text-sm">
                    Click &quot;Generate from Templates&quot; to populate sessions
                    from your session templates.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((group) => (
                    <div key={group.day}>
                      <div className="mb-2 flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{group.label}</h2>
                        <Badge variant="secondary">
                          {group.sessions.length}{" "}
                          {group.sessions.length === 1 ? "session" : "sessions"}
                        </Badge>
                      </div>
                      <div className="rounded-md border bg-white">
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[22%]">Name</TableHead>
                              <TableHead className="w-[22%]">Time</TableHead>
                              <TableHead className="w-[12%]">Live Lanes</TableHead>
                              <TableHead className="w-[12%]">Dry Lanes</TableHead>
                              <TableHead className="w-[12%]">Status</TableHead>
                              <TableHead className="w-[20%] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.sessions.map((session) => (
                              <TableRow
                                key={session.id}
                                className={
                                  session.is_cancelled
                                    ? "opacity-50"
                                    : ""
                                }
                              >
                                <TableCell
                                  className={`font-medium ${
                                    session.is_cancelled
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }`}
                                >
                                  {session.name}
                                </TableCell>
                                <TableCell
                                  className={
                                    session.is_cancelled
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }
                                >
                                  {formatTime(session.time_start)} &ndash;{" "}
                                  {formatTime(session.time_end)}
                                </TableCell>
                                <TableCell>{session.live_lanes}</TableCell>
                                <TableCell>{session.dry_lanes}</TableCell>
                                <TableCell>
                                  {session.is_cancelled ? (
                                    <Badge variant="destructive">Cancelled</Badge>
                                  ) : (
                                    <Badge variant="secondary">Active</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditSession(session)}
                                    disabled={loading}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={
                                      session.is_cancelled
                                        ? "text-green-600 hover:text-green-700"
                                        : "text-red-600 hover:text-red-700"
                                    }
                                    onClick={() => handleToggleCancel(session)}
                                    disabled={loading}
                                  >
                                    {session.is_cancelled
                                      ? "Reactivate"
                                      : "Cancel"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Edit Session Dialog ── */}
      <Dialog
        open={!!editingSession}
        onOpenChange={(open) => {
          if (!open) setEditingSession(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update session details for{" "}
              <strong>{editingSession?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSession} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Session name"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editForm.time_start}
                  onChange={(e) =>
                    setEditForm({ ...editForm, time_start: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editForm.time_end}
                  onChange={(e) =>
                    setEditForm({ ...editForm, time_end: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Live Lanes</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.live_lanes}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      live_lanes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Dry Lanes</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.dry_lanes}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      dry_lanes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Week Confirmation Dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Week</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this week
              {selectedWeek && (
                <>
                  {" "}
                  ({formatDate(selectedWeek.start_date)} &ndash;{" "}
                  {formatDate(selectedWeek.end_date)})
                </>
              )}
              ? All sessions in this week will also be deleted. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleDeleteWeek}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Generate Sessions Confirmation Dialog ── */}
      <Dialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Sessions from Templates</DialogTitle>
            <DialogDescription>
              This will create sessions for this week based on all existing
              session templates. Each template will become one session. Proceed?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGenerateConfirm(false)}
            >
              Cancel
            </Button>
            <Button disabled={loading} onClick={handleGenerateSessions}>
              {loading ? "Generating..." : "Generate Sessions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
