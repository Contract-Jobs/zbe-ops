"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHead, TableWrap, Stamp, ModalPanel, Tabs } from "@/components/ui";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useInventoryNode, useInventoryMaterials, useInventoryIndividualEquipment, useInventoryBulkEquipment } from "@/hooks/use-inventories";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { BulkEquipmentMovementForm } from "@/components/forms/bulk-equipment-movement";
import { InventoryAdjustForm } from "@/components/forms/inventory-adjust";
import { BalanceHistoryPanel } from "@/components/BalanceHistory";
import type { QuantityMovementType } from "@/types/api";

export default function InventoryLocationPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSites = visibleSiteIds(store);

  const { data: nodeData, isLoading: isLocLoading } = useInventoryNode(id);
  const node = nodeData?.data;

  const [matPage, setMatPage] = useState(1);
  const { data: materialsData, isLoading: isMatLoading } = useInventoryMaterials(id, { page: matPage, limit: 10 });

  const [eqPage, setEqPage] = useState(1);
  const { data: equipmentData, isLoading: isEqLoading } = useInventoryIndividualEquipment(id, { page: eqPage, limit: 10 });
  const [bulkEqPage, setBulkEqPage] = useState(1);
  const { data: bulkEquipmentData, isLoading: isBulkEqLoading } = useInventoryBulkEquipment(id, { page: bulkEqPage, limit: 10 });

  const locationName = node?.site?.name ?? node?.warehouse?.name ?? "Unknown Location";
  const locationType = node?.inventoryType ?? "unknown";
  const refId = node?.site?.id ?? node?.warehouse?.id;

  const canMutate = manager && locationType === "warehouse"
    ? false
    : manager && locationType === "site" && refId
      ? allowedSites.has(refId)
      : true; // Admin can mutate anything

  const [moveMaterialId, setMoveMaterialId] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState<{ itemId: string; materialName: string; unit: string; currentQuantity: number } | null>(null);
  const [moveEquipmentId, setMoveEquipmentId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ itemId: string; itemName: string; unit: string } | null>(null);
  const [purchaseMaterialOpen, setPurchaseMaterialOpen] = useState(false);
  const [purchaseEquipmentOpen, setPurchaseEquipmentOpen] = useState(false);
  const [purchaseBulkEquipmentOpen, setPurchaseBulkEquipmentOpen] = useState(false);
  const [tab, setTab] = useState<"materials" | "bulk" | "equipment">("materials");

  const mats = materialsData?.data ?? [];
  const eqs = equipmentData?.data ?? [];
  const bulkEqs = bulkEquipmentData?.data ?? [];

  if (isLocLoading && !nodeData) {
    return <p className="p-8 text-center text-sm text-black/50">Loading location inventory...</p>;
  }

  if (locationType === "unknown" || !refId) {
    return <p className="p-8 text-center text-sm text-black/50">Location not found or access restricted.</p>;
  }

  const matActions: QuantityMovementType[] = locationType === "warehouse"
    ? ["transfer", "sale", "consume", "loss"]
    : ["transfer", "consume", "loss"];

  const eqActions = (locationType === "warehouse"
    ? ["transfer", "sale", "degrade", "send_to_maintenance", "return_from_maintenance", "dispose"]
    : ["transfer", "degrade", "send_to_maintenance", "return_from_maintenance", "dispose"]) as ("transfer" | "sale" | "degrade" | "send_to_maintenance" | "return_from_maintenance" | "dispose")[];

  return (
    <div>
      <PageHead kicker="Inventory Detail" title={locationName} />
      <p className="mb-8 font-mono text-[0.7rem] uppercase tracking-wider text-black/40">
        {locationType} • {id}
      </p>

      <Tabs
        tabs={[
          { id: "materials", label: "Materials", count: materialsData?.pagination?.total },
          { id: "bulk", label: "Bulk Equipment", count: bulkEquipmentData?.pagination?.total },
          { id: "equipment", label: "Equipment", count: equipmentData?.pagination?.total },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === "materials" ? (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="kicker">Inventory Balances</p>
          {canMutate && (
            <button className="btn btn-ghost" onClick={() => setPurchaseMaterialOpen(true)}>Purchase material</button>
          )}
        </div>
        {isMatLoading && !materialsData ? (
          <div className="p-8 text-center text-sm text-black/40">Loading...</div>
        ) : mats.length > 0 ? (
          <TableWrap pagination={materialsData?.pagination} onPageChange={setMatPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="text-left">Quantity</th>
                  <th className="text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {mats.map((m) => (
                  <tr key={m.itemId}>
                    <td>
                      <p className="font-medium">{m.itemName}</p>
                    </td>
                    <td className="font-mono text-left min-w-[120px]">
                      {m.quantity} {m.unit}
                    </td>
                    <td className="text-left">
                      {canMutate && (
                        <span className="inline-block">
                          <button className="text-xs text-black/50 hover:text-black hover:underline" onClick={() => setMoveMaterialId(m.itemId)}>Move</button>
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
            No materials recorded at this location.
          </div>
        )}
      </div>
      ) : null}

      {tab === "bulk" ? (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="kicker">Bulk Equipment</p>
          {canMutate && (
            <button className="btn btn-ghost" onClick={() => setPurchaseBulkEquipmentOpen(true)}>Purchase Bulk Equipment</button>
          )}
        </div>
        {isBulkEqLoading && !bulkEquipmentData ? (
          <div className="p-8 text-center text-sm text-black/40">Loading...</div>
        ) : bulkEqs.length > 0 ? (
          <TableWrap pagination={bulkEquipmentData?.pagination} onPageChange={setBulkEqPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th className="text-left">Quantity</th>
                  <th className="text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {bulkEqs.map((b) => (
                  <tr key={b.itemId}>
                    <td>
                      <p className="font-medium">{b.itemName}</p>
                    </td>
                    <td className="font-mono text-left min-w-[120px]">
                      {b.quantity} {b.unit}
                    </td>
                    <td className="text-left">
                      {canMutate && (
                        <span className="inline-block">
                          <button className="text-xs text-black/50 hover:text-black hover:underline" onClick={() => setMoveMaterialId(b.itemId)}>Move</button>
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
            No bulk equipment recorded at this location.
          </div>
        )}
      </div>
      ) : null}

      {tab === "equipment" ? (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="kicker">Parked Equipment</p>
          {canMutate && (
            <button className="btn btn-ghost" onClick={() => setPurchaseEquipmentOpen(true)}>Purchase equipment</button>
          )}
        </div>
        {isEqLoading && !equipmentData ? (
          <div className="p-8 text-center text-sm text-black/40">Loading...</div>
        ) : eqs.length > 0 ? (
          <TableWrap pagination={equipmentData?.pagination} onPageChange={setEqPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Assignment</th>
                  <th>Condition</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eqs.map((e) => (
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
                    <td className="text-sm capitalize items-center min-w-[140px]">
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
            No equipment parked at this location.
          </div>
        )}
      </div>
      ) : null}

      {moveMaterialId ? (
        <ModalPanel kicker={`${locationType} Inventory`} title="Move Material" onClose={() => setMoveMaterialId(null)}>
          <MaterialMovementForm
            materialId={moveMaterialId}
            noBg
            fixedSource={{ id: refId, type: locationType as "site" | "warehouse", name: locationName }}
            allowedActions={matActions}
            onSuccess={() => setMoveMaterialId(null)}
            onCancel={() => setMoveMaterialId(null)}
          />
        </ModalPanel>
      ) : null}

      {moveEquipmentId ? (
        <ModalPanel kicker={`${locationType} Equipment`} title="Move Equipment" onClose={() => setMoveEquipmentId(null)}>
          <EquipmentMovementForm
            noBg
            equipmentId={moveEquipmentId}
            allowedActions={eqActions}
            onSuccess={() => setMoveEquipmentId(null)}
            onCancel={() => setMoveEquipmentId(null)}
          />
        </ModalPanel>
      ) : null}

      {purchaseMaterialOpen ? (
        <ModalPanel kicker={`${locationType} Inventory`} title="Purchase Material" onClose={() => setPurchaseMaterialOpen(false)}>
          <MaterialMovementForm
            noBg
            fixedDestination={{ id: refId, type: locationType as "site" | "warehouse", name: locationName }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseMaterialOpen(false)}
            onCancel={() => setPurchaseMaterialOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {purchaseBulkEquipmentOpen ? (
        <ModalPanel kicker={`${locationType} Inventory`} title="Purchase Bulk Equipment" onClose={() => setPurchaseBulkEquipmentOpen(false)}>
          <BulkEquipmentMovementForm
            noBg
            fixedDestination={{ id: refId, type: locationType as "site" | "warehouse", name: locationName }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseBulkEquipmentOpen(false)}
            onCancel={() => setPurchaseBulkEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {purchaseEquipmentOpen ? (
        <ModalPanel kicker={`${locationType} Equipment`} title="Purchase Equipment" onClose={() => setPurchaseEquipmentOpen(false)}>
          <EquipmentMovementForm
            noBg
            fixedDestination={{ id: refId, type: locationType as "site" | "warehouse", name: locationName }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseEquipmentOpen(false)}
            onCancel={() => setPurchaseEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {adjustBalance ? (
        <ModalPanel kicker="Inventory Detail" title="Report Loss" onClose={() => setAdjustBalance(null)}>
          <InventoryAdjustForm
            noBg
            itemId={adjustBalance.itemId}
            inventoryId={id ?? ""}
            materialName={adjustBalance.materialName}
            unit={adjustBalance.unit}
            currentQuantity={adjustBalance.currentQuantity}
            onSuccess={() => setAdjustBalance(null)}
            onCancel={() => setAdjustBalance(null)}
          />
        </ModalPanel>
      ) : null}

      {historyTarget ? (
        <ModalPanel wide kicker="Inventory Detail" title="Movement history" onClose={() => setHistoryTarget(null)}>
          <BalanceHistoryPanel
            itemId={historyTarget.itemId}
            inventoryId={id ?? ""}
            itemName={historyTarget.itemName}
            unit={historyTarget.unit}
          />
        </ModalPanel>
      ) : null}
    </div>
  );
}
