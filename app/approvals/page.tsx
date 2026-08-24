"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { day } from "@/lib/format";
import { userName, useStore } from "@/lib/store";

export default function ApprovalsPage() {
  const store = useStore();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const rows = useMemo(() => {
    return store.approvals.filter((a) => (status === "all" ? true : a.status === status));
  }, [store.approvals, status]);

  return (
    <div>
      <PageHead kicker="Workflow" title="Approvals" />
      <div className="mb-5 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn ${status === s ? "" : "btn-ghost"}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <TableWrap>
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
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`/approvals/${a.id}`} className="font-medium hover:text-yellow">
                  {a.summary}
                </Link>
              </td>
              <td className="hidden font-mono text-[0.75rem] uppercase md:table-cell">{a.approvalType.replaceAll("_", " ")}</td>
              <td className="hidden sm:table-cell">{userName(a.createdBy, store)}</td>
              <td className="hidden whitespace-nowrap md:table-cell">{day(a.createdAt)}</td>
              <td>
                <Stamp value={a.status} tone={statusTone(a.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableWrap>
    </div>
  );
}
