"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SortSelect, type SortState } from "@/components/SortSelect";

type ApprovalSortBy = "createdAt" | "updatedAt" | "status" | "approvalType";

const APPROVAL_SORT_OPTIONS: { value: ApprovalSortBy; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Updated" },
  { value: "status", label: "Status" },
  { value: "approvalType", label: "Type" },
];
import { PageHead, Stamp, TableWrap, Username, statusTone } from "@/components/ui";
import { day } from "@/lib/format";
import { userName, useStore } from "@/lib/store";
import { useApprovals } from "@/hooks/use-approvals";
import type { Approval } from "@/types/api";

export default function ApprovalsPage() {
  const store = useStore();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [page, setPage] = useState(1);

  const [sort, setSort] = useState<SortState<ApprovalSortBy>>({ sortBy: "createdAt", sortOrder: "desc" });

  const { data: approvalsData, isLoading } = useApprovals({
    status: status === "all" ? undefined : [status],
    page,
    limit: 10,
    ...sort,
  });

  const apiApprovals = approvalsData?.data;
  const storeApprovals = useMemo(() => {
    return store.approvals.filter((a) => (status === "all" ? true : a.status === status));
  }, [store.approvals, status]);

  const rows = (apiApprovals ?? (storeApprovals as unknown as Approval[]));

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
      <div className="mb-5">
        <SortSelect
          options={APPROVAL_SORT_OPTIONS}
          value={sort}
          onChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
      </div>
      {isLoading && !approvalsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading approvals...</div>
      ) : (
        <TableWrap pagination={approvalsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Request</th>
                <th className="hidden md:table-cell">Type</th>
                <th className="hidden sm:table-cell">By</th>
                <th className="hidden md:table-cell">When</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const summary = (a as unknown as { summary?: string }).summary ??
                  (a.notes || `${a.approvalType.replaceAll("_", " ")} #${a.recordId?.slice(0, 8) ?? a.id.slice(0, 8)}`);
                const createdBy = (a as unknown as { createdBy?: string }).createdBy ?? a.submittedBy;

                return (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/approvals/${a.id}`} className="font-medium hover:text-yellow">
                        {summary}
                      </Link>
                    </td>
                    <td className="hidden font-mono text-[0.75rem] uppercase md:table-cell">
                      {a.approvalType.replaceAll("_", " ")}
                    </td>
                    <td className="hidden sm:table-cell"><Username userId={a.approvedBy} /></td>
                    <td className="hidden whitespace-nowrap md:table-cell">{day(a.createdAt)}</td>
                    <td>
                      <Stamp value={a.status} tone={statusTone(a.status)} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-black/45">
                    No approvals found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

