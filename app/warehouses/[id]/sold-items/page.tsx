"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { ConfirmDialog, ModalPanel, PageHead, Stamp, TableWrap, Username } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  useWarehouseSoldOverview,
  useWarehouseSoldEquipment,
  useWarehouseSoldMaterials,
  useWarehouse,
} from "@/hooks/use-warehouses";
import { useLicensesInBulk } from "@/hooks/use-licenses";
import { useReverseInventoryMovement } from "@/hooks/use-inventory-movements";
import { useReverseEquipmentMovement } from "@/hooks/use-equipment-movements";
import { etb, day } from "@/lib/format";
import type {
  SoldItemsOverview,
  Warehouse,
  IndividualEquipmentMovement,
  IndividualEquipmentItem,
  InventoryMovement,
  InventoryItem,
  License,
} from "@/types/api";

type SoldEquipRow = IndividualEquipmentMovement & { equipment: IndividualEquipmentItem | null };
type SoldMatRow = InventoryMovement & { item: InventoryItem | null };

type DetailModalState =
  | { kind: "equipment"; record: SoldEquipRow }
  | { kind: "material"; record: SoldMatRow }
  | null;

interface ReverseTarget {
  id: string;
  kind: "equipment" | "material";
  title: string;
  amount: number;
}

export default function WarehouseSoldItemsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const [equipPage, setEquipPage] = useState(1);
  const [matPage, setMatPage] = useState(1);
  const [filters, setFilters] = useState<QueryFilterValues>({});
  const soldParams = {
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };

  const { data: warehouseData, isLoading: isWhLoading } = useWarehouse(id);
  const { data: overviewData } = useWarehouseSoldOverview(id);
  const { data: equipmentData } = useWarehouseSoldEquipment(id, { page: equipPage, limit: 10, ...soldParams });
  const { data: materialsData } = useWarehouseSoldMaterials(id, { page: matPage, limit: 10, ...soldParams });

  const reverseMaterialMutation = useReverseInventoryMovement();
  const reverseEquipmentMutation = useReverseEquipmentMovement();

  const [reverseTarget, setReverseTarget] = useState<ReverseTarget | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);
  const [error, setError] = useState<string | null>(null);

  const warehouse = warehouseData?.data ?? (store.warehouses.find((w) => w.id === id) as unknown as Warehouse | undefined);

  const fallbackOverview: SoldItemsOverview = {
    soldEquipmentCount: 0,
    soldEquipmentTotal: "0",
    soldMaterialCount: 0,
    soldMaterialTotal: "0",
    totalCount: 0,
    totalRevenue: "0",
  };

  const overview = overviewData?.data ?? fallbackOverview;
  const soldEquip: SoldEquipRow[] = useMemo(() => equipmentData?.data ?? [], [equipmentData?.data]);
  const soldMats: SoldMatRow[] = useMemo(() => materialsData?.data ?? [], [materialsData?.data]);

  // Resolve unique license IDs via in-bulk
  const licenseIds = useMemo(() => {
    return Array.from(
      new Set(
        [...soldEquip.map((e) => e.licenseId), ...soldMats.map((m) => m.licenseId)].filter(
          (licId): licId is string => Boolean(licId)
        )
      )
    );
  }, [soldEquip, soldMats]);

  const { data: licensesData } = useLicensesInBulk(licenseIds);

  const licensesMap = useMemo(() => {
    const map = new Map<string, License>();
    licensesData?.data?.forEach((l) => map.set(l.id, l));
    return map;
  }, [licensesData]);

  if (isWhLoading && !warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Loading warehouse...</p>;
  }

  if (!warehouse) {
    return <p className="p-8 text-center text-sm text-black/50">Warehouse not found</p>;
  }

  const handleConfirmReverse = async () => {
    if (!reverseTarget) return;
    setError(null);
    try {
      if (reverseTarget.kind === "material") {
        await reverseMaterialMutation.mutateAsync({ id: reverseTarget.id });
      } else {
        await reverseEquipmentMutation.mutateAsync({ id: reverseTarget.id });
      }
      setReverseTarget(null);
      if (detailModal?.record.id === reverseTarget.id) {
        setDetailModal(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reverse movement");
    }
  };

  const isReversing = reverseMaterialMutation.isPending || reverseEquipmentMutation.isPending;

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

      <QueryFilters
        fields={["licenseId", "dateFrom", "dateTo"]}
        values={filters}
        onChange={(next) => {
          setFilters(next);
          setEquipPage(1);
          setMatPage(1);
        }}
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
                  <th>Note</th>
                  <th>Price</th>
                  <th>Logged By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {soldEquip.map((l) => {
                  const canReverse = !l.isReversal && !l.isReversed;
                  const price = Number(l.movementCost ?? 0);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setDetailModal({ kind: "equipment", record: l })}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailModal({ kind: "equipment", record: l });
                        }
                      }}
                    >
                      <td className="whitespace-nowrap">{day(l.movementDate)}</td>
                      <td className="min-w-0">
                        <div className="font-medium">{l.equipment?.identifier ?? "Unknown equipment"}</div>
                        {l.equipment?.item?.name && <div className="text-sm text-black/60">{l.equipment.item.name}</div>}
                        {l.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
                        {l.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
                      </td>
                      <td>{l.clientName ?? "—"}</td>
                      <td
                        className="max-w-[12rem] truncate text-sm text-black/70"
                        title={l.note ?? undefined}
                      >
                        {l.note || "—"}
                      </td>
                      <td className="whitespace-nowrap font-mono">{etb(price)}</td>
                      <td><Username userId={l.loggedBy ?? ""} /></td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {canReverse ? (
                          <button
                            type="button"
                            className="btn btn-ghost-bad px-2 py-0.5 text-xs"
                            onClick={() =>
                              setReverseTarget({
                                id: l.id,
                                kind: "equipment",
                                title: l.equipment?.identifier ?? "Equipment sale",
                                amount: price,
                              })
                            }
                          >
                            Reverse
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
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
                  <th>Note</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Logged By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {soldMats.map((l) => {
                  const canReverse = !l.isReversal && !l.isReversed;
                  const total = Number(l.totalCost) || Number(l.unitCost) * l.quantity;
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setDetailModal({ kind: "material", record: l })}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailModal({ kind: "material", record: l });
                        }
                      }}
                    >
                      <td className="whitespace-nowrap">{day(l.movementDate)}</td>
                      <td className="min-w-0">
                        <div className="font-medium">{l.item?.name ?? "Unknown material"}</div>
                        {l.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
                        {l.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
                      </td>
                      <td className="whitespace-nowrap font-mono">
                        {l.quantity} {l.item?.unit ?? ""}
                      </td>
                      <td>{l.clientName ?? "—"}</td>
                      <td
                        className="max-w-[12rem] truncate text-sm text-black/70"
                        title={l.note ?? undefined}
                      >
                        {l.note || "—"}
                      </td>
                      <td className="whitespace-nowrap font-mono">{etb(l.unitCost)}</td>
                      <td className="whitespace-nowrap font-mono">{etb(total)}</td>
                      <td><Username userId={l.loggedBy ?? ""} /></td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {canReverse ? (
                          <button
                            type="button"
                            className="btn btn-ghost-bad px-2 py-0.5 text-xs"
                            onClick={() =>
                              setReverseTarget({
                                id: l.id,
                                kind: "material",
                                title: l.item?.name ?? "Material sale",
                                amount: total,
                              })
                            }
                          >
                            Reverse
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No materials sold from this warehouse.
          </div>
        )}
      </div>

      {detailModal?.kind === "equipment" ? (
        <ModalPanel
          kicker="Sold Equipment"
          title={detailModal.record.equipment?.identifier ? `Equipment · ${detailModal.record.equipment.identifier}` : "Equipment sale detail"}
          onClose={() => setDetailModal(null)}
        >
          <SoldEquipmentDetailModal
            record={detailModal.record}
            warehouseName={warehouse.name}
            licensesMap={licensesMap}
            canReverse={!detailModal.record.isReversal && !detailModal.record.isReversed}
            onReverse={() => {
              const rec = detailModal.record;
              setDetailModal(null);
              setReverseTarget({
                id: rec.id,
                kind: "equipment",
                title: rec.equipment?.identifier ?? "Equipment sale",
                amount: Number(rec.movementCost ?? 0),
              });
            }}
            onClose={() => setDetailModal(null)}
          />
        </ModalPanel>
      ) : null}

      {detailModal?.kind === "material" ? (
        <ModalPanel
          kicker="Sold Material"
          title={detailModal.record.item?.name ? `Material · ${detailModal.record.item.name}` : "Material sale detail"}
          onClose={() => setDetailModal(null)}
        >
          <SoldMaterialDetailModal
            record={detailModal.record}
            warehouseName={warehouse.name}
            licensesMap={licensesMap}
            canReverse={!detailModal.record.isReversal && !detailModal.record.isReversed}
            onReverse={() => {
              const rec = detailModal.record;
              const total = Number(rec.totalCost) || Number(rec.unitCost) * rec.quantity;
              setDetailModal(null);
              setReverseTarget({
                id: rec.id,
                kind: "material",
                title: rec.item?.name ?? "Material sale",
                amount: total,
              });
            }}
            onClose={() => setDetailModal(null)}
          />
        </ModalPanel>
      ) : null}

      <ConfirmDialog
        open={reverseTarget !== null}
        title="Reverse this sale?"
        body={
          error
            ? error
            : `This will reverse the ${reverseTarget?.kind === "equipment" ? "equipment" : "material"} sale for ${reverseTarget?.title} (${etb(reverseTarget?.amount ?? 0)}). This will restore stock balance and record inverse ledger lines.`
        }
        confirmLabel="Reverse sale"
        danger
        loading={isReversing}
        onCancel={() => {
          setReverseTarget(null);
          setError(null);
        }}
        onConfirm={handleConfirmReverse}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function SoldEquipmentDetailModal({
  record: l,
  warehouseName,
  licensesMap,
  canReverse,
  onReverse,
  onClose,
}: {
  record: SoldEquipRow;
  warehouseName: string;
  licensesMap: Map<string, License>;
  canReverse: boolean;
  onReverse: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const license = l.licenseId ? licensesMap.get(l.licenseId) : null;
  const licenseName = l.licenseId
    ? license?.name ?? store.licenses.find((lic) => lic.id === l.licenseId)?.name ?? l.licenseId
    : "—";
  const price = Number(l.movementCost ?? 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp
          value={l.isApproved ? "approved" : "pending"}
          tone={l.isApproved ? "ok" : "yellow"}
        />
        {l.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
        {l.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
        <Stamp value="equipment sale" tone="ok" />
      </div>

      <div className="mb-6 border-b border-black/10 pb-4">
        <p className="kicker">Sale Price</p>
        <p className="mt-1 font-mono text-2xl font-medium tracking-tight text-ok">
          {etb(price)}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <DetailRow
          label="Sale date"
          value={<span className="font-mono text-xs">{day(l.movementDate)}</span>}
        />
        <DetailRow
          label="Buyer"
          value={l.clientName ?? "—"}
        />
        <DetailRow
          label="Equipment identifier"
          value={<span className="font-mono text-xs">{l.equipment?.identifier ?? l.individualItemId}</span>}
        />
        <DetailRow
          label="Equipment model"
          value={l.equipment?.item?.name ?? "—"}
        />
        <DetailRow label="Warehouse" value={warehouseName} />
        <DetailRow label="License" value={licenseName} />
        <DetailRow
          label="Logged by"
          value={<Username userId={l.loggedBy} fallback={l.loggedBy || "—"} />}
        />

        {l.transactionId ? (
          <DetailRow
            label="Transaction reference"
            value={<span className="font-mono text-xs">{l.transactionId}</span>}
          />
        ) : null}

        {l.ledgerId ? (
          <DetailRow
            label="Ledger reference"
            value={<span className="font-mono text-xs">{l.ledgerId}</span>}
          />
        ) : null}

        {l.reversalOfId ? (
          <DetailRow
            label="Reversal of"
            value={<span className="font-mono text-xs">{l.reversalOfId}</span>}
          />
        ) : null}

        <DetailRow
          label="Note"
          value={l.note || "—"}
          fullWidth
        />

        <DetailRow
          label="Movement ID"
          value={
            <span className="font-mono text-xs text-black/60 break-all">
              {l.id}
            </span>
          }
          fullWidth
        />

        <DetailRow
          label="Created at"
          value={<span className="font-mono text-xs">{day(l.createdAt)}</span>}
        />

        {l.updatedAt ? (
          <DetailRow
            label="Updated at"
            value={<span className="font-mono text-xs">{day(l.updatedAt)}</span>}
          />
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        {canReverse ? (
          <button
            type="button"
            className="btn btn-ghost-bad text-xs"
            onClick={onReverse}
          >
            Reverse sale
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SoldMaterialDetailModal({
  record: l,
  warehouseName,
  licensesMap,
  canReverse,
  onReverse,
  onClose,
}: {
  record: SoldMatRow;
  warehouseName: string;
  licensesMap: Map<string, License>;
  canReverse: boolean;
  onReverse: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const license = l.licenseId ? licensesMap.get(l.licenseId) : null;
  const licenseName = l.licenseId
    ? license?.name ?? store.licenses.find((lic) => lic.id === l.licenseId)?.name ?? l.licenseId
    : "—";
  const total = Number(l.totalCost) || Number(l.unitCost) * l.quantity;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp
          value={l.isApproved ? "approved" : "pending"}
          tone={l.isApproved ? "ok" : "yellow"}
        />
        {l.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
        {l.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
        <Stamp value="material sale" tone="ok" />
      </div>

      <div className="mb-6 border-b border-black/10 pb-4">
        <p className="kicker">Total Sale Amount</p>
        <p className="mt-1 font-mono text-2xl font-medium tracking-tight text-ok">
          {etb(total)}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <DetailRow
          label="Sale date"
          value={<span className="font-mono text-xs">{day(l.movementDate)}</span>}
        />
        <DetailRow
          label="Buyer"
          value={l.clientName ?? "—"}
        />
        <DetailRow
          label="Material"
          value={l.item?.name ?? l.itemId}
        />
        <DetailRow
          label="Quantity"
          value={
            <span className="font-mono text-xs">
              {l.quantity} {l.item?.unit ?? ""}
            </span>
          }
        />
        <DetailRow
          label="Unit price"
          value={<span className="font-mono text-xs">{etb(l.unitCost)}</span>}
        />
        <DetailRow
          label="Total price"
          value={<span className="font-mono text-xs">{etb(total)}</span>}
        />
        <DetailRow label="Warehouse" value={warehouseName} />
        <DetailRow label="License" value={licenseName} />
        <DetailRow
          label="Logged by"
          value={<Username userId={l.loggedBy} fallback={l.loggedBy || "—"} />}
        />

        {l.transactionId ? (
          <DetailRow
            label="Transaction reference"
            value={<span className="font-mono text-xs">{l.transactionId}</span>}
          />
        ) : null}

        {l.ledgerId ? (
          <DetailRow
            label="Ledger reference"
            value={<span className="font-mono text-xs">{l.ledgerId}</span>}
          />
        ) : null}

        {l.reversalOfId ? (
          <DetailRow
            label="Reversal of"
            value={<span className="font-mono text-xs">{l.reversalOfId}</span>}
          />
        ) : null}

        <DetailRow
          label="Note"
          value={l.note || "—"}
          fullWidth
        />

        <DetailRow
          label="Movement ID"
          value={
            <span className="font-mono text-xs text-black/60 break-all">
              {l.id}
            </span>
          }
          fullWidth
        />

        <DetailRow
          label="Created at"
          value={<span className="font-mono text-xs">{day(l.createdAt)}</span>}
        />

        {l.updatedAt ? (
          <DetailRow
            label="Updated at"
            value={<span className="font-mono text-xs">{day(l.updatedAt)}</span>}
          />
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        {canReverse ? (
          <button
            type="button"
            className="btn btn-ghost-bad text-xs"
            onClick={onReverse}
          >
            Reverse sale
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
