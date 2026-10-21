import { Stamp } from "@/components/ui";
import { etb, saleMargin } from "@/lib/format";
import type { InventoryMovement } from "@/types/api";

// Cost of goods sold and margin for one sale. COGS never moves when the price
// is edited, so margin follows the price. Null COGS (non-sales) renders nothing.
export function SaleCogs({ movement: m }: { movement: InventoryMovement }) {
  if (m.movementType !== "sale" || m.cogsTotalCost == null) return null;
  const margin = saleMargin(m.totalCost, m.cogsTotalCost);
  return (
    <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-3 sm:p-5">
      <div>
        <p className="kicker">Cost of goods</p>
        <p className="mt-1 font-mono text-xs">
          {etb(m.cogsTotalCost)}
          {m.cogsUnitCost != null ? <span className="text-black/50"> ({etb(m.cogsUnitCost)} / unit)</span> : null}
        </p>
        {m.cogsEstimated ? (
          <div className="mt-1">
            <Stamp value="estimated" tone="warn" />
          </div>
        ) : null}
      </div>
      <div>
        <p className="kicker">Margin</p>
        <p className={`mt-1 font-mono text-xs ${margin && margin.isNegative() ? "text-bad" : "text-ok"}`}>
          {margin ? etb(margin.toFixed(2)) : "—"}
        </p>
      </div>
    </div>
  );
}
