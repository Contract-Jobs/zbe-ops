"use client";

import { RequireAdmin } from "@/components/NoAccess";
import { isSiteManager, useStore } from "@/lib/store";

// Not available to site managers (the API refuses it), so it is never drawn.
export default function Layout({ children }: { children: React.ReactNode }) {
  const store = useStore();
  return <RequireAdmin allowed={!isSiteManager(store)}>{children}</RequireAdmin>;
}
