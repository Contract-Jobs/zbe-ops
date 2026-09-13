"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MaterialForm } from "@/components/forms/material";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, Stamp, TableWrap, type RecordMode } from "@/components/ui";
import { qty } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useMaterials, useDeleteMaterial } from "@/hooks/use-materials";
import type { MaterialCatalog } from "@/types/api";

export default function MaterialsPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<RecordMode<MaterialCatalog>>(closedMode);

  const { data: materialsData, isLoading } = useMaterials();
  const deleteMutation = useDeleteMaterial();

  const materialsList = materialsData ? materialsData.data : (store.materials as unknown as MaterialCatalog[]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return materialsList
      .filter((m) => !m.deletedAt)
      .filter((m) => (term ? m.name.toLowerCase().includes(term) : true))
      .map((m) => ({
        ...m,
        // Quantity from store balances until inventory is wired on this page
        total: store.balances.filter((b) => b.catalogId === m.id).reduce((s, b) => s + b.quantity, 0),
      }));
  }, [q, store.balances, materialsList]);

  async function handleDelete() {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
      } catch {
        // Handle silently
      }
    }
  }

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
      {isLoading && !materialsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading materials...</div>
      ) : (
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
      )}
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDelete}
      />
    </div>
  );
}
