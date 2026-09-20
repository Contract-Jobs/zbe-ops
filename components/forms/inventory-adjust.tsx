"use client";

import { useState } from "react";
import { useAdjustInventoryBalance } from "@/hooks/use-inventory";

export interface InventoryAdjustFormProps {
  balanceId: string;
  materialName: string;
  unit: string;
  currentQuantity: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  noBg?: boolean;
}

export function InventoryAdjustForm({
  balanceId,
  materialName,
  unit,
  currentQuantity,
  onSuccess,
  onCancel,
  noBg,
}: InventoryAdjustFormProps) {
  const [quantity, setQuantity] = useState<string>("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: adjustBalance, isPending } = useAdjustInventoryBalance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const q = Number(quantity);
    if (!quantity || isNaN(q) || q <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    if (q > currentQuantity) {
      setError(`Cannot adjust more than current balance (${currentQuantity} ${unit}).`);
      return;
    }

    try {
      await adjustBalance({
        id: balanceId,
        payload: {
          quantity: q,
          newUnitPrice: newUnitPrice ? newUnitPrice : undefined,
          notes: notes ? notes : undefined,
        },
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust balance");
    }
  };

  return (
    <div className={noBg ? "" : "border border-black/10 bg-paper/40 p-5"}>
      <p className="kicker mb-3">Adjust Balance: {materialName}</p>
      
      <p className="mb-3 text-sm text-black/60">
        Current balance: <span className="font-mono text-black">{currentQuantity} {unit}</span>
      </p>

      <label className="mb-3 block text-sm">
        Units to deduct *
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
        Override Unit Price (ETB)
        <input
          type="number"
          step="0.01"
          value={newUnitPrice}
          onChange={(e) => setNewUnitPrice(e.target.value)}
          className="field mt-1 font-mono"
          placeholder="Leave blank for average cost"
        />
      </label>

      <label className="mb-3 block text-sm">
        Notes
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field mt-1"
          placeholder="Reason (e.g. damaged)"
        />
      </label>

      <div className="flex items-center gap-3 mt-3">
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? "Submitting..." : "Adjust Balance"}
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
