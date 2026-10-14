"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { ListToolbar } from "@/components/ListToolbar";
import { SortSelect, type SortState } from "@/components/SortSelect";
import { ConfirmDialog, PageHead, Stamp, TableWrap, Username, statusTone } from "@/components/ui";
import { day } from "@/lib/format";
import { currentUser, useStore } from "@/lib/store";
import { BULK_APPROVAL_LIMIT, type ApprovalSortBy } from "@/lib/api/approvals";
import { canApproveType, isAdmin } from "@/lib/auth/permissions";
import { useApprovals, useBulkProcessApprovals } from "@/hooks/use-approvals";
import type { Approval, ApprovalType, BulkApprovalResult } from "@/types/api";

const APPROVAL_SORT_OPTIONS: { value: ApprovalSortBy; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Updated" },
  { value: "status", label: "Status" },
  { value: "approvalType", label: "Type" },
];

function summaryOf(a: Approval) {
  return (
    (a as unknown as { summary?: string }).summary ??
    (a.notes || `${a.approvalType.replaceAll("_", " ")} #${a.recordId?.slice(0, 8) ?? a.id.slice(0, 8)}`)
  );
}

export default function ApprovalsPage() {
  const store = useStore();
  const role = currentUser(store).role;
  const admin = isAdmin(role);

  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<QueryFilterValues>({});
  const [sort, setSort] = useState<SortState<ApprovalSortBy>>({ sortBy: "createdAt", sortOrder: "desc" });

  const { data: approvalsData, isLoading } = useApprovals({
    status: status === "all" ? undefined : [status],
    approvalType: filters.approvalType ? [filters.approvalType] : undefined,
    submittedBy: filters.submittedBy ? [filters.submittedBy] : undefined,
    approvedBy: filters.approvedBy ? [filters.approvedBy] : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    resolvedFrom: filters.resolvedFrom || undefined,
    resolvedTo: filters.resolvedTo || undefined,
    search: filters.search || undefined,
    page,
    limit: 10,
    ...sort,
  });

  const apiApprovals = approvalsData?.data;
  const storeApprovals = useMemo(() => {
    return store.approvals.filter((a) => (status === "all" ? true : a.status === status));
  }, [store.approvals, status]);

  const rows = apiApprovals ?? (storeApprovals as unknown as Approval[]);

  // ---- Bulk resolve ----
  // Selection survives paging so a long queue can be worked through; the id →
  // type map is what lets the refresh fan out per type afterwards.
  const [selected, setSelected] = useState<Map<string, ApprovalType>>(new Map());
  const [notes, setNotes] = useState("");
  const [atomic, setAtomic] = useState(false);
  const [confirm, setConfirm] = useState<"approved" | "rejected" | null>(null);
  const [outcome, setOutcome] = useState<{ result?: BulkApprovalResult; error?: string } | null>(null);
  const [summaries, setSummaries] = useState<Map<string, string>>(new Map());
  const bulk = useBulkProcessApprovals();

  const canSelect = (a: Approval) => a.status === "pending" && (admin || canApproveType(role, a.approvalType));
  const selectable = rows.filter(canSelect);
  const allSelected = selectable.length > 0 && selectable.every((a) => selected.has(a.id));
  const overLimit = selected.size > BULK_APPROVAL_LIMIT;

  const toggle = (a: Approval) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(a.id)) next.delete(a.id);
      else next.set(a.id, a.approvalType);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      for (const a of selectable) {
        if (checked) next.set(a.id, a.approvalType);
        else next.delete(a.id);
      }
      return next;
    });

  async function runBulk() {
    if (!confirm) return;
    const decision = confirm;
    setConfirm(null);
    setOutcome(null);
    // Remember what each row said, so failures can be named after the refresh.
    setSummaries(new Map(rows.map((a) => [a.id, summaryOf(a)])));
    try {
      const res = await bulk.mutateAsync({
        approvals: Array.from(selected, ([id, approvalType]) => ({ id, approvalType })),
        status: decision,
        notes: notes.trim() || undefined,
        atomic,
      });
      setOutcome({ result: res.data });
      // Keep only what failed selected, so it can be retried or inspected.
      const failed = new Set(res.data.results.filter((r) => !r.ok).map((r) => r.approvalId));
      setSelected((prev) => new Map(Array.from(prev).filter(([id]) => failed.has(id))));
      if (res.data.failed === 0) {
        toast.success(`${res.data.succeeded} ${decision}.`);
        setNotes("");
      }
    } catch (err) {
      // Atomic mode: nothing was changed. The message names the failing approval.
      setOutcome({ error: err instanceof Error ? err.message : "The batch could not be applied." });
    }
  }

  const showUserFilters = admin;

  return (
    <div>
      <PageHead kicker="Workflow" title="Approvals" />
      <div className="mb-5 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn ${status === s ? "" : "btn-ghost"}`}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <ListToolbar
        sort={
          <SortSelect
            options={APPROVAL_SORT_OPTIONS}
            value={sort}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      >
      <QueryFilters
        className="contents"
        searchPlaceholder="Search notes"
        popover
        pinned={["search", "dateFrom", "dateTo"]}
        labels={{ dateFrom: "Submitted from", dateTo: "Submitted to" }}
        fields={[
          "search",
          "approvalType",
          ...(showUserFilters ? (["submittedBy", "approvedBy"] as const) : []),
          "dateFrom",
          "dateTo",
          "resolvedFrom",
          "resolvedTo",
        ]}
        values={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      </ListToolbar>

      {outcome ? (
        <div className="mb-5 border border-black/10 bg-paper/40 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            {outcome.error ? (
              <p className="text-bad">{outcome.error}</p>
            ) : outcome.result ? (
              <p>
                <span className="font-medium">
                  {outcome.result.succeeded} of {outcome.result.total} {outcome.result.decision}.
                </span>
                {outcome.result.failed > 0 ? ` ${outcome.result.failed} could not be applied and stay selected.` : ""}
              </p>
            ) : null}
            <button type="button" className="text-xs text-black/50 hover:underline" onClick={() => setOutcome(null)}>
              Dismiss
            </button>
          </div>
          {outcome.result && outcome.result.failed > 0 ? (
            <ul className="mt-3 border-t border-black/10">
              {outcome.result.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.approvalId} className="border-b border-black/10 py-2 last:border-0">
                    <p className="font-medium">{summaries.get(r.approvalId) ?? `Approval ${r.approvalId.slice(0, 8)}`}</p>
                    <p className="text-xs text-bad">
                      {r.error ?? "Could not be applied."}
                      {r.code ? <span className="ml-2 font-mono uppercase text-black/50">{r.code}</span> : null}
                    </p>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="mb-3 flex flex-col gap-3 border border-black/10 bg-paper/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {selected.size} selected{overLimit ? ` — at most ${BULK_APPROVAL_LIMIT} at a time` : ""}
            </span>
            <button
              type="button"
              className="btn px-2 py-0.5 text-xs"
              disabled={bulk.isPending || overLimit}
              onClick={() => setConfirm("approved")}
            >
              Approve selected
            </button>
            <button
              type="button"
              className="btn btn-ghost-bad px-2 py-0.5 text-xs"
              disabled={bulk.isPending || overLimit}
              onClick={() => setConfirm("rejected")}
            >
              Reject selected
            </button>
            <button type="button" className="text-xs text-black/50 hover:underline" onClick={() => setSelected(new Map())}>
              Clear
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="field w-full sm:max-w-sm"
              placeholder="Note added to each (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-black/70">
              <input type="checkbox" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} />
              All or nothing — if any one fails, change none
            </label>
          </div>
        </div>
      ) : null}

      {isLoading && !approvalsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading approvals...</div>
      ) : (
        <TableWrap pagination={approvalsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all pending approvals on this page"
                    disabled={selectable.length === 0}
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th>Request</th>
                <th className="hidden md:table-cell">Type</th>
                <th className="hidden sm:table-cell">Submitted by</th>
                <th className="hidden lg:table-cell">Resolved by</th>
                <th className="hidden md:table-cell">When</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    {canSelect(a) ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${summaryOf(a)}`}
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a)}
                      />
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/approvals/${a.id}`} className="font-medium hover:text-yellow">
                      {summaryOf(a)}
                    </Link>
                  </td>
                  <td className="hidden font-mono text-[0.75rem] uppercase md:table-cell">
                    {a.approvalType.replaceAll("_", " ")}
                  </td>
                  <td className="hidden sm:table-cell">
                    {a.submittedByName ?? <Username userId={a.submittedBy} />}
                  </td>
                  <td className="hidden lg:table-cell">
                    {a.approvedBy ? (a.approvedByName ?? <Username userId={a.approvedBy} />) : "—"}
                  </td>
                  <td className="hidden whitespace-nowrap md:table-cell">{day(a.createdAt)}</td>
                  <td>
                    <Stamp value={a.status} tone={statusTone(a.status)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-black/45">
                    No approvals found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "approved" ? `Approve ${selected.size} requests?` : `Reject ${selected.size} requests?`}
        body={
          confirm === "approved"
            ? `Each one is applied oldest first, as if approved one by one. ${
                atomic
                  ? "If any one cannot be applied, none are."
                  : "Any that cannot be applied are reported and left pending; the rest go through."
              }`
            : "Each one is rejected. Stock and money are not touched."
        }
        confirmLabel={confirm === "approved" ? "Approve and post" : "Reject"}
        danger={confirm === "rejected"}
        loading={bulk.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={runBulk}
      />
    </div>
  );
}
