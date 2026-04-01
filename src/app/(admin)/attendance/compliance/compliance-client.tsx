"use client";

import Link from "next/link";
import type { Week, TeamType, LevelType } from "@/types/database";
import { TEAM_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ComplianceMember = {
  id: string;
  name: string;
  team: TeamType;
  level: LevelType;
  requiredSessions: number;
  attendedSessions: number;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ComplianceClient({
  week,
  members,
}: {
  week: Week;
  members: ComplianceMember[];
}) {
  const metCount = members.filter(
    (m) => m.attendedSessions >= m.requiredSessions
  ).length;
  const totalCount = members.length;
  const belowCount = totalCount - metCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Report</h1>
          <p className="text-sm text-muted-foreground">
            Week of {formatDate(week.start_date)} -{" "}
            {formatDate(week.end_date)}
          </p>
        </div>
        <Link href="/attendance">
          <Button variant="outline">Back to Attendance</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total With Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Met Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{metCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Below Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{belowCount}</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        {metCount} of {totalCount} members met their training requirements this
        week.
      </p>

      {/* Compliance Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Required Sessions</TableHead>
              <TableHead>Attended Sessions</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No members with training requirements for this week.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const met =
                  member.attendedSessions >= member.requiredSessions;

                return (
                  <TableRow
                    key={member.id}
                    className={met ? "" : "bg-red-50"}
                  >
                    <TableCell className="font-medium">
                      {member.name}
                    </TableCell>
                    <TableCell>
                      {TEAM_LABELS[member.team] ?? member.team}
                    </TableCell>
                    <TableCell>{member.level}</TableCell>
                    <TableCell>{member.requiredSessions}</TableCell>
                    <TableCell>{member.attendedSessions}</TableCell>
                    <TableCell>
                      <Badge variant={met ? "default" : "destructive"}>
                        {met ? "Met" : "Below"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
