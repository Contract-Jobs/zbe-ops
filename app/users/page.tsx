"use client";

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
import { useStore, isSiteManager } from "@/lib/store";
import { useUsers, useRemoveUser, useBanUser, useUnbanUser, useSetUserPassword } from "@/hooks/use-users";
import { useSession } from "@/lib/auth/client";
import type { User as ApiUser } from "@/types/api";

function roleTone(role: string) {
  if (role === "superadmin") return "ok";
  if (role === "admin" || role === "operations") return "yellow";
  return "ink";
}

export default function UsersPage() {
  const store = useStore();
  const { data: sessionData } = useSession();

  // Use session role if available, otherwise check if they are a site manager from store
  const isManager = sessionData?.user?.role === "site_manager" || isSiteManager(store);

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

  // Assume superadmin if the session role is superadmin, or if it's the specific seed user simulating superadmin
  const canSetAdmin = sessionData?.user?.role === "superadmin" || sessionData?.user?.email === "haileabt@gmail.com";
  const currentUserRole = sessionData?.user?.role || (store.session.userId === "usr_abebe" ? "admin" : "site_manager");
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
        <TableWrap>
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
              {users.map((u) => {
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
                        <div className="flex flex-wrap gap-2">
                          <RecordActions
                            onEdit={() => setMode({ kind: "edit", record: u })}
                            onDelete={canSetAdmin ? () => setMode({ kind: "delete", record: u, label: u.name }) : undefined}
                          />
                          {u.role === "site_manager" && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => setMode({ kind: "assign", record: u } as any)}
                            >
                              Assign sites
                            </button>
                          )}
                          {canSetAdmin && (
                            <>
                              {u.banned ? (
                                <button type="button" className="btn btn-ghost" onClick={() => setMode({ kind: "unban", record: u } as any)}>Unban</button>
                              ) : (
                                <button type="button" className="btn btn-ghost-bad" onClick={() => setMode({ kind: "ban", record: u } as any)}>Ban</button>
                              )}
                              <button type="button" className="btn btn-ghost" onClick={() => setMode({ kind: "password", record: u } as any)}>Set password</button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

function AssignSitesModal({
  user,
  onCancel,
  onDone,
}: {
  user: ApiUser;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { data: sitesData, isLoading } = useSites();
  const updateSiteMutation = useUpdateSite();
  const [error, setError] = useState<string | null>(null);

  const sites = sitesData?.data || [];
  const store = useStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Initialize selected sites based on managerId in sites list or demo store
  // We check site.managerId (API) or site.managerUserId (Store)
  useEffect(() => {
    if (initialized) return;
    if (sites.length > 0) {
      const initial = new Set(
        sites
          .filter((s: any) => s.managerId === user.id || s.managerUserId === user.id)
          .map((s) => s.id)
      );
      setSelectedIds(initial);
      setInitialized(true);
    } else if (store.sites.length > 0) {
      const initial = new Set(
        store.sites
          .filter((s: any) => s.managerUserId === user.id)
          .map((s) => s.id)
      );
      setSelectedIds(initial);
      setInitialized(true);
    }
  }, [sites, store.sites, user.id, initialized]);

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

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    setError(null);
    try {
      const allSites = sites.length > 0 ? sites : store.sites;
      const promises = [];
      for (const site of allSites) {
        const wasManaged = (site as any).managerId === user.id || (site as any).managerUserId === user.id;
        const isManagedNow = selectedIds.has(site.id);
        
        if (isManagedNow && !wasManaged) {
          promises.push(updateSiteMutation.mutateAsync({ id: site.id, payload: { managerId: user.id } }).catch(() => {}));
        } else if (!isManagedNow && wasManaged) {
          promises.push(updateSiteMutation.mutateAsync({ id: site.id, payload: { managerId: null as unknown as string } }).catch(() => {}));
        }
      }
      await Promise.all(promises);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign sites");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="relative w-full max-w-md border border-black bg-white p-5 flex flex-col max-h-[90vh]"
      >
        <h2 id="assign-title" className="text-xl tracking-tight">
          Assign Sites to {user.name}
        </h2>
        
        {error ? (
          <p className="mt-3 border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex-1 overflow-y-auto border border-black/10 p-3 bg-paper/40">
          {isLoading && sites.length === 0 ? (
            <p className="text-sm text-black/50">Loading sites...</p>
          ) : (sites.length === 0 && store.sites.length === 0) ? (
            <p className="text-sm text-black/50">No sites available.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(sites.length > 0 ? sites : store.sites).map((site: any) => {
                const managerId = site.managerId || site.managerUserId;
                const isManagedByOther = managerId && managerId !== user.id;

                return (
                  <label key={site.id} className={`flex items-center gap-3 text-sm select-none ${isManagedByOther ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      className="accent-[var(--yellow)] h-4 w-4"
                      checked={selectedIds.has(site.id)}
                      onChange={() => {
                        if (!isManagedByOther) handleToggle(site.id);
                      }}
                      disabled={updateSiteMutation.isPending || !!isManagedByOther}
                    />
                    <span>
                      <span className="font-medium block">
                        {site.name} {isManagedByOther && <span className="text-black/50 ml-1 font-normal">(Assigned to another manager)</span>}
                      </span>
                      <span className="text-[0.8rem] text-black/50 block">{site.location || (site as any).address || "No location"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end shrink-0">
          <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={onCancel} disabled={updateSiteMutation.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn w-full sm:w-auto"
            onClick={handleSave}
            disabled={updateSiteMutation.isPending}
          >
            {updateSiteMutation.isPending ? "Saving..." : "Save Assignments"}
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
