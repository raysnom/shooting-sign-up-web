"use client";

import { useState } from "react";
import type { Member } from "@/types/database";
import { TEAM_LABELS } from "@/lib/constants";
import {
  promoteToExco,
  demoteToMember,
  transferPresidency,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function HandoverClient({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  async function handlePromote(memberId: string) {
    setLoading(memberId);
    setMessage(null);
    const result = await promoteToExco(memberId);
    if (result.error) setMessage(`Error: ${result.error}`);
    setLoading(null);
  }

  async function handleDemote(memberId: string) {
    setLoading(memberId);
    setMessage(null);
    const result = await demoteToMember(memberId);
    if (result.error) setMessage(`Error: ${result.error}`);
    setLoading(null);
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    setLoading("transfer");
    setMessage(null);

    const result = await transferPresidency(transferTarget.id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage(
        `Presidency transferred to ${transferTarget.name}. You are now EXCO. Redirecting...`
      );
      setTimeout(() => {
        window.location.href = "/schedule";
      }, 2000);
    }
    setTransferTarget(null);
    setLoading(null);
  }

  const otherMembers = members.filter((m) => m.id !== currentUserId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Handover & Roles</h1>

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

      <Card>
        <CardHeader>
          <CardTitle>Transfer Presidency</CardTitle>
          <CardDescription>
            Transfer your President role to another member. You will be demoted
            to EXCO. This action cannot be undone by you.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {otherMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {TEAM_LABELS[member.team] || member.team}
                  </Badge>
                </TableCell>
                <TableCell>{member.level}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {member.role === "member" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading === member.id}
                      onClick={() => handlePromote(member.id)}
                    >
                      Promote to EXCO
                    </Button>
                  )}
                  {member.role === "exco" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading === member.id}
                      onClick={() => handleDemote(member.id)}
                    >
                      Demote to Member
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setTransferTarget(member)}
                  >
                    Transfer Presidency
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Transfer confirmation dialog */}
      <Dialog
        open={!!transferTarget}
        onOpenChange={() => setTransferTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Presidency</DialogTitle>
            <DialogDescription>
              Are you sure you want to transfer the President role to{" "}
              <strong>{transferTarget?.name}</strong>? You will be demoted to
              EXCO and will lose access to President-only features. This cannot
              be undone by you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading === "transfer"}
              onClick={handleTransfer}
            >
              {loading === "transfer"
                ? "Transferring..."
                : "Confirm Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
