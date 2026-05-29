"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  Semester,
  TeamType,
  LevelType,
  DivisionType,
} from "@/types/database";
import {
  TEAM_LABELS,
  DIVISION_MAP,
  DIVISION_LABELS,
  DIVISIONS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TEAMS: TeamType[] = ["APW", "APM", "ARM", "ARW"];

type WeekCol = { id: string; startDate: string };
type Cell = { required: number; attended: number };
type MatrixMember = {
  id: string;
  name: string;
  team: TeamType;
  level: LevelType;
  cells: Record<string, Cell>;
};

function cellClasses(cell: Cell): string {
  if (cell.required <= 0) return "text-gray-400";
  if (cell.attended < cell.required) return "bg-red-100 text-red-800";
  if (cell.attended === cell.required) return "bg-green-100 text-green-800";
  return "bg-blue-100 text-blue-800";
}

export function OverviewClient({
  semesters,
  selectedSemesterId,
  weeks,
  members,
}: {
  semesters: Semester[];
  selectedSemesterId: string;
  weeks: WeekCol[];
  members: MatrixMember[];
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<Set<TeamType>>(new Set());
  const [divisions, setDivisions] = useState<Set<DivisionType>>(new Set());

  const onSemesterChange = useCallback(
    (value: string | null) => {
      if (value) router.push(`/attendance/overview?semesterId=${value}`);
    },
    [router]
  );

  const toggleTeam = useCallback((t: TeamType) => {
    setTeams((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const toggleDivision = useCallback((d: DivisionType) => {
    setDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }, []);

  const hasFilters = teams.size > 0 || divisions.size > 0;

  const visibleMembers = useMemo(() => {
    return members
      .filter((m) => {
        const div = DIVISION_MAP[m.level];
        const teamOk = teams.size === 0 || teams.has(m.team);
        const divOk = divisions.size === 0 || divisions.has(div);
        return teamOk && divOk;
      })
      .sort((a, b) => {
        if (a.team !== b.team) {
          return TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team);
        }
        const da = DIVISION_MAP[a.level];
        const db = DIVISION_MAP[b.level];
        if (da !== db) return DIVISIONS.indexOf(da) - DIVISIONS.indexOf(db);
        return a.name.localeCompare(b.name);
      });
  }, [members, teams, divisions]);

  // Per-week minimum-requirement summary across the visible members.
  // One value if everyone shares it, a range when they differ, "–" if none.
  const reqSummary = useMemo(() => {
    return weeks.map((w) => {
      const vals = new Set<number>();
      for (const m of visibleMembers) {
        const required = m.cells[w.id]?.required ?? 0;
        if (required > 0) vals.add(required);
      }
      if (vals.size === 0) return "–";
      const arr = [...vals].sort((a, b) => a - b);
      return arr.length === 1
        ? String(arr[0])
        : `${arr[0]}–${arr[arr.length - 1]}`;
    });
  }, [weeks, visibleMembers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance Overview</h1>
          <p className="text-sm text-muted-foreground">
            Sessions attended per week, coloured against each member&apos;s
            training requirement.
          </p>
        </div>
        <Select value={selectedSemesterId} onValueChange={onSemesterChange}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select a semester">
              {(value) =>
                semesters.find((s) => s.id === value)?.name ??
                "Select a semester"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {semesters.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">
            Team
          </span>
          {TEAMS.map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={teams.has(t) ? "default" : "outline"}
              title={TEAM_LABELS[t]}
              onClick={() => toggleTeam(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">
            Division
          </span>
          {DIVISIONS.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={divisions.has(d) ? "default" : "outline"}
              title={DIVISION_LABELS[d]}
              onClick={() => toggleDivision(d)}
            >
              {d}
            </Button>
          ))}
        </div>
        {hasFilters && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setTeams(new Set());
              setDivisions(new Set());
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border bg-red-100" />
          Below requirement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border bg-green-100" />
          Met requirement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border bg-blue-100" />
          Exceeded requirement
        </span>
        <span className="ml-auto">
          Showing {visibleMembers.length} of {members.length} members
        </span>
      </div>

      {weeks.length === 0 ? (
        <p className="rounded-md border bg-white p-6 text-center text-sm text-muted-foreground">
          No weeks in this semester yet.
        </p>
      ) : (
        <div className="relative max-h-[75vh] overflow-auto rounded-md border bg-white">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[12rem] border-b border-r bg-gray-50 px-3 py-2 text-left font-semibold">
                  Member
                </th>
                {weeks.map((w, i) => (
                  <th
                    key={w.id}
                    className="sticky top-0 z-20 min-w-[3.75rem] border-b bg-gray-50 px-2 py-1.5 text-center align-bottom"
                  >
                    <div className="whitespace-nowrap font-medium">
                      {formatDate(w.startDate)}
                    </div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      req {reqSummary[i]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={weeks.length + 1}
                    className="px-3 py-8 text-center text-gray-500"
                  >
                    No members match the selected filters.
                  </td>
                </tr>
              ) : (
                visibleMembers.map((m) => {
                  const div = DIVISION_MAP[m.level];
                  return (
                    <tr key={m.id}>
                      <td className="sticky left-0 z-10 min-w-[12rem] border-b border-r bg-white px-3 py-1.5">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.team} &middot; Div {div}
                        </div>
                      </td>
                      {weeks.map((w) => {
                        const cell = m.cells[w.id];
                        return (
                          <td
                            key={w.id}
                            title={
                              cell.required > 0
                                ? `Required ${cell.required} · Attended ${cell.attended}`
                                : `No requirement · Attended ${cell.attended}`
                            }
                            className={cn(
                              "border-b px-2 py-1.5 text-center tabular-nums",
                              cellClasses(cell)
                            )}
                          >
                            {cell.attended}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
