"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { useStore, isSiteManager, currentUser } from "@/lib/store";
import { toast } from "sonner";
import {
  useWarehouseSoldOverview,
  useWarehouseSoldMaterials,
  useWarehouse,
  useMarkSoldItemsPaid,
} from "@/hooks/use-warehouses";
import { SiteAccountsSection } from "@/components/SiteAccounts";
import { ListToolbar } from "@/components/ListToolbar";
import { SalePaymentsPanel } from "@/components/SalePaymentsPanel";
import { EditSalePriceModal, PriceHistory, canEditPrice } from "@/components/forms/edit-sale-price";
import { RowActions } from "@/components/RowActions";
import { SaleCogs } from "@/components/SaleCogs";
import { canEditSalePrice } from "@/lib/auth/permissions";
import { useLicensesInBulk } from "@/hooks/use-licenses";
import { useReverseInventoryMovement } from "@/hooks/use-inventory-movements";
import { etb, day, qtyNum, saleMargin } from "@/lib/format";
import type {
  SoldItemsOverview,
  Warehouse,
  InventoryMovement,
  InventoryItem,
  License,
  SaleStatus,
} from "@/types/api";

// A sale to a site is paid through the site's account, never per sale. Go by
// the buyer site as well as the flag, so a row missing `isInternal` is not
// mistaken for an ordinary sale with its own payments.
const soldToSite = (m: { isInternal?: boolean; buyerSiteId?: string | null }) => Boolean(m.isInternal || m.buyerSiteId);

type SoldMatRow = InventoryMovement & { item: InventoryItem | null };

// Per-sale payments exist for sales to outside clients only. A site never pays
// per sale — it pays its account (Site Accounts tab).
interface PaymentTarget {
  id: string;
  title: string;
  totalCost: number;
  paidAmount: number;
  saleStatus: SaleStatus;
}

interface ReverseTarget {
  id: string;
  title: string;
  amount: number;
}

