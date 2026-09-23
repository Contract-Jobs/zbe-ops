"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog, PageHead, Stamp, statusTone, Username } from "@/components/ui";
import { day } from "@/lib/format";
import { approveApproval, currentUser, rejectApproval, useStore } from "@/lib/store";
import { useApproval, useApproveApproval, useRejectApproval, useCanActOnApproval } from "@/hooks/use-approvals";
import { useTransaction } from "@/hooks/use-transactions";
import { useTask } from "@/hooks/use-tasks";
import type { Approval } from "@/types/api";

export default function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();

  const { data: approvalData, isLoading: isApprovalLoading } = useApproval(id);
  const approveMutation = useApproveApproval();
  const rejectMutation = useRejectApproval();

  const storeItem = store.approvals.find((a) => a.id === id);
  const item: Approval | undefined = approvalData?.data ?? (storeItem as unknown as Approval);
  const { canAct } = useCanActOnApproval(item, currentUser(store).role);

  // v2 has no single-record GET for inventory-movements/equipment-movements/
  // rental-events (only list + create + reverse) — so unlike transaction/
  // progress_log, those types can't be enriched with quantity/price/location
  // detail here. See docs/api-v2-migration-plan.md §3.7.
  const tx = useTransaction(item?.approvalType === "transaction" ? item.recordId : undefined);
  const task = useTask(item?.approvalType === "progress_log" ? item.recordId : undefined);

  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);

  if (isApprovalLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading approval...</p>;
  }

  if (!item) return <p>Approval not found.</p>;

  const isRecordDetailUnavailable = item.approvalType === "inventory_movement" || item.approvalType === "equipment_movement" || item.approvalType === "rental_event";

  const summary = item.notes || `${item.approvalType.replaceAll("_", " ")} #${item.recordId?.slice(0, 8) ?? item.id.slice(0, 8)}`;

  const handleApprove = async () => {
    setError(null);
    try {
      if (approvalData?.data) {
        await approveMutation.mutateAsync({
          approval: {
            id: approvalData.data.id,
            approvalType: approvalData.data.approvalType,
            recordId: approvalData.data.recordId,
          },
        });
      } else {
        approveApproval(item.id);
      }
      setConfirm(null);
      router.push("/approvals");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    }
  };

  const handleReject = async () => {
    setError(null);
    try {
      if (approvalData?.data) {
        await rejectMutation.mutateAsync({ id: approvalData.data.id });
      } else {
        rejectApproval(item.id);
      }
      setConfirm(null);
      router.push("/approvals");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    }
  };

  const isPendingMutation = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="max-w-3xl">
      <PageHead kicker="Approval" title={summary} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Stamp value={item.status} tone={statusTone(item.status)} />
        <span className="font-mono text-[0.75rem] uppercase text-black/50">
          {item.approvalType.replaceAll("_", " ")}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <Row label="Raised by" value={<Username userId={item.submittedBy} />} />
        <Row label="Raised" value={day(item.createdAt)} />
        {item.approvalType === "transaction" && tx.data?.data ? (
          <>
            <Row label="Amount" value={String(tx.data.data.amount)} />
            <Row label="Note" value={tx.data.data.description ?? "—"} />
          </>
        ) : null}
        {item.approvalType === "progress_log" && task.data?.data ? (
          <>
            <Row label="Task" value={task.data.data.title} />
            {task.data.data.notes ? <Row label="Note" value={task.data.data.notes} /> : null}
          </>
        ) : null}
        {item.notes ? <Row label="Note" value={item.notes} /> : null}
        {item.approvedBy ? <Row label="Decided by" value={<Username userId={item.approvedBy} />} /> : null}
      </dl>
      {isRecordDetailUnavailable ? (
        <p className="mt-4 text-sm text-black/50">
          Movement detail (quantity, price, location) isn't available from this screen — the API only exposes it via the movements list, not a single-record lookup. Cross-check the underlying movement/rental list if you need it before deciding.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      {item.status === "pending" && canAct ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn"
            disabled={isPendingMutation}
            onClick={() => setConfirm("approve")}
          >
            {approveMutation.isPending ? "Approving..." : "Approve and post"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isPendingMutation}
            onClick={() => setConfirm("reject")}
          >
            {rejectMutation.isPending ? "Rejecting..." : "Reject"}
          </button>
        </div>
      ) : item.status === "pending" ? (
        <p className="mt-6 text-sm text-black/50">You don't have permission to resolve this approval.</p>
      ) : null}
      <ConfirmDialog
        open={confirm === "approve"}
        title="Are you sure?"
        body="This posts the event: stock, plant status, and any money line will change."
        confirmLabel="Approve and post"
        danger={false}
        loading={approveMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={handleApprove}
      />
      <ConfirmDialog
        open={confirm === "reject"}
        title="Are you sure?"
        body="The queued event will be dropped. Nothing moves."
        confirmLabel="Reject"
        loading={rejectMutation.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={handleReject}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
