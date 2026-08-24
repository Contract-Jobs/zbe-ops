"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap } from "@/components/ui";
import { qty } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function MaterialsPage() {
  const store = useStore();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return store.materials
      .filter((m) => !m.deletedAt)
      .filter((m) => (term ? m.name.toLowerCase().includes(term) : true))
      .map((m) => ({
        ...m,
        total: store.balances.filter((b) => b.catalogId === m.id).reduce((s, b) => s + b.quantity, 0),
      }));
  }, [q, store.balances, store.materials]);

  return (
    <div>
      <PageHead kicker="Catalog" title="Materials" />
      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Search catalog"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <TableWrap>
      <table className="data">
        <thead>
          <tr>
            <th>Name</th>
            <th>Unit</th>
            <th className="hidden sm:table-cell">Type</th>
            <th>On hand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>
                <Link href={`/materials/${m.id}`} className="font-medium hover:text-yellow">
                  {m.name}
                </Link>
              </td>
              <td className="font-mono text-sm">{m.unit}</td>
              <td className="hidden sm:table-cell">
                <Stamp value={m.type} />
              </td>
              <td className="font-mono">{qty(m.total, m.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableWrap>
    </div>
  );
}
