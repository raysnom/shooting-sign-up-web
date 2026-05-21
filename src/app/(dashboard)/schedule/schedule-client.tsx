"use client";

import { Fragment, useState, useTransition, useMemo, useCallback, useOptimistic } from "react";
import type { Week, Session, ExcoDuty, DayType } from "@/types/database";
import type { AllocationWithSession, AllocationWithSessionAndMember } from "./page";
import { DAY_LABELS, TEAM_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/utils/datetime";
import {
  cancelAllocation,
  submitAbsenceReason,
  setRunningLate,
  claimLeftoverSlot,
} from "./actions";

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

type Timing = { timeStart: string; timeEnd: string };

function sameTiming(a?: Timing, b?: Timing) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.timeStart === b.timeStart && a.timeEnd === b.timeEnd;
}

type DayRole = "open" | "close" | "both" | "middle";

type DayInfo = {
  timing?: Timing;
  hasSession: boolean;
  hasEXCO: boolean;
  role: DayRole;
};

const EMPTY_DAY_INFO: DayInfo = {
  timing: undefined,
  hasSession: false,
  hasEXCO: false,
  role: "open",
};

function teacherCoverText(role: DayRole) {
  switch (role) {
    case "open":
      return "⚠ Teacher opens range";
    case "close":
      return "⚠ Teacher closes range";
    case "both":
      return "⚠ Teacher opens/closes range";
    case "middle":
      return "⚠ No EXCO on duty";
  }
}

function sameDayInfo(a: DayInfo, b: DayInfo) {
  if (!sameTiming(a.timing, b.timing)) return false;
  // Empty days (no session) merge with anything timing-equivalent
  if (!a.hasSession || !b.hasSession) return true;
  return a.hasEXCO === b.hasEXCO && a.role === b.role;
}

