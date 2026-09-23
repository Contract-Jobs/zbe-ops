"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { useEquipmentMovements } from "@/hooks/use-equipment-movements";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useInventoryNodeMap } from "@/hooks/use-inventories";
import { EQUIPMENT_MOVEMENT_LABELS } from "@/lib/movement-labels";
import type { EquipmentMovementType } from "@/types/api";

const MOVEMENT_TYPES = Object.keys(EQUIPMENT_MOVEMENT_LABELS) as EquipmentMovementType[];

export default function EquipmentMovementsPage() {
  const [page, setPage] = useState(1);
  const [movementType, setMovementType] = useState<string>("");

  const { data: movementsData, isLoading } = useEquipmentMovements({
    page,
    limit: 10,
    movementType: (movementType || undefined) as EquipmentMovementType | undefined,
  });
  // Flat browse — no itemId→identifier join on the list response, pull the
  // whole equipment catalog once instead (same hard-50 cap used elsewhere).
  const { data: equipmentData } = useEquipmentList({ limit: 50 });
  const { byId: nodeById } = useInventoryNodeMap();

  const identifierById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of equipmentData?.data ?? []) map.set(e.id, e.identifier);
    return map;
  }, [equipmentData]);

  const locationLabel = (nodeId: string | null) => (nodeId ? nodeById.get(nodeId)?.name ?? "Unknown" : "—");
  const movements = movementsData?.data ?? [];

  return (
    <div>
      <PageHead kicker="Plant" title="Equipment Movements" />
      <p className="mb-6 max-w-xl text-black/65">
        Every equipment movement across every asset — flat, not scoped to one piece of equipment.
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
            {EQUIPMENT_MOVEMENT_LABELS[t]}
          </option>
        ))}
      </select>

      {isLoading && !movementsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading equipment movements...</div>
      ) : (
        <TableWrap pagination={movementsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Equipment</th>
                <th>Type</th>
                <th className="hidden sm:table-cell">From / To</th>
                <th>Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{day(m.movementDate)}</td>
                  <td>
                    <Link href={`/equipment/${m.individualItemId}`} className="font-medium hover:text-yellow">
                      {identifierById.get(m.individualItemId) ?? m.individualItemId}
                    </Link>
                  </td>
                  <td>
                    <Stamp value={EQUIPMENT_MOVEMENT_LABELS[m.movementType]} />
                  </td>
                  <td className="hidden text-sm sm:table-cell">
                    {locationLabel(m.sourceInventoryId)} → {locationLabel(m.destinationInventoryId)}
                  </td>
                  <td className="font-mono text-sm">{m.movementCost ? etb(Number(m.movementCost)) : "—"}</td>
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
              ))}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-black/45">
                    No equipment movements found.
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