export default function WarehouseSoldItemsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const canEditPrices = canEditSalePrice(currentUser(store).role);

  // Site accounts are admin-only (the API returns none to a site manager), so
  // a manager only ever sees the sold items. ?tab=accounts deep-links in.
  const [viewTab, setViewTab] = useState<"accounts" | "sold">(
    searchParams.get("tab") === "accounts" ? "accounts" : "sold",
  );
  const view = canMutate ? viewTab : "sold";

  const [matPage, setMatPage] = useState(1);
  // Payment status is a filter in the bar above (filters.saleStatus).
  const [filters, setFilters] = useState<QueryFilterValues>({});

  const soldParams = {
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    // Sales to a site have no per-sale status, so this leaves them out.
    saleStatus: (filters.saleStatus as SaleStatus | undefined) || undefined,
    buyerType: (filters.buyerType as "site" | "external" | undefined) || undefined,
    buyerSiteId: filters.buyerSiteId || undefined,
    isMarkedPaid: filters.isMarkedPaid || undefined,
    isApproved: filters.isApproved || undefined,
    minAmount: filters.minAmount || undefined,
    maxAmount: filters.maxAmount || undefined,
    search: filters.search || undefined,
  };

  const { data: warehouseData, isLoading: isWhLoading } = useWarehouse(id);
  const { data: overviewData } = useWarehouseSoldOverview(id, {
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  const { data: materialsData } = useWarehouseSoldMaterials(id, { page: matPage, limit: 10, ...soldParams });

  const reverseMaterialMutation = useReverseInventoryMovement();
  const markPaidMutation = useMarkSoldItemsPaid();

  // Sales to sites ticked for the paid label. Cleared whenever the page of
  // rows changes so a tick never refers to a row the user can't see.
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());

  const [reverseTarget, setReverseTarget] = useState<ReverseTarget | null>(null);
  const [detailModal, setDetailModal] = useState<SoldMatRow | null>(null);
  const [priceTarget, setPriceTarget] = useState<SoldMatRow | null>(null);
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
  const soldMats: SoldMatRow[] = useMemo(() => materialsData?.data ?? [], [materialsData?.data]);

  // Only an approved, live sale to a site can carry the paid label.
  const canTick = (m: SoldMatRow) => soldToSite(m) && m.isApproved && !m.isReversed && !m.isReversal;
  const tickable = soldMats.filter(canTick);
  const allTicked = tickable.length > 0 && tickable.every((m) => selectedSales.has(m.id));

  const selectedBySite = new Map<string, string[]>();
  for (const m of soldMats) {
    if (m.buyerSiteId && selectedSales.has(m.id)) {
      selectedBySite.set(m.buyerSiteId, [...(selectedBySite.get(m.buyerSiteId) ?? []), m.id]);
    }
  }

  const toggleSale = (saleId: string) =>
    setSelectedSales((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });

  const setPaidLabel = async (movementIds: string[], paid: boolean) => {
    try {
      await markPaidMutation.mutateAsync({ warehouseId: id, movementIds, paid });
      toast.success(paid ? "Marked as paid." : "Paid label removed.");
      return true;
    } catch {
      // The API client already toasts the failure; nothing changed (all-or-nothing).
      return false;
    }
  };

  const applyPaidLabel = async (paid: boolean) => {
    if (await setPaidLabel(Array.from(selectedSales), paid)) setSelectedSales(new Set());
  };

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
        soldMats.map((m) => m.licenseId).filter((licId): licId is string => Boolean(licId))
      )
    );
  }, [soldMats]);

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
      await reverseMaterialMutation.mutateAsync({ id: reverseTarget.id });
      setReverseTarget(null);
      if (detailModal?.id === reverseTarget.id) {
        setDetailModal(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reverse movement";
      // 409: the site has paid more than it would then owe this warehouse.
      setError(
        /Reverse a payment first/i.test(message)
          ? `${message} Open Site accounts, then Payments for that site, to reverse one.`
          : message,
      );
    }
  };

  const isReversing = reverseMaterialMutation.isPending;

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

      <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
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

      <p className="mb-8 mt-2 text-xs text-black/50">
        Totals follow the date and license filters on the Sold Items tab.
      </p>

      {canMutate ? (
        <Tabs
          tabs={[
            { id: "accounts", label: "Site Accounts", count: overview.bySite?.length },
            { id: "sold", label: "Sold Items", count: overview.totalCount },
          ]}
          active={view}
          onChange={(next) => setViewTab(next as typeof viewTab)}
        />
      ) : null}

      {view === "accounts" ? (
        <>
          <p className="mb-4 text-xs text-black/50">
            Balances are all-time, so date and license filters don&apos;t apply to them.
          </p>
          <SiteAccountsSection
            warehouseId={id}
            accounts={overview.bySite ?? []}
            canMutate={canMutate}
            selectedSaleIdsBySite={selectedBySite}
            onPaymentRegistered={() => setSelectedSales(new Set())}
          />
        </>
      ) : (
      <>
      <ListToolbar>
        <QueryFilters
          className="contents"
          searchPlaceholder="Buyer or item"
          popover
          pinned={["search", "dateFrom", "dateTo"]}
          fields={[
            "search",
            "licenseId",
            "dateFrom",
            "dateTo",
            "saleStatus",
            "buyerType",
            "buyerSiteId",
            "isMarkedPaid",
            "isApproved",
            "minAmount",
            "maxAmount",
          ]}
          values={filters}
          onChange={(next) => {
            setFilters(next);
            setMatPage(1);
            setSelectedSales(new Set());
          }}
        />
      </ListToolbar>
      <div className="mb-8">
        {selectedSales.size > 0 && canMutate ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 border border-black/10 bg-paper/40 p-3 text-sm">
            <span>{selectedSales.size} selected</span>
            <button
              type="button"
              className="btn px-2 py-0.5 text-xs"
              disabled={markPaidMutation.isPending}
              onClick={() => applyPaidLabel(true)}
            >
              Mark paid
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-0.5 text-xs"
              disabled={markPaidMutation.isPending}
              onClick={() => applyPaidLabel(false)}
            >
              Unmark paid
            </button>
            <button type="button" className="text-xs text-black/50 hover:underline" onClick={() => setSelectedSales(new Set())}>
              Clear
            </button>
            <span className="text-xs text-black/50">A tracking label only; it does not change what a site owes.</span>
          </div>
        ) : null}
        {soldMats.length > 0 ? (
          <TableWrap
            pagination={materialsData?.pagination}
            onPageChange={(next) => {
              setSelectedSales(new Set());
              setMatPage(next);
            }}
          >
            <table className="data w-full text-left">
              <thead>
                <tr>
                  {canMutate ? (
                    <th className="w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all sales to sites on this page"
                        disabled={tickable.length === 0}
                        checked={allTicked}
                        onChange={(e) =>
                          setSelectedSales(e.target.checked ? new Set(tickable.map((m) => m.id)) : new Set())
                        }
                      />
                    </th>
                  ) : null}
                  <th>Date</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th className="hidden lg:table-cell">Margin</th>
                  <th>Logged By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {soldMats.map((l) => {
                  const canReverse = !l.isReversal && !l.isReversed;
                  const total = Number(l.totalCost) || Number(l.unitCost) * l.quantity;
                  // A sale to a site has no per-sale payment (saleStatus and
                  // paidAmount are null) — its money lives in the site account.
                  const isSiteSale = soldToSite(l);
                  const currentSaleStatus = l.saleStatus ?? "paid";
                  const paid = Number(l.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : total));
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setDetailModal(l)}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailModal(l);
                        }
                      }}
                    >
                      {canMutate ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          {canTick(l) ? (
                            <input
                              type="checkbox"
                              aria-label={`Select ${l.item?.name ?? "sale"}`}
                              checked={selectedSales.has(l.id)}
                              onChange={() => toggleSale(l.id)}
                            />
                          ) : null}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap">{day(l.movementDate)}</td>
                      <td className="min-w-0">
                        <div className="font-medium">{l.item?.name ?? "Unknown material"}</div>
                        {l.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
                        {l.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
                      </td>
                      <td className="whitespace-nowrap font-mono">
                        {qtyNum(l.quantity)} {l.item?.unit ?? ""}
                      </td>
                      <td>
                        {l.clientName ?? "—"}
                        {l.buyerSiteId ? (
                          <>
                            {" "}
                            <Stamp value="site" tone="yellow" />
                          </>
                        ) : null}
                      </td>
                      <td>
                        {isSiteSale ? (
                          l.isMarkedPaid ? <Stamp value="marked paid" tone="ok" /> : null
                        ) : (
                          <Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />
                        )}
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
                        {!isSiteSale && currentSaleStatus !== "paid" ? (
                          <div className="text-xs text-black/50">Paid: {etb(paid)}</div>
                        ) : null}
                      </td>
                      <td className="hidden whitespace-nowrap font-mono lg:table-cell">
                        {(() => {
                          const margin = saleMargin(l.totalCost, l.cogsTotalCost);
                          if (!margin) return "—";
                          return (
                            <span className={margin.isNegative() ? "text-bad" : "text-ok"}>
                              {etb(margin.toFixed(2))}
                              {l.cogsEstimated ? <span className="ml-1 text-xs text-black/50">est.</span> : null}
                            </span>
                          );
                        })()}
                      </td>
                      <td><Username userId={l.loggedBy ?? ""} /></td>
                      <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          ariaLabel={`Actions for ${l.item?.name ?? "sale"}`}
                          items={[
                            {
                              label: "Payments",
                              hidden: isSiteSale,
                              onClick: () =>
                                setPaymentTarget({
                                  id: l.id,
                                  title: l.item?.name ?? "Material sale",
                                  totalCost: total,
                                  paidAmount: paid,
                                  saleStatus: currentSaleStatus,
                                }),
                            },
                            {
                              label: l.isMarkedPaid ? "Unmark paid" : "Mark paid",
                              hidden: !(canMutate && canTick(l)),
                              disabled: markPaidMutation.isPending,
                              onClick: () => void setPaidLabel([l.id], !l.isMarkedPaid),
                            },
                            { label: "Edit price", hidden: !(canEditPrices && canEditPrice(l)), onClick: () => setPriceTarget(l) },
                            {
                              label: "Reverse sale",
                              tone: "bad",
                              separatorBefore: true,
                              hidden: !(canReverse && canMutate),
                              onClick: () =>
                                setReverseTarget({
                                  id: l.id,
                                  title: l.item?.name ?? "Material sale",
                                  amount: total,
                                }),
                            },
                          ]}
                        />
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
      </>
      )}

      {paymentTarget ? (
        <ModalPanel
          kicker="Sale Payments"
          title={`${paymentTarget.title} · Payments`}
          wide
          onClose={() => setPaymentTarget(null)}
        >
          <SalePaymentsPanel
            movementId={paymentTarget.id}
            kind="material"
            itemTitle={paymentTarget.title}
            totalCost={paymentTarget.totalCost}
            paidAmount={paymentTarget.paidAmount}
            saleStatus={paymentTarget.saleStatus}
            canMutate={canMutate}
          />
        </ModalPanel>
      ) : null}

      {detailModal ? (
        <ModalPanel
          kicker="Sold Material"
          title={detailModal.item?.name ? `Material · ${detailModal.item.name}` : "Material sale detail"}
          onClose={() => setDetailModal(null)}
        >
          <SoldMaterialDetailModal
            record={detailModal}
            warehouseName={warehouse.name}
            licensesMap={licensesMap}
            canReverse={!detailModal.isReversal && !detailModal.isReversed && canMutate}
            onEditPrice={
              canEditPrices && canEditPrice(detailModal)
                ? () => {
                    setPriceTarget(detailModal);
                    setDetailModal(null);
                  }
                : undefined
            }
            onOpenPayments={
              soldToSite(detailModal)
                ? undefined
                : () => {
                    const rec = detailModal;
                    const total = Number(rec.totalCost) || Number(rec.unitCost) * rec.quantity;
                    const currentSaleStatus = rec.saleStatus ?? "paid";
                    const paid = Number(rec.paidAmount ?? (currentSaleStatus === "unpaid" ? 0 : total));
                    setDetailModal(null);
                    setPaymentTarget({
                      id: rec.id,
                      title: rec.item?.name ?? "Material sale",
                      totalCost: total,
                      paidAmount: paid,
                      saleStatus: currentSaleStatus,
                    });
                  }
            }
            onReverse={() => {
              const rec = detailModal;
              const total = Number(rec.totalCost) || Number(rec.unitCost) * rec.quantity;
              setDetailModal(null);
              setReverseTarget({
                id: rec.id,
                title: rec.item?.name ?? "Material sale",
                amount: total,
              });
            }}
            onClose={() => setDetailModal(null)}
          />
        </ModalPanel>
      ) : null}

      {priceTarget ? (
        <EditSalePriceModal
          key={priceTarget.id}
          movement={priceTarget}
          unit={priceTarget.item?.unit}
          onClose={() => setPriceTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={reverseTarget !== null}
        title="Reverse this sale?"
        body={
          error
            ? error
            : `This will reverse the material sale for ${reverseTarget?.title} (${etb(reverseTarget?.amount ?? 0)}). This will restore stock balance and record inverse ledger lines.`
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

function SoldMaterialDetailModal({
  record: l,
  warehouseName,
  licensesMap,
  canReverse,
  onEditPrice,
  onOpenPayments,
  onReverse,
  onClose,
}: {
  record: SoldMatRow;
  warehouseName: string;
  licensesMap: Map<string, License>;
  canReverse: boolean;
  // Absent unless the user may edit this sale's price.
  onEditPrice?: () => void;
  // Absent for a sale to a site, which has no per-sale payments.
  onOpenPayments?: () => void;
  onReverse: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const license = l.licenseId ? licensesMap.get(l.licenseId) : null;
  const licenseName = l.licenseId
    ? license?.name ?? store.licenses.find((lic) => lic.id === l.licenseId)?.name ?? l.licenseId
    : "—";
  const total = Number(l.totalCost) || Number(l.unitCost) * l.quantity;
  const isSiteSale = soldToSite(l);
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
        {isSiteSale ? (
          <Stamp value="site account" tone="yellow" />
        ) : (
          <Stamp value={currentSaleStatus} tone={statusTone(currentSaleStatus)} />
        )}
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
          value={
            l.buyerSiteId ? (
              <Link href={`/sites/${l.buyerSiteId}`} className="hover:text-yellow">
                {l.clientName ?? "Site"} (site)
              </Link>
            ) : (
              l.clientName ?? "—"
            )
          }
        />
        <DetailRow
          label="Material"
          value={l.item?.name ?? l.itemId}
        />
        <DetailRow
          label="Quantity"
          value={
            <span className="font-mono text-xs">
              {qtyNum(l.quantity)} {l.item?.unit ?? ""}
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
        {isSiteSale ? (
          <DetailRow
            label="Paid label"
            value={
              l.isMarkedPaid ? (
                <span className="text-xs">
                  Marked paid{l.markedPaidAt ? ` on ${day(l.markedPaidAt)}` : ""}
                  {l.markedPaidBy ? (
                    <>
                      {" "}by <Username userId={l.markedPaidBy} fallback={l.markedPaidBy} />
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-black/60">Not marked</span>
              )
            }
          />
        ) : (
          <>
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
          </>
        )}
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

      <SaleCogs movement={l} />
      <PriceHistory movement={l} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        <div className="flex items-center gap-2">
          {onEditPrice ? (
            <button type="button" className="btn btn-ghost text-xs" onClick={onEditPrice}>
              Edit price
            </button>
          ) : null}
          {canReverse ? (
            <button
              type="button"
              className="btn btn-ghost-bad text-xs"
              onClick={onReverse}
            >
              Reverse sale
            </button>
          ) : null}
          {onOpenPayments ? (
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={onOpenPayments}
            >
              Payments
            </button>
          ) : null}
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
