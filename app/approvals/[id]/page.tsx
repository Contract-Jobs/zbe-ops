"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHead, Stamp, statusTone } from "@/components/ui";
import { day } from "@/lib/format";
import { approveApproval, locationName, rejectApproval, useStore, userName } from "@/lib/store";

export default function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const item = store.approvals.find((a) => a.id === id);
  const [error, setError] = useState<string | null>(null);

  if (!item) return <p>Approval not found.</p>;

  const act = (fn: () => void) => {
    try {
      fn();
      router.push("/approvals");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const p = item.payload;

  return (
    <div className="max-w-3xl">
      <PageHead kicker="Approval" title={item.summary} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Stamp value={item.status} tone={statusTone(item.status)} />
        <span className="font-mono text-[0.75rem] uppercase text-black/50">
          {item.approvalType.replaceAll("_", " ")}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <Row label="Raised by" value={userName(item.createdBy, store)} />
        <Row label="Raised" value={day(item.createdAt)} />
        {p.quantity != null ? <Row label="Quantity" value={String(p.quantity)} /> : null}
        {p.unitPrice != null ? <Row label="Unit price" value={String(p.unitPrice)} /> : null}
        {p.price != null ? <Row label="Amount" value={String(p.price)} /> : null}
        {p.fromId ? <Row label="From" value={locationName(p.fromKind, p.fromId, store)} /> : null}
        {p.toId ? <Row label="To" value={locationName(p.toKind, p.toId, store)} /> : null}
        {p.buyerName ? <Row label="Buyer" value={p.buyerName} /> : null}
        {p.vendorName ? <Row label="Vendor" value={p.vendorName} /> : null}
        {p.note ? <Row label="Note" value={p.note} /> : null}
        {item.decidedBy ? <Row label="Decided by" value={userName(item.decidedBy, store)} /> : null}
      </dl>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      {item.status === "pending" ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn" onClick={() => act(() => approveApproval(item.id))}>
            Approve and post
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => act(() => rejectApproval(item.id))}>
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
