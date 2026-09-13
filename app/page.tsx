"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useApprovals } from "@/hooks/use-approvals";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useTransactions } from "@/hooks/use-transactions";
import { useSites } from "@/hooks/use-sites";
import type { Approval, Equipment, Site, Transaction } from "@/types/api";

export default function BoardPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSiteIds = visibleSiteIds(store);

  const { data: approvalsData } = useApprovals({ status: ["pending"] });
  const { data: equipmentData } = useEquipmentList();
  const { data: transactionsData } = useTransactions();
  const { data: sitesData } = useSites();

  const sites = useMemo(() => {
    const list = sitesData?.data ?? (store.sites as unknown as Site[]);
    return list
      .filter((s) => !s.deletedAt)
      .filter((s) => (manager ? allowedSiteIds.has(s.id) : true));
  }, [allowedSiteIds, manager, sitesData?.data, store.sites]);

  const pending = useMemo(() => {
    const list = approvalsData?.data ?? (store.approvals as unknown as Approval[]);
    return list.filter((a) => a.status === "pending");
  }, [approvalsData?.data, store.approvals]);

  const equipment = useMemo(() => {
    const list = equipmentData?.data ?? (store.equipment as unknown as Equipment[]);
    return list.filter((e) => !e.deletedAt);
  }, [equipmentData?.data, store.equipment]);

  const onLoan = useMemo(() => {
    return equipment.filter((e) => (e as unknown as { isOnLoan?: boolean }).isOnLoan);
  }, [equipment]);

  const maintenance = useMemo(() => {
    return equipment.filter(
      (e) => e.currentStatus === "maintenance" || (e as unknown as { status?: string }).status === "maintenance"
    );
  }, [equipment]);

  const transactions = useMemo(() => {
    return transactionsData?.data ?? (store.transactions as unknown as Transaction[]);
  }, [transactionsData?.data, store.transactions]);

  const spend = useMemo(() => {
    return transactions
      .filter((t) => !t.isReversal && t.type === "money_out")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const income = useMemo(() => {
    return transactions
      .filter((t) => !t.isReversal && t.type === "money_in")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const getSiteSpend = (siteId: string) => {
    const txs = transactions.filter((t) => t.siteId === siteId && !t.isReversal);
    const out = txs.filter((t) => t.type === "money_out").reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const inn = txs.filter((t) => t.type === "money_in").reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const labor = txs
      .filter((t) => t.type === "money_out" && t.categoryId === "cat_labor")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const material = txs
      .filter((t) => t.type === "money_out" && t.categoryId === "cat_mat")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { out, inn, labor, material };
  };

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
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Labor</th>
                  <th>Material</th>
                  <th className="hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const s = getSiteSpend(site.id);
                  const laborBudget = Number(site.laborBudget) || 0;
                  const materialBudget = Number(site.materialBudget) || 0;

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
                        <span className="block text-[0.7rem] text-black/45">of {etb(laborBudget)}</span>
                        <Bar used={s.labor} max={laborBudget} />
                      </td>
                      <td className="font-mono text-sm">
                        {etb(s.material)}
                        <span className="block text-[0.7rem] text-black/45">of {etb(materialBudget)}</span>
                        <Bar used={s.material} max={materialBudget} />
                      </td>
                      <td className="hidden text-right text-black/50 sm:table-cell">{etb(s.out)} out</td>
                    </tr>
                  );
                })}
                {sites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-black/45">
                      No active sites found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section>
          <p className="kicker mb-3">Waiting on you</p>
          <ul className="border border-black/10">
            {pending.slice(0, 6).map((a) => {
              const summary = (a as unknown as { summary?: string }).summary ??
                (a.notes || `${a.approvalType.replaceAll("_", " ")} #${a.recordId?.slice(0, 8) ?? a.id.slice(0, 8)}`);

              return (
                <li key={a.id} className="border-b border-black/10 last:border-0">
                  <Link href={`/approvals/${a.id}`} className="block border-l-2 border-yellow px-4 py-3 hover:bg-paper/50">
                    <p className="text-sm font-medium leading-snug">{summary}</p>
                    <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-black/45">
                      {a.approvalType.replaceAll("_", " ")}
                    </p>
                  </Link>
                </li>
              );
            })}
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
      <p className="mt-3 break-words text-[1.45rem] tracking-[-0.04em] sm:text-[1.85rem]">{value}</p>
    </Link>
  );
}

function Bar({ used, max }: { used: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <span className="mt-1 block h-1 w-full max-w-28 bg-black/10">
      <span className="block h-1 bg-yellow" style={{ width: `${pct}%` }} />
    </span>
  );
}

