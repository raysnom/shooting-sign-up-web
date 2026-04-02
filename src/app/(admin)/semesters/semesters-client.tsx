"use client";

import { useState, useCallback } from "react";
import type { Semester } from "@/types/database";
import { createSemester, deleteSemester, resetNoShowCounts } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";

const EMPTY_FORM = { name: "", start_date: "", end_date: "" };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SemestersClient({ semesters }: { semesters: Semester[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [deleteTarget, setDeleteTarget] = useState<Semester | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createSemester(form);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Semester created successfully!");
      setTimeout(() => setMessage(null), 5000);
      setForm(EMPTY_FORM);
      setShowCreate(false);
    }
    setLoading(false);
  }, [form]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setMessage(null);
    setMessageType("success");

    const result = await deleteSemester(deleteTarget.id);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Semester deleted.");
      setTimeout(() => setMessage(null), 5000);
    }
    setDeleteTarget(null);
    setLoading(false);
  }, [deleteTarget]);

  const handleResetNoShows = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const result = await resetNoShowCounts();

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("All no-show counts have been reset to 0.");
      setTimeout(() => setMessage(null), 5000);
      setShowReset(false);
    }
    setLoading(false);
  }, []);

  const handleFormChange = useCallback((field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCloseCreate = useCallback(() => {
    setShowCreate(false);
  }, []);

  const handleCloseReset = useCallback(() => {
    setShowReset(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Semesters</h1>
        <div className="flex gap-2">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger render={<Button />}>
              Create Semester
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Semester</DialogTitle>
                <DialogDescription>
                  Add a new semester with a name and date range.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => handleFormChange("name", e.target.value)}
                    placeholder="e.g. Semester 1 2025"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => handleFormChange("start_date", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => handleFormChange("end_date", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create Semester"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showReset} onOpenChange={setShowReset}>
            <DialogTrigger render={<Button variant="destructive" />}>
              Reset No-Show Counts
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset No-Show Counts</DialogTitle>
                <DialogDescription>
                  This will set the no-show count to 0 for all non-archived
                  members. This is typically done at the start of a new
                  semester. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCloseReset}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetNoShows}
                  disabled={loading}
                >
                  {loading ? "Resetting..." : "Confirm Reset"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${messageType === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      <Separator />

      <div className="rounded-md border bg-white">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">Name</TableHead>
              <TableHead className="w-[20%]">Start Date</TableHead>
              <TableHead className="w-[20%]">End Date</TableHead>
              <TableHead className="w-[20%]">Created At</TableHead>
              <TableHead className="w-[15%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semesters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  No semesters found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              semesters.map((semester) => (
                <TableRow key={semester.id}>
                  <TableCell className="font-medium">
                    {semester.name}
                  </TableCell>
                  <TableCell>{formatDate(semester.start_date)}</TableCell>
                  <TableCell>{formatDate(semester.end_date)}</TableCell>
                  <TableCell>{formatDate(semester.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(semester)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Semester</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? All weeks and sessions in this semester will also be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={loading} onClick={handleConfirmDelete}>
              {loading ? "Deleting..." : "Delete Semester"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
