"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, FormActions, ModalPanel } from "@/components/ui";
import { useUpdateInventoryItem } from "@/hooks/use-inventory-items";
import { etb } from "@/lib/format";

// At most 2 decimals, non-negative — what the API accepts.
export const MARKET_VALUE_PATTERN = /^\d+(\.\d{1,2})?$/;

// A balance row's market-value cells. null means "not set", never 0.
export function MarketValueCells({
  marketValue,
  totalMarketValue,
}: {
  marketValue?: string | null;
  totalMarketValue?: string | null;
}) {
  return (
    <>
      <td className="font-mono text-left min-w-[120px]">{marketValue != null ? etb(marketValue) : "—"}</td>
      <td className="font-mono text-left min-w-[120px]">{totalMarketValue != null ? etb(totalMarketValue) : "—"}</td>
    </>
  );
}

// Controlled version for callers that open it from a menu item (the menu
// unmounts on close, so the modal cannot live inside it).
export function MarketValueModal({
  itemId,
  itemName,
  unit,
  marketValue,
  averageUnitValue,
  onClose,
}: {
  itemId: string;
  itemName: string;
  unit: string;
  marketValue?: string | null;
  averageUnitValue?: string | null;
  onClose: () => void;
}) {
  return (
    <ModalPanel kicker="Material" title={`Market value · ${itemName}`} onClose={onClose}>
      <MarketValueForm
        itemId={itemId}
        unit={unit}
        current={marketValue ?? null}
        averageUnitValue={averageUnitValue}
        onDone={onClose}
      />
    </ModalPanel>
  );
}

// Row action: change the item's market price without leaving the balances
// table. The price belongs to the item, so it changes on every balance row of
// that item, at every location.
export function SetMarketValueButton({
  itemId,
  itemName,
  unit,
  marketValue,
  averageUnitValue,
  className = "ml-3 text-xs text-blue-600/80 hover:text-black hover:underline",
}: {
  itemId: string;
  itemName: string;
  unit: string;
  marketValue?: string | null;
  // The stock's cost per unit at this row, shown for comparison.
  averageUnitValue?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {marketValue != null ? "Market value" : "Set market value"}
      </button>
      {open ? (
        <ModalPanel kicker="Material" title={`Market value · ${itemName}`} onClose={() => setOpen(false)}>
          <MarketValueForm
            itemId={itemId}
            unit={unit}
            current={marketValue ?? null}
            averageUnitValue={averageUnitValue}
            onDone={() => setOpen(false)}
          />
        </ModalPanel>
      ) : null}
    </>
  );
}

function MarketValueForm({
  itemId,
  unit,
  current,
  averageUnitValue,
  onDone,
}: {
  itemId: string;
  unit: string;
  current: string | null;
  averageUnitValue?: string | null;
  onDone: () => void;
}) {
  const mutation = useUpdateInventoryItem();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setError(null);
    try {
      await mutation.mutateAsync({ id: itemId, payload: { marketValue: next } });
      toast.success(next === null ? "Market value cleared." : "Market value updated.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update market value");
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!MARKET_VALUE_PATTERN.test(trimmed)) {
      setError("Enter an amount of 0 or more, with at most 2 decimals.");
      return;
    }
    void save(trimmed);
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>
      ) : null}
      <p className="text-sm text-black/60">
        The current market price per {unit}. It is a reference price for valuing stock and does not change what the
        stock cost.
        {averageUnitValue ? (
          <>
            {" "}
            Cost here: <span className="font-mono">{etb(averageUnitValue)}</span> per {unit}.
          </>
        ) : null}
      </p>
      <Field label={`Market value per ${unit} (ETB)`}>
        <input
          className="field"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          disabled={mutation.isPending}
          autoFocus
        />
      </Field>
      <FormActions onCancel={onDone} loading={mutation.isPending} saveLabel="Save" />
      {current !== null ? (
        <button
          type="button"
          className="text-left text-xs text-bad hover:underline"
          disabled={mutation.isPending}
          onClick={() => void save(null)}
        >
          Clear market value
        </button>
      ) : null}
    </form>
  );
}