function buildHeaderSegments(
  columns: { day: DayType }[],
  infoByDay: Partial<Record<DayType, DayInfo>>
) {
  const segments: Array<{
    key: string;
    span: number;
    timing?: Timing;
    coverText: string | null;
  }> = [];
  let i = 0;
  while (i < columns.length) {
    const col = columns[i];
    const info = infoByDay[col.day] ?? EMPTY_DAY_INFO;
    let span = 1;
    while (i + span < columns.length) {
      const next = infoByDay[columns[i + span].day] ?? EMPTY_DAY_INFO;
      if (!sameDayInfo(info, next)) break;
      span++;
    }
    segments.push({
      key: col.day,
      span,
      timing: info.timing,
      coverText:
        info.hasSession && !info.hasEXCO
          ? teacherCoverText(info.role)
          : null,
    });
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
  submittedPrefs: boolean;
}

export function ScheduleClient({
  week,
  allocations,
  allAllocations,
  sessions,
  excoDuties,
  currentMemberId,
  submittedPrefs,
}: ScheduleClientProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [isPending, startTransition] = useTransition();

  type AllocationAction =
    | { kind: "cancel"; id: string }
    | { kind: "late"; id: string; runningLate: boolean };

  const [optimisticAllocations, applyOptimisticAllocation] = useOptimistic(
    allocations,
    (state, action: AllocationAction) => {
      if (action.kind === "cancel") return state.filter((a) => a.id !== action.id);
      return state.map((a) =>
        a.id === action.id ? { ...a, running_late: action.runningLate } : a
      );
    }
  );

  const [optimisticAllAllocations, applyOptimisticAllAllocation] = useOptimistic(
    allAllocations,
    (state, action: AllocationAction) => {
      if (action.kind === "cancel") return state.filter((a) => a.id !== action.id);
      return state.map((a) =>
        a.id === action.id ? { ...a, running_late: action.runningLate } : a
      );
    }
  );

  // Cancel confirmation dialog state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // Leftover-claim state — id of the session currently being claimed (for the spinner)
  const [claimingSessionId, setClaimingSessionId] = useState<string | null>(null);

  // Provide Reason dialog state
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonAllocId, setReasonAllocId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonSubmitting, setReasonSubmitting] = useState(false);

  // Sessions where the CURRENT user is on EXCO duty (used by My Schedule banner)
  const excoDutySessionIds = useMemo(
    () =>
      new Set(
        excoDuties
          .filter((d) => d.member_id === currentMemberId)
          .map((d) => d.session_id)
      ),
    [excoDuties, currentMemberId]
  );

  // (session_id|member_id) pairs that are on EXCO duty — used for per-cell pill
  const dutyByAllocation = useMemo(
    () => new Set(excoDuties.map((d) => `${d.session_id}|${d.member_id}`)),
    [excoDuties]
  );

  // Sessions that have at least one EXCO on duty
  const sessionsWithDuty = useMemo(
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
    for (const alloc of optimisticAllAllocations) {
      const list = map.get(alloc.session_id) || [];
      list.push(alloc);
      map.set(alloc.session_id, list);
    }
    return map;
  }, [optimisticAllAllocations]);

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
      const infoByDay: Partial<Record<DayType, DayInfo>> = {};

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

        const total = daySessions?.length ?? 0;
        const role: DayRole =
          total === 1
            ? "both"
            : i === 0
              ? "open"
              : i === total - 1
                ? "close"
                : "middle";

        infoByDay[day] = {
          timing: {
            timeStart: session.time_start,
            timeEnd: session.time_end,
          },
          hasSession: true,
          hasEXCO: sessionsWithDuty.has(session.id),
          role,
        };
      }

      slots.push({
        key: `slot-${i}`,
        ordinal: i + 1,
        infoByDay,
        cellsByDay,
        maxRows: Math.max(
          0,
          ...Object.values(cellsByDay).map((arr) => arr?.length ?? 0)
        ),
      });
    }

    return slots;
  }, [sessions, allocationsBySession, sessionsWithDuty]);

  // Sessions where the current user already has an active allocation —
  // used to disable the "Claim" button for those sessions.
  const myAllocatedSessionIds = useMemo(
    () => new Set(optimisticAllocations.map((a) => a.session_id)),
    [optimisticAllocations]
  );

  // Leftover capacity per session (only meaningful when the member is eligible
  // to claim, i.e. didn't submit prefs and the week is published).
  const leftoverSessions = useMemo(() => {
    if (submittedPrefs || week.status !== "published") return [];

    return sessions
      .map((session) => {
        const allocs = allocationsBySession.get(session.id) || [];
        const liveUsed = allocs.filter((a) => a.type === "live").length;
        const dryUsed = allocs.filter((a) => a.type === "dry").length;
        const liveLeft = Math.max(0, session.live_lanes - liveUsed);
        const dryLeft = Math.max(0, session.dry_lanes - dryUsed);
        return { session, liveLeft, dryLeft };
      })
      .filter((s) => s.liveLeft > 0 || s.dryLeft > 0)
      .sort((a, b) => {
        const dayOrderA = DAY_ORDER.indexOf(a.session.day as DayType);
        const dayOrderB = DAY_ORDER.indexOf(b.session.day as DayType);
        if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB;
        return a.session.time_start.localeCompare(b.session.time_start);
      });
  }, [submittedPrefs, week.status, sessions, allocationsBySession]);

  const handleClaim = useCallback(
    (sessionId: string) => {
      setMessage(null);
      setClaimingSessionId(sessionId);
      startTransition(async () => {
        const result = await claimLeftoverSlot(sessionId);
        if (result.error) {
          setMessageType("error");
          setMessage(result.error);
        } else {
          setMessageType("success");
          setMessage(
            `Slot claimed. You have been allocated to ${
              result.type === "live" ? "live fire" : "dry fire"
            }.`
          );
          setTimeout(() => setMessage(null), 5000);
        }
        setClaimingSessionId(null);
      });
    },
    [startTransition]
  );

  const handleCancel = useCallback(
    (allocationId: string) => {
      setMessage(null);
      setCancellingId(allocationId);

      startTransition(async () => {
        applyOptimisticAllocation({ kind: "cancel", id: allocationId });
        applyOptimisticAllAllocation({ kind: "cancel", id: allocationId });
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
    [startTransition, applyOptimisticAllocation, applyOptimisticAllAllocation]
  );

  const handleToggleLate = useCallback(
    (allocationId: string, runningLate: boolean) => {
      setMessage(null);
      startTransition(async () => {
        applyOptimisticAllocation({ kind: "late", id: allocationId, runningLate });
        applyOptimisticAllAllocation({ kind: "late", id: allocationId, runningLate });
        const result = await setRunningLate(allocationId, runningLate);
        if (result.error) {
          setMessageType("error");
          setMessage(result.error);
        } else if (result.warning) {
          setMessageType("error");
          setMessage(result.warning);
        } else {
          setMessageType("success");
          setMessage(
            runningLate
              ? "Marked as running late. EXCO will see this when taking attendance."
              : "Late status cleared."
          );
          setTimeout(() => setMessage(null), 5000);
        }
      });
    },
    [startTransition, applyOptimisticAllocation, applyOptimisticAllAllocation]
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
              Cancel My Slot
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

            {/* ── Leftover slots (only for non-submitters in a published week) ── */}
            {!submittedPrefs &&
              week.status === "published" &&
              leftoverSessions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Available Leftover Slots</CardTitle>
                    <CardDescription>
                      You didn&rsquo;t submit preferences for this week, but you
                      can still claim any leftover slots below. The system gives
                      you live fire if available, dry fire otherwise.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {leftoverSessions.map(({ session, liveLeft, dryLeft }) => {
                        const alreadyAllocated = myAllocatedSessionIds.has(
                          session.id
                        );
                        const isClaiming =
                          claimingSessionId === session.id && isPending;
                        return (
                          <div
                            key={session.id}
                            className="rounded-md border bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-medium">{session.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {DAY_LABELS[session.day] ?? session.day}{" "}
                                  &middot;{" "}
                                  {formatTime(session.time_start)} &ndash;{" "}
                                  {formatTime(session.time_end)}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {liveLeft > 0 && (
                                  <Badge className="bg-green-600 text-white">
                                    {liveLeft} live left
                                  </Badge>
                                )}
                                {dryLeft > 0 && (
                                  <Badge className="bg-blue-100 text-blue-700">
                                    {dryLeft} dry left
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="mt-3">
                              <Button
                                size="sm"
                                disabled={alreadyAllocated || isClaiming}
                                onClick={() => handleClaim(session.id)}
                              >
                                {alreadyAllocated
                                  ? "Already allocated"
                                  : isClaiming
                                    ? "Claiming..."
                                    : "Claim this slot"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
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

                          {alloc.running_late && (
                            <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                              <span className="font-semibold">
                                You marked yourself ~30 min late for this session.
                              </span>{" "}
                              EXCO will see this when taking attendance.
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {isLive && (
                              <>
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
                              </>
                            )}

                            <Button
                              variant={alloc.running_late ? "default" : "outline"}
                              size="sm"
                              className={
                                alloc.running_late
                                  ? "bg-orange-600 text-white hover:bg-orange-700"
                                  : ""
                              }
                              onClick={() =>
                                handleToggleLate(alloc.id, !alloc.running_late)
                              }
                            >
                              {alloc.running_late
                                ? "Cancel Late Notice"
                                : "I'll be ~30 min late"}
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
          {timeSlots.length === 0 || weekDayColumns.length === 0 ? (
            <div className="rounded-md border bg-white p-8 text-center text-gray-500">
              <p className="text-lg font-medium">No sessions this week.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Live fire allocations are bold; dry fire allocations are shown
                in italic grey. Yellow cells indicate a shared-gun clash within
                the session. An amber{" "}
                <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                  EXCO
                </span>{" "}
                tag marks the member on duty to open/close the range. When no
                EXCO is assigned, the grey row shows{" "}
                <span className="text-amber-700">
                  ⚠ Teacher opens range
                </span>{" "}
                for the first session of the day and{" "}
                <span className="text-amber-700">
                  ⚠ Teacher closes range
                </span>{" "}
                for the last. An orange{" "}
                <span className="rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-800">
                  LATE
                </span>{" "}
                tag means the member will arrive ~30 min late.
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
                        slot.infoByDay
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
                                <div>
                                  {idx === 0 ? (
                                    <>
                                      Session {slot.ordinal}
                                      {timeLabel && ` (${timeLabel})`}
                                    </>
                                  ) : (
                                    timeLabel
                                  )}
                                </div>
                                {seg.coverText && (
                                  <div className="mt-0.5 text-[11px] font-normal text-amber-700">
                                    {seg.coverText}
                                  </div>
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
                                  const hasClash =
                                    isLive && !!alloc.gun_clash_warning;
                                  const onDuty = dutyByAllocation.has(
                                    `${alloc.session_id}|${alloc.member_id}`
                                  );
                                  const baseTitle = `${
                                    TEAM_LABELS[alloc.members.team] ??
                                    alloc.members.team
                                  } — ${isLive ? "Live Fire" : "Dry Fire"}`;
                                  const title = hasClash
                                    ? `${baseTitle}\nShared gun: ${alloc.gun_clash_warning}`
                                    : baseTitle;
                                  return (
                                    <TableCell
                                      key={col.day}
                                      className={cn(
                                        "align-top whitespace-nowrap",
                                        isLive
                                          ? "font-medium"
                                          : "italic text-muted-foreground",
                                        // gun-clash yellow wins over "me" blue
                                        hasClash
                                          ? "bg-yellow-50"
                                          : isMe && "bg-blue-50"
                                      )}
                                      title={title}
                                    >
                                      {alloc.members.name}
                                      {onDuty && (
                                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                                          EXCO
                                        </span>
                                      )}
                                      {alloc.running_late && (
                                        <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-800">
                                          LATE
                                        </span>
                                      )}
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
