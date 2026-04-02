"use client";

import { useState, useMemo, useCallback } from "react";
import type { Gun, GunTypeEnum, Member } from "@/types/database";
import { TEAM_LABELS } from "@/lib/constants";
import {
  createGun,
  updateGun,
  deleteGun,
  assignGunToMember,
  bulkImportGuns,
} from "./actions";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GUN_TYPE_LABELS: Record<GunTypeEnum, string> = {
  air_pistol: "Air Pistol",
  air_rifle: "Air Rifle",
  individual: "Individual",
};

// Sentinel value for the "Unassign" option in the select.
// Must not collide with a real UUID.
const UNASSIGN_VALUE = "__unassign__";

export function GunsClient({
  guns,
  members,
}: {
  guns: Gun[];
  members: Member[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingGun, setEditingGun] = useState<Gun | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    name: "",
    type: "air_pistol" as GunTypeEnum,
  });

  const [editForm, setEditForm] = useState({
    name: "",
    type: "air_pistol" as GunTypeEnum,
  });

  // Bulk import state
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState<GunTypeEnum>("air_pistol");
  const [bulkResults, setBulkResults] = useState<
    { gun: string; members: { name: string; matched: string | null; error?: string }[] }[] | null
  >(null);

  // ──────────────────────────────────────────────
  // Derived data
  // ──────────────────────────────────────────────

  const getAssignedMembers = useCallback((gunId: string) => {
    return members.filter((m) => m.gun_id === gunId);
  }, [members]);

  const getGunName = useCallback((gunId: string | null) => {
    if (!gunId) return null;
    const gun = guns.find((g) => g.id === gunId);
    return gun ? `${gun.name} (${GUN_TYPE_LABELS[gun.type]})` : null;
  }, [guns]);

  const pistolGuns = useMemo(() => guns.filter((g) => g.type === "air_pistol"), [guns]);
  const rifleGuns = useMemo(() => guns.filter((g) => g.type === "air_rifle"), [guns]);

  // ──────────────────────────────────────────────
  // Callbacks
  // ──────────────────────────────────────────────

  const openEditGun = useCallback((gun: Gun) => {
    setEditingGun(gun);
    setEditForm({ name: gun.name, type: gun.type });
    setShowEdit(true);
  }, []);

  const handleDeleteGunClick = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this gun?")) return;
    setLoading(true);
    setMessage(null);

    const result = await deleteGun(id);

    setLoading(false);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Gun deleted.");
    }
  }, []);

  // ──────────────────────────────────────────────
  // Server actions
  // ──────────────────────────────────────────────

  async function handleCreateGun(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setLoading(true);
    setMessage(null);

    const result = await createGun({
      name: addForm.name.trim(),
      type: addForm.type,
    });

    setLoading(false);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Gun added.");
      setAddForm({ name: "", type: "air_pistol" });
      setShowAdd(false);
    }
  }

  async function handleUpdateGun(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGun || !editForm.name.trim()) return;
    setLoading(true);
    setMessage(null);

    const result = await updateGun(editingGun.id, {
      name: editForm.name.trim(),
      type: editForm.type,
    });

    setLoading(false);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Gun updated.");
      setShowEdit(false);
      setEditingGun(null);
    }
  }

  // ──────────────────────────────────────────────
  // Bulk import handler
  // ──────────────────────────────────────────────

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setLoading(true);
    setMessage(null);
    setBulkResults(null);

    const result = await bulkImportGuns(bulkText, bulkType);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      const totalGuns = result.results.length;
      const totalMatched = result.results.reduce(
        (sum, r) => sum + r.members.filter((m) => m.matched).length,
        0
      );
      const totalFailed = result.results.reduce(
        (sum, r) => sum + r.members.filter((m) => !m.matched && m.name).length,
        0
      );
      setMessage(
        `Imported ${totalGuns} guns. ${totalMatched} members matched, ${totalFailed} unmatched.`
      );
      setBulkResults(result.results);
    }
    setLoading(false);
  }

  // ──────────────────────────────────────────────
  // Gun assignment handler
  // ──────────────────────────────────────────────

  async function handleAssign(memberId: string, value: string) {
    const gunId = value === UNASSIGN_VALUE ? null : value;

    // Skip if the value hasn't changed
    const member = members.find((m) => m.id === memberId);
    if (member && (member.gun_id ?? null) === gunId) return;

    setLoading(true);
    setMessage(null);

    const result = await assignGunToMember(memberId, gunId);

    setLoading(false);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Gun assignment updated.");
    }
  }

  // ──────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────

  const renderGunSelect = useCallback((member: Member) => {
    const currentValue = member.gun_id || UNASSIGN_VALUE;

    return (
      <Select
        value={currentValue}
        onValueChange={(v) => v && handleAssign(member.id, v)}
        disabled={loading}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select a gun">
            {(value) => {
              if (value === UNASSIGN_VALUE) return "Unassigned";
              const g = guns.find((gun) => gun.id === value);
              return g ? `${g.name} (${GUN_TYPE_LABELS[g.type]})` : "Select a gun";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGN_VALUE}>Unassigned</SelectItem>
          {pistolGuns.length > 0 && (
            <SelectGroup>
              <SelectLabel>Air Pistol</SelectLabel>
              {pistolGuns.map((g) => (
                <SelectItem key={g.id} value={g.id} label={g.name}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {rifleGuns.length > 0 && (
            <SelectGroup>
              <SelectLabel>Air Rifle</SelectLabel>
              {rifleGuns.map((g) => (
                <SelectItem key={g.id} value={g.id} label={g.name}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    );
  }, [guns, handleAssign, loading, pistolGuns, rifleGuns]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gun Management</h1>

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

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Gun Inventory</TabsTrigger>
          <TabsTrigger value="assignments">Gun Assignments</TabsTrigger>
          <TabsTrigger value="import">Bulk Import</TabsTrigger>
        </TabsList>

        {/* ─────── Tab 1: Gun Inventory ─────── */}
        <TabsContent value="inventory">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogTrigger render={<Button />}>Add Gun</DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Gun</DialogTitle>
                    <DialogDescription>
                      Add a new gun to the inventory.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateGun} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={addForm.name}
                        onChange={(e) =>
                          setAddForm({ ...addForm, name: e.target.value })
                        }
                        placeholder="e.g. Steyr LP10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={addForm.type}
                        onValueChange={(v) =>
                          setAddForm({
                            ...addForm,
                            type: v as GunTypeEnum,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(value) => GUN_TYPE_LABELS[value as GunTypeEnum] || value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air_pistol">Air Pistol</SelectItem>
                          <SelectItem value="air_rifle">Air Rifle</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || !addForm.name.trim()}
                    >
                      {loading ? "Adding..." : "Add Gun"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned Members</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-gray-500"
                      >
                        No guns in inventory.
                      </TableCell>
                    </TableRow>
                  ) : (
                    guns.map((gun) => (
                      <TableRow key={gun.id}>
                        <TableCell className="font-medium">
                          {gun.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {GUN_TYPE_LABELS[gun.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAssignedMembers(gun.id).length === 0 ? (
                            <span className="text-muted-foreground">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {getAssignedMembers(gun.id).map((m) => (
                                <Badge key={m.id} variant="outline" className="text-xs">
                                  {m.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditGun(gun)}
                              disabled={loading}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteGunClick(gun.id)}
                              disabled={loading}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─────── Tab 2: Gun Assignments ─────── */}
        <TabsContent value="assignments">
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Current Gun</TableHead>
                  <TableHead>Assign Gun</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-gray-500"
                    >
                      No active members.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {TEAM_LABELS[member.team] || member.team}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getGunName(member.gun_id) || (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{renderGunSelect(member)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        {/* ─────── Tab 3: Bulk Import ─────── */}
        <TabsContent value="import">
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Paste tab-separated gun data from a spreadsheet. First column should
              be the gun number, remaining columns are member names. Names with
              notes like (C, M) or (ARM) are automatically cleaned.
            </div>

            <form onSubmit={handleBulkImport} className="space-y-4">
              <div className="space-y-2">
                <Label>Gun Type</Label>
                <Select
                  value={bulkType}
                  onValueChange={(v) => setBulkType(v as GunTypeEnum)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>
                      {(value) => GUN_TYPE_LABELS[value as GunTypeEnum] || value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air_pistol">Air Pistol</SelectItem>
                    <SelectItem value="air_rifle">Air Rifle</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Paste Data (tab-separated)</Label>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Gun Number\tMember 1\tMember 2\tMember 3\n749268\tOWEN (C, M)\tYIYANG (B, M)\tRAYSON (A, M)"}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !bulkText.trim()}
              >
                {loading ? "Importing..." : "Import Guns & Assign Members"}
              </Button>
            </form>

            {bulkResults && (
              <div className="space-y-3">
                <h3 className="font-semibold">Import Results</h3>
                <div className="rounded-md border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gun</TableHead>
                        <TableHead>Search Name</TableHead>
                        <TableHead>Matched To</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkResults.flatMap((r) =>
                        r.members.length === 0
                          ? [
                              <TableRow key={r.gun + "-empty"}>
                                <TableCell className="font-medium">
                                  {r.gun}
                                </TableCell>
                                <TableCell
                                  colSpan={3}
                                  className="text-muted-foreground"
                                >
                                  No members listed
                                </TableCell>
                              </TableRow>,
                            ]
                          : r.members.map((m, idx) => (
                              <TableRow key={r.gun + "-" + idx}>
                                {idx === 0 && (
                                  <TableCell
                                    className="font-medium"
                                    rowSpan={r.members.length}
                                  >
                                    {r.gun}
                                  </TableCell>
                                )}
                                <TableCell>{m.name || "—"}</TableCell>
                                <TableCell>
                                  {m.matched || (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {m.matched ? (
                                    <Badge className="bg-green-100 text-green-800">
                                      Matched
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">
                                      {m.error || "Failed"}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Gun Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Gun</DialogTitle>
            <DialogDescription>
              Update the gun name or type.
            </DialogDescription>
          </DialogHeader>
          {editingGun && (
            <form onSubmit={handleUpdateGun} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      type: v as GunTypeEnum,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => GUN_TYPE_LABELS[value as GunTypeEnum] || value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="air_pistol">Air Pistol</SelectItem>
                    <SelectItem value="air_rifle">Air Rifle</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !editForm.name.trim()}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
