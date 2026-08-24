"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    hydrateStore();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[15.5rem] flex-col bg-black text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between px-5 py-6">
          <div>
            <p className="font-medium tracking-[-0.06em] text-[1.45rem] leading-none">ZBE</p>
            <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-yellow">
              Ops desk
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-white lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex items-center justify-between px-3 py-2.5 text-[0.95rem] ${
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
        <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center bg-black text-white lg:hidden"
              aria-expanded={menuOpen}
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon />
            </button>
            <div className="min-w-0 flex-1">
              <p className="kicker truncate">ZBE Power Engineering</p>
              <p className="truncate text-sm text-black/70">
                {manager ? "Site desk — assigned jobs only" : "Central operations"}
              </p>
            </div>
            {pending > 0 ? (
              <Link
                href="/approvals"
                className="shrink-0 bg-yellow px-2 py-1 font-mono text-[0.7rem] text-black lg:hidden"
              >
                {pending}
              </Link>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:flex-wrap">
            <select
              className="field min-w-[9.5rem] flex-1 bg-white sm:flex-none sm:min-w-[10rem]"
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
              className="field min-w-[11rem] flex-1 bg-white sm:flex-none sm:min-w-[12rem]"
              value={store.session.userId}
              onChange={(e) => switchUser(e.target.value)}
            >
              {store.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role === "site_manager" ? "site" : "ops"}
                </option>
              ))}
            </select>
            <span className="hidden items-center font-mono text-[0.7rem] text-black/45 lg:inline">
              {user.id}
            </span>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="h-4 w-5" viewBox="0 0 20 12" fill="none" aria-hidden>
      <path d="M0 1h20M0 6h20M0 11h20" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
