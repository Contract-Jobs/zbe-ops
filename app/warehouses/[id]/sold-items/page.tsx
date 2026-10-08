"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import {
  ConfirmDialog,
  ModalPanel,
  PageHead,
  Stamp,
  TableWrap,
  Username,
  Tabs,
  statusTone,
} from "@/components/ui";
import { useStore, isSiteManager } from "@/lib/store";
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
import { SalePaymentsPanel } from "@/components/SalePaymentsPanel";
import type {
  SoldItemsOverview,
  Warehouse,
  IndividualEquipmentMovement,
  IndividualEquipmentItem,
  InventoryMovement,
  InventoryItem,
  License,
  SaleStatus,
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

interface PaymentTarget {
  id: string;
  kind: "equipment" | "material";
  title: string;
  totalCost: number;
  paidAmount: number;
  saleStatus: SaleStatus;
}

export default function WarehouseSoldItemsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const canMutate = !isSiteManager(store);

  const [equipPage, setEquipPage] = useState(1);
  const [matPage, setMatPage] = useState(1);
  const [statusTab, setStatusTab] = useState<"all" | SaleStatus>("all");
  const [filters, setFilters] = useState<QueryFilterValues>({});

  const soldParams = {
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    saleStatus: statusTab === "all" ? undefined : statusTab,
  };

  const { data: warehouseData, isLoading: isWhLoading } = useWarehouse(id);
  const { data: overviewData } = useWarehouseSoldOverview(id, {
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  const { data: equipmentData } = useWarehouseSoldEquipment(id, { page: equipPage, limit: 10, ...soldParams });
  const { data: materialsData } = useWarehouseSoldMaterials(id, { page: matPage, limit: 10, ...soldParams });

  const reverseMaterialMutation = useReverseInventoryMovement();
  const reverseEquipmentMutation = useReverseEquipmentMovement();

  const [reverseTarget, setReverseTarget] = useState<ReverseTarget | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
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

  const totalRevenue = Number(overview.totalRevenue ?? 0);
  const totalCash = Number(overview.totalCashCollected ?? overview.totalRevenue ?? 0);
  const totalOutstanding = Number(overview.totalOutstanding ?? Math.max(0, totalRevenue - totalCash));
  const collectionRate =
    overview.collectionRate ??
    (totalRevenue > 0 ? `${((totalCash / totalRevenue) * 100).toFixed(1)}%` : "100%");

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

      <div className="mb-8 grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-5">
          <p className="kicker">Total Revenue</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(totalRevenue)}</p>
          <p className="mt-1 text-sm text-black/60">{overview.totalCount} sales logged</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Equipments Sold</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(overview.soldEquipmentTotal)}</p>
          <p className="mt-1 text-sm text-black/60">
            {overview.soldEquipmentCount} units
            {overview.soldEquipmentCash !== undefined && (
              <> · Cash: {etb(overview.soldEquipmentCash)}</>
            )}
          </p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Materials Sold</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(overview.soldMaterialTotal)}</p>
          <p className="mt-1 text-sm text-black/60">
            {overview.soldMaterialCount} batches
            {overview.soldMaterialCash !== undefined && (
              <> · Cash: {etb(overview.soldMaterialCash)}</>
            )}
          </p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Cash Collected</p>
          <p className="mt-2 break-words text-2xl tracking-tight text-ok">{etb(totalCash)}</p>
          <p className="mt-1 text-sm text-black/60">Total payments received</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Outstanding Balance</p>
          <p
            className={`mt-2 break-words text-2xl tracking-tight ${
              totalOutstanding > 0 ? "text-bad" : "text-black/60"
            }`}
          >
            {etb(totalOutstanding)}
          </p>
          <p className="mt-1 text-sm text-black/60">
            {totalOutstanding > 0 ? "Uncollected receivables" : "All sales cleared"}
          </p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Collection Rate</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{collectionRate}</p>
          <p className="mt-1 text-sm text-black/60">Cash vs. total sales revenue</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "all", label: "All Sales", count: overview.totalCount },
          { id: "unpaid", label: "Unpaid", count: overview.revenueVsCash?.byStatus?.unpaid?.count },
          {
            id: "partially_paid",
            label: "Partially Paid",
            count: overview.revenueVsCash?.byStatus?.partiallyPaid?.count,
          },
          { id: "paid", label: "Fully Paid", count: overview.revenueVsCash?.byStatus?.paid?.count },
        ]}
        active={statusTab}
        onChange={(next) => {
          setStatusTab(next as typeof statusTab);
          setEquipPage(1);
          setMatPage(1);
        }}
      />

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
                  <th>Status</th>
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
                  const currentSaleStatus = l.saleStatus ?? "paid";
                  const paid = Number(l.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : price));
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
                      <td>
                        <Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />
                      </td>
                      <td
                        className="max-w-[12rem] truncate text-sm text-black/70"
                        title={l.note ?? undefined}
                      >
                        {l.note || "—"}
                      </td>
                      <td className="whitespace-nowrap font-mono">
                        <div>{etb(price)}</div>
                        {currentSaleStatus !== "paid" ? (
                          <div className="text-xs text-black/50">Paid: {etb(paid)}</div>
                        ) : null}
                      </td>
                      <td><Username userId={l.loggedBy ?? ""} /></td>
                      <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-block text-right">
                          <button
                            type="button"
                            className="text-xs text-black/50 hover:text-black hover:underline"
                            onClick={() =>
                              setPaymentTarget({
                                id: l.id,
                                kind: "equipment",
                                title: l.equipment?.identifier ?? "Equipment sale",
                                totalCost: price,
                                paidAmount: paid,
                                saleStatus: currentSaleStatus,
                              })
                            }
                          >
                            Payments
                          </button>
                          {canReverse && canMutate ? (
                            <button
                              type="button"
                              className="ml-3 text-xs text-bad hover:underline"
                              onClick={() =>
                                setReverseTarget({
                                  id: l.id,
                                  kind: "equipment",
                                  title: l.equipment?.identifier ?? "Equipment sale",
                                  amount: price,
                                })
                              }
                            >
                              Reverse sale
                            </button>
                          ) : null}
                        </span>
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
                  <th>Status</th>
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
                  const currentSaleStatus = l.saleStatus ?? "paid";
                  const paid = Number(l.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : total));
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
                      <td>
                        <Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />
                      </td>
                      <td
                        className="max-w-[12rem] truncate text-sm text-black/70"
                        title={l.note ?? undefined}
                      >
                        {l.note || "—"}
                      </td>
                      <td className="whitespace-nowrap font-mono">{etb(l.unitCost)}</td>
                      <td className="whitespace-nowrap font-mono">
                        <div>{etb(total)}</div>
                        {currentSaleStatus !== "paid" ? (
                          <div className="text-xs text-black/50">Paid: {etb(paid)}</div>
                        ) : null}
                      </td>
                      <td><Username userId={l.loggedBy ?? ""} /></td>
                      <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-block text-right">
                          <button
                            type="button"
                            className="text-xs text-black/50 hover:text-black hover:underline"
                            onClick={() =>
                              setPaymentTarget({
                                id: l.id,
                                kind: "material",
                                title: l.item?.name ?? "Material sale",
                                totalCost: total,
                                paidAmount: paid,
                                saleStatus: currentSaleStatus,
                              })
                            }
                          >
                            Payments
                          </button>
                          {canReverse && canMutate ? (
                            <button
                              type="button"
                              className="ml-3 text-xs text-bad hover:underline"
                              onClick={() =>
                                setReverseTarget({
                                  id: l.id,
                                  kind: "material",
                                  title: l.item?.name ?? "Material sale",
                                  amount: total,
                                })
                              }
                            >
                              Reverse sale
                            </button>
                          ) : null}
                        </span>
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

      {paymentTarget ? (
        <ModalPanel
          kicker="Sale Payments"
          title={`${paymentTarget.title} · Payments`}
          wide
          onClose={() => setPaymentTarget(null)}
        >
          <SalePaymentsPanel
            movementId={paymentTarget.id}
            kind={paymentTarget.kind}
            itemTitle={paymentTarget.title}
            totalCost={paymentTarget.totalCost}
            paidAmount={paymentTarget.paidAmount}
            saleStatus={paymentTarget.saleStatus}
            canMutate={canMutate}
          />
        </ModalPanel>
      ) : null}

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
            canReverse={!detailModal.record.isReversal && !detailModal.record.isReversed && canMutate}
            onOpenPayments={() => {
              const rec = detailModal.record;
              const price = Number(rec.movementCost ?? 0);
              const currentSaleStatus = rec.saleStatus ?? "paid";
              const paid = Number(rec.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : price));
              setDetailModal(null);
              setPaymentTarget({
                id: rec.id,
                kind: "equipment",
                title: rec.equipment?.identifier ?? "Equipment sale",
                totalCost: price,
                paidAmount: paid,
                saleStatus: currentSaleStatus,
              });
            }}
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
            canReverse={!detailModal.record.isReversal && !detailModal.record.isReversed && canMutate}
            onOpenPayments={() => {
              const rec = detailModal.record;
              const total = Number(rec.totalCost) || Number(rec.unitCost) * rec.quantity;
              const currentSaleStatus = rec.saleStatus ?? "paid";
              const paid = Number(rec.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : total));
              setDetailModal(null);
              setPaymentTarget({
                id: rec.id,
                kind: "material",
                title: rec.item?.name ?? "Material sale",
                totalCost: total,
                paidAmount: paid,
                saleStatus: currentSaleStatus,
              });
            }}
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
  onOpenPayments,
  onReverse,
  onClose,
}: {
  record: SoldEquipRow;
  warehouseName: string;
  licensesMap: Map<string, License>;
  canReverse: boolean;
  onOpenPayments: () => void;
  onReverse: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const license = l.licenseId ? licensesMap.get(l.licenseId) : null;
  const licenseName = l.licenseId
    ? license?.name ?? store.licenses.find((lic) => lic.id === l.licenseId)?.name ?? l.licenseId
    : "—";
  const price = Number(l.movementCost ?? 0);
  const currentSaleStatus = l.saleStatus ?? "paid";
  const paid = Number(l.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : price));
  const remaining = Math.max(0, price - paid);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp
          value={l.isApproved ? "approved" : "pending"}
          tone={l.isApproved ? "ok" : "yellow"}
        />
        <Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />
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
        <DetailRow
          label="Payment status"
          value={<Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />}
        />
        <DetailRow
          label="Cash collected"
          value={<span className="font-mono text-xs text-ok">{etb(paid)}</span>}
        />
        {remaining > 0 ? (
          <DetailRow
            label="Outstanding balance"
            value={<span className="font-mono text-xs text-bad">{etb(remaining)}</span>}
          />
        ) : null}
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
        <div className="flex items-center gap-2">
          {canReverse ? (
            <button
              type="button"
              className="btn btn-ghost-bad text-xs"
              onClick={onReverse}
            >
              Reverse sale
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={onOpenPayments}
          >
            Payments
          </button>
        </div>
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
  onOpenPayments,
  onReverse,
  onClose,
}: {
  record: SoldMatRow;
  warehouseName: string;
  licensesMap: Map<string, License>;
  canReverse: boolean;
  onOpenPayments: () => void;
  onReverse: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const license = l.licenseId ? licensesMap.get(l.licenseId) : null;
  const licenseName = l.licenseId
    ? license?.name ?? store.licenses.find((lic) => lic.id === l.licenseId)?.name ?? l.licenseId
    : "—";
  const total = Number(l.totalCost) || Number(l.unitCost) * l.quantity;
  const currentSaleStatus = l.saleStatus ?? "paid";
  const paid = Number(l.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : total));
  const remaining = Math.max(0, total - paid);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp
          value={l.isApproved ? "approved" : "pending"}
          tone={l.isApproved ? "ok" : "yellow"}
        />
        <Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />
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
        <DetailRow
          label="Payment status"
          value={<Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />}
        />
        <DetailRow
          label="Cash collected"
          value={<span className="font-mono text-xs text-ok">{etb(paid)}</span>}
        />
        {remaining > 0 ? (
          <DetailRow
            label="Outstanding balance"
            value={<span className="font-mono text-xs text-bad">{etb(remaining)}</span>}
          />
        ) : null}
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
        <div className="flex items-center gap-2">
          {canReverse ? (
            <button
              type="button"
              className="btn btn-ghost-bad text-xs"
              onClick={onReverse}
            >
              Reverse sale
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={onOpenPayments}
          >
            Payments
          </button>
        </div>
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
