"use client";

import { useState } from "react";
import type { SessionTemplate, DayType } from "@/types/database";
import { DAY_LABELS, DEFAULT_LIVE_LANES, DEFAULT_DRY_LANES } from "@/lib/constants";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  seedDefaultTemplates,
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

const DAYS: DayType[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

const DAY_ORDER: Record<DayType, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
};

function formatTime(time: string) {
  // Convert "15:00" or "15:00:00" to "3:00 PM"
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

type TemplateForm = {
  name: string;
  day: DayType;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
};

const emptyForm: TemplateForm = {
  name: "",
  day: "mon",
  time_start: "15:00",
  time_end: "16:30",
  live_lanes: DEFAULT_LIVE_LANES,
  dry_lanes: DEFAULT_DRY_LANES,
};

export function TemplatesClient({
  templates,
}: {
  templates: SessionTemplate[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<SessionTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Add form state
  const [addForm, setAddForm] = useState<TemplateForm>({ ...emptyForm });

  // Edit form state
  const [editForm, setEditForm] = useState<TemplateForm>({ ...emptyForm });

  // Group templates by day
  const grouped = DAYS.map((day) => ({
    day,
    label: DAY_LABELS[day],
    templates: templates
      .filter((t) => t.day === day)
      .sort((a, b) => a.time_start.localeCompare(b.time_start)),
  })).filter((g) => g.templates.length > 0);

  // ──────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createTemplate(addForm);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Template created successfully.");
      setAddForm({ ...emptyForm });
      setShowAdd(false);
    }
    setLoading(false);
  }

  function openEdit(template: SessionTemplate) {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      day: template.day,
      time_start: template.time_start.slice(0, 5), // trim seconds if present
      time_end: template.time_end.slice(0, 5),
      live_lanes: template.live_lanes,
      dry_lanes: template.dry_lanes,
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTemplate) return;
    setLoading(true);
    setMessage(null);

    const result = await updateTemplate(editingTemplate.id, editForm);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Template updated successfully.");
      setEditingTemplate(null);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!deletingTemplate) return;
    setLoading(true);
    setMessage(null);

    const result = await deleteTemplate(deletingTemplate.id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Template deleted.");
    }
    setDeletingTemplate(null);
    setLoading(false);
  }

  async function handleSeed() {
    setLoading(true);
    setMessage(null);

    const result = await seedDefaultTemplates();

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage(`${result.count} default templates created successfully.`);
    }
    setShowSeedConfirm(false);
    setLoading(false);
  }

  // ──────────────────────────────────────────────
  // Template form fields (shared between Add and Edit dialogs)
  // ──────────────────────────────────────────────

  function renderFormFields(
    form: TemplateForm,
    setForm: (f: TemplateForm) => void
  ) {
    return (
      <>
        <div className="space-y-2">
          <Label>Day</Label>
          <Select
            value={form.day}
            onValueChange={(v) => v && setForm({ ...form, day: v as DayType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) => DAY_LABELS[value as DayType] || value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={d}>
                  {DAY_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Monday Session 1"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={form.time_start}
              onChange={(e) =>
                setForm({ ...form, time_start: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={form.time_end}
              onChange={(e) =>
                setForm({ ...form, time_end: e.target.value })
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
              value={form.live_lanes}
              onChange={(e) =>
                setForm({ ...form, live_lanes: parseInt(e.target.value, 10) || 0 })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Dry Lanes</Label>
            <Input
              type="number"
              min={0}
              value={form.dry_lanes}
              onChange={(e) =>
                setForm({ ...form, dry_lanes: parseInt(e.target.value, 10) || 0 })
              }
              required
            />
          </div>
        </div>
      </>
    );
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Session Templates</h1>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button
              variant="outline"
              onClick={() => setShowSeedConfirm(true)}
              disabled={loading}
            >
              Seed Defaults
            </Button>
          )}
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger render={<Button />}>Add Template</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Session Template</DialogTitle>
                <DialogDescription>
                  Create a custom session template for the weekly schedule.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {renderFormFields(addForm, setAddForm)}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create Template"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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

      {templates.length === 0 ? (
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No session templates yet</p>
          <p className="mt-1 text-sm">
            Click &quot;Seed Defaults&quot; to create the standard 12 weekly
            sessions, or add templates manually.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.day}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-lg font-semibold">{group.label}</h2>
                <Badge variant="secondary">
                  {group.templates.length}{" "}
                  {group.templates.length === 1 ? "session" : "sessions"}
                </Badge>
              </div>
              <div className="rounded-md border bg-white">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Name</TableHead>
                      <TableHead className="w-[25%]">Time</TableHead>
                      <TableHead className="w-[12%]">Live Lanes</TableHead>
                      <TableHead className="w-[12%]">Dry Lanes</TableHead>
                      <TableHead className="w-[21%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          {template.name}
                        </TableCell>
                        <TableCell>
                          {formatTime(template.time_start)} &ndash;{" "}
                          {formatTime(template.time_end)}
                        </TableCell>
                        <TableCell>{template.live_lanes}</TableCell>
                        <TableCell>{template.dry_lanes}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(template)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeletingTemplate(template)}
                          >
                            Delete
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

      {/* ── Edit Dialog ── */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the session template details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            {renderFormFields(editForm, setEditForm)}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deletingTemplate}
        onOpenChange={(open) => {
          if (!open) setDeletingTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingTemplate?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingTemplate(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleDelete}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Seed Confirmation Dialog ── */}
      <Dialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seed Default Templates</DialogTitle>
            <DialogDescription>
              This will create 12 default session templates: 2 sessions per day
              for Monday through Friday (3:00-4:30 PM &amp; 4:30-6:00 PM) and
              Saturday (9:00-10:30 AM &amp; 10:30 AM-12:00 PM). Proceed?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSeedConfirm(false)}
            >
              Cancel
            </Button>
            <Button disabled={loading} onClick={handleSeed}>
              {loading ? "Creating..." : "Seed Defaults"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
