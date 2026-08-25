"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MaterialForm } from "@/components/forms/material";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, Stamp, TableWrap, type RecordMode } from "@/components/ui";
import { qty } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import type { Material } from "@/lib/types";

export default function MaterialsPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<RecordMode<Material>>(closedMode);
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
      <PageHead
        kicker="Catalog"
        title="Materials"
        action={canMutate ? <RecordActions newLabel="New material" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Catalog" title="New material" onClose={() => setMode(closedMode())}>
          <MaterialForm onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Catalog" title="Edit material" onClose={() => setMode(closedMode())}>
          <MaterialForm initial={mode.record} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
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
              {canMutate ? <th></th> : null}
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
                {canMutate ? (
                  <td>
                    <RecordActions
                      onEdit={() => setMode({ kind: "edit", record: m })}
                      onDelete={() => setMode({ kind: "delete", record: m, label: m.name })}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <DeleteConfirm mode={mode} restore onClose={() => setMode(closedMode())} />
    </div>
  );
}
