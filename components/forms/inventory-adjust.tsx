"use client";

import { useState } from "react";
import { useLogInventoryLoss } from "@/hooks/use-inventory-movements";

// v2 has no balance "adjust" action — the closest equivalent for real
// physical shrinkage/damage is a `loss` movement (requires a reason,
// priced from the current weighted-average cost, no client-supplied
// price). See docs/api-v2-migration-plan.md §3.1. For fixing a plain
// data-entry mistake, the correct v2 path is reversing the offending
// movement instead (POST /api/inventory-movements/[id]/reverse) — not
// covered by this form.
export interface InventoryAdjustFormProps {
  itemId: string;
  inventoryId: string;
  materialName: string;
  unit: string;
  currentQuantity: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  noBg?: boolean;
}

export function InventoryAdjustForm({
  itemId,
  inventoryId,
  materialName,
  unit,
  currentQuantity,
  onSuccess,
  onCancel,
  noBg,
}: InventoryAdjustFormProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: logLoss, isPending } = useLogInventoryLoss();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const q = Number(quantity);
    if (!quantity || isNaN(q) || q <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    if (q > currentQuantity) {
      setError(`Cannot report a loss greater than the current balance (${currentQuantity} ${unit}).`);
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    try {
      await logLoss({
        itemId,
        quantity: q,
        sourceInventoryId: inventoryId,
        metadata: { reason: reason.trim() },
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report loss");
    }
  };

  return (
    <div className={noBg ? "" : "border border-black/10 bg-paper/40 p-5"}>
      <p className="kicker mb-3">Report loss: {materialName}</p>

      <p className="mb-3 text-sm text-black/60">
        Current balance: <span className="font-mono text-black">{currentQuantity} {unit}</span>
      </p>

      <label className="mb-3 block text-sm">
        Units lost *
        <input
          type="number"
          step="0.01"
          required
          max={currentQuantity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="field mt-1"
          placeholder={`Max: ${currentQuantity}`}
        />
      </label>

      <label className="mb-3 block text-sm">
        Reason *
        <input
          type="text"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="field mt-1"
          placeholder="e.g. damaged in transit"
        />
      </label>

      <div className="flex items-center gap-3 mt-3">
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? "Submitting..." : "Report loss"}
        </button>
        {onCancel && (
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
