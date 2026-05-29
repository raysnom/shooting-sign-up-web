"use client";

import { useState, useMemo, useCallback } from "react";
import type { Member, TeamType, LevelType, RoleType, DivisionType } from "@/types/database";
import { DIVISION_MAP, DIVISION_LABELS } from "@/lib/constants";
import {
  createMember,
  bulkUploadMembers,
  archiveMember,
  resetMemberPassword,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const teams: TeamType[] = ["APW", "APM", "ARM", "ARW"];
const levels: LevelType[] = ["JH1", "JH2", "JH3", "JH4", "SH1", "SH2"];
const roles: RoleType[] = ["member", "exco", "president"];
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const INITIAL_FORM_STATE = {
  login_id: "",
  name: "",
  email: "",
  team: "APW" as TeamType,
  level: "JH1" as LevelType,
  role: "member" as RoleType,
};

export function MembersClient({ members }: { members: Member[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState<TeamType | "all">("all");
  const [filterLevel, setFilterLevel] = useState<LevelType | "all">("all");
  const [filterDivision, setFilterDivision] = useState<DivisionType | "all">("all");
  const [archiveTarget, setArchiveTarget] = useState<Member | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [csvContent, setCsvContent] = useState("");

  // Pagination state
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [pageIndex, setPageIndex] = useState(0);

  // ──────────────────────────────────────────────
  // Memoized values
  // ──────────────────────────────────────────────

  const { filteredMembers, activeCount, archivedCount } = useMemo(() => {
    const active = members.filter((m) => !m.archived);
    const archived = members.filter((m) => m.archived);

    const query = search.trim().toLowerCase();

    const filtered = members.filter((m) => {
      if (filter === "active" && m.archived) return false;
      if (filter === "archived" && !m.archived) return false;
      if (filterTeam !== "all" && m.team !== filterTeam) return false;
      if (filterLevel !== "all" && m.level !== filterLevel) return false;
      if (filterDivision !== "all" && DIVISION_MAP[m.level] !== filterDivision) return false;
      if (
        query &&
        !`${m.name} ${m.login_id} ${m.email}`.toLowerCase().includes(query)
      )
        return false;
      return true;
    });

    return {
      filteredMembers: filtered,
      activeCount: active.length,
      archivedCount: archived.length,
    };
  }, [members, filter, search, filterTeam, filterLevel, filterDivision]);

  // Pagination derived values
  const totalFiltered = filteredMembers.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const startIndex = safePageIndex * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const pagedMembers = useMemo(
    () => filteredMembers.slice(startIndex, endIndex),
    [filteredMembers, startIndex, endIndex],
  );

  // Reset to the first page whenever the filters/search change. Adjusting state
  // during render (React's recommended pattern) avoids the cascading re-render
  // that a setState-in-effect would cause.
  const filterKey = `${filter}|${search}|${filterTeam}|${filterLevel}|${filterDivision}|${pageSize}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPageIndex(0);
  }

  // ──────────────────────────────────────────────
  // Callbacks
  // ──────────────────────────────────────────────

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  }, []);

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveTarget) return;

    setArchiving(true);
    const result = await archiveMember(archiveTarget.id);

    if ("error" in result && result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage(`${archiveTarget.name} has been archived.`);
      setTimeout(() => setMessage(null), 5000);
    }

    setArchiving(false);
    setArchiveTarget(null);
  }, [archiveTarget]);

  const handleResetConfirm = useCallback(async () => {
    if (!resetTarget) return;

    setResetting(true);
    const result = await resetMemberPassword(resetTarget.id);
    setResetting(false);

    if ("error" in result && result.error) {
      setMessageType("error");
      setMessage(result.error);
      setTimeout(() => setMessage(null), 5000);
      setResetTarget(null);
    } else if ("tempPassword" in result) {
      setResetResult(result.tempPassword);
    }
  }, [resetTarget]);

  const handleResetDialogClose = useCallback(() => {
    setResetTarget(null);
    setResetResult(null);
    setCopied(false);
  }, []);

  const handleCopyTempPassword = useCallback(async () => {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [resetResult]);

  // ──────────────────────────────────────────────
  // Server actions
  // ──────────────────────────────────────────────

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await createMember(form);

    if ("error" in result && result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else {
      setMessageType("success");
      setMessage("Member created and invite sent!");
      setTimeout(() => setMessage(null), 5000);
      setForm(INITIAL_FORM_STATE);
      setShowAdd(false);
    }
    setLoading(false);
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await bulkUploadMembers(csvContent);

    if ("error" in result && result.error) {
      setMessageType("error");
      setMessage(result.error);
    } else if ("results" in result) {
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        setMessageType("error");
        setMessage(
          `${result.summary}. Failed: ${failed.map((f) => `${f.email} (${f.error})`).join(", ")}`
        );
      } else {
        setMessageType("success");
        setMessage(`${result.summary}`);
        setTimeout(() => setMessage(null), 5000);
      }
      setCsvContent("");
      setShowBulk(false);
    }
    setLoading(false);
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
                        <SelectValue />
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
                        <SelectValue />
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
                        <SelectValue placeholder="Select role" className="capitalize" />
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
            messageType === "error"
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="relative w-full sm:w-64">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, login ID, or email"
            aria-label="Search members"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            Active ({activeCount})
          </Button>
          <Button
            variant={filter === "archived" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("archived")}
          >
            Archived ({archivedCount})
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v as TeamType | "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Teams" />
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
              <SelectValue placeholder="All Levels" />
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
              <SelectValue placeholder="All Divisions" />
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
            {pagedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No {filter} members found.
                </TableCell>
              </TableRow>
            ) : (
              pagedMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.login_id}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.team}</Badge>
                  </TableCell>
                  <TableCell>{member.level}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!member.archived && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetTarget(member)}
                        >
                          Reset Password
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setArchiveTarget(member)}
                        >
                          Archive
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">
          {totalFiltered === 0
            ? "Showing 0 members"
            : `Showing ${startIndex + 1}-${endIndex} of ${totalFiltered} member${totalFiltered !== 1 ? "s" : ""}`}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="members-page-size" className="text-muted-foreground">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v) as PageSize)}
            >
              <SelectTrigger id="members-page-size" className="w-[80px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-muted-foreground">
            Page {totalFiltered === 0 ? 0 : safePageIndex + 1} of {totalFiltered === 0 ? 0 : pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={safePageIndex === 0 || totalFiltered === 0}
              aria-label="Previous page"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
              disabled={safePageIndex >= pageCount - 1 || totalFiltered === 0}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &apos;{archiveTarget?.name}&apos;? They will no longer appear in active members.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchiveConfirm}
              disabled={archiving}
            >
              {archiving ? "Archiving..." : "Archive"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && handleResetDialogClose()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resetResult ? "Password Reset" : "Reset Password"}
            </DialogTitle>
            <DialogDescription>
              {resetResult
                ? `${resetTarget?.name}'s password has been reset. Share this temporary password with them — they can change it on the set-password page after logging in.`
                : `Reset the password for ${resetTarget?.name}? Their new password will be the default temp password.`}
            </DialogDescription>
          </DialogHeader>

          {resetResult ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-gray-50 p-3 font-mono text-sm break-all">
                {resetResult}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCopyTempPassword}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button onClick={handleResetDialogClose}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setResetTarget(null)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetConfirm}
                disabled={resetting}
              >
                {resetting ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
