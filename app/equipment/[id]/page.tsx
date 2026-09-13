"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EquipmentForm } from "@/components/forms/equipment";
import { LocationSelect } from "@/components/LocationSelect";
import {
  closedMode,
  DeleteConfirm,
  FormPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  type RecordMode,
} from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, locationName, submitApproval, useStore } from "@/lib/store";
import {
  useEquipment,
  useDeleteEquipment,
  useEquipmentLogs,
  useTransferEquipment,
  useSellEquipment,
  useConsumeEquipment,
  useReportMissingEquipment,
  useMaintenanceDispatch,
  useMaintenanceReturn,
  useDegradeEquipment,
  useAppreciateEquipment,
} from "@/hooks/use-equipment";
import { useLicenses } from "@/hooks/use-licenses";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import type { ApprovalType, LocationKind } from "@/lib/types";
import type { Equipment, EquipmentLog, License } from "@/types/api";

import { EquipmentMovementForm } from "@/components/forms/equipment-movement";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const { data: equipData, isLoading: isEquipLoading } = useEquipment(id);
  const { data: logsData } = useEquipmentLogs({ equipmentId: id });
  const { data: licensesData } = useLicenses();
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();

  const deleteEquipmentMutation = useDeleteEquipment();


  const item = equipData?.data ?? (store.equipment.find((e) => e.id === id) as unknown as Equipment | undefined);
  const canMutate = !isSiteManager(store);


  const [mode, setMode] = useState<RecordMode<Equipment>>(closedMode);
  const [msg, setMsg] = useState<string | null>(null);

  if (isEquipLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading equipment...</p>;
  }

  if (!item) return <p>Equipment not found.</p>;

  const logs: EquipmentLog[] = logsData?.data ??
    (store.equipmentLogs.filter((l) => l.equipmentId === item.id) as unknown as EquipmentLog[]);
  const licenses: License[] = licensesData?.data ?? (store.licenses as unknown as License[]);

  const here = item.siteId
    ? (sitesData?.data.find((s) => s.id === item.siteId)?.name ?? locationName("site", item.siteId, store))
    : item.warehouseId
      ? (warehousesData?.data.find((w) => w.id === item.warehouseId)?.name ?? locationName("warehouse", item.warehouseId, store))
      : "Off books";

  const status = item.currentStatus ?? (item as unknown as { status: string }).status;
  const ownership = item.ownershipStatus;
  const value = item.value ?? item.originalValue;
  const rentRate = item.rentRate;
  const isOnLoan = (item as unknown as { isOnLoan?: boolean }).isOnLoan;



  const handleDeleteEquipment = async () => {
    if (mode.kind === "delete" && mode.record) {
      try {
        if (equipData) {
          await deleteEquipmentMutation.mutateAsync(mode.record.id);
        }
        setMode(closedMode());
        router.push("/equipment");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to delete");
      }
    }
  };

  return (
    <div>
      <PageHead
        kicker="Asset"
        title={item.name}
        action={
          canMutate ? (
            <RecordActions
              onEdit={() => setMode({ kind: "edit", record: item })}
              onDelete={() => setMode({ kind: "delete", record: item, label: item.name })}
            />
          ) : undefined
        }
      />
      {mode.kind === "edit" ? (
        <FormPanel kicker="Asset" title="Edit equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm
            initial={mode.kind === "edit" ? mode.record : undefined}
            licenses={licenses}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_25rem] lg:gap-10">
        <div>
          <div className="mb-8 flex flex-wrap gap-2">
            <Stamp value={status} tone={statusTone(status)} />
            <Stamp value={ownership} />
            {isOnLoan ? <Stamp value="on loan" tone="yellow" /> : null}
          </div>
          <dl className="mb-10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="kicker">Serial</dt>
              <dd className="mt-1 font-mono">{item.serialNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="kicker">Book value</dt>
              <dd className="mt-1 font-mono">{etb(Number(value) || 0)}</dd>
            </div>
            <div>
              <dt className="kicker">Location</dt>
              <dd className="mt-1">{here}</dd>
            </div>
            <div>
              <dt className="kicker">Rent rate</dt>
              <dd className="mt-1 font-mono">{rentRate ? `${etb(Number(rentRate) || 0)} / day` : "—"}</dd>
            </div>
          </dl>
          <p className="kicker mb-2">Event log</p>
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{day(l.timestamp ?? l.createdAt)}</td>
                    <td>
                      <Stamp value={l.logType} />
                    </td>
                    <td className="font-mono text-sm">{l.price ? etb(Number(l.price) || 0) : "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm text-black/45">
                      No event log entries found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <EquipmentMovementForm 
          equipmentId={item.id} 
          fixedSource={item.siteId ? { id: item.siteId, type: "site", name: here } : item.warehouseId ? { id: item.warehouseId, type: "warehouse", name: here } : undefined}
        />
      </div>
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteEquipmentMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDeleteEquipment}
      />
    </div>
  );
}

