"use client";

import { RowActions } from "@/components/RowActions";
import { useState, useEffect } from "react";
import { UserForm } from "@/components/forms/user";
import { useSites, useUpdateSite } from "@/hooks/use-sites";
import {
  closedMode,
  FormPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  ConfirmDialog,
  DeleteConfirm,
  type RecordMode,
} from "@/components/ui";
import { useStore, isSiteManager, normalizeRole } from "@/lib/store";
import { isSuperadmin } from "@/lib/auth/permissions";
import { useUsers, useRemoveUser, useBanUser, useUnbanUser, useSetUserPassword } from "@/hooks/use-users";
import { useSession } from "@/lib/auth/client";
import type { Site, User as ApiUser } from "@/types/api";

function roleTone(role: string) {
  if (role === "superadmin") return "ok";
  if (role === "admin" || role === "operations") return "yellow";
  return "ink";
}

export default function UsersPage() {
  const store = useStore();
  const { data: sessionData } = useSession();

  // Use session role if available, otherwise check if they are a site manager from store
  const isManager = normalizeRole(sessionData?.user?.role) === "site_manager" || isSiteManager(store);

  const [mode, setMode] = useState<
    | RecordMode<ApiUser>
    | { kind: "assign"; record: ApiUser }
    | { kind: "ban"; record: ApiUser }
    | { kind: "unban"; record: ApiUser }
    | { kind: "password"; record: ApiUser }
  >(closedMode);

  const { data: usersData, isLoading } = useUsers();
  const removeUser = useRemoveUser();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const setPassword = useSetUserPassword();

  // Fallback to local store for demo mode if API fails or hasn't loaded
  let users: ApiUser[] = [];
  if (usersData && Array.isArray(usersData.users)) {
    users = usersData.users as ApiUser[];
  } else if (Array.isArray(usersData)) {
    users = usersData as ApiUser[];
  } else if (process.env.NEXT_PUBLIC_USE_DEMO === "true") {
    // Demo mode mapping
    users = store.users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email || `${u.id}@example.com`,
      role: u.role === "operations" ? "admin" : "site_manager",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      banned: !!u.banned,
    }));
  }

  // Protect the route locally
  if (isManager) {
    return (
      <div className="p-8 text-center text-sm text-[var(--bad)]">
        You do not have permission to view this page.
      </div>
    );
  }

  // Only the real session role counts; no role at all means site manager.
  const currentUserRole = normalizeRole(sessionData?.user?.role);
  const canSetAdmin = isSuperadmin(currentUserRole);
  const currentUserId = sessionData?.user?.id || store.session.userId;

  return (
    <div>
      <PageHead
        kicker="Settings"
        title="Team"
        action={
          currentUserRole === "superadmin" || currentUserRole === "admin" || canSetAdmin ? (
            <RecordActions newLabel="New user" onNew={() => setMode({ kind: "create" })} />
          ) : undefined
        }
      />
      {mode.kind === "edit" || mode.kind === "create" ? (
        <FormPanel kicker="Settings" title={mode.kind === "edit" ? "Edit user" : "New user"} onClose={() => setMode(closedMode())}>
          <UserForm
            initial={mode.kind === "edit" ? (mode.record as ApiUser) : undefined}
            canSetAdmin={canSetAdmin}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}

      {isLoading && !usersData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading users...</div>
      ) : (
        <TableWrap
          data={users}
          sortOptions={[
            { label: "Name (A-Z)", value: "name_asc", sortFn: (a, b) => a.name.localeCompare(b.name) },
            { label: "Name (Z-A)", value: "name_desc", sortFn: (a, b) => b.name.localeCompare(a.name) },
            { label: "Role", value: "role", sortFn: (a, b) => a.role.localeCompare(b.role) },
            { label: "Status", value: "status", sortFn: (a, b) => Number(a.banned) - Number(b.banned) }
          ]}
          itemsPerPage={10}
        >
          {(paginatedUsers) => (
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="hidden sm:table-cell">Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => {
                  // Determine if current user can edit this row
                  let canEdit = false;
                  if (currentUserRole === "superadmin" || canSetAdmin) {
                    canEdit = true;
                  } else if (currentUserRole === "admin" && (u.role === "site_manager" || u.id === currentUserId)) {
                    canEdit = true;
                  }

                  return (
                    <tr key={u.id}>
                      <td>
                        <p className="font-medium">{u.name}</p>
                        <p className="mt-1 text-[0.8rem] text-black/50 sm:hidden">{u.email}</p>
                      </td>
                      <td className="hidden text-[0.95rem] sm:table-cell">{u.email}</td>
                      <td>
                        <Stamp value={u.role.replace("_", " ")} tone={roleTone(u.role)} />
                      </td>
                      <td>
                        <Stamp value={u.banned ? "banned" : "active"} tone={u.banned ? "bad" : "ok"} />
                      </td>
                      <td>
                        {canEdit ? (
                          <RowActions
                            ariaLabel={`Actions for ${u.name}`}
                            primary={{ label: "Edit", onClick: () => setMode({ kind: "edit", record: u }) }}
                            items={[
                              { label: "Assign sites", hidden: u.role !== "site_manager", onClick: () => setMode({ kind: "assign", record: u }) },
                              { label: "Set password", hidden: !canSetAdmin, onClick: () => setMode({ kind: "password", record: u }) },
                              u.banned
                                ? { label: "Unban", hidden: !canSetAdmin, onClick: () => setMode({ kind: "unban", record: u }) }
                                : { label: "Ban", tone: "bad", hidden: !canSetAdmin, onClick: () => setMode({ kind: "ban", record: u }) },
                              { label: "Delete", tone: "bad", separatorBefore: true, hidden: !canSetAdmin, onClick: () => setMode({ kind: "delete", record: u, label: u.name }) },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}

      {mode.kind === "assign" && mode.record ? (
        <AssignSitesModal
          user={mode.record as ApiUser}
          onCancel={() => setMode(closedMode())}
          onDone={() => setMode(closedMode())}
        />
      ) : null}
      
      <DeleteConfirm
        mode={mode as any}
        restore={false}
        loading={removeUser.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={() => {
          if (mode.kind === "delete" && mode.record) {
            removeUser.mutate({ userId: (mode.record as ApiUser).id }, {
              onSuccess: () => setMode(closedMode()),
            });
          }
        }}
      />

      <ConfirmDialog
        open={mode.kind === "ban"}
        title="Ban User"
        body={`Are you sure you want to ban ${(mode as any).record?.name}? They will no longer be able to log in.`}
        confirmLabel={banUser.isPending ? "Banning..." : "Ban user"}
        onCancel={() => setMode(closedMode())}
        onConfirm={() => {
          if (mode.kind === "ban" && mode.record) {
            banUser.mutate({ userId: (mode.record as ApiUser).id }, {
              onSuccess: () => setMode(closedMode()),
            });
          }
        }}
      />

      <ConfirmDialog
        open={mode.kind === "unban"}
        title="Unban User"
        body={`Are you sure you want to unban ${(mode as any).record?.name}? They will be able to log in again.`}
        confirmLabel={unbanUser.isPending ? "Unbanning..." : "Unban user"}
        danger={false}
        onCancel={() => setMode(closedMode())}
        onConfirm={() => {
          if (mode.kind === "unban" && mode.record) {
            unbanUser.mutate({ userId: (mode.record as ApiUser).id }, {
              onSuccess: () => setMode(closedMode()),
            });
          }
        }}
      />

      {mode.kind === "password" && mode.record ? (
        <SetPasswordModal
          user={mode.record as ApiUser}
          loading={setPassword.isPending}
          onCancel={() => setMode(closedMode())}
          onDone={(password) => {
            setPassword.mutate({ userId: (mode.record as ApiUser).id, password }, {
              onSuccess: () => setMode(closedMode()),
            });
          }}
        />
      ) : null}
    </div>
  );
}

const ASSIGN_PAGE_SIZE = 10;

// Pick the sites a user manages. The list is paged and searchable on the
// server, so every site is reachable; what the admin ticks is kept as a list of
// changes (per site) and survives paging and searching. Nothing is sent until
// "Save assignments".
function AssignSitesModal({
  user,
  onCancel,
  onDone,
}: {
  user: ApiUser;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  // Narrow to the sites this user already manages (server-side filter).
  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const { data: sitesData, isLoading, isFetching } = useSites({
    page,
    limit: ASSIGN_PAGE_SIZE,
    search: search || undefined,
    managerId: onlyAssigned ? user.id : undefined,
  });
  const updateSiteMutation = useUpdateSite();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sites = (sitesData?.data ?? []).filter((s) => !s.deletedAt);
  const pagination = sitesData?.pagination;

  // Ticks the admin has changed, by site. A site not in here shows whatever
  // the server says (managed by this user or not).
  const [changes, setChanges] = useState<Map<string, { site: Site; selected: boolean }>>(new Map());
  const isManagedByUser = (site: Site) => site.managerId === user.id;
  const isSelected = (site: Site) => changes.get(site.id)?.selected ?? isManagedByUser(site);

  // Wait for a pause in typing before asking the server, and start from page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  const handleToggle = (site: Site) => {
    setChanges((prev) => {
      const next = new Map(prev);
      const nowSelected = !isSelected(site);
      // Back to what the server already has: not a change any more.
      if (nowSelected === isManagedByUser(site)) next.delete(site.id);
      else next.set(site.id, { site, selected: nowSelected });
      return next;
    });
  };

  const added = Array.from(changes.values()).filter((c) => c.selected);
  const removed = Array.from(changes.values()).filter((c) => !c.selected);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const entries = Array.from(changes.values());
    const results = await Promise.allSettled(
      entries.map((c) =>
        updateSiteMutation.mutateAsync({
          id: c.site.id,
          payload: { managerId: c.selected ? user.id : (null as unknown as string) },
        }),
      ),
    );
    setSaving(false);
    // Keep only the changes that did not go through, so a retry is safe.
    const failed = entries.filter((_, i) => results[i]?.status === "rejected");
    if (failed.length === 0) {
      onDone();
      return;
    }
    setChanges(new Map(failed.map((c) => [c.site.id, c])));
    setError(
      `${failed.length} of ${entries.length} site${entries.length === 1 ? "" : "s"} could not be updated: ` +
        failed.map((c) => c.site.name).join(", ") +
        ". The others were saved.",
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="relative flex max-h-[90vh] w-full max-w-md flex-col border border-black bg-white p-5"
      >
        <h2 id="assign-title" className="text-xl tracking-tight">
          Assign Sites to {user.name}
        </h2>

        {error ? (
          <p className="mt-3 border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>
        ) : null}

        <input
          className="field mt-4"
          type="search"
          placeholder="Search sites by name"
          aria-label="Search sites"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <label className="mt-2 flex items-center gap-2 text-sm text-black/70">
          <input
            type="checkbox"
            checked={onlyAssigned}
            onChange={(e) => {
              setOnlyAssigned(e.target.checked);
              setPage(1);
            }}
          />
          Only sites assigned to {user.name}
        </label>

        <div className="mt-3 min-h-[12rem] flex-1 overflow-y-auto border border-black/10 bg-paper/40 p-3">
          {isLoading && sites.length === 0 ? (
            <p className="text-sm text-black/50">Loading sites...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-black/50">{search ? "No site matches your search." : onlyAssigned ? `${user.name} has no sites yet.` : "No sites available."}</p>
          ) : (
            <div className={`flex flex-col gap-3 ${isFetching ? "opacity-60" : ""}`}>
              {sites.map((site) => {
                const managedByOther = !!site.managerId && site.managerId !== user.id;
                return (
                  <label
                    key={site.id}
                    className={`flex select-none items-center gap-3 text-sm ${managedByOther ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--yellow)]"
                      checked={isSelected(site)}
                      onChange={() => handleToggle(site)}
                      disabled={saving || managedByOther}
                    />
                    <span>
                      <span className="block font-medium">
                        {site.name}
                        {managedByOther ? (
                          <span className="ml-1 font-normal text-black/50">(Assigned to another manager)</span>
                        ) : null}
                      </span>
                      <span className="block text-[0.8rem] text-black/50">{site.location || "No location"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-black/60">
          <span>
            {pagination
              ? `Page ${pagination.page} of ${Math.max(1, pagination.totalPages)} · ${pagination.total} site${pagination.total === 1 ? "" : "s"}`
              : ""}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              disabled={page <= 1 || saving}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              disabled={!pagination || page >= pagination.totalPages || saving}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </span>
        </div>

        <p className="mt-2 text-xs text-black/60" aria-live="polite">
          {changes.size === 0
            ? "No changes yet."
            : `${added.length > 0 ? `Assign ${added.length}` : ""}${added.length > 0 && removed.length > 0 ? ", " : ""}${removed.length > 0 ? `remove ${removed.length}` : ""} — kept while you search or change page.`}
        </p>

        <div className="mt-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn w-full sm:w-auto"
            onClick={handleSave}
            disabled={saving || changes.size === 0}
          >
            {saving ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SetPasswordModal({
  user,
  loading,
  onCancel,
  onDone,
}: {
  user: ApiUser;
  loading: boolean;
  onCancel: () => void;
  onDone: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
        className="relative w-full max-w-md border border-black bg-white p-5 flex flex-col"
      >
        <h2 id="password-title" className="text-xl tracking-tight">
          Set Password
        </h2>
        <p className="mt-2 text-sm text-black/70 leading-relaxed">
          Set a new password for <strong className="font-medium">{user.name}</strong>.
        </p>
        <div className="mt-4">
          <input 
            type="password" 
            className="input w-full"
            placeholder="New Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end shrink-0">
          <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn w-full sm:w-auto"
            onClick={() => {
              if (password.length >= 8) onDone(password);
              else alert("Password must be at least 8 characters");
            }}
            disabled={loading || password.length < 8}
          >
            {loading ? "Saving..." : "Set Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
