"use client";

import { useState, useMemo, useCallback } from "react";
import type {
  Week,
  TrainingRequirement,
  TrainingTargetType,
  TeamType,
  Member,
  CompetitionGroup,
  DivisionType,
} from "@/types/database";
import { TEAM_LABELS, DIVISION_LABELS, DIVISIONS } from "@/lib/constants";
import {
  createRequirement,
  updateRequirement,
  deleteRequirement,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

const teams: TeamType[] = ["APW", "APM", "ARM", "ARW"];

const TARGET_TYPE_LABELS: Record<TrainingTargetType, string> = {
  team: "Team",
  individual: "Individual",
  division: "Division",
  group: "Group",
};

// ──────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getWeekLabel(week: Week) {
  return `Week of ${formatDate(week.start_date)} - ${formatDate(week.end_date)}`;
}

function getTargetValueLabel(
  targetType: TrainingTargetType,
  targetValue: string,
  members: Member[],
  groups: CompetitionGroup[]
) {
  if (targetType === "team") {
    return TEAM_LABELS[targetValue] || targetValue;
  }
  if (targetType === "division") {
    return DIVISION_LABELS[targetValue as DivisionType] || targetValue;
  }
  if (targetType === "group") {
    const group = groups.find((g) => g.id === targetValue);
    return group ? group.name : targetValue;
  }
  // individual
  const member = members.find((m) => m.id === targetValue);
  return member ? member.name : targetValue;
}

