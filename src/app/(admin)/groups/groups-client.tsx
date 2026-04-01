"use client";

import { useState } from "react";
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
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createGroup(newGroupName);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Group created successfully.");
      setNewGroupName("");
      setShowCreate(false);
    }
    setLoading(false);
  }

  async function handleDeleteGroup(id: string, name: string) {
    if (
      !confirm(
        `Are you sure you want to delete the group "${name}"? All members will be removed from this group.`
      )
    )
      return;

    setLoading(true);
    setMessage(null);

    const result = await deleteGroup(id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Group deleted successfully.");
    }
    setLoading(false);
  }

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  async function handleAddMembers(e: React.FormEvent) {
    e.preventDefault();
    if (!addMemberGroupId || selectedMemberIds.size === 0) return;

    setLoading(true);
    setMessage(null);

    let added = 0;
    let errors: string[] = [];
    for (const memberId of selectedMemberIds) {
      const result = await addGroupMember(addMemberGroupId, memberId);
      if (result.error) {
        const name = allMembers.find((m) => m.id === memberId)?.name || memberId;
        errors.push(`${name}: ${result.error}`);
      } else {
        added++;
      }
    }

    if (errors.length > 0) {
      setMessage(`Added ${added} member(s). Errors: ${errors.join("; ")}`);
    } else {
      setMessage(`${added} member(s) added to group.`);
    }
    setSelectedMemberIds(new Set());
    setAddMemberGroupId(null);
    setLoading(false);
  }

  async function handleRemoveMember(id: string) {
    if (!confirm("Remove this member from the group?")) return;

    setLoading(true);
    setMessage(null);

    const result = await removeGroupMember(id);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Member removed from group.");
    }
    setLoading(false);
  }

  function getMembersForGroup(groupId: string) {
    return groupMembers.filter((gm) => gm.group_id === groupId);
  }

  function getAvailableMembers(groupId: string) {
    const existingMemberIds = new Set(
      getMembersForGroup(groupId).map((gm) => gm.member_id)
    );
    return allMembers.filter((m) => !existingMemberIds.has(m.id));
  }

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
            message.startsWith("Error")
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
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{group.name}</h2>
                    <Badge variant="secondary">
                      {members.length}{" "}
                      {members.length === 1 ? "member" : "members"}
                    </Badge>
                  </div>
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
                                  {available
                                    .filter((m) =>
                                      m.name.toLowerCase().includes(memberSearch.toLowerCase())
                                    )
                                    .map((m) => (
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
                                    ))}
                                  {available.filter((m) =>
                                    m.name.toLowerCase().includes(memberSearch.toLowerCase())
                                  ).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">
                                      No members found
                                    </div>
                                  )}
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
                            {loading ? "Adding..." : `Add ${selectedMemberIds.size || ""} Member${selectedMemberIds.size !== 1 ? "s" : ""}`}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      disabled={loading}
                    >
                      Delete Group
                    </Button>
                  </div>
                </div>

                {members.length === 0 ? (
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
                              onClick={() => handleRemoveMember(gm.id)}
                              disabled={loading}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
