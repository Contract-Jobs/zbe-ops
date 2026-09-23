"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfirmDialog, PageHead, TableWrap } from "@/components/ui";
import { currentUser, isSiteManager, useStore } from "@/lib/store";
import { useInventoryNodes } from "@/hooks/use-inventories";
import { useRebuildInventoryBalances } from "@/hooks/use-inventory-balances";

export default function InventoryPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const isSuperadmin = currentUser(store).role === "superadmin";
  const [q, setQ] = useState("");
  const rebuildBalancesMutation = useRebuildInventoryBalances();
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const handleRebuildBalances = async () => {
    setRebuildMsg(null);
    try {
      const res = await rebuildBalancesMutation.mutateAsync();
      setRebuildMsg(`Rebuilt ${res.data.rebuilt} balance(s).${res.data.errors.length ? ` ${res.data.errors.length} error(s).` : ""}`);
    } catch (e) {
      setRebuildMsg(e instanceof Error ? e.message : "Failed to rebuild balances");
    } finally {
      setConfirmRebuild(false);
    }
  };

  const { data: nodesData, isLoading } = useInventoryNodes({ limit: 50 });

  const locations = useMemo(() => {
    return (nodesData?.data ?? []).map((node) => ({
      id: node.id,
      name: node.site?.name ?? node.warehouse?.name ?? "Unknown",
      type: node.inventoryType,
      materialItemCount: node.materialItemCount ?? 0,
      bulkEquipmentItemCount: node.bulkEquipmentItemCount ?? 0,
      individualEquipmentCount: node.individualEquipmentCount ?? 0,
    }));
  }, [nodesData]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter((l) => l.name.toLowerCase().includes(term));
  }, [locations, q]);

  return (
    <div>
      <PageHead
        kicker="Stock"
        title="Inventory Locations"
        action={
          isSuperadmin ? (
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmRebuild(true)}
              disabled={rebuildBalancesMutation.isPending}
            >
              {rebuildBalancesMutation.isPending ? "Rebuilding..." : "Rebuild balances"}
            </button>
          ) : undefined
        }
      />
      {manager ? (
        <p className="mb-4 text-sm text-black/60">Site desk shows only stock on your jobs — not central warehouses.</p>
      ) : null}
      {rebuildMsg ? <p className="mb-4 text-sm text-black/60">{rebuildMsg}</p> : null}
      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Search locations"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading && !nodesData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading inventory locations...</div>
      ) : (
        <TableWrap data={rows}>
          {(pageRows) => (
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Material Items</th>
                  <th>Bulk Equipment Items</th>
                  <th>Equipment</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/inventory/${l.id}`} className="font-medium hover:text-yellow">
                        {l.name}
                      </Link>
                    </td>
                    <td className="font-mono text-[0.7rem] uppercase text-black/50">{l.type}</td>
                    <td className="font-mono">{l.materialItemCount}</td>
                    <td className="font-mono">{l.bulkEquipmentItemCount}</td>
                    <td className="font-mono">{l.individualEquipmentCount}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-black/45">
                      No locations found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}

      <ConfirmDialog
        open={confirmRebuild}
        title="Rebuild all inventory balances?"
        body="Recomputes every (item, inventory) balance from the movement ledger from scratch. Heavy — a recovery tool, not routine maintenance."
        confirmLabel="Rebuild"
        danger
        loading={rebuildBalancesMutation.isPending}
        onCancel={() => setConfirmRebuild(false)}
        onConfirm={handleRebuildBalances}
      />
    </div>
  );
}
