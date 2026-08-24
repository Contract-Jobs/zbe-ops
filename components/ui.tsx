import type { ReactNode } from "react";
import Link from "next/link";
import { stamp } from "@/lib/format";

export function PageHead({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="mt-2 text-[2rem] font-normal leading-none tracking-[-0.04em]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Stamp({
  value,
  tone = "ink",
}: {
  value: string;
  tone?: "ink" | "ok" | "warn" | "bad" | "yellow";
}) {
  const cls = {
    ink: "border-black/25 text-black/70",
    ok: "border-ok/40 text-ok",
    warn: "border-warn/40 text-warn",
    bad: "border-bad/40 text-bad",
    yellow: "border-yellow bg-yellow/15 text-black",
  }[tone];
  return (
    <span className={`inline-block border px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em] ${cls}`}>
      {stamp(value)}
    </span>
  );
}

export function statusTone(status: string): "ink" | "ok" | "warn" | "bad" | "yellow" {
  if (["active", "available", "completed", "approved", "won", "money_in"].includes(status)) return "ok";
  if (["pending", "claimed", "submitted", "draft", "on_hold", "maintenance", "rented_in", "rented_out"].includes(status))
    return "yellow";
  if (["closed", "lost", "sold", "disposed", "rejected", "missing"].includes(status)) return "bad";
  if (["deployed", "open"].includes(status)) return "warn";
  return "ink";
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-black/20 px-4 py-10 text-center text-black/50">{children}</p>;
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium hover:text-yellow">
      {children}
    </Link>
  );
}
