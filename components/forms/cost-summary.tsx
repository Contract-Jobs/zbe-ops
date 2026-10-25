"use client";

import { etb } from "@/lib/format";
import { VAT_RATE_PERCENT, amountToSend, costSummary, type CostKind } from "@/lib/vat";

// The tax controls and "what will be recorded" box for a purchase or sale.
// `amount` is what the user typed (per unit); the parent sends
// `amountToSend(...)` to the API.
export function CostSummary({
  kind,
  amount,
  quantity,
  includesTax,
  onIncludesTaxChange,
  noVat,
  onNoVatChange,
  itemExempt = false,
  disabled,
}: {
  kind: CostKind;
  amount: string;
  quantity: string | number;
  includesTax: boolean;
  onIncludesTaxChange: (next: boolean) => void;
  noVat: boolean;
  onNoVatChange: (next: boolean) => void;
  // The catalog item is flagged VAT-exempt: 0% regardless.
  itemExempt?: boolean;
  disabled?: boolean;
}) {
  const exempt = noVat || itemExempt;
  const send = amountToSend(kind, amount, includesTax, exempt);
  const summary = send ? costSummary(kind, send, quantity, exempt) : null;
  const cell = (v: { toFixed: (n: number) => string } | undefined) => (v ? etb(v.toFixed(2)) : "—");

  return (
    <div className="mb-3">
      {!exempt ? (
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input
            type="checkbox"
            checked={includesTax}
            disabled={disabled}
            onChange={(e) => onIncludesTaxChange(e.target.checked)}
          />
          Amount includes VAT
        </label>
      ) : null}
      <label className="mt-1 flex items-center gap-2 text-sm text-black/70">
        <input
          type="checkbox"
          checked={exempt}
          disabled={disabled || itemExempt}
          onChange={(e) => onNoVatChange(e.target.checked)}
        />
        {itemExempt
          ? "This item is VAT-exempt"
          : kind === "sale"
            ? "No VAT on this sale"
            : "No VAT was charged on this purchase"}
      </label>
      <p className="kicker mt-3">Cost summary</p>
      <dl className="mt-1 grid grid-cols-2 gap-1 border border-black/10 p-3 text-sm">
        {send && Number(quantity) > 0 ? (
          <>
            <dt className="text-black/60">{kind === "sale" ? "Price × quantity" : "Cost × quantity"}</dt>
            <dd className="text-right font-mono text-black/60">
              {etb(send)} × {Number(quantity)}
            </dd>
          </>
        ) : null}
        <dt className="text-black/60">Before VAT</dt>
        <dd className="text-right font-mono">{cell(summary?.net)}</dd>
        <dt className="text-black/60">{exempt ? "VAT (exempt)" : `VAT ${VAT_RATE_PERCENT}%`}</dt>
        <dd className="text-right font-mono">{cell(summary?.vat)}</dd>
        <dt className="font-medium">{kind === "sale" ? "Total to pay" : "Total paid"}</dt>
        <dd className="text-right font-mono font-medium">{cell(summary?.gross)}</dd>
      </dl>
    </div>
  );
}
