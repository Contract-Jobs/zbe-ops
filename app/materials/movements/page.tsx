"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { useInventoryMovements } from "@/hooks/use-inventory-movements";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import { useInventoryNodeMap } from "@/hooks/use-inventories";
import { QUANTITY_MOVEMENT_LABELS } from "@/lib/movement-labels";
import type { QuantityMovementType } from "@/types/api";

const MOVEMENT_TYPES = Object.keys(QUANTITY_MOVEMENT_LABELS) as QuantityMovementType[];

export default function InventoryMovementsPage() {
  const [page, setPage] = useState(1);
  const [movementType, setMovementType] = useState<string>("");

  const { data: movementsData, isLoading } = useInventoryMovements({
    page,
    limit: 10,
    movementType: (movementType || undefined) as QuantityMovementType | undefined,
  });
  // Flat browse — no itemId→name join on the list response, pull the whole
  // quantity-tracked catalog once instead (same hard-50 cap used elsewhere).
  // Covers both materials and bulk equipment — this endpoint carries both.
  const { data: itemsData } = useInventoryItems({ limit: 50 });
  const { byId: nodeById } = useInventoryNodeMap();

  const itemById = useMemo(() => {
    const map = new Map<string, { name: string; unit: string }>();
    for (const it of itemsData?.data ?? []) map.set(it.id, { name: it.name, unit: it.unit });
    return map;
  }, [itemsData]);

  const locationLabel = (nodeId: string | null) => (nodeId ? nodeById.get(nodeId)?.name ?? "Unknown" : "—");
  const movements = movementsData?.data ?? [];

  return (
    <div>
      <PageHead kicker="Stock" title="Inventory Movements" />
      <p className="mb-6 max-w-xl text-black/65">
        Every material and bulk-equipment movement across the whole catalog — flat, not scoped to one item.
      </p>

      <select
        className="field mb-5 w-full max-w-sm"
        value={movementType}
        onChange={(e) => {
          setMovementType(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All movement types</option>
        {MOVEMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {QUANTITY_MOVEMENT_LABELS[t]}
          </option>
        ))}
      </select>

      {isLoading && !movementsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading inventory movements...</div>
      ) : (
        <TableWrap pagination={movementsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Type</th>
                <th>Qty</th>
                <th className="hidden sm:table-cell">From / To</th>
                <th>Unit Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const item = itemById.get(m.itemId);
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{day(m.movementDate)}</td>
                    <td>
                      <Link href={`/materials/${m.itemId}`} className="font-medium hover:text-yellow">
                        {item?.name ?? m.itemId}
                      </Link>
                    </td>
                    <td>
                      <Stamp value={QUANTITY_MOVEMENT_LABELS[m.movementType]} />
                    </td>
                    <td className="font-mono">
                      {m.quantity} {item?.unit ?? ""}
                    </td>
                    <td className="hidden text-sm sm:table-cell">
                      {locationLabel(m.sourceInventoryId)} → {locationLabel(m.destinationInventoryId)}
                    </td>
                    <td className="font-mono text-sm">{etb(m.unitCost)}</td>
                    <td>
                      {m.isReversed ? (
                        <Stamp value="reversed" tone="bad" />
                      ) : m.isReversal ? (
                        <Stamp value="reversal" tone="yellow" />
                      ) : (
                        <Stamp value="posted" tone="ok" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-black/45">
                    No inventory movements found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
