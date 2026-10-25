"use client";

import authClient, { signOut, useSession } from "@/lib/auth/client";
import { NoAccess } from "@/components/NoAccess";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSites } from "@/lib/api/sites";
import { normalizeRole, syncSessionUser, useStore } from "@/lib/store";

// The sites this user manages (a site manager's scope), straight from the
// API's managerId filter. 100 is the API's page maximum; extra pages are
// followed in case a manager has more.
async function loadManagedSiteIds(userId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await listSites({ managerId: userId, page, limit: 100 });
    for (const s of res.data) ids.push(s.id);
    if (!res.pagination || page >= res.pagination.totalPages) break;
  }
  return ids.sort();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: sessionData, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const user = sessionData?.user;
  const role = normalizeRole((user as { role?: string | null } | undefined)?.role);
  const isManager = role === "site_manager";

  const managed = useQuery({
    queryKey: ["auth", "managed-site-ids", user?.id],
    queryFn: () => loadManagedSiteIds(user!.id),
    enabled: isManager && process.env.NEXT_PUBLIC_USE_DEMO !== "true",
    staleTime: 60 * 1000,
  });

  // Put the real role (and managed sites) into the store before any screen
  // reads it, so no page ever renders with the wrong permissions.
  const store = useStore();
  const synced = !!user && store.session.userId === user.id && store.users.some((u) => u.id === user.id);
  const noRole = !!user && !role && process.env.NEXT_PUBLIC_USE_DEMO !== "true";
  const managedReady = !isManager || !managed.isPending;
  useLayoutEffect(() => {
    if (!user || !role || !managedReady) return;
    syncSessionUser(
      { id: user.id, name: user.name, role: (user as { role?: string | null }).role },
      managed.data ?? [],
    );
  }, [user, role, managed.data, managedReady, synced]);

  // After a 403 the role may have changed on the server: re-read the session.
  useEffect(() => {
    const refresh = () => {
      void authClient.getSession({ fetchOptions: { cache: "no-store" } }).then(() => {
        authClient.$store.notify("$sessionSignal");
      });
    };
    window.addEventListener("zbe:forbidden", refresh);
    return () => window.removeEventListener("zbe:forbidden", refresh);
  }, []);

  useEffect(() => {
    if (isPending) return;

    if (!sessionData?.user && pathname !== "/login") {
      router.push("/login");
    } else if (sessionData?.user && pathname === "/login") {
      router.push("/");
    }
  }, [sessionData?.user, isPending, pathname, router]);

  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <p className="text-sm font-medium tracking-wide text-black/50">Loading ZBE Ops desk...</p>
      </div>
    );
  }

  // Prevent flash of protected content before redirect
  if (!sessionData?.user && pathname !== "/login") {
    return null;
  }

  // The API refuses every call from an account with no role.
  if (noRole && pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <NoAccess title="This account has no role assigned">
          Ask an administrator to give it a role.
          <div className="mt-4">
            <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </NoAccess>
      </div>
    );
  }

  // Wait for the role to be known before drawing anything that depends on it.
  if (user && pathname !== "/login" && process.env.NEXT_PUBLIC_USE_DEMO !== "true" && !synced && role) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <p className="text-sm font-medium tracking-wide text-black/50">Loading ZBE Ops desk...</p>
      </div>
    );
  }

  return <>{children}</>;
}
