"use client";

import Decimal from "decimal.js";
import { useState } from "react";
import { toast } from "sonner";
import { ModalPanel, Username } from "@/components/ui";
import { useUpdateSalePrice } from "@/hooks/use-inventory-movements";
import { ApiError } from "@/lib/api/client";
import { day, etb, qtyNum } from "@/lib/format";
import type { InventoryMovement } from "@/types/api";

// Only a live sale can be re-priced.
export function canEditPrice(m: Pick<InventoryMovement, "movementType" | "isReversed" | "isReversal">): boolean {
  return m.movementType === "sale" && !m.isReversed && !m.isReversal;
}

const CLIENT_PAID_MSG = "Reverse a payment first, then edit the price.";
const SITE_PAID_MSG = "Reverse a site payment first, then edit the price.";

interface PriceChange {
  from: string;
  to: string;
  by?: string;
  at?: string;
  reason?: string | null;
}

function priceHistory(m: InventoryMovement): PriceChange[] {
  const raw = m.metadata?.priceHistory;
  return Array.isArray(raw) ? (raw as PriceChange[]) : [];
}

export function PriceHistory({ movement }: { movement: InventoryMovement }) {
  const history = priceHistory(movement);
  if (history.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="kicker">Price edits</p>
      <ul className="mt-2 divide-y divide-black/10 border border-black/10 text-sm">
        {history.map((h, i) => (
          <li key={`${h.at ?? i}-${i}`} className="px-3 py-2">
            <div className="font-mono text-xs">
              {etb(h.from)} → {etb(h.to)}
            </div>
            <div className="text-xs text-black/60">
              {h.at ? day(h.at) : "—"}
              {h.by ? (
                <>
                  {" "}by <Username userId={h.by} fallback={h.by} />
                </>
              ) : null}
              {h.reason ? ` — ${h.reason}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditSalePriceModal({
  movement,
  unit,
  onClose,
}: {
  movement: InventoryMovement;
  unit?: string;
  onClose: () => void;
}) {
  const [unitCost, setUnitCost] = useState(Number(movement.unitCost).toFixed(2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateSalePrice();

  const isSiteSale = Boolean(movement.isInternal || movement.buyerSiteId);
  const parsed = /^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(unitCost.trim()) ? new Decimal(unitCost.trim()) : null;
  const newTotal = parsed ? parsed.times(movement.quantity) : null;
  // A site never has a per-sale paid amount — its payments live in the account.
  const paid = !isSiteSale && movement.paidAmount != null ? new Decimal(movement.paidAmount) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!parsed || !newTotal) {
      setError("Enter a price with at most 2 decimals.");
      return;
    }
    if (parsed.lte(0)) {
      setError("Price must be greater than 0.");
      return;
    }
    if (paid && newTotal.lt(paid)) {
      setError(CLIENT_PAID_MSG);
      return;
    }
    try {
      await mutation.mutateAsync({ id: movement.id, unitCost: parsed.toFixed(2), reason });
      toast.success("Sale price updated.");
      onClose();
    } catch (err) {
      // The API client already toasted the raw server message; replace it
      // with the plain instruction where we know what to say.
      if (err instanceof ApiError && err.status === 409) {
        toast.dismiss();
        const msg = isSiteSale ? SITE_PAID_MSG : CLIENT_PAID_MSG;
        setError(msg);
        toast.error(msg);
      } else if (err instanceof ApiError && err.code === "VALIDATION_FAILED") {
        setError(err.details?.[0]?.message ?? err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return (
    <ModalPanel kicker="Sale" title="Edit selling price" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-3 text-sm text-black/60">
          {movement.item?.name ?? "Sale"} · {qtyNum(movement.quantity)} {unit ?? movement.item?.unit ?? ""}
        </p>
        <label className="mb-3 block text-sm">
          Unit price (ETB) *
          <input
            className="field mt-1"
            type="number"
            step="0.01"
            min="0.01"
            required
            inputMode="decimal"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            disabled={mutation.isPending}
          />
        </label>
        <dl className="mb-3 grid grid-cols-2 gap-2 border border-black/10 p-3 text-sm">
          <dt className="text-black/60">Current total</dt>
          <dd className="text-right font-mono">{etb(movement.totalCost)}</dd>
          <dt className="text-black/60">New total</dt>
          <dd className="text-right font-mono">{newTotal ? etb(newTotal.toFixed(2)) : "—"}</dd>
          {paid ? (
            <>
              <dt className="text-black/60">Already paid</dt>
              <dd className="text-right font-mono">{etb(paid.toFixed(2))}</dd>
            </>
          ) : null}
        </dl>
        <label className="mb-3 block text-sm">
          Reason (optional)
          <input
            className="field mt-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Agreed discount"
            disabled={mutation.isPending}
          />
        </label>
        <p className="mb-3 text-xs text-black/50">Stock and cost of goods sold do not change.</p>
        {error ? <p className="mb-3 text-sm text-bad">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" className="btn" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save price"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
        </div>
      </form>
    </ModalPanel>
  );
}
