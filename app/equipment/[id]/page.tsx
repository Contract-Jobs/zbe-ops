"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EquipmentForm } from "@/components/forms/equipment";
import {
  closedMode,
  DeleteConfirm,
  FormPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  type RecordMode,
} from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useEquipment, useDeleteEquipment, useEquipmentTrace, useVerifyEquipmentState } from "@/hooks/use-equipment";
import { useReverseEquipmentMovement } from "@/hooks/use-equipment-movements";
import { useInventoryItem } from "@/hooks/use-inventory-items";
import { EQUIPMENT_MOVEMENT_LABELS } from "@/lib/movement-labels";
import type { IndividualEquipmentItem } from "@/types/api";

import { EquipmentMovementForm } from "@/components/forms/equipment-movement";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const { data: equipData, isLoading: isEquipLoading } = useEquipment(id);
  const { data: traceData } = useEquipmentTrace(id);
  const { data: verifyData, isLoading: isVerifyLoading } = useVerifyEquipmentState(id);

  const deleteEquipmentMutation = useDeleteEquipment();
  const reverseMutation = useReverseEquipmentMovement();

  const item = equipData?.data;
  const { data: catalogItemData } = useInventoryItem(item?.itemId);
  const canMutate = !isSiteManager(store);

  const [mode, setMode] = useState<RecordMode<IndividualEquipmentItem>>(closedMode);
  const [msg, setMsg] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);

  if (isEquipLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading equipment...</p>;
  }

  if (!item) return <p>Equipment not found.</p>;

  const trace = traceData?.data;
  const displayName = catalogItemData?.data.name ?? item.identifier;
  const here = trace?.currentLocation?.location ?? "Off books";
  // Newest first — same convention as BalanceHistoryPanel. Only the top row
  // is offered for reversal: reversing an older one out of order would
  // misrepresent what happened to the equipment in between.
  const history = [...(trace?.history ?? [])].sort(
    (a, b) => new Date(b.movement.movementDate).getTime() - new Date(a.movement.movementDate).getTime()
  );

  const handleReverse = async (movementId: string) => {
    setMsg(null);
    setReversingId(movementId);
    try {
      await reverseMutation.mutateAsync({ id: movementId });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to reverse movement");
    } finally {
      setReversingId(null);
    }
  };

  const handleDeleteEquipment = async () => {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteEquipmentMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
        router.push("/equipment");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to delete");
      }
    }
  };

  return (
    <div>
      <PageHead
        kicker="Asset"
        title={displayName}
        action={
          canMutate ? (
            <RecordActions
              onEdit={() => setMode({ kind: "edit", record: item })}
              onDelete={() => setMode({ kind: "delete", record: item, label: item.identifier })}
            />
          ) : undefined
        }
      />
      {mode.kind === "edit" ? (
        <FormPanel kicker="Asset" title="Edit equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm
            initial={mode.record}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_25rem] lg:gap-10">
        <div>
          <div className="mb-8 flex flex-wrap gap-2">
            <Stamp value={item.assignmentStatus} tone={statusTone(item.assignmentStatus)} />
            <Stamp value={item.lifecycleStatus} />
            <Stamp value={item.condition} />
            {!isVerifyLoading && verifyData ? (
              <Stamp
                value={verifyData.data.consistent ? "state consistent" : "state drifted"}
                tone={verifyData.data.consistent ? "ok" : "bad"}
              />
            ) : null}
          </div>
          <dl className="mb-10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="kicker">Identifier</dt>
              <dd className="mt-1 font-mono">{item.identifier}</dd>
            </div>
            <div>
              <dt className="kicker">Book value</dt>
              <dd className="mt-1 font-mono">{etb(Number(item.bookValue ?? item.originalValue) || 0)}</dd>
            </div>
            <div>
              <dt className="kicker">Location</dt>
              <dd className="mt-1">{here}</dd>
            </div>
            <div>
              <dt className="kicker">Vendor</dt>
              <dd className="mt-1">{item.vendorName ?? "—"}</dd>
            </div>
          </dl>
          <p className="kicker mb-2">Movement history</p>
          <TableWrap data={history}>
            {(pageRows) => (
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th className="hidden sm:table-cell">From / To</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((h) => {
                  const canReverse = h.movement.id === history[0]?.movement.id && !h.movement.isReversed && !h.movement.isReversal;
                  return (
                    <tr key={h.movement.id}>
                      <td>{day(h.movement.movementDate)}</td>
                      <td>
                        <Stamp value={EQUIPMENT_MOVEMENT_LABELS[h.movement.movementType]} />
                      </td>
                      <td className="hidden text-sm sm:table-cell">
                        {h.fromLabel || "—"} → {h.toLabel || "—"}
                      </td>
                      <td className="font-mono text-sm">{h.movement.movementCost ? etb(Number(h.movement.movementCost) || 0) : "—"}</td>
                      <td>
                        {h.movement.isReversed ? (
                          <Stamp value="reversed" tone="bad" />
                        ) : h.movement.isReversal ? (
                          <Stamp value="reversal" tone="yellow" />
                        ) : (
                          <Stamp value="posted" tone="ok" />
                        )}
                      </td>
                      <td>
                        {canReverse && canMutate ? (
                          <button
                            type="button"
                            className="text-xs text-bad hover:underline disabled:opacity-50"
                            disabled={reversingId === h.movement.id}
                            onClick={() => handleReverse(h.movement.id)}
                          >
                            {reversingId === h.movement.id ? "Reversing..." : "Reverse"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-black/45">
                      No movement history found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            )}
          </TableWrap>
        </div>
        <EquipmentMovementForm equipmentId={item.id} />
      </div>
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteEquipmentMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDeleteEquipment}
      />
      {msg ? <p className="mt-3 text-sm text-black/70">{msg}</p> : null}
    </div>
  );
}
