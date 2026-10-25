"use client";

import type { ReactNode } from "react";

// Shown in place of a screen the signed-in user may not use. The API would
// answer 403 for everything on it, so the screen is never drawn.
export function NoAccess({
  title = "You don't have access to this",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg border border-black/10 p-8 text-center">
      <p className="text-lg font-medium tracking-tight">{title}</p>
      {children ? <div className="mt-2 text-sm text-black/60">{children}</div> : null}
    </div>
  );
}

// Wrap an admin-only screen. A site manager never reaches it.
export function RequireAdmin({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  if (!allowed) {
    return (
      <NoAccess>
        This area is for office staff. Your account works on your own sites.
      </NoAccess>
    );
  }
  return <>{children}</>;
}
