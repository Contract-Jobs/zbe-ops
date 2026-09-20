"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHead, TableWrap, Stamp, FormPanel, ModalPanel } from "@/components/ui";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useInventoryLocations, useInventoryLocationMaterials, useInventoryLocationEquipments } from "@/hooks/use-inventory";
import { useMaterials } from "@/hooks/use-materials";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { InventoryAdjustForm } from "@/components/forms/inventory-adjust";
import type { InventoryBalance, Equipment, MaterialCatalog } from "@/types/api";

export default function InventoryLocationPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSites = visibleSiteIds(store);

  const { data: locationsData, isLoading: isLocLoading } = useInventoryLocations();
  const [matPage, setMatPage] = useState(1);
  const { data: materialsData, isLoading: isMatLoading } = useInventoryLocationMaterials(id, { page: matPage, limit: 10 });
  const [eqPage, setEqPage] = useState(1);
  const { data: equipmentsData, isLoading: isEqLoading } = useInventoryLocationEquipments(id, { page: eqPage, limit: 10 });

  console.log(materialsData)
  // Resolve location info
  const locations = locationsData?.data ?? [];
  const locationInfo = locations.find(l => l.id === id);

  let locationName = locationInfo?.name ?? "Unknown Location";
  let locationType = locationInfo?.type ?? "unknown";

  if (locationType === "unknown") {
    const site = store.sites.find((s) => s.id === id);
    const warehouse = store.warehouses.find((w) => w.id === id);
    if (site) {
      locationName = site.name;
      locationType = "site";
    } else if (warehouse) {
      locationName = warehouse.name;
      locationType = "warehouse";
    }
  }

  const canMutate = manager && locationType === "warehouse"
    ? false
    : manager && locationType === "site"
      ? allowedSites.has(id)
      : true; // Admin can mutate anything

  const [moveMaterialId, setMoveMaterialId] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState<{ id: string; materialName: string; unit: string; currentQuantity: number } | null>(null);
  const [moveEquipmentId, setMoveEquipmentId] = useState<string | null>(null);

  const bals = useMemo(() => {
    if (materialsData?.data) return materialsData.data;
    return store.balances.filter(b => b.locationId === id && b.quantity > 0) as unknown as InventoryBalance[];
  }, [materialsData, store.balances, id]);

  const eqs = useMemo(() => {
    if (equipmentsData?.data) return equipmentsData.data;
    return store.equipment.filter(e => e.siteId === id || e.warehouseId === id) as unknown as Equipment[];
  }, [equipmentsData, store.equipment, id]);

  if ((isMatLoading || isEqLoading || isLocLoading) && (!materialsData && !equipmentsData && !locationsData)) {
    return <p className="p-8 text-center text-sm text-black/50">Loading location inventory...</p>;
  }

  if (locationType === "unknown") {
    return <p className="p-8 text-center text-sm text-black/50">Location not found or access restricted.</p>;
  }

  const matActions = locationType === "warehouse"
    ? (["transfer", "sold", "used_up", "missing"] as any)
    : (["transfer", "used_up", "missing"] as any);

  const eqActions = locationType === "warehouse"
    ? (["transferred", "sold", "degraded", "appreciated", "maintenance_dispatch", "maintenance_return", "used_up", "missing"] as any)
    : (["transferred", "degraded", "appreciated", "maintenance_dispatch", "maintenance_return", "used_up", "missing"] as any);

  return (
    <div>
      <PageHead kicker="Inventory Detail" title={locationName} />
      <p className="mb-8 font-mono text-[0.7rem] uppercase tracking-wider text-black/40">
        {locationType} • {id}
      </p>

      <div className="mb-8">
        <p className="kicker mb-3">Inventory Balances</p>
        {bals.length > 0 ? (
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
                {bals.map((b) => {
                  const materialId = b.materialId;
                  return (
                    <tr key={`${materialId}-${b.id ?? b.siteId}`}>
                      <td>
                        <p className="font-medium">{b?.material.name ?? materialId}</p>
                      </td>
                      <td className="font-mono text-left min-w-[120px]">
                        {b.quantity} {b?.material.unit ?? "pcs"}
                      </td>
                      <td className="text-left">
                        {canMutate && (
                          <span className="inline-block">
                            <button className="text-xs text-black/50 hover:text-black hover:underline" onClick={() => setMoveMaterialId(materialId)}>Move</button>
                            <button
                              className="ml-3 text-xs text-blue-600/80 hover:text-black hover:underline"
                              onClick={() => setAdjustBalance({
                                id: (b as any).id ?? "",
                                materialName: b?.material.name ?? materialId,
                                unit: b?.material.unit ?? "pcs",
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
            No materials recorded at this location.
          </div>
        )}
      </div>

      <div>
        <p className="kicker mb-3">Parked Equipment</p>
        {eqs.length > 0 ? (
          <TableWrap pagination={equipmentsData?.pagination} onPageChange={setEqPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Status</th>
                  <th>Ownership</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eqs.map((e) => {
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
                      <td className="text-sm capitalize items-center min-w-[140px]">
                        {e.ownershipStatus}
                      </td>
                      <td>
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
            No equipment parked at this location.
          </div>
        )}
      </div>

      {moveMaterialId ? (
        <ModalPanel kicker={`${locationType} Inventory`} title="Move Material" onClose={() => setMoveMaterialId(null)}>
          <MaterialMovementForm
            materialId={moveMaterialId}
            noBg
            fixedSource={{ id, type: locationType as "site" | "warehouse", name: locationName }}
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
            fixedSource={{ id, type: locationType as "site" | "warehouse", name: locationName }}
            allowedActions={eqActions}
            onSuccess={() => setMoveEquipmentId(null)}
            onCancel={() => setMoveEquipmentId(null)}
          />
        </ModalPanel>
      ) : null}

      {adjustBalance ? (
        <ModalPanel kicker="Inventory Detail" title="Adjust Balance" onClose={() => setAdjustBalance(null)}>
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
