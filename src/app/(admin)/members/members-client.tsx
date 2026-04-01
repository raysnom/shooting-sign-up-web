"use client";

import { useState } from "react";
import type { Member, TeamType, LevelType, RoleType, DivisionType } from "@/types/database";
import { TEAM_LABELS, DIVISION_MAP, DIVISION_LABELS } from "@/lib/constants";
import { createMember, bulkUploadMembers, archiveMember } from "./actions";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const teams: TeamType[] = ["APW", "APM", "ARM", "ARW"];
const levels: LevelType[] = ["JH1", "JH2", "JH3", "JH4", "SH1", "SH2"];
const roles: RoleType[] = ["member", "exco", "president"];

export function MembersClient({ members }: { members: Member[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [filterTeam, setFilterTeam] = useState<TeamType | "all">("all");
  const [filterLevel, setFilterLevel] = useState<LevelType | "all">("all");
  const [filterDivision, setFilterDivision] = useState<DivisionType | "all">("all");

  // Add member form state
  const [form, setForm] = useState({
    login_id: "",
    name: "",
    email: "",
    team: "APW" as TeamType,
    level: "JH1" as LevelType,
    role: "member" as RoleType,
  });

  // Bulk upload state
  const [csvContent, setCsvContent] = useState("");

  const filteredMembers = members.filter((m) => {
    if (filter === "active" ? m.archived : !m.archived) return false;
    if (filterTeam !== "all" && m.team !== filterTeam) return false;
    if (filterLevel !== "all" && m.level !== filterLevel) return false;
    if (filterDivision !== "all" && DIVISION_MAP[m.level] !== filterDivision) return false;
    return true;
  });

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createMember(form);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setMessage("Member created and invite sent!");
      setForm({
        login_id: "",
        name: "",
        email: "",
        team: "APW",
        level: "JH1",
        role: "member",
      });
      setShowAdd(false);
    }
    setLoading(false);
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await bulkUploadMembers(csvContent);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        setMessage(
          `${result.summary}. Failed: ${failed.map((f) => `${f.email} (${f.error})`).join(", ")}`
        );
      } else {
        setMessage(`${result.summary}`);
      }
      setCsvContent("");
      setShowBulk(false);
    }
    setLoading(false);
  }

  async function handleArchive(memberId: string) {
    if (!confirm("Are you sure you want to archive this member?")) return;
    const result = await archiveMember(memberId);
    if (result.error) {
      setMessage(`Error: ${result.error}`);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Members</h1>
        <div className="flex gap-2">
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger render={<Button />}>
              Add Member
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>
                  Create a member profile and send them an invite email.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Login ID</Label>
                    <Input
                      value={form.login_id}
                      onChange={(e) =>
                        setForm({ ...form, login_id: e.target.value })
                      }
                      placeholder="e.g. S12345"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Full name"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="member@example.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Team</Label>
                    <Select
                      value={form.team}
                      onValueChange={(v) =>
                        setForm({ ...form, team: v as TeamType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{(value) => value}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select
                      value={form.level}
                      onValueChange={(v) =>
                        setForm({ ...form, level: v as LevelType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{(value) => value}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) =>
                        setForm({ ...form, role: v as RoleType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r} value={r}>
                            <span className="capitalize">{r}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create & Send Invite"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger render={<Button variant="outline" />}>
              Bulk Upload
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Upload Members</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with columns: login_id, name, email, team,
                  level. Optional column: role (defaults to &quot;member&quot;).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBulkUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>CSV File</Label>
                  <Input type="file" accept=".csv" onChange={handleFileUpload} />
                </div>
                {csvContent && (
                  <p className="text-sm text-gray-500">
                    {csvContent.split("\n").length - 1} rows detected
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !csvContent}
                >
                  {loading ? "Uploading..." : "Upload & Send Invites"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            Active ({members.filter((m) => !m.archived).length})
          </Button>
          <Button
            variant={filter === "archived" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("archived")}
          >
            Archived ({members.filter((m) => m.archived).length})
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v as TeamType | "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue>{(value) => value === "all" ? "All Teams" : value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v as LevelType | "all")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue>{(value) => value === "all" ? "All Levels" : value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDivision} onValueChange={(v) => setFilterDivision(v as DivisionType | "all")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue>
                {(value) => value === "all" ? "All Divisions" : DIVISION_LABELS[value as DivisionType]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              <SelectItem value="A">{DIVISION_LABELS["A"]}</SelectItem>
              <SelectItem value="B">{DIVISION_LABELS["B"]}</SelectItem>
              <SelectItem value="C">{DIVISION_LABELS["C"]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Login ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No {filter} members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.login_id}</TableCell>
                  <TableCell>{member.email}</TableCell>
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
                  <TableCell className="text-right">
                    {!member.archived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleArchive(member.id)}
                      >
                        Archive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
