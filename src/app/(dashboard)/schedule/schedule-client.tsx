"use client";

import { useState, useTransition } from "react";
import type { Week, Session, ExcoDuty, DayType } from "@/types/database";
import type { AllocationWithSession, AllocationWithSessionAndMember } from "./page";
import { DAY_LABELS, TEAM_LABELS } from "@/lib/constants";
import { cancelAllocation, submitAbsenceReason } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const DAY_ORDER: DayType[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  // timeStr is "HH:MM" or "HH:MM:SS"
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function groupByDay(allocations: AllocationWithSession[]) {
  const groups: Partial<Record<DayType, AllocationWithSession[]>> = {};

  for (const alloc of allocations) {
    const day = alloc.sessions.day as DayType;
    if (!groups[day]) {
      groups[day] = [];
    }
    groups[day]!.push(alloc);
  }

  // Sort each group by time_start
  for (const day of Object.keys(groups) as DayType[]) {
    groups[day]!.sort((a, b) =>
      a.sessions.time_start.localeCompare(b.sessions.time_start)
    );
  }

  return groups;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

interface ScheduleClientProps {
  week: Week;
  allocations: AllocationWithSession[];
  allAllocations: AllocationWithSessionAndMember[];
  sessions: Session[];
  excoDuties: ExcoDuty[];
  currentMemberId: string;
}

export function ScheduleClient({
  week,
  allocations,
  allAllocations,
  sessions,
  excoDuties,
  currentMemberId,
}: ScheduleClientProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Provide Reason dialog state
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonAllocId, setReasonAllocId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonSubmitting, setReasonSubmitting] = useState(false);
  const [reasonSuccess, setReasonSuccess] = useState<string | null>(null);

  const excoDutySessionIds = new Set(excoDuties.map((d) => d.session_id));
  const grouped = groupByDay(allocations);
  const orderedDays = DAY_ORDER.filter((d) => grouped[d] !== undefined);

  // Group sessions by day for the full schedule view
  const sessionsByDay = DAY_ORDER.map((day) => ({
    day,
    label: DAY_LABELS[day] ?? day,
    sessions: sessions
      .filter((s) => s.day === day)
      .sort((a, b) => a.time_start.localeCompare(b.time_start)),
  })).filter((g) => g.sessions.length > 0);

  // Build a map: session_id -> allocations for that session
  const allocationsBySession = new Map<string, AllocationWithSessionAndMember[]>();
  for (const alloc of allAllocations) {
    const list = allocationsBySession.get(alloc.session_id) || [];
    list.push(alloc);
    allocationsBySession.set(alloc.session_id, list);
  }

  function handleCancel(allocationId: string) {
    setError(null);
    setCancellingId(allocationId);

    startTransition(async () => {
      const result = await cancelAllocation(allocationId);
      if (result.error) {
        setError(result.error);
      }
      setCancellingId(null);
    });
  }

  function openReasonDialog(allocationId: string) {
    setReasonAllocId(allocationId);
    setReasonText("");
    setReasonSuccess(null);
    setError(null);
    setReasonDialogOpen(true);
  }

  async function handleSubmitReason() {
    if (!reasonAllocId) return;
    setReasonSubmitting(true);
    setError(null);
    setReasonSuccess(null);

    const result = await submitAbsenceReason(reasonAllocId, reasonText);

    if (result.error) {
      setError(result.error);
    } else {
      setReasonSuccess("Reason submitted successfully.");
      setReasonDialogOpen(false);
    }
    setReasonSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Schedule &mdash; Week of {formatDate(week.start_date)} -{" "}
            {formatDate(week.end_date)}
          </h1>
        </div>
        <Badge
          variant={week.status === "published" ? "default" : "secondary"}
        >
          {week.status === "published" ? "Published" : "Drafted"}
        </Badge>
      </div>

      <Separator />

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Success banner ── */}
      {reasonSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {reasonSuccess}
        </div>
      )}

      {/* ── Provide Reason Dialog ── */}
      <Dialog
        open={reasonDialogOpen}
        onOpenChange={setReasonDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Absence Reason</DialogTitle>
            <DialogDescription>
              Explain why you will be absent from this session. This will be
              recorded as a valid reason (VR).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              placeholder="Enter your reason for absence..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={4}
              disabled={reasonSubmitting}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReasonDialogOpen(false)}
                disabled={reasonSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitReason}
                disabled={reasonSubmitting || !reasonText.trim()}
              >
                {reasonSubmitting ? "Submitting..." : "Submit Reason"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Tabs: My Schedule / Full Schedule ── */}
      <Tabs defaultValue="my-schedule">
        <TabsList>
          <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
          <TabsTrigger value="full-schedule">Full Schedule</TabsTrigger>
        </TabsList>

        {/* ── My Schedule Tab ── */}
        <TabsContent value="my-schedule">
          <div className="space-y-6">
            {allocations.length === 0 && (
              <div className="rounded-md border bg-white p-8 text-center text-gray-500">
                <p className="text-lg font-medium">
                  You have no allocated sessions this week.
                </p>
                <p className="mt-1 text-sm">
                  Did you submit preferences? If so, the algorithm may not have
                  been able to place you in any sessions this round.
                </p>
              </div>
            )}

            {orderedDays.map((day) => (
              <div key={day} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {DAY_LABELS[day] ?? day}
                </h2>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped[day]!.map((alloc) => {
                    const session = alloc.sessions;
                    const isLive = alloc.type === "live";
                    const hasExcoDuty = excoDutySessionIds.has(session.id);
                    const isCancelling =
                      cancellingId === alloc.id && isPending;

                    return (
                      <Card key={alloc.id}>
                        {hasExcoDuty && (
                          <div className="rounded-t-xl bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
                            You are on EXCO duty &mdash; responsible for
                            opening/closing the range
                          </div>
                        )}

                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle>{session.name}</CardTitle>
                              <CardDescription>
                                {formatTime(session.time_start)} &ndash;{" "}
                                {formatTime(session.time_end)}
                              </CardDescription>
                            </div>
                            <Badge
                              variant={isLive ? "default" : "secondary"}
                              className={
                                isLive
                                  ? "bg-green-600 text-white"
                                  : "bg-blue-100 text-blue-700"
                              }
                            >
                              {isLive ? "Live Fire" : "Dry Fire"}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          {isLive && alloc.gun_clash_warning && (
                            <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                              <span className="mr-1 font-semibold">
                                Shared Gun Clash:
                              </span>
                              {alloc.gun_clash_warning}
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Priority score: {alloc.priority_score.toFixed(2)}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {isLive && (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isCancelling}
                                onClick={() => handleCancel(alloc.id)}
                              >
                                {isCancelling ? "Cancelling..." : "Cancel Slot"}
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReasonDialog(alloc.id)}
                            >
                              Provide Reason
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Full Schedule Tab ── */}
        <TabsContent value="full-schedule">
          <div className="space-y-6">
            {sessionsByDay.length === 0 && (
              <div className="rounded-md border bg-white p-8 text-center text-gray-500">
                <p className="text-lg font-medium">No sessions this week.</p>
              </div>
            )}

            {sessionsByDay.map((group) => (
              <div key={group.day}>
                <h2 className="mb-3 text-lg font-semibold">{group.label}</h2>
                <div className="space-y-4">
                  {group.sessions.map((session) => {
                    const sessionAllocs =
                      allocationsBySession.get(session.id) || [];
                    const liveAllocs = sessionAllocs
                      .filter((a) => a.type === "live")
                      .sort((a, b) => a.members.name.localeCompare(b.members.name));
                    const dryAllocs = sessionAllocs
                      .filter((a) => a.type === "dry")
                      .sort((a, b) => a.members.name.localeCompare(b.members.name));

                    return (
                      <Card key={session.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>{session.name}</CardTitle>
                              <CardDescription>
                                {formatTime(session.time_start)} &ndash;{" "}
                                {formatTime(session.time_end)}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Badge className="bg-green-600 text-white">
                                {liveAllocs.length} Live
                              </Badge>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                {dryAllocs.length} Dry
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {sessionAllocs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No members allocated to this session.
                            </p>
                          ) : (
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead>Type</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {[...liveAllocs, ...dryAllocs].map((alloc) => {
                                    const isMe =
                                      alloc.member_id === currentMemberId;
                                    return (
                                      <TableRow
                                        key={alloc.id}
                                        className={
                                          isMe ? "bg-blue-50" : undefined
                                        }
                                      >
                                        <TableCell className="font-medium">
                                          {alloc.members.name}
                                          {isMe && (
                                            <span className="ml-2 text-xs text-blue-600">
                                              (You)
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {TEAM_LABELS[alloc.members.team] ??
                                            alloc.members.team}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              alloc.type === "live"
                                                ? "default"
                                                : "secondary"
                                            }
                                            className={
                                              alloc.type === "live"
                                                ? "bg-green-600 text-white"
                                                : "bg-blue-100 text-blue-700"
                                            }
                                          >
                                            {alloc.type === "live"
                                              ? "Live Fire"
                                              : "Dry Fire"}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
