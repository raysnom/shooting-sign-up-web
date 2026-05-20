"use client";

import { Fragment, useState, useTransition, useMemo, useCallback, useOptimistic } from "react";
import type { Week, Session, ExcoDuty, DayType } from "@/types/database";
import type { AllocationWithSession, AllocationWithSessionAndMember } from "./page";
import { DAY_LABELS, TEAM_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

type Timing = { timeStart: string; timeEnd: string };

function sameTiming(a?: Timing, b?: Timing) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.timeStart === b.timeStart && a.timeEnd === b.timeEnd;
}

function buildHeaderSegments(
  columns: { day: DayType }[],
  timingByDay: Partial<Record<DayType, Timing>>
) {
  const segments: Array<{ key: string; span: number; timing?: Timing }> = [];
  let i = 0;
  while (i < columns.length) {
    const col = columns[i];
    const timing = timingByDay[col.day];
    let span = 1;
    while (i + span < columns.length) {
      const next = timingByDay[columns[i + span].day];
      if (!sameTiming(timing, next)) break;
      span++;
    }
    segments.push({ key: col.day, span, timing });
    i += span;
  }
  return segments;
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
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [isPending, startTransition] = useTransition();

  const [optimisticAllocations, removeOptimisticAllocation] = useOptimistic(
    allocations,
    (state, cancelledId: string) => state.filter((a) => a.id !== cancelledId)
  );

  // Cancel confirmation dialog state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // Provide Reason dialog state
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonAllocId, setReasonAllocId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonSubmitting, setReasonSubmitting] = useState(false);

  const excoDutySessionIds = useMemo(
    () => new Set(excoDuties.map((d) => d.session_id)),
    [excoDuties]
  );

  const grouped = useMemo(() => groupByDay(optimisticAllocations), [optimisticAllocations]);

  const orderedDays = useMemo(
    () => DAY_ORDER.filter((d) => grouped[d] !== undefined),
    [grouped]
  );

  // Build a map: session_id -> allocations for that session
  const allocationsBySession = useMemo(() => {
    const map = new Map<string, AllocationWithSessionAndMember[]>();
    for (const alloc of allAllocations) {
      const list = map.get(alloc.session_id) || [];
      list.push(alloc);
      map.set(alloc.session_id, list);
    }
    return map;
  }, [allAllocations]);

  // Week-day columns for the full-schedule grid: only days that have sessions
  const weekDayColumns = useMemo(() => {
    const start = new Date(week.start_date + "T00:00:00");
    const daysWithSessions = new Set(sessions.map((s) => s.day));
    return DAY_ORDER.filter((day) => daysWithSessions.has(day)).map((day) => {
      const offset = DAY_ORDER.indexOf(day);
      const d = new Date(start);
      d.setDate(d.getDate() + offset);
      return {
        day,
        label: DAY_LABELS[day] ?? day,
        dateLabel: `${d.getDate()}/${d.getMonth() + 1}`,
      };
    });
  }, [week.start_date, sessions]);

  // Sessions grouped by ordinal position within each day (1st session of
  // the day, 2nd session of the day, etc.) so Saturday-only timings line up
  // with the corresponding weekday sessions. Distinct timings within a row
  // are surfaced in the grey header.
  const timeSlots = useMemo(() => {
    // Per-day, sessions sorted by start time
    const sessionsByDay = new Map<DayType, Session[]>();
    for (const session of sessions) {
      const list = sessionsByDay.get(session.day) || [];
      list.push(session);
      sessionsByDay.set(session.day, list);
    }
    for (const list of sessionsByDay.values()) {
      list.sort((a, b) => a.time_start.localeCompare(b.time_start));
    }

    const maxOrdinal = Math.max(
      0,
      ...Array.from(sessionsByDay.values()).map((arr) => arr.length)
    );

    const slots = [];
    for (let i = 0; i < maxOrdinal; i++) {
      const cellsByDay: Partial<
        Record<DayType, AllocationWithSessionAndMember[]>
      > = {};
      const timingByDay: Partial<
        Record<DayType, { timeStart: string; timeEnd: string }>
      > = {};

      for (const day of DAY_ORDER) {
        const daySessions = sessionsByDay.get(day);
        const session = daySessions?.[i];
        if (!session) continue;

        const allocs = allocationsBySession.get(session.id) || [];
        const sorted = [...allocs].sort((a, b) => {
          if (a.type !== b.type) return a.type === "live" ? -1 : 1;
          return a.members.name.localeCompare(b.members.name);
        });
        cellsByDay[day] = sorted;
        timingByDay[day] = {
          timeStart: session.time_start,
          timeEnd: session.time_end,
        };
      }

      slots.push({
        key: `slot-${i}`,
        ordinal: i + 1,
        timingByDay,
        cellsByDay,
        maxRows: Math.max(
          0,
          ...Object.values(cellsByDay).map((arr) => arr?.length ?? 0)
        ),
      });
    }

    return slots;
  }, [sessions, allocationsBySession]);

  const handleCancel = useCallback(
    (allocationId: string) => {
      setMessage(null);
      setCancellingId(allocationId);

      startTransition(async () => {
        removeOptimisticAllocation(allocationId);
        const result = await cancelAllocation(allocationId);
        if (result.error) {
          setMessageType("error");
          setMessage(result.error);
        } else {
          setMessageType("success");
          setMessage("Slot cancelled successfully. You have been moved to dry fire.");
          setTimeout(() => setMessage(null), 5000);
        }
        setCancellingId(null);
        setCancelTarget(null);
      });
    },
    [startTransition, removeOptimisticAllocation]
  );

  const openReasonDialog = useCallback((allocationId: string) => {
    setReasonAllocId(allocationId);
    setReasonText("");
    setMessage(null);
    setReasonDialogOpen(true);
  }, []);

  const handleSubmitReason = useCallback(async () => {
    if (!reasonAllocId) return;
    setReasonSubmitting(true);
    setMessage(null);

    const result = await submitAbsenceReason(reasonAllocId, reasonText);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Reason submitted successfully.");
      setTimeout(() => setMessage(null), 5000);
      setReasonDialogOpen(false);
    }
    setReasonSubmitting(false);
  }, [reasonAllocId, reasonText]);

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
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge
                variant={week.status === "published" ? "default" : "secondary"}
              >
                {week.status === "published" ? "Published" : "Drafted"}
              </Badge>
            }
          />
          <TooltipContent>
            {week.status === "published"
              ? "Allocations are final. You can cancel slots up to 24 hours before each session."
              : "Allocations are a draft and may still change before publication."}
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator />

      {/* ── Message banner ── */}
      {message && (
        <div
          className={
            messageType === "error"
              ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              : "rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
          }
        >
          {message}
        </div>
      )}

      {/* ── Cancel Confirmation Dialog ── */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Live Fire Slot</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this live fire slot? You will be
              moved to dry fire.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            {optimisticAllocations.length === 0 && (
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

                          {isLive && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isCancelling}
                                onClick={() => setCancelTarget(alloc.id)}
                              >
                                {isCancelling ? "Cancelling..." : "Cancel Slot"}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReasonDialog(alloc.id)}
                              >
                                Provide Reason
                              </Button>
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

        {/* ── Full Schedule Tab ── */}
        <TabsContent value="full-schedule">
          {timeSlots.length === 0 || weekDayColumns.length === 0 ? (
            <div className="rounded-md border bg-white p-8 text-center text-gray-500">
              <p className="text-lg font-medium">No sessions this week.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Live fire allocations are bold; dry fire allocations are shown
                in italic grey.
              </p>
              <div className="overflow-x-auto rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {weekDayColumns.map((col) => (
                        <TableHead
                          key={col.day}
                          className="text-center align-bottom"
                        >
                          <div className="text-sm font-semibold uppercase tracking-wide">
                            {col.label}
                          </div>
                          <div className="text-xs font-normal text-muted-foreground">
                            {col.dateLabel}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeSlots.map((slot) => {
                      const segments = buildHeaderSegments(
                        weekDayColumns,
                        slot.timingByDay
                      );
                      return (
                      <Fragment key={slot.key}>
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          {segments.map((seg, idx) => {
                            const timeLabel = seg.timing
                              ? `${formatTime(seg.timing.timeStart)} – ${formatTime(seg.timing.timeEnd)}`
                              : "";
                            return (
                              <TableCell
                                key={seg.key}
                                colSpan={seg.span}
                                className="font-semibold text-center"
                              >
                                {idx === 0 ? (
                                  <>
                                    Session {slot.ordinal}
                                    {timeLabel && ` (${timeLabel})`}
                                  </>
                                ) : (
                                  timeLabel
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        {slot.maxRows === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={weekDayColumns.length}
                              className="text-center text-xs text-muted-foreground"
                            >
                              No members allocated.
                            </TableCell>
                          </TableRow>
                        ) : (
                          Array.from({ length: slot.maxRows }).map(
                            (_, rowIdx) => (
                              <TableRow key={rowIdx}>
                                {weekDayColumns.map((col) => {
                                  const alloc =
                                    slot.cellsByDay[col.day]?.[rowIdx];
                                  if (!alloc) {
                                    return (
                                      <TableCell
                                        key={col.day}
                                        className="align-top"
                                      />
                                    );
                                  }
                                  const isMe =
                                    alloc.member_id === currentMemberId;
                                  const isLive = alloc.type === "live";
                                  return (
                                    <TableCell
                                      key={col.day}
                                      className={cn(
                                        "align-top whitespace-nowrap",
                                        isLive
                                          ? "font-medium"
                                          : "italic text-muted-foreground",
                                        isMe && "bg-blue-50"
                                      )}
                                      title={`${
                                        TEAM_LABELS[alloc.members.team] ??
                                        alloc.members.team
                                      } — ${isLive ? "Live Fire" : "Dry Fire"}`}
                                    >
                                      {alloc.members.name}
                                      {isMe && (
                                        <span className="ml-1 text-xs text-blue-600">
                                          (you)
                                        </span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            )
                          )
                        )}
                      </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
