"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Week, Session, DayType } from "@/types/database";
import type { AllocationWithDetails, ExcoDutyWithDetails } from "./page";
import { DAY_LABELS } from "@/lib/constants";
import { publishWeek, rerunDraft } from "./actions";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";

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

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function DraftReviewClient({
  week,
  sessions,
  allocations,
  excoDuties,
}: {
  week: Week;
  sessions: Session[];
  allocations: AllocationWithDetails[];
  excoDuties: ExcoDutyWithDetails[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showRerunConfirm, setShowRerunConfirm] = useState(false);

  // ── Summary stats ──
  const totalAllocations = allocations.length;
  const liveFireCount = allocations.filter((a) => a.type === "live").length;
  const dryFireCount = allocations.filter((a) => a.type === "dry").length;
  const uniqueMembers = new Set(allocations.map((a) => a.member_id)).size;

  // ── Sessions sorted and grouped by day ──
  const sortedSessions = [...sessions]
    .filter((s) => !s.is_cancelled)
    .sort((a, b) => {
      const dayDiff = DAY_ORDER[a.day] - DAY_ORDER[b.day];
      if (dayDiff !== 0) return dayDiff;
      return a.time_start.localeCompare(b.time_start);
    });

  // ── Calculate unused slots per session ──
  const sessionUnusedSlots = sortedSessions.map((session) => {
    const sessionAllocations = allocations.filter((a) => a.session_id === session.id);
    const liveUsed = sessionAllocations.filter((a) => a.type === "live").length;
    const dryUsed = sessionAllocations.filter((a) => a.type === "dry").length;
    const liveRemaining = session.live_lanes - liveUsed;
    const dryRemaining = session.dry_lanes - dryUsed;
    return {
      session,
      liveUsed,
      dryUsed,
      liveRemaining,
      dryRemaining,
      hasUnused: liveRemaining > 0 || dryRemaining > 0,
    };
  }).filter((s) => !s.session.is_cancelled);

  const hasUnusedSlots = sessionUnusedSlots.some((s) => s.hasUnused);

  const grouped = DAYS.map((day) => ({
    day,
    label: DAY_LABELS[day],
    sessions: sortedSessions.filter((s) => s.day === day),
  })).filter((g) => g.sessions.length > 0);

  // ── Build lookup maps ──
  const excoDutyBySession = new Map<string, ExcoDutyWithDetails[]>();
  for (const duty of excoDuties) {
    const existing = excoDutyBySession.get(duty.session_id) || [];
    existing.push(duty);
    excoDutyBySession.set(duty.session_id, existing);
  }

  const allocationsBySession = new Map<string, AllocationWithDetails[]>();
  for (const alloc of allocations) {
    const existing = allocationsBySession.get(alloc.session_id) || [];
    existing.push(alloc);
    allocationsBySession.set(alloc.session_id, existing);
  }

  // ── Handlers ──

  async function handlePublish() {
    setLoading(true);
    setMessage(null);

    const result = await publishWeek(week.id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
      setLoading(false);
    } else {
      setMessage("Results published successfully! Redirecting...");
      setTimeout(() => {
        router.push("/sessions");
      }, 1500);
    }
  }

  async function handleRerunDraft() {
    setLoading(true);
    setMessage(null);

    const result = await rerunDraft(week.id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
      setLoading(false);
    } else {
      setMessage("Draft cleared. Week reset to closed. Redirecting...");
      setShowRerunConfirm(false);
      setTimeout(() => {
        router.push("/sessions");
      }, 1500);
    }
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Draft Review</h1>
          <p className="text-sm text-muted-foreground">
            Review draft results before publishing to members.
          </p>
        </div>
        <Badge variant="secondary">Drafted</Badge>
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

      {/* ── Week Info ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Week: {formatDate(week.start_date)} &ndash;{" "}
            {formatDate(week.end_date)}
          </CardTitle>
          <CardDescription>
            Review the draft allocations below. Publish when satisfied or re-run
            the draft to try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{totalAllocations}</p>
              <p className="text-xs text-muted-foreground">Total Allocations</p>
            </div>
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{liveFireCount}</p>
              <p className="text-xs text-muted-foreground">Live Fire</p>
            </div>
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{dryFireCount}</p>
              <p className="text-xs text-muted-foreground">Dry Fire</p>
            </div>
            <div className="rounded-md border p-3 text-center">
              <p className="text-2xl font-bold">{uniqueMembers}</p>
              <p className="text-xs text-muted-foreground">Members Allocated</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Unused Slots Warning ── */}
      {hasUnusedSlots && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-900">
              Unused Slots Detected
            </CardTitle>
            <CardDescription className="text-amber-800">
              The following sessions have unfilled capacity. Late submissions may
              fill these slots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionUnusedSlots
                .filter((s) => s.hasUnused)
                .map((s) => (
                  <div
                    key={s.session.id}
                    className="flex items-center justify-between rounded-md border border-amber-200 bg-white p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-amber-900">
                        {s.session.name}
                      </p>
                      <p className="text-xs text-amber-700">
                        {DAY_LABELS[s.session.day]} &middot;{" "}
                        {formatTime(s.session.time_start)} &ndash;{" "}
                        {formatTime(s.session.time_end)}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {s.liveRemaining > 0 && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">
                          {s.liveRemaining} live{" "}
                          {s.liveRemaining === 1 ? "slot" : "slots"} unfilled
                        </Badge>
                      )}
                      {s.dryRemaining > 0 && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">
                          {s.dryRemaining} dry{" "}
                          {s.dryRemaining === 1 ? "slot" : "slots"} unfilled
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Action Buttons ── */}
      <div className="flex gap-3">
        <Button onClick={handlePublish} disabled={loading}>
          {loading ? "Processing..." : "Publish Results"}
        </Button>
        <Button
          variant="outline"
          className="text-red-600 hover:text-red-700"
          onClick={() => setShowRerunConfirm(true)}
          disabled={loading}
        >
          Re-run Draft
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/sessions")}
          disabled={loading}
        >
          Back to Sessions
        </Button>
      </div>

      <Separator />

      {/* ── Sessions grouped by day ── */}
      {grouped.length === 0 ? (
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No sessions found</p>
          <p className="mt-1 text-sm">
            There are no active sessions in this week.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.day}>
              <h2 className="mb-3 text-lg font-semibold">{group.label}</h2>
              <div className="space-y-4">
                {group.sessions.map((session) => {
                  const sessionAllocations =
                    allocationsBySession.get(session.id) || [];
                  const liveAllocations = sessionAllocations
                    .filter((a) => a.type === "live")
                    .sort((a, b) => b.priority_score - a.priority_score);
                  const dryAllocations = sessionAllocations
                    .filter((a) => a.type === "dry")
                    .sort((a, b) => b.priority_score - a.priority_score);
                  const sessionExco = excoDutyBySession.get(session.id) || [];
                  const excoMemberIds = new Set(
                    sessionExco.map((e) => e.member_id)
                  );

                  return (
                    <Card key={session.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {session.name}
                          </CardTitle>
                          <span className="text-sm text-muted-foreground">
                            {formatTime(session.time_start)} &ndash;{" "}
                            {formatTime(session.time_end)}
                          </span>
                        </div>
                        <CardDescription>
                          {liveAllocations.length} live fire /{" "}
                          {dryAllocations.length} dry fire
                          {sessionExco.length > 0 && (
                            <>
                              {" "}
                              / EXCO duty:{" "}
                              {sessionExco
                                .map((e) => e.member_name)
                                .join(", ")}
                            </>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {sessionAllocations.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No allocations for this session.
                          </p>
                        ) : (
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Member</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Priority Score</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Live fire members first */}
                                {liveAllocations.map((alloc) => (
                                  <TableRow
                                    key={alloc.id}
                                    className={
                                      alloc.gun_clash_warning
                                        ? "bg-yellow-50"
                                        : ""
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {alloc.member_name}
                                      {excoMemberIds.has(alloc.member_id) && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 text-xs"
                                        >
                                          EXCO Duty
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="default">Live</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {alloc.priority_score.toFixed(1)}
                                    </TableCell>
                                    <TableCell>
                                      {alloc.gun_clash_warning && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs"
                                        >
                                          Gun clash: {alloc.gun_clash_warning}
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {/* Dry fire members */}
                                {dryAllocations.map((alloc) => (
                                  <TableRow key={alloc.id}>
                                    <TableCell className="font-medium">
                                      {alloc.member_name}
                                      {excoMemberIds.has(alloc.member_id) && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 text-xs"
                                        >
                                          EXCO Duty
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">Dry</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {alloc.priority_score.toFixed(1)}
                                    </TableCell>
                                    <TableCell />
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Re-run Draft Confirmation Dialog ── */}
      <Dialog open={showRerunConfirm} onOpenChange={setShowRerunConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-run Draft</DialogTitle>
            <DialogDescription>
              Are you sure you want to re-run the draft? This will delete all
              current allocations and EXCO duty assignments for this week and
              reset the week status to &quot;closed&quot;. You can then run the
              draft algorithm again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRerunConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleRerunDraft}
            >
              {loading ? "Clearing..." : "Confirm Re-run"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
