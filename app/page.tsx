"use client";

import { siteSpend, useStore, visibleSites } from "@/lib/store";
import { etb } from "@/lib/format";
import { PageHead, Stamp, statusTone } from "@/components/ui";
import Link from "next/link";

export default function BoardPage() {
  const store = useStore();
  const sites = visibleSites(store);
  const pending = store.approvals.filter((a) => a.status === "pending");
  const onLoan = store.equipment.filter((e) => e.isOnLoan);
  const maintenance = store.equipment.filter((e) => e.status === "maintenance");
  const spend = store.transactions.filter((t) => !t.isReversal && t.type === "money_out").reduce((s, t) => s + t.amount, 0);
  const income = store.transactions.filter((t) => !t.isReversal && t.type === "money_in").reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <PageHead kicker="Today" title="Yard and site board" />

      <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending approvals" value={String(pending.length)} href="/approvals" />
        <Stat label="Money out (posted)" value={etb(spend)} href="/ledger" />
        <Stat label="Money in (posted)" value={etb(income)} href="/ledger" />
        <Stat label="Plant on loan" value={String(onLoan.length)} href="/equipment" />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="kicker mb-3">Budget health</p>
          <table className="data">
            <thead>
              <tr>
                <th>Site</th>
                <th>Labor</th>
                <th>Material</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const s = siteSpend(site.id, store);
                return (
                  <tr key={site.id}>
                    <td>
                      <Link href={`/sites/${site.id}`} className="font-medium hover:text-yellow">
                        {site.name}
                      </Link>
                      <div className="mt-1">
                        <Stamp value={site.status} tone={statusTone(site.status)} />
                      </div>
                    </td>
                    <td className="font-mono text-sm">
                      {etb(s.labor)}
                      <span className="block text-[0.7rem] text-black/45">of {etb(site.laborBudget)}</span>
                      <Bar used={s.labor} max={site.laborBudget} />
                    </td>
                    <td className="font-mono text-sm">
                      {etb(s.material)}
                      <span className="block text-[0.7rem] text-black/45">of {etb(site.materialBudget)}</span>
                      <Bar used={s.material} max={site.materialBudget} />
                    </td>
                    <td className="text-right text-black/50">{etb(s.out)} out</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <p className="kicker mb-3">Waiting on you</p>
          <ul className="border border-black/10">
            {pending.slice(0, 6).map((a) => (
              <li key={a.id} className="border-b border-black/10 last:border-0">
                <Link href={`/approvals/${a.id}`} className="block border-l-2 border-yellow px-4 py-3 hover:bg-paper/50">
                  <p className="text-sm font-medium leading-snug">{a.summary}</p>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-black/45">
                    {a.approvalType.replaceAll("_", " ")}
                  </p>
                </Link>
              </li>
            ))}
            {pending.length === 0 ? (
              <li className="px-4 py-8 text-center text-black/45">Queue is clear.</li>
            ) : null}
          </ul>
          {maintenance.length > 0 ? (
            <p className="mt-6 text-sm text-black/70">
              In the shop: {maintenance.map((e) => e.name).join(", ")}.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="block bg-white p-5 hover:bg-paper/60">
      <p className="kicker">{label}</p>
      <p className="mt-3 text-[1.85rem] tracking-[-0.04em]">{value}</p>
    </Link>
  );
}

function Bar({ used, max }: { used: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <span className="mt-1 block h-1 w-28 bg-black/10">
      <span className="block h-1 bg-yellow" style={{ width: `${pct}%` }} />
    </span>
  );
}
