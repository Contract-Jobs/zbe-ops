"use client";

import { useState } from "react";
import { ConfirmDialog, Stamp, TableWrap } from "@/components/ui";
import { etb } from "@/lib/format";
import { useCostBreakdown, useVerifySiteLedger, useRebuildSiteLedger } from "@/hooks/use-ledgers";

// Cost breakdown + ledger integrity check/repair for one site — read:budget
// (site-scoped) covers breakdown and verify for any authorized viewer;
// rebuild is admin/superadmin only server-side, gated here to match.
export function LedgerToolsPanel({ siteId, canRebuild }: { siteId: string; canRebuild: boolean }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: breakdownData, isLoading: isBreakdownLoading } = useCostBreakdown({
    siteId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: verifyData, isLoading: isVerifyLoading } = useVerifySiteLedger(siteId);
  const rebuildMutation = useRebuildSiteLedger();
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const breakdown = breakdownData?.data;
  const verify = verifyData?.data;

  const handleRebuild = async () => {
    setRebuildMsg(null);
    try {
      await rebuildMutation.mutateAsync(siteId);
      setRebuildMsg("Ledger rebuilt from source events.");
    } catch (e) {
      setRebuildMsg(e instanceof Error ? e.message : "Failed to rebuild ledger");
    } finally {
      setConfirmRebuild(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <p className="kicker mb-2">Integrity</p>
        {isVerifyLoading && !verifyData ? (
          <p className="text-sm text-black/50">Checking...</p>
        ) : verify ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Stamp value={verify.consistent ? "consistent" : "drifted"} tone={verify.consistent ? "ok" : "bad"} />
            <span className="text-black/60">
              Stored {etb(verify.storedTotal)} · Expected {etb(verify.expectedTotal)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-black/50">Could not check.</p>
        )}
        {canRebuild ? (
          <button
            type="button"
            className="btn btn-ghost-bad mt-3"
            onClick={() => setConfirmRebuild(true)}
            disabled={rebuildMutation.isPending}
          >
            {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild ledger"}
          </button>
        ) : null}
        {rebuildMsg ? <p className="mt-2 text-sm text-black/60">{rebuildMsg}</p> : null}
      </div>

      <div>
        <p className="kicker mb-2">Cost breakdown</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="block text-sm">
            From
            <input type="date" className="field mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="block text-sm">
            To
            <input type="date" className="field mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        {isBreakdownLoading && !breakdownData ? (
          <p className="text-sm text-black/50">Loading...</p>
        ) : breakdown && breakdown.byCategory.length > 0 ? (
          <>
            <TableWrap data={breakdown.byCategory}>
              {(rows) => (
                <table className="data w-full text-left">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Total</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.categoryId ?? c.categoryName}>
                        <td className="font-medium">{c.categoryName}</td>
                        <td className="font-mono">{etb(c.total)}</td>
                        <td className="font-mono">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TableWrap>
            <p className="mt-3 text-sm font-medium">Total: {etb(breakdown.totalSpend)}</p>
          </>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No spend in this range.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRebuild}
        title="Rebuild this site's ledger?"
        body="Wipes and replays every ledger entry from source events (transactions, movements, reversals, in order). Heavy — a recovery tool, not routine maintenance."
        confirmLabel="Rebuild"
        danger
        loading={rebuildMutation.isPending}
        onCancel={() => setConfirmRebuild(false)}
        onConfirm={handleRebuild}
      />
    </div>
  );
}
