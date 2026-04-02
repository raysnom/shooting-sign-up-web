"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import type {
  Week,
  Session,
  Allocation,
  Member,
  Attendance,
  AttendanceStatus,
  DayType,
  SpecialEvent,
  SpecialEventAttendance,
} from "@/types/database";
import { DAY_LABELS } from "@/lib/constants";
import {
  markAttendance,
  createSpecialEvent,
  deleteSpecialEvent,
  toggleSpecialEventAttendance,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type AllocationWithMember = Allocation & { member: Member };

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

const DAY_ORDER: DayType[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

function statusLabel(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "vr":
      return "VR";
    case "no_show":
      return "No Show";
    default:
      return status;
  }
}

function statusBadgeVariant(
  status: AttendanceStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "present":
      return "default";
    case "vr":
      return "secondary";
    case "absent":
    case "no_show":
      return "destructive";
    default:
      return "outline";
  }
}

export function AttendanceClient({
  weeks,
  sessions,
  allocations,
  attendanceRecords,
  specialEvents,
  specialEventAttendance,
  allMembers,
}: {
  weeks: Week[];
  sessions: Session[];
  allocations: AllocationWithMember[];
  attendanceRecords: Attendance[];
  specialEvents: SpecialEvent[];
  specialEventAttendance: SpecialEventAttendance[];
  allMembers: Member[];
}) {
  const [selectedWeekId, setSelectedWeekId] = useState<string>(
    weeks[0]?.id ?? ""
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");

  // VR dialog state
  const [vrDialogOpen, setVrDialogOpen] = useState(false);
  const [vrMemberId, setVrMemberId] = useState<string>("");
  const [vrReason, setVrReason] = useState("");

  // Special event create dialog state
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [eventLoading, setEventLoading] = useState(false);

  // Special event delete confirmation state
  const [deleteEventTarget, setDeleteEventTarget] = useState<SpecialEvent | null>(null);

  // Special event checkbox loading state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Special event member search filter
  const [eventMemberSearch, setEventMemberSearch] = useState<
    Record<string, string>
  >({});

  // Build a map of attendance records keyed by member_id + session_id + week_id
  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const record of attendanceRecords) {
      const key = `${record.member_id}_${record.session_id}_${record.week_id}`;
      map.set(key, record);
    }
    return map;
  }, [attendanceRecords]);

  const getAttendance = useCallback(
    (memberId: string, sessionId: string, weekId: string): Attendance | undefined => {
      return attendanceMap.get(`${memberId}_${sessionId}_${weekId}`);
    },
    [attendanceMap]
  );

  // Filter sessions for the selected week
  const weekSessions = useMemo(
    () => sessions.filter((s) => s.week_id === selectedWeekId),
    [sessions, selectedWeekId]
  );

  // Group sessions by day for the select dropdown
  const sessionsByDay = useMemo(
    () =>
      DAY_ORDER.reduce<Record<string, Session[]>>((acc, day) => {
        const daySessions = weekSessions.filter((s) => s.day === day);
        if (daySessions.length > 0) {
          acc[day] = daySessions;
        }
        return acc;
      }, {}),
    [weekSessions]
  );

  // Filter allocations for the selected session and week
  const sessionAllocations = useMemo(
    () =>
      allocations.filter(
        (a) => a.session_id === selectedSessionId && a.week_id === selectedWeekId
      ),
    [allocations, selectedSessionId, selectedWeekId]
  );

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalAllocated = sessionAllocations.length;
    const presentCount = sessionAllocations.filter((a) => {
      const att = getAttendance(a.member_id, a.session_id, a.week_id);
      return att?.status === "present";
    }).length;
    const absentCount = sessionAllocations.filter((a) => {
      const att = getAttendance(a.member_id, a.session_id, a.week_id);
      return att?.status === "absent" || att?.status === "no_show";
    }).length;
    const vrCount = sessionAllocations.filter((a) => {
      const att = getAttendance(a.member_id, a.session_id, a.week_id);
      return att?.status === "vr";
    }).length;
    const notMarkedCount = totalAllocated - presentCount - absentCount - vrCount;

    return { totalAllocated, presentCount, absentCount, vrCount, notMarkedCount };
  }, [sessionAllocations, getAttendance]);

  const handleMark = useCallback(
    async (memberId: string, status: AttendanceStatus, reason?: string) => {
      if (!selectedSessionId || !selectedWeekId) return;
      setLoading(true);
      setMessage(null);

      const result = await markAttendance({
        memberId,
        sessionId: selectedSessionId,
        weekId: selectedWeekId,
        status,
        reason,
      });

      if (result.error) {
        setMessageType("error");
        setMessage(result.error);
      } else {
        setMessageType("success");
        setMessage(`Attendance marked as ${statusLabel(status)}.`);
        // Auto-dismiss success message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      }
      setLoading(false);
    },
    [selectedSessionId, selectedWeekId]
  );

  const openVrDialog = useCallback((memberId: string) => {
    setVrMemberId(memberId);
    setVrReason("");
    setVrDialogOpen(true);
  }, []);

  const handleVrSubmit = useCallback(async () => {
    if (!vrMemberId) return;
    await handleMark(vrMemberId, "vr", vrReason);
    setVrDialogOpen(false);
    setVrMemberId("");
    setVrReason("");
  }, [vrMemberId, vrReason, handleMark]);

  // ── Special Events helpers ──

  // Filter special events for the selected week
  const weekSpecialEvents = useMemo(
    () => specialEvents.filter((e) => e.week_id === selectedWeekId),
    [specialEvents, selectedWeekId]
  );

  // Build a set of attended (specialEventId + memberId) for quick lookup
  const specialAttendanceSet = useMemo(
    () =>
      new Set(
        specialEventAttendance.map(
          (sa) => `${sa.special_event_id}_${sa.member_id}`
        )
      ),
    [specialEventAttendance]
  );

  const hasMemberAttendedEvent = useCallback(
    (specialEventId: string, memberId: string): boolean => {
      return specialAttendanceSet.has(`${specialEventId}_${memberId}`);
    },
    [specialAttendanceSet]
  );

  const getEventAttendedCount = useCallback(
    (specialEventId: string): number => {
      return specialEventAttendance.filter(
        (sa) => sa.special_event_id === specialEventId
      ).length;
    },
    [specialEventAttendance]
  );

  const handleCreateEvent = useCallback(async () => {
    if (!selectedWeekId || !newEventName.trim() || !newEventDate) return;
    setEventLoading(true);
    setMessage(null);

    const result = await createSpecialEvent({
      weekId: selectedWeekId,
      name: newEventName.trim(),
      eventDate: newEventDate,
    });

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Special event created.");
      setCreateEventDialogOpen(false);
      setNewEventName("");
      setNewEventDate("");
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    }
    setEventLoading(false);
  }, [selectedWeekId, newEventName, newEventDate]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    setEventLoading(true);
    setMessage(null);

    const result = await deleteSpecialEvent(eventId);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Special event deleted.");
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    }
    setEventLoading(false);
    setDeleteEventTarget(null);
  }, []);

  const handleToggleEventAttendance = useCallback(
    async (specialEventId: string, memberId: string) => {
      setTogglingId(`${specialEventId}_${memberId}`);
      setMessage(null);

      const result = await toggleSpecialEventAttendance({
        specialEventId,
        memberId,
      });

      if (result.error) {
        setMessageType("error");
        setMessage(result.error);
      }
      setTogglingId(null);
    },
    []
  );

  const getEventMemberSearch = useCallback(
    (eventId: string): string => {
      return eventMemberSearch[eventId] ?? "";
    },
    [eventMemberSearch]
  );

  const setEventMemberSearchValue = useCallback((eventId: string, value: string) => {
    setEventMemberSearch((prev) => ({ ...prev, [eventId]: value }));
  }, []);

  // When week changes, reset session selection
  const handleWeekChange = useCallback((weekId: string) => {
    setSelectedWeekId(weekId);
    setSelectedSessionId("");
    setMessage(null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance</h1>
        {selectedWeekId && (
          <Link href={`/attendance/compliance?weekId=${selectedWeekId}`}>
            <Button variant="outline">View Compliance Report</Button>
          </Link>
        )}
      </div>

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            messageType === "error"
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Week Selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Week</label>
          {weeks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published or drafted weeks available.
            </p>
          ) : (
            <Select
              value={selectedWeekId}
              onValueChange={(v) => v && handleWeekChange(v)}
            >
              <SelectTrigger className="w-[320px]">
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

        {/* Session Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Session</label>
          {weekSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions for this week.
            </p>
          ) : (
            <Select
              value={selectedSessionId}
              onValueChange={(v) => v && setSelectedSessionId(v)}
            >
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Select a session">
                  {(value) => {
                    const s = sessions.find((ses) => ses.id === value);
                    return s ? `${s.name} (${s.time_start} - ${s.time_end})` : "Select a session";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sessionsByDay).map(([day, daySessions]) => (
                  <SelectGroup key={day}>
                    <SelectLabel>{DAY_LABELS[day] ?? day}</SelectLabel>
                    {daySessions.map((s) => {
                      const sessionLabel = `${s.name} (${s.time_start} - ${s.time_end})`;
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {sessionLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {selectedSessionId && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Allocated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summaryStats.totalAllocated}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Present
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {summaryStats.presentCount}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Absent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{summaryStats.absentCount}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Valid Reason
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{summaryStats.vrCount}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Not Marked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-400">
                {summaryStats.notMarkedCount}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      {selectedSessionId && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionAllocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    No allocations for this session.
                  </TableCell>
                </TableRow>
              ) : (
                sessionAllocations.map((alloc) => {
                  const att = getAttendance(
                    alloc.member_id,
                    alloc.session_id,
                    alloc.week_id
                  );
                  const currentStatus = att?.status;

                  return (
                    <TableRow key={alloc.id}>
                      <TableCell className="font-medium">
                        {alloc.member.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            alloc.type === "live" ? "default" : "secondary"
                          }
                        >
                          {alloc.type === "live" ? "Live" : "Dry"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentStatus ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={statusBadgeVariant(currentStatus)}>
                              {statusLabel(currentStatus)}
                            </Badge>
                            {currentStatus === "vr" && att?.reason && (
                              <span className="text-xs text-muted-foreground">
                                ({att.reason})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">
                            Not marked
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant={
                              currentStatus === "present"
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              handleMark(alloc.member_id, "present")
                            }
                            disabled={loading}
                          >
                            Present
                          </Button>
                          <Button
                            variant={
                              currentStatus === "absent" ||
                              currentStatus === "no_show"
                                ? "destructive"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              handleMark(alloc.member_id, "absent")
                            }
                            disabled={loading}
                          >
                            Absent
                          </Button>
                          <Button
                            variant={
                              currentStatus === "vr" ? "secondary" : "outline"
                            }
                            size="sm"
                            onClick={() => openVrDialog(alloc.member_id)}
                            disabled={loading}
                          >
                            VR
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!selectedSessionId && selectedWeekId && weekSessions.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Select a session above to mark attendance.
        </div>
      )}

      {/* Special Events Section */}
      {selectedWeekId && (
        <>
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Special Events</h2>
              <Button
                onClick={() => setCreateEventDialogOpen(true)}
                size="sm"
              >
                Create Event
              </Button>
            </div>

            {weekSpecialEvents.length === 0 ? (
              <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                No special events for this week. Click &quot;Create
                Event&quot; to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {weekSpecialEvents.map((event) => {
                  const attendedCount = getEventAttendedCount(event.id);
                  const totalMembers = allMembers.length;
                  const searchFilter = getEventMemberSearch(event.id);
                  const filteredMembers = allMembers.filter((m) =>
                    m.name
                      .toLowerCase()
                      .includes(searchFilter.toLowerCase())
                  );

                  return (
                    <Card key={event.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {event.name}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(event.event_date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {attendedCount} / {totalMembers} members attended
                            </Badge>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteEventTarget(event)}
                              disabled={eventLoading}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <Input
                            placeholder="Search members..."
                            value={searchFilter}
                            onChange={(e) =>
                              setEventMemberSearchValue(
                                event.id,
                                e.target.value
                              )
                            }
                          />
                          <div className="max-h-64 overflow-y-auto rounded-md border">
                            {filteredMembers.map((member) => {
                              const isChecked = hasMemberAttendedEvent(
                                event.id,
                                member.id
                              );

                              return (
                                <label
                                  key={member.id}
                                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggleEventAttendance(
                                        event.id,
                                        member.id
                                      )
                                    }
                                    disabled={togglingId === `${event.id}_${member.id}`}
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <span className="text-sm font-medium">
                                    {member.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {member.team} &middot; {member.level}
                                  </span>
                                </label>
                              );
                            })}
                            {filteredMembers.length === 0 && (
                              <div className="p-3 text-center text-sm text-muted-foreground">
                                No members match your search.
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Special Event Dialog */}
      <Dialog
        open={createEventDialogOpen}
        onOpenChange={setCreateEventDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Special Event</DialogTitle>
            <DialogDescription>
              Add a special event (e.g., Structured Training) for the selected
              week. You can then mark member attendance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                placeholder="e.g., Structured Training"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-date">Event Date</Label>
              <Input
                id="event-date"
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateEventDialogOpen(false)}
              disabled={eventLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={
                eventLoading || !newEventName.trim() || !newEventDate
              }
            >
              {eventLoading ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VR Reason Dialog */}
      <Dialog open={vrDialogOpen} onOpenChange={setVrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valid Reason</DialogTitle>
            <DialogDescription>
              Enter the reason for this member&apos;s absence with a valid
              reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Textarea
              placeholder="e.g., Medical appointment, academic commitment..."
              value={vrReason}
              onChange={(e) => setVrReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVrDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleVrSubmit} disabled={loading}>
              {loading ? "Saving..." : "Mark as VR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Special Event Confirmation Dialog */}
      <Dialog open={!!deleteEventTarget} onOpenChange={(open) => !open && setDeleteEventTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Special Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &apos;{deleteEventTarget?.name}&apos;? All attendance records for this event will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteEventTarget(null)}
              disabled={eventLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteEventTarget && handleDeleteEvent(deleteEventTarget.id)}
              disabled={eventLoading}
            >
              {eventLoading ? "Deleting..." : "Delete Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
