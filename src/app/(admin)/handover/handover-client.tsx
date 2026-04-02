"use client";

import { useState, useMemo, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const REDIRECT_DELAY_MS = 2000;

export function HandoverClient({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Member | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<Member | null>(null);
  const [transferSelectId, setTransferSelectId] = useState("");

  const handleConfirmPromote = useCallback(async () => {
    if (!promoteTarget) return;
    setLoading(promoteTarget.id);
    setMessage(null);
    const result = await promoteToExco(promoteTarget.id);
    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage(`${promoteTarget.name} promoted to EXCO.`);
      setTimeout(() => setMessage(null), 5000);
    }
    setPromoteTarget(null);
    setLoading(null);
  }, [promoteTarget]);

  const handleConfirmDemote = useCallback(async () => {
    if (!demoteTarget) return;
    setLoading(demoteTarget.id);
    setMessage(null);
    const result = await demoteToMember(demoteTarget.id);
    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage(`${demoteTarget.name} demoted to member.`);
      setTimeout(() => setMessage(null), 5000);
    }
    setDemoteTarget(null);
    setLoading(null);
  }, [demoteTarget]);

  const handleTransfer = useCallback(async () => {
    if (!transferTarget) return;
    setLoading("transfer");
    setMessage(null);

    const result = await transferPresidency(transferTarget.id);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage(`Presidency transferred to ${transferTarget.name}. You are now EXCO. Redirecting...`);
      setTimeout(() => {
        window.location.href = "/schedule";
      }, REDIRECT_DELAY_MS);
    }
    setTransferTarget(null);
    setLoading(null);
  }, [transferTarget]);

  const handleCloseDialog = useCallback(() => {
    setTransferTarget(null);
  }, []);

  const otherMembers = useMemo(
    () => members.filter((m) => m.id !== currentUserId),
    [members, currentUserId]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Handover & Roles</h1>

      {message && (
        <div className={`rounded-md p-3 text-sm ${messageType === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transfer Presidency</CardTitle>
          <CardDescription>
            Transfer your President role to another member. You will be demoted to EXCO. This action cannot be undone by you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Select member to transfer to</Label>
              <Select value={transferSelectId} onValueChange={(v) => setTransferSelectId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a member">
                    {(value) => {
                      const m = otherMembers.find((mem) => mem.id === value);
                      return m ? `${m.name} (${m.role})` : "Choose a member";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="destructive"
              disabled={!transferSelectId || loading === "transfer"}
              onClick={() => {
                const member = otherMembers.find((m) => m.id === transferSelectId);
                if (member) setTransferTarget(member);
              }}
            >
              Transfer
            </Button>
          </div>
        </CardContent>
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
                      onClick={() => setPromoteTarget(member)}
                    >
                      Promote to EXCO
                    </Button>
                  )}
                  {member.role === "exco" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading === member.id}
                      onClick={() => setDemoteTarget(member)}
                    >
                      Demote to Member
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Promote Confirmation */}
      <Dialog open={!!promoteTarget} onOpenChange={(open) => { if (!open) setPromoteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to EXCO</DialogTitle>
            <DialogDescription>
              Promote <strong>{promoteTarget?.name}</strong> to EXCO? They will gain access to attendance marking and other EXCO features.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPromoteTarget(null)}>Cancel</Button>
            <Button disabled={loading === promoteTarget?.id} onClick={handleConfirmPromote}>
              {loading === promoteTarget?.id ? "Promoting..." : "Confirm Promote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Demote Confirmation */}
      <Dialog open={!!demoteTarget} onOpenChange={(open) => { if (!open) setDemoteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote to Member</DialogTitle>
            <DialogDescription>
              Demote <strong>{demoteTarget?.name}</strong> to regular member? They will lose EXCO privileges.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDemoteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={loading === demoteTarget?.id} onClick={handleConfirmDemote}>
              {loading === demoteTarget?.id ? "Demoting..." : "Confirm Demote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer confirmation dialog */}
      <Dialog open={!!transferTarget} onOpenChange={handleCloseDialog}>
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
            <Button variant="outline" onClick={handleCloseDialog}>
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
