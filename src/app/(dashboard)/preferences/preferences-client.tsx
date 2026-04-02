"use client";

import { useState, useMemo, useCallback } from "react";
import type { Week, Session, Preference, DayType } from "@/types/database";
import { DAY_LABELS } from "@/lib/constants";
import { submitPreferences } from "./actions";
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
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function PreferencesClient({
  week,
  sessions,
  existingPreferences,
  deadlinePassed,
}: {
  week: Week;
  sessions: Session[];
  existingPreferences: Preference[];
  deadlinePassed: boolean;
}) {
  // Build initial rankings from existing preferences
  const initialRankedIds = existingPreferences
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.session_id)
    .filter((id) => sessions.some((s) => s.id === id));

  const [rankedIds, setRankedIds] = useState<string[]>(initialRankedIds);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Session lookup map
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) {
      map.set(s.id, s);
    }
    return map;
  }, [sessions]);

  // Available sessions (not yet ranked), grouped by day
  const availableSessions = useMemo(() => {
    const rankedSet = new Set(rankedIds);
    const available = sessions.filter((s) => !rankedSet.has(s.id));

    return DAYS
      .map((day) => ({
        day,
        label: DAY_LABELS[day],
        sessions: available
          .filter((s) => s.day === day)
          .sort((a, b) => a.time_start.localeCompare(b.time_start)),
      }))
      .filter((g) => g.sessions.length > 0);
  }, [sessions, rankedIds]);

  // Ranked sessions in order
  const rankedSessions = useMemo(
    () =>
      rankedIds
        .map((id) => sessionMap.get(id))
        .filter((s): s is Session => !!s),
    [rankedIds, sessionMap]
  );

  // ──────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────

  const handleAdd = useCallback((sessionId: string) => {
    setRankedIds((prev) => [...prev, sessionId]);
    setMessage(null);
  }, []);

  const handleRemove = useCallback((sessionId: string) => {
    setRankedIds((prev) => prev.filter((id) => id !== sessionId));
    setMessage(null);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setRankedIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setMessage(null);
  }, []);

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= rankedIds.length - 1) return;
      setRankedIds((prev) => {
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      });
      setMessage(null);
    },
    [rankedIds.length]
  );

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const rankings = rankedIds.map((session_id, i) => ({
      session_id,
      rank: i + 1,
    }));

    const result = await submitPreferences(week.id, rankings);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Preferences submitted successfully.");
    }
    setLoading(false);
  }, [rankedIds, week.id]);

  // ──────────────────────────────────────────────
  // Interactive view (with warning if deadline passed)
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Preferences</h1>
        <p className="mt-1 text-muted-foreground">
          Week of {formatDate(week.start_date)} &ndash;{" "}
          {formatDate(week.end_date)}
        </p>
      </div>

      {/* Late submission warning */}
      {deadlinePassed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <div>
              <p className="font-medium">Deadline has passed</p>
              <p className="mt-1">
                You are submitting after the deadline. Late submissions will be
                allocated to any remaining unfilled slots after on-time submissions
                are processed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deadline & status info */}
      <Card>
        <CardHeader>
          <CardTitle>Rank Your Sessions for Live Fire</CardTitle>
          <CardDescription>
            Click a session to add it to your rankings. Use the arrows to
            reorder. Higher-ranked sessions are more likely to be allocated as
            live fire. If you don&apos;t win live fire for a session, you will be
            auto-assigned dry fire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Deadline: </span>
              <span className="font-medium">
                {formatDeadline(week.submission_deadline)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Status: </span>
              {rankedSessions.length > 0 ? (
                <Badge variant="secondary">
                  {rankedSessions.length}{" "}
                  {rankedSessions.length === 1 ? "session" : "sessions"} ranked
                </Badge>
              ) : (
                <Badge variant="outline">Not yet submitted</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message */}
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

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Available Sessions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Sessions</h2>

          {availableSessions.length === 0 ? (
            <div className="rounded-md border bg-white p-6 text-center text-sm text-muted-foreground">
              All sessions have been added to your rankings.
            </div>
          ) : (
            <div className="space-y-4">
              {availableSessions.map((group) => (
                <div key={group.day}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {group.label}
                    </h3>
                    <Badge variant="secondary">
                      {group.sessions.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {group.sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => handleAdd(session.id)}
                        className="flex w-full items-center gap-3 rounded-md border bg-white p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{session.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(session.time_start)} &ndash;{" "}
                            {formatTime(session.time_end)}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {session.live_lanes} live{" "}
                          {session.live_lanes === 1 ? "lane" : "lanes"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          + Add
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: My Rankings */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My Rankings</h2>

          {rankedSessions.length === 0 ? (
            <div className="rounded-md border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">
              Click sessions on the left to add them to your rankings.
            </div>
          ) : (
            <div className="space-y-2">
              {rankedSessions.map((session, index) => (
                <div
                  key={session.id}
                  className="flex items-center gap-2 rounded-md border bg-white p-3"
                >
                  {/* Rank number */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>

                  {/* Session info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{session.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DAY_LABELS[session.day]} &middot;{" "}
                      {formatTime(session.time_start)} &ndash;{" "}
                      {formatTime(session.time_end)}
                    </p>
                  </div>

                  <Badge variant="secondary" className="shrink-0">
                    {session.live_lanes} live
                  </Badge>

                  {/* Reorder & remove buttons */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === rankedSessions.length - 1}
                      aria-label="Move down"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleRemove(session.id)}
                      aria-label="Remove"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Submit button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={loading || rankedSessions.length === 0}
          >
            {loading
              ? "Submitting..."
              : `Submit Preferences (${rankedSessions.length} ${rankedSessions.length === 1 ? "session" : "sessions"})`}
          </Button>

          {rankedSessions.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Add at least one session to submit your preferences.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
