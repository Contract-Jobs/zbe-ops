"use client";

import { useState } from "react";
import { Stamp, TableWrap, Username } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { useBalanceMovements, useVerifyInventoryBalance } from "@/hooks/use-inventory-balances";
import { useReverseInventoryMovement } from "@/hooks/use-inventory-movements";
import { useInventoryNodeMap } from "@/hooks/use-inventories";
import { QUANTITY_MOVEMENT_LABELS } from "@/lib/movement-labels";

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
  const { data, isLoading } = useBalanceMovements({ itemId, inventoryId, includeReversed: false });
  const { data: verifyData, isLoading: isVerifyLoading } = useVerifyInventoryBalance(itemId, inventoryId);
  const { byId: nodeById } = useInventoryNodeMap();
  const reverseMutation = useReverseInventoryMovement();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const movements = [...(data?.data ?? [])].sort(
    (a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime()
  );

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
                  <th className="hidden sm:table-cell">Logged By</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => {
                  const canReverse = m.id === topMovementId && !m.isReversed && !m.isReversal;
                  return (
                    <tr key={m.id}>
                      <td className="text-xs">{day(m.movementDate)}</td>
                      <td>
                        <Stamp value={QUANTITY_MOVEMENT_LABELS[m.movementType]} />
                      </td>
                      <td className="font-mono">{m.quantity}</td>
                      <td className="hidden text-sm sm:table-cell">
                        {locationLabel(m.sourceInventoryId)} → {locationLabel(m.destinationInventoryId)}
                      </td>
                      <td className="font-mono">{etb(m.unitCost)}</td>
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
                      <td>
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
    </div>
  );
}
