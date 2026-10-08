"use client";

import { useState, useMemo } from "react";
import { ModalPanel, Stamp, TableWrap, Username, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { useBalanceMovements, useVerifyInventoryBalance } from "@/hooks/use-inventory-balances";
import { useReverseInventoryMovement } from "@/hooks/use-inventory-movements";
import { useInventoriesInBulk } from "@/hooks/use-inventories";
import { useLicensesInBulk } from "@/hooks/use-licenses";
import { useStore } from "@/lib/store";
import { QUANTITY_MOVEMENT_LABELS } from "@/lib/movement-labels";
import type { InventoryMovement, License } from "@/types/api";

// One movement ledger for a single (item, inventory) balance — the v2
// drill-down for finding a bad entry to reverse (there's no direct balance
// "adjust" action). Only the most recent movement can be reversed from
// here: reversing an older one out of order would misrepresent what
// actually happened to the balance in between.
export function BalanceHistoryPanel({
  itemId,
  inventoryId,
  itemName,
  unit,
}: {
  itemId: string;
  inventoryId: string;
  itemName: string;
  unit: string;
}) {
  const store = useStore();
  const { data, isLoading } = useBalanceMovements({ itemId, inventoryId, includeReversed: false });
  const reverseMutation = useReverseInventoryMovement();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const movements = [...(data?.data ?? [])].sort(
    (a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime()
  );

  const inventoryIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of movements) {
      if (m.sourceInventoryId) ids.push(m.sourceInventoryId);
      if (m.destinationInventoryId) ids.push(m.destinationInventoryId);
    }
    return Array.from(new Set(ids));
  }, [movements]);

  const { data: inventoriesData } = useInventoriesInBulk(inventoryIds);

  const nodeById = useMemo(() => {
    const map = new Map<string, { kind: "site" | "warehouse"; name: string }>();
    for (const node of inventoriesData?.data ?? []) {
      const name = node.site?.name ?? node.warehouse?.name ?? "Unknown";
      map.set(node.id, { kind: node.inventoryType, name });
    }
    return map;
  }, [inventoriesData]);

  const licenseIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of movements) {
      if (m.licenseId) ids.push(m.licenseId);
    }
    return Array.from(new Set(ids));
  }, [movements]);

  const { data: licensesData } = useLicensesInBulk(licenseIds);

  const licensesMap = useMemo(() => {
    const map = new Map<string, License>();
    licensesData?.data?.forEach((l) => map.set(l.id, l));
    return map;
  }, [licensesData]);

  // Balances (and now verify) are scoped per license lot. This ledger spans
  // every lot at this (item, location) pair, so "verify" checks the most
  // recent movement's lot — the one `canReverse` below points at — not
  // some other lot mixed into the same history.
  const verifyLicenseId = movements[0]?.licenseId ?? undefined;
  const { data: verifyData, isLoading: isVerifyLoading } = useVerifyInventoryBalance(itemId, inventoryId, verifyLicenseId);

  const locationLabel = (nodeId: string | null) => (nodeId ? nodeById.get(nodeId)?.name ?? "Unknown" : "—");
  // The reversable row is the top of the FULL sorted list, not just the
  // first row of whichever page is showing — matters once this table is
  // paginated client-side below.
  const topMovementId = movements[0]?.id;

  const handleReverse = async (movementId: string) => {
    setError(null);
    setReversingId(movementId);
    try {
      await reverseMutation.mutateAsync({ id: movementId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reverse movement");
    } finally {
      setReversingId(null);
    }
  };

  return (
    <div>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-black/60">
        {itemName} <span className="text-black/40">({unit})</span>
        {!isVerifyLoading && verifyData ? (
          <Stamp
            value={verifyData.data.consistent ? "balance consistent" : "balance drifted"}
            tone={verifyData.data.consistent ? "ok" : "bad"}
          />
        ) : null}
      </p>
      {error ? <p className="mb-3 text-sm text-bad">{error}</p> : null}
      {isLoading && !data ? (
        <div className="p-8 text-center text-sm text-black/40">Loading movements...</div>
      ) : movements.length === 0 ? (
        <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
          No movements recorded for this balance.
        </div>
      ) : (
        <TableWrap data={movements}>
          {(pageRows) => (
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th className="hidden sm:table-cell">From / To</th>
                  <th>Unit Cost</th>
                  <th>Note</th>
                  <th className="hidden sm:table-cell">Logged By</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => {
                  const canReverse = m.id === topMovementId && !m.isReversed && !m.isReversal;
                  const noteText = m.note || (m.metadata?.reason ? String(m.metadata.reason) : "");
                  return (
                    <tr
                      key={m.id}
                      className="cursor-pointer hover:bg-paper/30"
                      onClick={() => setSelectedMovement(m)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedMovement(m);
                        }
                      }}
                    >
                      <td className="whitespace-nowrap text-xs">{day(m.movementDate)}</td>
                      <td>
                        <Stamp value={QUANTITY_MOVEMENT_LABELS[m.movementType] ?? m.movementType} />
                      </td>
                      <td className="font-mono">{m.quantity}</td>
                      <td className="hidden text-sm sm:table-cell">
                        {locationLabel(m.sourceInventoryId)} → {locationLabel(m.destinationInventoryId)}
                      </td>
                      <td className="font-mono">{etb(m.unitCost)}</td>
                      <td
                        className="max-w-[10rem] truncate text-sm text-black/70 sm:max-w-[14rem]"
                        title={noteText || undefined}
                      >
                        {noteText || "—"}
                      </td>
                      <td className="hidden text-sm sm:table-cell">
                        <Username userId={m.loggedBy} />
                      </td>
                      <td>
                        {m.isReversed ? (
                          <Stamp value="reversed" tone="bad" />
                        ) : m.isReversal ? (
                          <Stamp value="reversal" tone="yellow" />
                        ) : (
                          <Stamp value="posted" tone="ok" />
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canReverse ? (
                          <button
                            type="button"
                            className="text-xs text-bad hover:underline disabled:opacity-50"
                            disabled={reversingId === m.id}
                            onClick={() => handleReverse(m.id)}
                          >
                            {reversingId === m.id ? "Reversing..." : "Reverse"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}

      {selectedMovement ? (
        <ModalPanel
          kicker="Movement Detail"
          title={`${itemName} · Movement`}
          zIndex="z-[60]"
          onClose={() => setSelectedMovement(null)}
        >
          <MovementDetailModal
            movement={selectedMovement}
            itemName={itemName}
            unit={unit}
            locationLabel={locationLabel}
            licenseName={
              selectedMovement.licenseId
                ? licensesMap.get(selectedMovement.licenseId)?.name ??
                  store.licenses.find((l) => l.id === selectedMovement.licenseId)?.name ??
                  selectedMovement.licenseId
                : undefined
            }
            canReverse={
              selectedMovement.id === topMovementId &&
              !selectedMovement.isReversed &&
              !selectedMovement.isReversal
            }
            isReversing={reversingId === selectedMovement.id}
            onReverse={() => {
              const id = selectedMovement.id;
              setSelectedMovement(null);
              handleReverse(id);
            }}
            onClose={() => setSelectedMovement(null)}
          />
        </ModalPanel>
      ) : null}
    </div>
  );
}

function MovementDetailModal({
  movement: m,
  itemName,
  unit,
  locationLabel,
  licenseName,
  canReverse,
  isReversing,
  onReverse,
  onClose,
}: {
  movement: InventoryMovement;
  itemName: string;
  unit: string;
  locationLabel: (nodeId: string | null) => string;
  licenseName?: string;
  canReverse: boolean;
  isReversing: boolean;
  onReverse: () => void;
  onClose: () => void;
}) {
  const total = Number(m.totalCost) || Number(m.unitCost) * m.quantity;
  const noteText = m.note || (m.metadata?.reason ? String(m.metadata.reason) : "");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp value={QUANTITY_MOVEMENT_LABELS[m.movementType] ?? m.movementType} />
        <Stamp
          value={m.isApproved ? "approved" : "pending"}
          tone={m.isApproved ? "ok" : "yellow"}
        />
        {m.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
        {m.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
        {m.saleStatus ? <Stamp value={m.saleStatus} tone={statusTone(m.saleStatus)} /> : null}
      </div>

      <div className="mb-6 border-b border-black/10 pb-4">
        <p className="kicker">Quantity & Cost</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-4">
          <span className="font-mono text-2xl font-medium tracking-tight">
            {m.quantity} <span className="text-base text-black/50">{unit}</span>
          </span>
          {total > 0 ? (
            <span className="font-mono text-lg text-black/70">
              Total: {etb(total)}
            </span>
          ) : null}
          {Number(m.unitCost) > 0 ? (
            <span className="font-mono text-sm text-black/50">
              ({etb(m.unitCost)} / {unit})
            </span>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <DetailRow
          label="Movement date"
          value={<span className="font-mono text-xs">{day(m.movementDate)}</span>}
        />
        <DetailRow
          label="Type"
          value={QUANTITY_MOVEMENT_LABELS[m.movementType] ?? m.movementType}
        />
        <DetailRow
          label="Material"
          value={`${itemName} (${unit})`}
        />
        <DetailRow
          label="Source location"
          value={locationLabel(m.sourceInventoryId)}
        />
        <DetailRow
          label="Destination location"
          value={locationLabel(m.destinationInventoryId)}
        />
        {m.clientName ? (
          <DetailRow label="Client / Buyer" value={m.clientName} />
        ) : null}
        {licenseName ? (
          <DetailRow label="License" value={licenseName} />
        ) : null}
        <DetailRow
          label="Logged by"
          value={<Username userId={m.loggedBy} fallback={m.loggedBy || "—"} />}
        />
        {m.saleStatus ? (
          <DetailRow
            label="Sale payment status"
            value={
              <div className="flex items-center gap-2">
                <Stamp value={m.saleStatus} tone={statusTone(m.saleStatus)} />
                {m.paidAmount !== undefined ? (
                  <span className="font-mono text-xs text-black/70">
                    Paid: {etb(m.paidAmount)}
                  </span>
                ) : null}
              </div>
            }
          />
        ) : null}
        {m.transactionId ? (
          <DetailRow
            label="Transaction reference"
            value={<span className="font-mono text-xs">{m.transactionId}</span>}
          />
        ) : null}
        {m.ledgerId ? (
          <DetailRow
            label="Ledger reference"
            value={<span className="font-mono text-xs">{m.ledgerId}</span>}
          />
        ) : null}
        {m.reversalOfId ? (
          <DetailRow
            label="Reversal of"
            value={<span className="font-mono text-xs">{m.reversalOfId}</span>}
          />
        ) : null}
        <DetailRow
          label="Note"
          value={noteText || "—"}
          fullWidth
        />
        <DetailRow
          label="Movement ID"
          value={<span className="font-mono text-xs text-black/60 break-all">{m.id}</span>}
          fullWidth
        />
        <DetailRow
          label="Created at"
          value={<span className="font-mono text-xs">{day(m.createdAt)}</span>}
        />
        {m.updatedAt ? (
          <DetailRow
            label="Updated at"
            value={<span className="font-mono text-xs">{day(m.updatedAt)}</span>}
          />
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        <div>
          {canReverse ? (
            <button
              type="button"
              className="btn btn-ghost-bad text-xs"
              disabled={isReversing}
              onClick={onReverse}
            >
              {isReversing ? "Reversing..." : "Reverse movement"}
            </button>
          ) : null}
        </div>
        <button type="button" className="btn btn-ghost text-xs" onClick={onClose}>
          Close
        </button>
      </div>
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
