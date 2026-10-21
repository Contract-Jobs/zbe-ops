"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap } from "@/components/ui";
import { day, etb, qtyNum } from "@/lib/format";
import { useInventoryMovements } from "@/hooks/use-inventory-movements";
import { useInventoryItemsInBulk } from "@/hooks/use-inventory-items";
import { useInventoriesInBulk } from "@/hooks/use-inventories";
import { QUANTITY_MOVEMENT_LABELS } from "@/lib/movement-labels";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { ListToolbar } from "@/components/ListToolbar";
import { SortSelect, type SortState } from "@/components/SortSelect";
import type { QuantityMovementType } from "@/types/api";

type MovementSortBy =
  | "movementDate"
  | "createdAt"
  | "quantity"
  | "unitCost"
  | "totalCost"
  | "paidAmount"
  | "saleStatus"
  | "clientName";

const MOVEMENT_SORT_OPTIONS: { value: MovementSortBy; label: string }[] = [
  { value: "movementDate", label: "Date" },
  { value: "createdAt", label: "Created" },
  { value: "quantity", label: "Quantity" },
  { value: "unitCost", label: "Unit cost" },
  { value: "totalCost", label: "Total cost" },
  { value: "paidAmount", label: "Paid amount" },
  { value: "saleStatus", label: "Payment status" },
  { value: "clientName", label: "Buyer" },
];

export default function InventoryMovementsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<QueryFilterValues>({});

  const [sort, setSort] = useState<SortState<MovementSortBy>>({ sortBy: "movementDate", sortOrder: "desc" });

  const { data: movementsData, isLoading } = useInventoryMovements({
    page,
    limit: 10,
    ...sort,
    movementType: (filters.movementType || undefined) as QuantityMovementType | undefined,
    isInternal: filters.isInternal || undefined,
    isMarkedPaid: filters.isMarkedPaid || undefined,
    buyerSiteId: filters.buyerSiteId || undefined,
  });

  const movements = movementsData?.data ?? [];

  const itemIds = useMemo(() => {
    return Array.from(new Set(movements.map((m) => m.itemId).filter(Boolean)));
  }, [movements]);

  const inventoryIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of movements) {
      if (m.sourceInventoryId) ids.push(m.sourceInventoryId);
      if (m.destinationInventoryId) ids.push(m.destinationInventoryId);
    }
    return Array.from(new Set(ids));
  }, [movements]);

  const { data: itemsData } = useInventoryItemsInBulk(itemIds);
  const { data: inventoriesData } = useInventoriesInBulk(inventoryIds);

  const itemById = useMemo(() => {
    const map = new Map<string, { name: string; unit: string }>();
    for (const it of itemsData?.data ?? []) map.set(it.id, { name: it.name, unit: it.unit });
    return map;
  }, [itemsData]);

  const nodeById = useMemo(() => {
    const map = new Map<string, { kind: "site" | "warehouse"; name: string }>();
    for (const node of inventoriesData?.data ?? []) {
      const name = node.site?.name ?? node.warehouse?.name ?? "Unknown";
      map.set(node.id, { kind: node.inventoryType, name });
    }
    return map;
  }, [inventoriesData]);

  const locationLabel = (nodeId: string | null) => (nodeId ? nodeById.get(nodeId)?.name ?? "Unknown" : "—");

  return (
    <div>
      <PageHead kicker="Stock" title="Inventory Movements" />
      <p className="mb-6 max-w-xl text-black/65">
        Every material and bulk-equipment movement across the whole catalog — flat, not scoped to one item.
      </p>

      <ListToolbar
        sort={
          <SortSelect
            options={MOVEMENT_SORT_OPTIONS}
            value={sort}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      >
        <QueryFilters
          className="contents"
          popover
          pinned={["movementType"]}
          fields={["movementType", "isInternal", "buyerSiteId", "isMarkedPaid"]}
          values={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
      </ListToolbar>

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
                      {qtyNum(m.quantity)} {item?.unit ?? ""}
                    </td>
                    <td className="hidden text-sm sm:table-cell">
                      {locationLabel(m.sourceInventoryId)} →{" "}
                      {m.buyerSiteId ? (
                        <>
                          <Link href={`/sites/${m.buyerSiteId}`} className="hover:text-yellow">
                            {m.clientName ?? "Site"}
                          </Link>{" "}
                          <Stamp value="site sale" tone="yellow" />
                        </>
                      ) : (
                        locationLabel(m.destinationInventoryId)
                      )}
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
