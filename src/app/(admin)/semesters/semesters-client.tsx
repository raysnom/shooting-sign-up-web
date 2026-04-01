"use client";

import { useState } from "react";
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

export function SemestersClient({ semesters }: { semesters: Semester[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createSemester(form);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Semester created successfully!");
      setForm({ name: "", start_date: "", end_date: "" });
      setShowCreate(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this semester?")) return;
    setLoading(true);
    setMessage(null);

    const result = await deleteSemester(id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Semester deleted.");
    }
    setLoading(false);
  }

  async function handleResetNoShows() {
    setLoading(true);
    setMessage(null);

    const result = await resetNoShowCounts();

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("All no-show counts have been reset to 0.");
      setShowReset(false);
    }
    setLoading(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

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
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
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
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
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
                  onClick={() => setShowReset(false)}
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
                      onClick={() => handleDelete(semester.id)}
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
    </div>
  );
}
