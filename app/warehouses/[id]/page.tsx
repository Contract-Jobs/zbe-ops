"use client";

import { useParams } from "next/navigation";
import { PageHead, TableWrap, Stamp } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useWarehouse } from "@/hooks/use-warehouses";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useInventoryBalances } from "@/hooks/use-inventory";
import { useMaterials } from "@/hooks/use-materials";
import type { Warehouse, Equipment, InventoryBalance, MaterialCatalog } from "@/types/api";

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();

  const { data: warehouseData, isLoading: isWarehouseLoading } = useWarehouse(id);
  const { data: equipData } = useEquipmentList({ warehouseId: id ? [id] : undefined });
  const { data: balancesData } = useInventoryBalances({ warehouseId: id ? [id] : undefined });
  const { data: materialsData } = useMaterials();

  const warehouse = warehouseData?.data ?? (store.warehouses.find((w) => w.id === id) as unknown as Warehouse | undefined);

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
  const materials = materialsData?.data ?? (store.materials as unknown as MaterialCatalog[]);

  return (
    <div>
      <PageHead
        kicker="Central"
        title={warehouse.name}
      />
      <div className="mb-8">
        <p className="text-black/70">Location: {warehouse.location ?? "—"}</p>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Inventory Balances</h2>
        {balances.length > 0 ? (
          <TableWrap>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const materialId = (b as unknown as { catalogId?: string }).catalogId ?? (b as any).materialId;
                  const m = materials.find((mat) => mat.id === materialId);
                  const key = (b as any).id ?? materialId;
                  return (
                    <tr key={key}>
                      <td>
                        <p className="font-medium">{m?.name ?? "Unknown material"}</p>
                      </td>
                      <td className="font-mono">
                        {b.quantity} {m?.unit ?? ""}
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
        <h2 className="mb-4 font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Parked Equipment</h2>
        {equipment.length > 0 ? (
          <TableWrap>
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
                      <td className="text-sm capitalize">{e.ownershipStatus}</td>
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
    </div>
  );
}
