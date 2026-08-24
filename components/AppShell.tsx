"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  currentUser,
  hydrateStore,
  isSiteManager,
  resetStore,
  switchLicense,
  switchUser,
  useStore,
} from "@/lib/store";

const nav = [
  { href: "/", label: "Board" },
  { href: "/approvals", label: "Approvals" },
  { href: "/sites", label: "Sites" },
  { href: "/materials", label: "Materials" },
  { href: "/inventory", label: "Inventory" },
  { href: "/equipment", label: "Equipment" },
  { href: "/warehouses", label: "Yards" },
  { href: "/tenders", label: "Tenders" },
  { href: "/licenses", label: "Licenses" },
  { href: "/ledger", label: "Ledger" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const store = useStore();
  const pathname = usePathname();
  const user = currentUser(store);
  const pending = store.approvals.filter((a) => a.status === "pending").length;
  const manager = isSiteManager(store);

  useEffect(() => {
    hydrateStore();
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[15.5rem] shrink-0 flex-col bg-black text-white">
        <div className="px-5 py-6">
          <p className="font-medium tracking-[-0.06em] text-[1.45rem] leading-none">ZBE</p>
          <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-yellow">
            Ops desk
          </p>
        </div>
        <nav className="flex-1 px-3">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex items-center justify-between px-3 py-2 text-[0.95rem] ${
                  active ? "bg-yellow text-black" : "text-white/80 hover:bg-raised hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {item.href === "/approvals" && pending > 0 ? (
                  <span className={`font-mono text-[0.7rem] ${active ? "text-black" : "text-yellow"}`}>
                    {pending}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4">
          <button type="button" className="text-left font-mono text-[0.65rem] text-white/40 hover:text-yellow" onClick={() => resetStore()}>
            Reset demo data
          </button>
          <p className="mt-2 font-mono text-[0.65rem] leading-relaxed text-white/40">
            Yard movements wait in Approvals. Manual ledger entries post immediately.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-black/10 bg-white/90 px-6 py-3 backdrop-blur">
          <div>
            <p className="kicker">ZBE Power Engineering</p>
            <p className="text-sm text-black/70">
              {manager ? "Site desk — assigned jobs only" : "Central operations"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field w-auto min-w-[10rem] bg-white"
              value={store.session.licenseId}
              onChange={(e) => switchLicense(e.target.value as "all" | string)}
            >
              <option value="all">All licenses</option>
              {store.licenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              className="field w-auto min-w-[12rem] bg-white"
              value={store.session.userId}
              onChange={(e) => switchUser(e.target.value)}
            >
              {store.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role === "site_manager" ? "site" : "ops"}
                </option>
              ))}
            </select>
            <span className="hidden font-mono text-[0.7rem] text-black/45 sm:inline">
              {user.id}
            </span>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