export function RequirementsClient({
  weeks,
  requirements,
  members,
  groups,
}: {
  weeks: Week[];
  requirements: TrainingRequirement[];
  members: Member[];
  groups: CompetitionGroup[];
}) {
  const [selectedWeekId, setSelectedWeekId] = useState<string>(
    weeks[0]?.id || ""
  );
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingReq, setEditingReq] = useState<TrainingRequirement | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    target_type: "team" as TrainingTargetType,
    target_value: "",
    min_sessions: 1,
  });

  const [editMinSessions, setEditMinSessions] = useState(1);

  // ──────────────────────────────────────────────
  // Memoized values
  // ──────────────────────────────────────────────

  const filteredRequirements = useMemo(
    () => requirements.filter((r) => r.week_id === selectedWeekId),
    [requirements, selectedWeekId]
  );

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.id === selectedWeekId),
    [weeks, selectedWeekId]
  );

  // ──────────────────────────────────────────────
  // Callbacks
  // ──────────────────────────────────────────────

  const handleTargetTypeChange = useCallback((value: TrainingTargetType) => {
    setForm((prev) => ({ ...prev, target_type: value, target_value: "" }));
  }, []);

  const handleTargetValueChange = useCallback((value: string | null) => {
    if (!value) return;
    setForm((prev) => ({ ...prev, target_value: value ?? "" }));
  }, []);

  const handleMinSessionsChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10);
    setForm((prev) => ({ ...prev, min_sessions: isNaN(parsed) ? 1 : parsed }));
  }, []);

  const openEdit = useCallback((req: TrainingRequirement) => {
    setEditingReq(req);
    setEditMinSessions(req.min_sessions);
    setShowEdit(true);
  }, []);

  // ──────────────────────────────────────────────
  // Server actions
  // ──────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWeekId) return;
    setLoading(true);
    setMessage(null);

    const result = await createRequirement({
      week_id: selectedWeekId,
      target_type: form.target_type,
      target_value: form.target_value,
      min_sessions: form.min_sessions,
    });

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Training requirement added.");
      setForm({ target_type: "team", target_value: "", min_sessions: 1 });
      setShowAdd(false);
    }
    setLoading(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReq) return;
    setLoading(true);
    setMessage(null);

    const result = await updateRequirement(editingReq.id, {
      min_sessions: editMinSessions,
    });

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Training requirement updated.");
      setShowEdit(false);
      setEditingReq(null);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this training requirement?"))
      return;
    setLoading(true);
    setMessage(null);

    const result = await deleteRequirement(id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Training requirement deleted.");
    }
    setLoading(false);
  }

  // ──────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────

  function renderTargetValueSelect() {
    if (form.target_type === "team") {
      return (
        <Select
          value={form.target_value}
          onValueChange={handleTargetValueChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a team">
              {(value) => TEAM_LABELS[value as TeamType] || value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {TEAM_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (form.target_type === "division") {
      return (
        <Select
          value={form.target_value}
          onValueChange={handleTargetValueChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a division">
              {(value) => DIVISION_LABELS[value as DivisionType] || value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DIVISIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {DIVISION_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (form.target_type === "group") {
      return (
        <Select
          value={form.target_value}
          onValueChange={handleTargetValueChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a group">
              {(value) => {
                const g = groups.find((grp) => grp.id === value);
                return g ? g.name : "Select a group";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {groups.length === 0 ? (
              <SelectItem value="__none__" disabled>
                No groups created yet
              </SelectItem>
            ) : (
              groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    }

    // individual
    return (
      <Select
        value={form.target_value}
        onValueChange={handleTargetValueChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a member">
            {(value) => {
              const m = members.find((mem) => mem.id === value);
              return m ? `${m.name} - ${m.login_id}` : "Select a member";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => {
            const memberLabel = `${m.name} - ${m.login_id}`;
            return (
              <SelectItem key={m.id} value={m.id}>
                {memberLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Training Requirements</h1>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger
            render={<Button disabled={!selectedWeekId} />}
          >
            Add Requirement
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Training Requirement</DialogTitle>
              <DialogDescription>
                Set a minimum session requirement for a team, individual
                member, division, or competition group for the selected week.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Week</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedWeek ? getWeekLabel(selectedWeek) : "No week selected"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Target Type</Label>
                <Select
                  value={form.target_type}
                  onValueChange={(v) =>
                    handleTargetTypeChange(v as TrainingTargetType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => TARGET_TYPE_LABELS[value as TrainingTargetType] || value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">
                      <span className="capitalize">Team</span>
                    </SelectItem>
                    <SelectItem value="individual">
                      <span className="capitalize">Individual</span>
                    </SelectItem>
                    <SelectItem value="division">
                      <span className="capitalize">Division</span>
                    </SelectItem>
                    <SelectItem value="group">
                      <span className="capitalize">Group</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Value</Label>
                {renderTargetValueSelect()}
              </div>
              <div className="space-y-2">
                <Label>Minimum Sessions</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.min_sessions}
                  onChange={(e) => handleMinSessionsChange(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !form.target_value}
              >
                {loading ? "Adding..." : "Add Requirement"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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

      <div className="space-y-2">
        <Label>Select Week</Label>
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open or published weeks available.
          </p>
        ) : (
          <Select value={selectedWeekId} onValueChange={(v) => v && setSelectedWeekId(v)}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a week">
                {(value) => {
                  const w = weeks.find((wk) => wk.id === value);
                  return w ? getWeekLabel(w) : "Select a week";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {weeks.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {getWeekLabel(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Requirements can be set per team, division, competition group, or
        individual. Priority order (highest to lowest): Individual &gt; Group
        &gt; Division &gt; Team.
      </div>

      <Separator />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target Type</TableHead>
              <TableHead>Target Value</TableHead>
              <TableHead>Min Sessions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequirements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500">
                  No training requirements for this week.
                </TableCell>
              </TableRow>
            ) : (
              filteredRequirements.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {req.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {getTargetValueLabel(
                      req.target_type,
                      req.target_value,
                      members,
                      groups
                    )}
                  </TableCell>
                  <TableCell>{req.min_sessions}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(req)}
                        disabled={loading}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(req.id)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Training Requirement</DialogTitle>
            <DialogDescription>
              Update the minimum number of sessions required.
            </DialogDescription>
          </DialogHeader>
          {editingReq && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label>Target</Label>
                <p className="text-sm text-muted-foreground">
                  <Badge variant="secondary" className="capitalize mr-2">
                    {editingReq.target_type}
                  </Badge>
                  {getTargetValueLabel(
                    editingReq.target_type,
                    editingReq.target_value,
                    members,
                    groups
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Minimum Sessions</Label>
                <Input
                  type="number"
                  min={1}
                  value={editMinSessions}
                  onChange={(e) =>
                    setEditMinSessions(parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
