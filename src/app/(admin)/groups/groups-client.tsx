"use client";

import { useState, useCallback } from "react";
import type {
  CompetitionGroup,
  CompetitionGroupMember,
  Member,
} from "@/types/database";
import { TEAM_LABELS } from "@/lib/constants";
import {
  createGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type GroupMemberWithMember = CompetitionGroupMember & {
  member: Member;
};

export function GroupsClient({
  groups,
  groupMembers,
  allMembers,
}: {
  groups: CompetitionGroup[];
  groupMembers: GroupMemberWithMember[];
  allMembers: Member[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CompetitionGroup | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{id: string; name: string} | null>(null);
  const [addProgress, setAddProgress] = useState<{current: number; total: number} | null>(null);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleCreateGroup = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createGroup(newGroupName);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Group created successfully.");
      setNewGroupName("");
      setShowCreate(false);
      setTimeout(() => setMessage(null), 5000);
    }
    setLoading(false);
  }, [newGroupName]);

  const handleDeleteGroup = useCallback(async (id: string) => {
    setLoading(true);
    setMessage(null);

    const result = await deleteGroup(id);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Group deleted successfully.");
      setTimeout(() => setMessage(null), 5000);
    }
    setLoading(false);
    setDeleteTarget(null);
  }, []);

  const toggleMemberSelection = useCallback((memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const handleAddMembers = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addMemberGroupId || selectedMemberIds.size === 0) return;

    setLoading(true);
    setMessage(null);
    setAddProgress({current: 0, total: selectedMemberIds.size});

    const memberMap = new Map(allMembers.map((m) => [m.id, m.name]));

    let added = 0;
    const errors: string[] = [];
    for (const memberId of selectedMemberIds) {
      const result = await addGroupMember(addMemberGroupId, memberId);
      if (result.error) {
        const name = memberMap.get(memberId) || memberId;
        errors.push(`${name}: ${result.error}`);
      } else {
        added++;
      }
      setAddProgress(prev => prev ? {...prev, current: prev.current + 1} : null);
    }

    if (errors.length > 0) {
      setMessageType("error");
      setMessage(`Added ${added} member(s). Errors: ${errors.join("; ")}`);
    } else {
      setMessageType("success");
      setMessage(`${added} member(s) added to group.`);
      setTimeout(() => setMessage(null), 5000);
    }
    setSelectedMemberIds(new Set());
    setAddMemberGroupId(null);
    setAddProgress(null);
    setLoading(false);
  }, [addMemberGroupId, selectedMemberIds, allMembers]);

  const handleRemoveMember = useCallback(async (id: string) => {
    setLoading(true);
    setMessage(null);

    const result = await removeGroupMember(id);

    if (result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Member removed from group.");
      setTimeout(() => setMessage(null), 5000);
    }
    setLoading(false);
    setRemoveTarget(null);
  }, []);

  const getMembersForGroup = useCallback((groupId: string) => {
    return groupMembers.filter((gm) => gm.group_id === groupId);
  }, [groupMembers]);

  const getAvailableMembers = useCallback((groupId: string) => {
    const existingMemberIds = new Set(
      groupMembers.filter((gm) => gm.group_id === groupId).map((gm) => gm.member_id)
    );
    return allMembers.filter((m) => !existingMemberIds.has(m.id));
  }, [groupMembers, allMembers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Competition Groups</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger render={<Button />}>Create Group</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Competition Group</DialogTitle>
              <DialogDescription>
                Create a named group of members for setting training
                requirements.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. National Team, Competition Squad"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !newGroupName.trim()}
              >
                {loading ? "Creating..." : "Create Group"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Competition groups let you define custom collections of members. You can
        then set training requirements for an entire group at once.
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          No competition groups created yet. Click &quot;Create Group&quot; to
          get started.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const members = getMembersForGroup(group.id);
            const available = getAvailableMembers(group.id);

            return (
              <div key={group.id} className="rounded-md border bg-white">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 text-left"
                    onClick={() => toggleGroupCollapse(group.id)}
                  >
                    <svg
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        collapsedGroups.has(group.id) ? "" : "rotate-90"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <h2 className="text-lg font-semibold">{group.name}</h2>
                    <Badge variant="secondary">
                      {members.length}{" "}
                      {members.length === 1 ? "member" : "members"}
                    </Badge>
                  </button>
                  <div className="flex items-center gap-2">
                    <Dialog
                      open={addMemberGroupId === group.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setAddMemberGroupId(group.id);
                          setSelectedMemberIds(new Set());
                          setMemberSearch("");
                        } else {
                          setAddMemberGroupId(null);
                        }
                      }}
                    >
                      <DialogTrigger
                        render={<Button variant="outline" size="sm" />}
                      >
                        Add Members
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Add Members to {group.name}
                          </DialogTitle>
                          <DialogDescription>
                            Select one or more members to add to this group.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddMembers} className="space-y-4">
                          <div className="space-y-2">
                            {available.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                All members are already in this group.
                              </p>
                            ) : (
                              <>
                                <Input
                                  placeholder="Search by name..."
                                  value={memberSearch}
                                  onChange={(e) => setMemberSearch(e.target.value)}
                                />
                                {selectedMemberIds.size > 0 && (
                                  <p className="text-sm text-green-700">
                                    {selectedMemberIds.size} member(s) selected
                                  </p>
                                )}
                                <div className="max-h-64 overflow-y-auto rounded-md border">
                                  {(() => {
                                    const searchLower = memberSearch.toLowerCase();
                                    const filtered = available.filter((m) =>
                                      m.name.toLowerCase().includes(searchLower)
                                    );

                                    if (filtered.length === 0) {
                                      return (
                                        <div className="px-3 py-2 text-sm text-gray-500">
                                          No members found
                                        </div>
                                      );
                                    }

                                    return filtered.map((m) => (
                                      <label
                                        key={m.id}
                                        className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedMemberIds.has(m.id)}
                                          onChange={() => toggleMemberSelection(m.id)}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <span className="font-medium text-sm">{m.name}</span>
                                        <span className="text-xs text-gray-500">
                                          {TEAM_LABELS[m.team] || m.team} ({m.level})
                                        </span>
                                      </label>
                                    ));
                                  })()}
                                </div>
                              </>
                            )}
                          </div>
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={
                              loading ||
                              selectedMemberIds.size === 0 ||
                              available.length === 0
                            }
                          >
                            {addProgress
                              ? `Adding ${addProgress.current}/${addProgress.total}...`
                              : `Add ${selectedMemberIds.size} Member${selectedMemberIds.size === 1 ? "" : "s"}`}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(group)}
                      disabled={loading}
                    >
                      Delete Group
                    </Button>
                  </div>
                </div>

                {!collapsedGroups.has(group.id) && (
                  members.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No members in this group yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((gm) => (
                          <TableRow key={gm.id}>
                            <TableCell className="font-medium">
                              {gm.member.name}
                            </TableCell>
                            <TableCell>
                              {TEAM_LABELS[gm.member.team] || gm.member.team}
                            </TableCell>
                            <TableCell>{gm.member.level}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setRemoveTarget({id: gm.id, name: gm.member.name})}
                                disabled={loading}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the group &quot;{deleteTarget?.name}&quot;? All members will be removed from this group.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDeleteGroup(deleteTarget.id)}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete Group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove &quot;{removeTarget?.name}&quot; from this group?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && handleRemoveMember(removeTarget.id)}
              disabled={loading}
            >
              {loading ? "Removing..." : "Remove Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
