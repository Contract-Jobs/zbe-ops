"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { PageHead, TableWrap, Stamp, ModalPanel, Tabs } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useWarehouse, useWarehouseMaterials, useWarehouseBulkEquipment, useWarehouseIndividualEquipment } from "@/hooks/use-warehouses";
import { useInventoryNodeId } from "@/hooks/use-inventories";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { BulkEquipmentMovementForm } from "@/components/forms/bulk-equipment-movement";
import { InventoryAdjustForm } from "@/components/forms/inventory-adjust";
import { BalanceHistoryPanel } from "@/components/BalanceHistory";
import { isSiteManager } from "@/lib/store";
import type { Warehouse } from "@/types/api";
import { useInventoryAnalytics } from "@/hooks/use-analytics";
import { etb } from "@/lib/format";

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();

  const { data: warehouseData, isLoading: isWarehouseLoading } = useWarehouse(id);
  // Still needed for InventoryAdjustForm's "loss" movement, which requires
  // a real node id — getWarehouseMaterials/getWarehouseEquipments below
  // resolve the node internally and never expose it.
  const { nodeId } = useInventoryNodeId("warehouse", id);
  const [bulkEquipPage, setBulkEquipPage] = useState(1);
  const [equipPage, setEquipPage] = useState(1);
  const { data: bulkEquipData } = useWarehouseBulkEquipment(id, { page: bulkEquipPage, limit: 10, });
  const { data: equipData } = useWarehouseIndividualEquipment(id, { page: equipPage, limit: 10 });
  const { data: inventoryAnalytics } = useInventoryAnalytics({ warehouseId: id });
  const [balPage, setBalPage] = useState(1);
  const { data: materialsData } = useWarehouseMaterials(id, { page: balPage, limit: 10 });

  const warehouse = warehouseData?.data ?? (store.warehouses.find((w) => w.id === id) as unknown as Warehouse | undefined);

  const [moveMaterialId, setMoveMaterialId] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState<{ itemId: string; materialName: string; unit: string; currentQuantity: number } | null>(null);
  const [moveEquipmentId, setMoveEquipmentId] = useState<string | null>(null);
  const [purchaseMaterialOpen, setPurchaseMaterialOpen] = useState(false);
  const [purchaseEquipmentOpen, setPurchaseEquipmentOpen] = useState(false);
  const [purchaseBulkEquipmentOpen, setPurchaseBulkEquipmentOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ itemId: string; itemName: string; unit: string } | null>(null);
  const [tab, setTab] = useState<"materials" | "bulk" | "equipment">("materials");

  const canMutate = !isSiteManager(store);

  if (isWarehouseLoading && !warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Loading warehouse...</p>;
  }

  if (!warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Warehouse not found</p>;
  }

  const equipment = equipData?.data ?? [];
  const bulkEquipment = bulkEquipData?.data ?? [];
  const materials = materialsData?.data ?? [];

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

      {inventoryAnalytics?.data && <div className="grid gap-px bg-black/10 sm:grid-cols-4">
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
        <div className="bg-white p-5">
          <p className="kicker">Total Equipment Value</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(inventoryAnalytics.data.equipmentValue)}</p>
        </div>
      </div>}

      <Tabs
        tabs={[
          { id: "materials", label: "Materials", count: materialsData?.pagination?.total },
          { id: "bulk", label: "Bulk Equipment", count: bulkEquipData?.pagination?.total },
          { id: "equipment", label: "Equipment", count: equipData?.pagination?.total },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === "materials" ? (
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Inventory Balances</h2>
          <button className="btn btn-ghost" onClick={() => setPurchaseMaterialOpen(true)}>Purchase material</button>
        </div>
        {materials.length > 0 ? (
          <TableWrap pagination={materialsData?.pagination} onPageChange={setBalPage}>
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
                {materials.map((m) => (
                  <tr key={m.itemId}>
                    <td>
                      <p className="font-medium">{m.itemName}</p>
                    </td>
                    <td className="font-mono text-left min-w-[120px]">
                      {m.quantity} {m.unit}
                    </td>

                    <td className="font-mono text-left min-w-[120px]">
                      {m.averageUnitValue ? etb(m.averageUnitValue) : "—"}
                    </td>

                    <td>
                      {canMutate && (
                        <span className="inline-block text-left">
                          <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveMaterialId(m.itemId)}>Move</button>
                          <button
                            className="ml-3 text-xs text-blue-600/80 hover:text-black hover:underline"
                            onClick={() => setAdjustBalance({
                              itemId: m.itemId,
                              materialName: m.itemName,
                              unit: m.unit,
                              currentQuantity: m.quantity
                            })}
                          >
                            Report loss
                          </button>
                          <button
                            className="ml-3 text-xs text-black/50 hover:text-black hover:underline"
                            onClick={() => setHistoryTarget({ itemId: m.itemId, itemName: m.itemName, unit: m.unit })}
                          >
                            History
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No stock recorded at this warehouse.
          </div>
        )}
      </div>
      ) : null}

      {tab === "bulk" ? (
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Bulk Equipment</h2>
          <button className="btn btn-ghost" onClick={() => setPurchaseBulkEquipmentOpen(true)}>Purchase Bulk Equipment</button>
        </div>
        {bulkEquipment.length > 0 ? (
          <TableWrap pagination={bulkEquipData?.pagination} onPageChange={setBulkEquipPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th className="text-left">Quantity</th>
                  {canMutate && <th className="text-left">Action</th>}
                </tr>
              </thead>
              <tbody>
                {bulkEquipment.map((b) => (
                  <tr key={b.itemId}>
                    <td>
                      <p className="font-medium">{b.itemName || "-"}</p>
                    </td>
                    <td className="font-mono text-left min-w-[120px]">
                      {b.quantity} {b.unit}
                    </td>
                    <td>
                      {canMutate && (
                        <span className="inline-block text-left">
                          <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveMaterialId(b.itemId)}>Move</button>
                          <button
                            className="ml-3 text-xs text-blue-600/80 hover:text-black hover:underline"
                            onClick={() => setAdjustBalance({
                              itemId: b.itemId,
                              materialName: b.itemName,
                              unit: b.unit,
                              currentQuantity: b.quantity
                            })}
                          >
                            Report loss
                          </button>
                          <button
                            className="ml-3 text-xs text-black/50 hover:text-black hover:underline"
                            onClick={() => setHistoryTarget({ itemId: b.itemId, itemName: b.itemName, unit: b.unit })}
                          >
                            History
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No bulk equipment recorded at this warehouse.
          </div>
        )}
      </div>
      ) : null}

      {tab === "equipment" ? (
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
                  <th>Assignment</th>
                  <th>Condition</th>
                  {canMutate && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {equipment.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <p className="font-medium">{e.identifier}</p>
                      <p className="font-mono text-[0.7rem] text-black/50">{e.vendorName ?? "No vendor"}</p>
                    </td>
                    <td>
                      <Stamp
                        value={e.assignmentStatus}
                        tone={e.assignmentStatus === "idle" ? "ok" : "ink"}
                      />
                    </td>
                    <td className="text-sm capitalize gap-3">
                      {e.condition}
                    </td>
                    <td>

                      {canMutate && (
                        <button className="text-xs text-black/50 hover:text-black hover:underline" onClick={() => setMoveEquipmentId(e.id)}>Move</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No equipment parked at this warehouse.
          </div>
        )}
      </div>
      ) : null}

      {moveMaterialId ? (
        <ModalPanel kicker="Warehouse Inventory" title="Move Material" onClose={() => setMoveMaterialId(null)}>
          <MaterialMovementForm
            noBg
            materialId={moveMaterialId}
            fixedSource={{ id: warehouse.id, type: "warehouse", name: warehouse.name }}
            allowedActions={["transfer", "sale", "consume", "loss"]}
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
            allowedActions={["transfer", "sale", "degrade", "send_to_maintenance", "return_from_maintenance", "dispose"]}
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
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseEquipmentOpen(false)}
            onCancel={() => setPurchaseEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {purchaseBulkEquipmentOpen ? (
        <ModalPanel kicker="Warehouse Inventory" title="Purchase Bulk Equipment" onClose={() => setPurchaseBulkEquipmentOpen(false)}>
          <BulkEquipmentMovementForm
            noBg
            fixedDestination={{ id: warehouse.id, type: "warehouse", name: warehouse.name }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseBulkEquipmentOpen(false)}
            onCancel={() => setPurchaseBulkEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {adjustBalance ? (
        <ModalPanel kicker="Warehouse Inventory" title="Report Loss" onClose={() => setAdjustBalance(null)}>
          <InventoryAdjustForm
            noBg
            itemId={adjustBalance.itemId}
            inventoryId={nodeId ?? ""}
            materialName={adjustBalance.materialName}
            unit={adjustBalance.unit}
            currentQuantity={adjustBalance.currentQuantity}
            onSuccess={() => setAdjustBalance(null)}
            onCancel={() => setAdjustBalance(null)}
          />
        </ModalPanel>
      ) : null}

      {historyTarget ? (
        <ModalPanel wide kicker="Warehouse Inventory" title="Movement history" onClose={() => setHistoryTarget(null)}>
          <BalanceHistoryPanel
            itemId={historyTarget.itemId}
            inventoryId={nodeId ?? ""}
            itemName={historyTarget.itemName}
            unit={historyTarget.unit}
          />
        </ModalPanel>
      ) : null}
    </div>
  );
}
