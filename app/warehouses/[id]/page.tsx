"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { PageHead, TableWrap, Stamp, FormPanel, ModalPanel } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/hooks/use-warehouses";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useInventoryBalances } from "@/hooks/use-inventory";
import { useMaterials } from "@/hooks/use-materials";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { InventoryAdjustForm } from "@/components/forms/inventory-adjust";
import { isSiteManager } from "@/lib/store";
import type { Warehouse, Equipment, InventoryBalance, MaterialCatalog } from "@/types/api";
import { useInventoryAnalytics } from "@/hooks/use-analytics";
import { etb } from "@/lib/format";

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();

  const { data: warehouseData, isLoading: isWarehouseLoading } = useWarehouse(id);
  const [equipPage, setEquipPage] = useState(1);
  const { data: equipData } = useEquipmentList({ warehouseId: id ? [id] : undefined, page: equipPage, limit: 10 });
  const { data: inventoryAnalytics } = useInventoryAnalytics({ warehouseId: id });
  const [balPage, setBalPage] = useState(1);
  const { data: balancesData } = useInventoryBalances({ warehouseId: id ? [id] : undefined, page: balPage, limit: 10 });
  // const { data: materialsData } = useMaterials({ limit: 300 });

  const warehouse = warehouseData?.data ?? (store.warehouses.find((w) => w.id === id) as unknown as Warehouse | undefined);

  const [moveMaterialId, setMoveMaterialId] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState<{ id: string; materialName: string; unit: string; currentQuantity: number } | null>(null);
  const [moveEquipmentId, setMoveEquipmentId] = useState<string | null>(null);
  const [purchaseMaterialOpen, setPurchaseMaterialOpen] = useState(false);
  const [purchaseEquipmentOpen, setPurchaseEquipmentOpen] = useState(false);

  const canMutate = !isSiteManager(store);

  if (isWarehouseLoading && !warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Loading warehouse...</p>;
  }

  if (!warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Warehouse not found</p>;
  }

  const equipment = equipData?.data ?? store.equipment.filter((e) => e.warehouseId === id && !e.deletedAt);
  const balances = balancesData?.data ?? store.balances.filter(
    (b) => b.locationKind === "warehouse" && b.locationId === id && b.quantity > 0
  );
  const materials = balancesData?.data.map(d => (d as any).material as unknown as MaterialCatalog)

  return (
    <div>
      <PageHead
        kicker="Central"
        title={
          <span className="flex items-baseline gap-4">
            {warehouse.name}
            <Link
              href={`/warehouses/${id}/sold-items`}
              className="text-base! text-[#0072c3]! underline! bg-transparent hover:text-[#005a9c]!"
            >
              See Sold Items
            </Link>
          </span>
        }
      />
      <div className="mb-8">
        <p className="text-black/70">Location: {warehouse.location ?? "—"}</p>
      </div>

      {inventoryAnalytics?.data && <div className="grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="kicker">Total Materials</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{inventoryAnalytics.data.totalMaterials}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Total Equipment</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{inventoryAnalytics.data.totalEquipment}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Total Material Value</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(inventoryAnalytics.data.totalMaterialValue)}</p>
        </div>
      </div>}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Inventory Balances</h2>
          <button className="btn btn-ghost" onClick={() => setPurchaseMaterialOpen(true)}>Purchase material</button>
        </div>
        {balances.length > 0 ? (
          <TableWrap pagination={balancesData?.pagination} onPageChange={setBalPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="text-left">Quantity</th>
                  <th className="text-left">Average Unit Price</th>
                  {canMutate && <th className="text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const m = materials?.find((mat) => mat.id === (b as any).materialId);
                  const key = (b as any).id ?? m?.id;
                  if (!m || !key) return null
                  return (
                    <tr key={key}>
                      <td>
                        <p className="font-medium">{m?.name ?? "Unknown material"}</p>
                      </td>
                      <td className="font-mono text-left min-w-[120px]">
                        {b.quantity} {m?.unit ?? ""}
                      </td>

                      <td className="font-mono text-left min-w-[120px]">
                        {etb((b as any).avgUnitPrice) ?? ""}
                      </td>

                      <td>
                        {canMutate && (
                          <span className="inline-block text-left">
                            <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveMaterialId(m?.id)}>Move</button>
                            <button
                              className="ml-3 text-xs text-blue-600/80 hover:text-black hover:underline"
                              onClick={() => setAdjustBalance({
                                id: (b as any).id ?? "",
                                materialName: m.name,
                                unit: m.unit,
                                currentQuantity: b.quantity
                              })}
                            >
                              Adjust
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No stock recorded at this warehouse.
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Parked Equipment</h2>
          <button className="btn btn-ghost" onClick={() => setPurchaseEquipmentOpen(true)}>Purchase equipment</button>
        </div>
        {equipment.length > 0 ? (
          <TableWrap pagination={equipData?.pagination} onPageChange={setEquipPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Status</th>
                  <th>Ownership</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e) => {
                  const status = (e as any).currentStatus ?? (e as any).status;
                  return (
                    <tr key={e.id}>
                      <td>
                        <p className="font-medium">{e.name}</p>
                        <p className="font-mono text-[0.7rem] text-black/50">{e.serialNumber ?? "No S/N"}</p>
                      </td>
                      <td>
                        <Stamp
                          value={status}
                          tone={status === "working" || status === "available" ? "ok" : status === "repair" || status === "maintenance" ? "bad" : "ink"}
                        />
                      </td>
                      <td className="text-sm capitalize flex items-center justify-between gap-3">
                        {e.ownershipStatus}
                        {canMutate && (
                          <button className="text-xs text-black/50 hover:text-black hover:underline" onClick={() => setMoveEquipmentId(e.id)}>Move</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No equipment parked at this warehouse.
          </div>
        )}
      </div>

      {moveMaterialId ? (
        <ModalPanel kicker="Warehouse Inventory" title="Move Material" onClose={() => setMoveMaterialId(null)}>
          <MaterialMovementForm
            noBg
            materialId={moveMaterialId}
            fixedSource={{ id: warehouse.id, type: "warehouse", name: warehouse.name }}
            allowedActions={["transfer", "sold", "used_up", "missing"]}
            onSuccess={() => setMoveMaterialId(null)}
            onCancel={() => setMoveMaterialId(null)}
          />
        </ModalPanel>
      ) : null}

      {moveEquipmentId ? (
        <ModalPanel kicker="Warehouse Equipment" title="Move Equipment" onClose={() => setMoveEquipmentId(null)}>
          <EquipmentMovementForm
            noBg
            equipmentId={moveEquipmentId}
            fixedSource={{ id: warehouse.id, type: "warehouse", name: warehouse.name }}
            allowedActions={["transferred", "sold", "degraded", "appreciated", "maintenance_dispatch", "maintenance_return", "used_up", "missing"]}
            onSuccess={() => setMoveEquipmentId(null)}
            onCancel={() => setMoveEquipmentId(null)}
          />
        </ModalPanel>
      ) : null}

      {purchaseMaterialOpen ? (
        <ModalPanel kicker="Warehouse Inventory" title="Purchase Material" onClose={() => setPurchaseMaterialOpen(false)}>
          <MaterialMovementForm
            noBg
            fixedDestination={{ id: warehouse.id, type: "warehouse", name: warehouse.name }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseMaterialOpen(false)}
            onCancel={() => setPurchaseMaterialOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {purchaseEquipmentOpen ? (
        <ModalPanel kicker="Warehouse Equipment" title="Purchase Equipment" onClose={() => setPurchaseEquipmentOpen(false)}>
          <EquipmentMovementForm
            noBg
            fixedDestination={{ id: warehouse.id, type: "warehouse", name: warehouse.name }}
            allowedActions={["purchased"]}
            onSuccess={() => setPurchaseEquipmentOpen(false)}
            onCancel={() => setPurchaseEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {adjustBalance ? (
        <ModalPanel kicker="Warehouse Inventory" title="Adjust Balance" onClose={() => setAdjustBalance(null)}>
          <InventoryAdjustForm
            noBg
            balanceId={adjustBalance.id}
            materialName={adjustBalance.materialName}
            unit={adjustBalance.unit}
            currentQuantity={adjustBalance.currentQuantity}
            onSuccess={() => setAdjustBalance(null)}
            onCancel={() => setAdjustBalance(null)}
          />
        </ModalPanel>
      ) : null}
    </div>
  );
}
