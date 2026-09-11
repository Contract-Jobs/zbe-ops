"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog, PageHead, Stamp, statusTone } from "@/components/ui";
import { day } from "@/lib/format";
import { approveApproval, locationName, rejectApproval, useStore, userName } from "@/lib/store";
import { useApproval, useApproveApproval, useRejectApproval } from "@/hooks/use-approvals";
import { useMaterialLog } from "@/hooks/use-materials";
import { useEquipmentLog } from "@/hooks/use-equipment";
import { useTransaction } from "@/hooks/use-transactions";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import type { LocationKind } from "@/lib/types";
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

  const matLog = useMaterialLog(item?.approvalType === "material_movement" ? item.recordId : undefined);
  const eqLog = useEquipmentLog(item?.approvalType === "equipment_movement" ? item.recordId : undefined);
  const tx = useTransaction(item?.approvalType === "transaction" ? item.recordId : undefined);

  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();

  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);

  if (isApprovalLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading approval...</p>;
  }

  if (!item) return <p>Approval not found.</p>;

  const resolveLocation = (kind: "site" | "warehouse" | undefined, locId: string | undefined) => {
    if (!kind || !locId) return null;
    if (kind === "site") {
      const s = sitesData?.data.find((site) => site.id === locId);
      return s ? s.name : locationName("site", locId, store);
    }
    const w = warehousesData?.data.find((wh) => wh.id === locId);
    return w ? w.name : locationName("warehouse", locId, store);
  };

  const p = (item as unknown as { payload?: Record<string, unknown> }).payload ?? {
    quantity: matLog.data?.data.quantity,
    unitPrice: matLog.data?.data.unitPrice,
    price: eqLog.data?.data.price ?? tx.data?.data.amount,
    fromId: matLog.data?.data.fromSiteId ?? matLog.data?.data.fromWarehouseId ?? eqLog.data?.data.fromSiteId ?? eqLog.data?.data.fromWarehouseId,
    fromKind: (matLog.data?.data.fromSiteId || eqLog.data?.data.fromSiteId) ? "site" : "warehouse",
    toId: matLog.data?.data.toSiteId ?? matLog.data?.data.toWarehouseId ?? eqLog.data?.data.toSiteId ?? eqLog.data?.data.toWarehouseId,
    toKind: (matLog.data?.data.toSiteId || eqLog.data?.data.toSiteId) ? "site" : "warehouse",
    buyerName: matLog.data?.data.buyerName ?? eqLog.data?.data.buyerName,
    vendorName: eqLog.data?.data.vendorName,
    note: matLog.data?.data.notes ?? eqLog.data?.data.notes ?? tx.data?.data.description ?? item.notes,
  };

  const summary = (item as unknown as { summary?: string }).summary ??
    (item.notes || `${item.approvalType.replaceAll("_", " ")} #${item.recordId?.slice(0, 8) ?? item.id.slice(0, 8)}`);
  const createdBy = (item as unknown as { createdBy?: string }).createdBy ?? item.submittedBy;
  const decidedBy = (item as unknown as { decidedBy?: string }).decidedBy ?? item.approvedBy;

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
        <Row label="Raised by" value={userName(createdBy, store)} />
        <Row label="Raised" value={day(item.createdAt)} />
        {p.quantity != null ? <Row label="Quantity" value={String(p.quantity)} /> : null}
        {p.unitPrice != null ? <Row label="Unit price" value={String(p.unitPrice)} /> : null}
        {p.price != null ? <Row label="Amount" value={String(p.price)} /> : null}
        {p.fromId ? <Row label="From" value={resolveLocation(p.fromKind as LocationKind, String(p.fromId)) ?? String(p.fromId)} /> : null}
        {p.toId ? <Row label="To" value={resolveLocation(p.toKind as LocationKind, String(p.toId)) ?? String(p.toId)} /> : null}
        {p.buyerName ? <Row label="Buyer" value={String(p.buyerName)} /> : null}
        {p.vendorName ? <Row label="Vendor" value={String(p.vendorName)} /> : null}
        {p.note ? <Row label="Note" value={String(p.note)} /> : null}
        {decidedBy ? <Row label="Decided by" value={userName(decidedBy, store)} /> : null}
      </dl>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      {item.status === "pending" ? (
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

