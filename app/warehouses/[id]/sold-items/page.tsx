"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHead, TableWrap } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  useWarehouseSoldOverview,
  useWarehouseSoldEquipment,
  useWarehouseSoldMaterials,
  useWarehouse,
} from "@/hooks/use-warehouses";
import { etb } from "@/lib/format";
import { day } from "@/lib/format";
import type { SoldItemsOverview, EquipmentLog, MaterialLog, Equipment, MaterialCatalog, Warehouse } from "@/types/api";
import { userName } from "@/lib/store";

export default function WarehouseSoldItemsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const [equipPage, setEquipPage] = useState(1);
  const [matPage, setMatPage] = useState(1);

  const { data: warehouseData, isLoading: isWhLoading } = useWarehouse(id);
  const { data: overviewData } = useWarehouseSoldOverview(id);
  const { data: equipmentData, isLoading: equipLoading } = useWarehouseSoldEquipment(id, { page: equipPage, limit: 10 });
  const { data: materialsData, isLoading: matLoading } = useWarehouseSoldMaterials(id, { page: matPage, limit: 10 });

  const warehouse = warehouseData?.data ?? (store.warehouses.find((w) => w.id === id) as unknown as Warehouse | undefined);

  // Fallback calculations for Demo Mode (since GET requests bypass interceptor)
  const fallbackOverview: SoldItemsOverview = {
    soldEquipmentCount: 0,
    soldEquipmentTotal: "0",
    soldMaterialCount: 0,
    soldMaterialTotal: "0",
    totalCount: 0,
    totalRevenue: "0",
  };

  const fallbackEquipLogs: (EquipmentLog & { equipment: Equipment | null })[] = [];
  const fallbackMatLogs: (MaterialLog & { material: MaterialCatalog | null })[] = [];

  if (!overviewData && !equipLoading && !matLoading) {
    let eqTotal = 0;
    store.equipmentLogs
      .filter((l) => l.logType === "sale" && l.fromKind === "warehouse" && l.fromId === id && !l.isReversal)
      .forEach((l) => {
        fallbackOverview.soldEquipmentCount++;
        eqTotal += Number(l.price) || 0;
        const equipment = store.equipment.find((e) => e.id === l.equipmentId) as unknown as Equipment | undefined;
        fallbackEquipLogs.push({ ...(l as unknown as EquipmentLog), equipment: equipment ?? null });
      });

    let matTotal = 0;
    store.materialLogs
      .filter((l) => l.logType === "sale" && l.fromKind === "warehouse" && l.fromId === id && !l.isReversal)
      .forEach((l) => {
        fallbackOverview.soldMaterialCount++;
        matTotal += Number(l.unitPrice) || 0; // Assuming unitPrice is total price of sale here for demo
        const material = store.materials.find((m) => m.id === l.materialId) as unknown as MaterialCatalog | undefined;
        fallbackMatLogs.push({ ...(l as unknown as MaterialLog), material: material ?? null });
      });

    fallbackOverview.soldEquipmentTotal = String(eqTotal);
    fallbackOverview.soldMaterialTotal = String(matTotal);
    fallbackOverview.totalCount = fallbackOverview.soldEquipmentCount + fallbackOverview.soldMaterialCount;
    fallbackOverview.totalRevenue = String(eqTotal + matTotal);
  }

  const overview = overviewData ?? fallbackOverview;
  const soldEquip = equipmentData?.data ?? fallbackEquipLogs;
  const soldMats = materialsData?.data ?? fallbackMatLogs;

  if (isWhLoading && !warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Loading warehouse...</p>;
  }

  if (!warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Warehouse not found</p>;
  }

  return (
    <div>
      <PageHead
        kicker="Central"
        title={`${warehouse.name} — Sold Items`}
        action={
          <button className="btn btn-ghost" onClick={() => router.push(`/warehouses/${id}`)}>
            Back to Warehouse
          </button>
        }
      />

      <div className="mb-8 grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="kicker">Total Revenue</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(overview.totalRevenue))}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Sold Equipment</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{overview.soldEquipmentCount} units</p>
          <p className="mt-1 text-sm text-black/60">{etb(Number(overview.soldEquipmentTotal))}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Sold Materials</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{overview.soldMaterialCount} batches</p>
          <p className="mt-1 text-sm text-black/60">{etb(Number(overview.soldMaterialTotal))}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Sold Equipment</h2>
        {soldEquip.length > 0 ? (
          <TableWrap pagination={equipmentData?.pagination} onPageChange={setEquipPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Equipment</th>
                  <th>Buyer</th>
                  <th>Price</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {soldEquip.map((l: any) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{day(l.timestamp || l.createdAt)}</td>
                    <td>{l.equipment?.name ?? "Unknown equipment"}</td>
                    <td>{l.buyerName ?? "—"}</td>
                    <td className="font-mono">{etb(Number(l.price))}</td>
                    <td>{userName(l.loggedBy ?? "", store)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No equipment sold from this warehouse.
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="mb-4 font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Sold Materials</h2>
        {soldMats.length > 0 ? (
          <TableWrap pagination={materialsData?.pagination} onPageChange={setMatPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Buyer</th>
                  <th>Price</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {soldMats.map((l: any) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{day(l.timestamp || l.createdAt)}</td>
                    <td>{l.material?.name ?? "Unknown material"}</td>
                    <td className="font-mono">
                      {l.quantity} {l.material?.unit ?? ""}
                    </td>
                    <td>{l.buyerName ?? "—"}</td>
                    <td className="font-mono">{etb(Number(l.unitPrice))}</td>
                    <td>{userName(l.loggedBy ?? "", store)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No materials sold from this warehouse.
          </div>
        )}
      </div>
    </div>
  );
}
