"use client";

import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, logManualTx, useStore, visibleSiteIds } from "@/lib/store";
import type { TxType } from "@/lib/types";

export default function LedgerPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const sites = visibleSiteIds(store);
  const [type, setType] = useState<TxType>("money_out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [siteId, setSiteId] = useState("");
  const [categoryId, setCategoryId] = useState(store.categories[0]?.id ?? "");
  const [licenseId, setLicenseId] = useState(store.licenses[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    return store.transactions.filter((t) => {
      if (store.session.licenseId !== "all" && t.licenseId !== store.session.licenseId) return false;
      if (manager) return t.siteId ? sites.has(t.siteId) : false;
      return true;
    });
  }, [manager, sites, store.session.licenseId, store.transactions]);

  const grouped = store.categories.map((c) => ({
    ...c,
    out: rows.filter((t) => t.categoryId === c.id && t.type === "money_out").reduce((s, t) => s + t.amount, 0),
  }));

  return (
    <div>
      <PageHead kicker="Money" title="Ledger" />
      <p className="mb-6 max-w-xl text-black/65">
        Manual income and expense post immediately — they do not wait in Approvals. Stock and plant movements still do, and they write their own lines when approved.
      </p>

      <div className="mb-8 grid gap-px bg-black/10 sm:grid-cols-3 lg:grid-cols-5">
        {grouped.map((c) => (
          <div key={c.id} className="bg-white p-4">
            <p className="kicker">{c.name}</p>
            <p className="mt-2 font-mono text-sm">{etb(c.out)}</p>
          </div>
        ))}
      </div>

      <form
        className="mb-8 grid gap-3 border border-black/10 bg-paper/30 p-5 md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const n = Number(amount);
            if (!n) throw new Error("Amount required");
            logManualTx({
              type,
              amount: n,
              licenseId,
              siteId: siteId || undefined,
              categoryId,
              note: note || "Manual entry",
            });
            setAmount("");
            setNote("");
            setMsg("Posted.");
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Failed");
          }
        }}
      >
        <select className="field" value={type} onChange={(e) => setType(e.target.value as TxType)}>
          <option value="money_out">Money out</option>
          <option value="money_in">Money in</option>
        </select>
        <input className="field" placeholder="Amount ETB" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="field" value={licenseId} onChange={(e) => setLicenseId(e.target.value)}>
          {store.licenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">No site</option>
          {store.sites
            .filter((s) => (manager ? sites.has(s.id) : true))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {store.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn w-full md:w-auto" type="submit">
          Post
        </button>
        <input
          className="field md:col-span-6"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {msg ? <p className="text-sm md:col-span-6">{msg}</p> : null}
      </form>

      <TableWrap>
      <table className="data">
        <thead>
          <tr>
            <th>Date</th>
            <th>Note</th>
            <th className="hidden md:table-cell">Category</th>
            <th className="hidden sm:table-cell">Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="whitespace-nowrap">{day(t.transactionDate)}</td>
              <td className="min-w-0">
                {t.note}
                {t.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
                <span className="mt-1 block sm:hidden">
                  <Stamp value={t.type} tone={statusTone(t.type)} />
                </span>
              </td>
              <td className="hidden md:table-cell">{store.categories.find((c) => c.id === t.categoryId)?.name ?? "—"}</td>
              <td className="hidden sm:table-cell">
                <Stamp value={t.type} tone={statusTone(t.type)} />
              </td>
              <td className="whitespace-nowrap font-mono text-sm">{etb(t.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableWrap>
    </div>
  );
}
