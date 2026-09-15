"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SiteForm, TaskForm } from "@/components/forms/site";
import {
  closedMode,
  DeleteConfirm,
  FormPanel,
  ModalPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  type RecordMode,
  FormActions,
  Username,
} from "@/components/ui";
import { day, etb, stamp } from "@/lib/format";
import {
  addTask,
  claimTask,
  completeTask,
  currentUser,
  isSiteManager,
  useStore,
  userName,
  visibleSiteIds,
} from "@/lib/store";
import {
  useSite,
  useSiteTasks,
  useCreateSiteTask,
  useClaimSiteTask,
  useCompleteSiteTask,
  useDeleteSiteTask,
  useSiteLifecycle,
  useDeleteSite,
} from "@/hooks/use-sites";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useInventoryBalances } from "@/hooks/use-inventory";
import { useMaterials } from "@/hooks/use-materials";
import { useTransactions } from "@/hooks/use-transactions";
import { useLicenses } from "@/hooks/use-licenses";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { TransactionForm } from "@/components/forms/transaction";
import type { Site, SiteTask, Equipment, InventoryBalance, MaterialCatalog, License, SiteLifecycleLog } from "@/types/api";

const getTaskStatus = (task: SiteTask) => {
  if (task.isCompleted) return "completed";
  if (task.completionClaimBy) return "claimed";
  return "open";
};

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const allowed = visibleSiteIds(store);

  const { data: siteData, isLoading: isSiteLoading } = useSite(id);
  const [taskPage, setTaskPage] = useState(1);
  const { data: tasksData } = useSiteTasks(id, { page: taskPage, limit: 10 });
  const [equipPage, setEquipPage] = useState(1);
  const { data: equipData } = useEquipmentList({ siteId: id ? [id] : undefined, page: equipPage, limit: 10 });
  const [balPage, setBalPage] = useState(1);
  const { data: balancesData } = useInventoryBalances({ siteId: id ? [id] : undefined, page: balPage, limit: 10 });
  const { data: materialsData } = useMaterials();
  const { data: lifecycleData } = useSiteLifecycle(id);
  const { data: txData } = useTransactions({ siteId: id ? [id] : undefined });
  const { data: licensesData } = useLicenses();

  const site = siteData?.data ?? (store.sites.find((s) => s.id === id) as unknown as Site | undefined);

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<RecordMode<Site>>(closedMode);
  const [taskMode, setTaskMode] = useState<RecordMode<SiteTask>>(closedMode);
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);
  const [moveMaterialId, setMoveMaterialId] = useState<string | null>(null);
  const [moveEquipmentId, setMoveEquipmentId] = useState<string | null>(null);
  const [purchaseMaterialOpen, setPurchaseMaterialOpen] = useState(false);
  const [purchaseEquipmentOpen, setPurchaseEquipmentOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);

  const createSiteTaskMutation = useCreateSiteTask(id || "");
  const claimSiteTaskMutation = useClaimSiteTask(id || "");
  const completeSiteTaskMutation = useCompleteSiteTask(id || "");
  const deleteSiteTaskMutation = useDeleteSiteTask(id || "");
  const deleteSiteMutation = useDeleteSite();

  const manager = isSiteManager(store);
  const canMutate = !manager;
  const user = currentUser(store);
  const isClosed = site?.status === "closed";

  const transactions = useMemo(() => {
    return txData?.data ?? store.transactions.filter((t) => t.siteId === id && !t.isReversal);
  }, [id, store.transactions, txData?.data]);

  const spend = useMemo(() => {
    const out = transactions
      .filter((t) => t.type === "money_out")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const inn = transactions
      .filter((t) => t.type === "money_in")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const labor = transactions
      .filter((t) => t.type === "money_out" && t.categoryId === "cat_labor")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const material = transactions
      .filter((t) => t.type === "money_out" && t.categoryId === "cat_mat")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { out, inn, labor, material };
  }, [transactions]);

  if (isSiteLoading && !site) {
    return <p className="p-8 text-center text-sm text-black/50">Loading site...</p>;
  }

  if (!site || (manager && !allowed.has(site.id))) {
    return <p>Site not found, or you are not assigned to it.</p>;
  }

  const tasks: SiteTask[] = tasksData?.data ??
    (store.tasks.filter((t) => t.siteId === site.id) as unknown as SiteTask[]);
  const logs = lifecycleData?.data ?? store.siteLifecycle.filter((l) => l.siteId === site.id);
  const eqs: Equipment[] = equipData?.data ??
    (store.equipment.filter((e) => e.siteId === site.id) as unknown as Equipment[]);
  const bals: InventoryBalance[] = balancesData?.data ??
    (store.balances.filter((b) => b.locationKind === "site" && b.locationId === site.id) as unknown as InventoryBalance[]);
  const materials: MaterialCatalog[] = balancesData?.data.map(d => (d as any).material as unknown as MaterialCatalog) || [];
  const licenses: License[] = licensesData?.data ?? (store.licenses as unknown as License[]);

  const handleAddTask = async (data: { title: string; targetDate?: string }) => {
    if (!data.title.trim()) return;
    try {
      if (tasksData) {
        await createSiteTaskMutation.mutateAsync({ title: data.title.trim(), targetDate: data.targetDate });
      } else {
        addTask(site.id, data.title.trim(), data.targetDate);
      }
      setTaskMode(closedMode());
    } catch {
      // Ignore or show error
    }
  };

  const handleEditTask = async (data: { title: string; targetDate?: string }) => {
    // In a real app, this would mutate the task.
    // We will just close the modal for now since there's no edit mutation yet.
    setTaskMode(closedMode());
  };

  const handleClaimTask = async (taskId: string, claimNotes?: string) => {
    try {
      if (tasksData) {
        await claimSiteTaskMutation.mutateAsync({ taskId, notes: claimNotes || undefined });
      } else {
        claimTask(taskId, claimNotes || undefined);
      }
      setTaskMode(closedMode());
    } catch {
      // Ignore
    }
  };

  const handleCompleteTask = async (taskId: string, reviewNotes?: string) => {
    try {
      if (tasksData) {
        await completeSiteTaskMutation.mutateAsync({ taskId, review: reviewNotes || "Approved" });
      } else {
        completeTask(taskId, reviewNotes || "Approved");
      }
      setTaskMode(closedMode());
    } catch {
      // Ignore
    }
  };

  const handleDeleteTask = async () => {
    if (taskMode.kind === "delete" && taskMode.record) {
      try {
        if (tasksData) {
          await deleteSiteTaskMutation.mutateAsync(taskMode.record.id);
        }
        setTaskMode(closedMode());
      } catch {
        // Ignore
      }
    }
  };

  const handleDeleteSite = async () => {
    if (mode.kind === "delete" && mode.record) {
      try {
        if (siteData) {
          await deleteSiteMutation.mutateAsync(mode.record.id);
        }
        setMode(closedMode());
        router.push("/sites");
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div>
      <PageHead
        kicker="Site"
        title={
          <span className="flex items-baseline gap-4">
            {site.name}
            <button
              type="button"
              className="text-base! text-[#0072c3] underline bg-transparent hover:text-[#005a9c]"
              onClick={() => setLifecycleModalOpen(true)}
            >
              See Lifecycle
            </button>
          </span>
        }
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Stamp value={site.status} tone={statusTone(site.status)} />
            {canMutate ? (
              <RecordActions
                onEdit={() => setMode({ kind: "edit", record: site })}
                onDelete={() => setMode({ kind: "delete", record: site, label: site.name })}
              />
            ) : null}
          </span>
        }
      />
      <p className="mb-8 text-black/60">{site.location ?? (site as unknown as { address?: string }).address ?? ""}</p>
      {mode.kind === "edit" ? (
        <FormPanel kicker="Site" title="Edit site" onClose={() => setMode(closedMode())}>
          <SiteForm
            initial={mode.kind === "edit" ? mode.record : undefined}
            licenses={licenses}
            users={store.users}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}

      <div className="mt-8 mb-4 flex items-center justify-between">
        <p className="kicker">Financials</p>
        {(!manager || user.siteIds.includes(site.id)) && !isClosed ? (
          <button
            className="btn"
            onClick={() => setAddTxOpen(true)}
          >
            Add Transaction
          </button>
        ) : null}
      </div>
      {addTxOpen ? (
        <FormPanel kicker="Money" title="Log Manual Transaction" onClose={() => setAddTxOpen(false)}>
          <TransactionForm initialSiteId={site.id} onDone={() => setAddTxOpen(false)} />
        </FormPanel>
      ) : null}

      <div className="grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="kicker">Labor Budget</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(site.laborBudget))}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Materials Budget</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(site.materialBudget))}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Approved Spend</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(spend.out)}</p>
          <p className="text-sm text-black/45">Revenue {etb(spend.inn)}</p>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <p className="kicker">Tasks</p>
          {(!manager || user.siteIds.includes(site.id)) && !isClosed ? (
            <button
              className="btn"
              onClick={() => setTaskMode({ kind: "create" })}
            >
              New Task
            </button>
          ) : null}
        </div>
        {taskMode.kind === "create" || taskMode.kind === "edit" ? (
          <FormPanel kicker="Task" title={taskMode.kind === "edit" ? "Edit task" : "New task"} onClose={() => setTaskMode(closedMode())}>
            <TaskForm
              initial={taskMode.kind === "edit" ? taskMode.record : undefined}
              onCancel={() => setTaskMode(closedMode())}
              onSubmit={taskMode.kind === "create" ? handleAddTask : handleEditTask}
            />
          </FormPanel>
        ) : null}
        {taskMode.kind === "view" && taskMode.record ? (
          <FormPanel kicker="Task" title="Task Details" onClose={() => setTaskMode(closedMode())}>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold">Title</p>
                <p>{taskMode.record.title}</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Status</p>
                <p className="capitalize">{getTaskStatus(taskMode.record)}</p>
              </div>
              {taskMode.record.completionClaimBy && (
                <div>
                  <p className="text-sm font-semibold">Claimed By</p>
                  <p>
                    <Username userId={taskMode.record.completionClaimBy} />
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">Target Date</p>
                <p>{taskMode.record.targetDate ? day(taskMode.record.targetDate) : "—"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Completed Date</p>
                <p>{taskMode.record.completedDate ? stamp(taskMode.record.completedDate) : "—"}</p>
              </div>
              {taskMode.record.notes && (
                <div>
                  <p className="text-sm font-semibold">Claim Notes</p>
                  <p>{taskMode.record.notes}</p>
                </div>
              )}
              {taskMode.record.review && (
                <div>
                  <p className="text-sm font-semibold">Review Notes</p>
                  <p>{taskMode.record.review}</p>
                </div>
              )}
              <div className="pt-4">
                <button className="btn" onClick={() => setTaskMode(closedMode())}>Close</button>
              </div>
            </div>
          </FormPanel>
        ) : null}
        {taskMode.kind === "claim" && taskMode.record ? (
          <FormPanel kicker="Task" title="Claim Completion" onClose={() => setTaskMode(closedMode())}>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                handleClaimTask(taskMode.record!.id, fd.get("notes") as string);
              }}
            >
              <label className="block text-sm">
                Completion Notes
                <textarea className="field mt-1 min-h-24" name="notes" placeholder="Describe the completion..." />
              </label>
              <FormActions saveLabel="Claim Completion" onCancel={() => setTaskMode(closedMode())} loading={claimSiteTaskMutation.isPending} />
            </form>
          </FormPanel>
        ) : null}
        {taskMode.kind === "complete" && taskMode.record ? (
          <FormPanel kicker="Task" title="Approve Completion" onClose={() => setTaskMode(closedMode())}>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                handleCompleteTask(taskMode.record!.id, fd.get("review") as string);
              }}
            >
              <label className="block text-sm">
                Review Notes
                <textarea className="field mt-1 min-h-24" name="review" placeholder="Approve the completion..." />
              </label>
              <FormActions saveLabel="Approve Completion" onCancel={() => setTaskMode(closedMode())} loading={completeSiteTaskMutation.isPending} />
            </form>
          </FormPanel>
        ) : null}
        <TableWrap pagination={tasksData?.pagination} onPageChange={setTaskPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Title</th>
                <th className="hidden sm:table-cell">Target</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    {task.title}
                    {task.review ? <p className="text-sm text-black/50">{task.review}</p> : null}
                  </td>
                  <td className="hidden sm:table-cell">{task.targetDate ? day(task.targetDate) : "—"}</td>
                  <td>
                    <Stamp value={getTaskStatus(task)} tone={statusTone(getTaskStatus(task) as any)} />
                    {task.notes ? (
                      <span className="ml-2 text-sm text-black/50">{task.notes}</span>
                    ) : null}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(getTaskStatus(task) === "open") &&
                        (user?.role === "site_manager" || user?.role === "admin" || user?.role === "superadmin") &&
                        !isClosed ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setTaskMode({ kind: "claim", record: task })}
                        >
                          Claim Completion
                        </button>
                      ) : null}
                      {getTaskStatus(task) === "claimed" && (user?.role === "admin" || user?.role === "superadmin") && !isClosed ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setTaskMode({ kind: "complete", record: task })}
                        >
                          Approve Complete
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-ghost" onClick={() => setTaskMode({ kind: "view", record: task })}>View</button>
                      <RecordActions
                        onEdit={() => setTaskMode({ kind: "edit", record: task })}
                        onDelete={() => setTaskMode({ kind: "delete", record: task, label: task.title })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-black/45">
                    No tasks found for this site.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </section>

      <div className="mt-10 space-y-10">
        <section>
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="kicker">Inventory Balances</p>
              {!isClosed && (
                <button className="btn btn-ghost" onClick={() => setPurchaseMaterialOpen(true)}>Purchase material</button>
              )}
            </div>
            {bals.length > 0 ? (
              <TableWrap pagination={balancesData?.pagination} onPageChange={setBalPage}>
                <table className="data w-full text-left">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="text-left">Quantity</th>
                      <th className="text-left">Average Unit Price</th>
                      {canMutate && <th className="text-left">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bals.map((b) => {
                      const m = materials?.find((mat) => mat.id === (b as any).materialId);
                      const key = m?.id;
                      if (!m || !key) return null
                      return (
                        <tr key={key}>
                          <td>
                            <p className="font-medium">{m?.name ?? "Unknown material"}</p>
                          </td>
                          <td className="font-mono text-left min-w-[120px]">
                            {b.quantity} {m?.unit ?? ""}
                          </td>

                          <td className="font-mono text-left min-w-[120px]">
                            {etb((b as any).avgUnitPrice) ?? ""}
                          </td>

                          <td>
                            {canMutate && (
                              <span className="inline-block text-left">
                                <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveMaterialId(m?.id)}>Move</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
                No stock recorded at this warehouse.
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="kicker">Parked Equipment</p>
              {!isClosed && (
                <button className="btn btn-ghost" onClick={() => setPurchaseEquipmentOpen(true)}>Purchase equipment</button>
              )}
            </div>
            {eqs.length > 0 ? (
              <TableWrap pagination={equipData?.pagination} onPageChange={setEquipPage}>
                <table className="data w-full text-left">
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Status</th>
                      <th>Ownership</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eqs.map((e) => {
                      const status = (e as any).currentStatus ?? (e as any).status;
                      return (
                        <tr key={e.id}>
                          <td>
                            <p className="font-medium">{e.name}</p>
                            <p className="font-mono text-[0.7rem] text-black/50">{e.serialNumber ?? "No S/N"}</p>
                          </td>
                          <td>
                            <Stamp
                              value={status}
                              tone={status === "working" || status === "available" ? "ok" : status === "repair" || status === "maintenance" ? "bad" : "ink"}
                            />
                          </td>
                          <td className="text-sm capitalize items-center gap-3 min-w-[140px] h-full!">
                            {e.ownershipStatus}
                          </td>
                          <td>
                            {canMutate && !isClosed && (
                              <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveEquipmentId(e.id)}>Move</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
                No equipment parked at this site.
              </div>
            )}
          </div>
        </section>
      </div>
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteSiteMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDeleteSite}
      />
      <DeleteConfirm
        mode={taskMode}
        restore={false}
        loading={deleteSiteTaskMutation.isPending}
        onClose={() => setTaskMode(closedMode())}
        onConfirm={handleDeleteTask}
      />
      {moveMaterialId ? (
        <ModalPanel kicker="Site Inventory" title="Move Material" onClose={() => setMoveMaterialId(null)}>
          <MaterialMovementForm
            noBg
            materialId={moveMaterialId}
            fixedSource={{ id: site.id, type: "site", name: site.name }}
            allowedActions={["transfer", "used_up", "missing"]}
            onSuccess={() => setMoveMaterialId(null)}
            onCancel={() => setMoveMaterialId(null)}
          />
        </ModalPanel>
      ) : null}

      {moveEquipmentId ? (
        <ModalPanel kicker="Site Equipment" title="Move Equipment" onClose={() => setMoveEquipmentId(null)}>
          <EquipmentMovementForm
            noBg
            equipmentId={moveEquipmentId}
            fixedSource={{ id: site.id, type: "site", name: site.name }}
            allowedActions={["transferred", "degraded", "appreciated", "maintenance_dispatch", "maintenance_return", "used_up", "missing"]}
            onSuccess={() => setMoveEquipmentId(null)}
            onCancel={() => setMoveEquipmentId(null)}
          />
        </ModalPanel>
      ) : null}

      {purchaseMaterialOpen ? (
        <ModalPanel kicker="Site Inventory" title="Purchase Material" onClose={() => setPurchaseMaterialOpen(false)}>
          <MaterialMovementForm
            noBg
            fixedDestination={{ id: site.id, type: "site", name: site.name }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseMaterialOpen(false)}
            onCancel={() => setPurchaseMaterialOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {purchaseEquipmentOpen ? (
        <ModalPanel kicker="Site Equipment" title="Purchase Equipment" onClose={() => setPurchaseEquipmentOpen(false)}>
          <EquipmentMovementForm
            noBg
            fixedDestination={{ id: site.id, type: "site", name: site.name }}
            allowedActions={["purchased"]}
            onSuccess={() => setPurchaseEquipmentOpen(false)}
            onCancel={() => setPurchaseEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {lifecycleModalOpen ? (
        <ModalPanel kicker="Site" title="Lifecycle Logs" onClose={() => setLifecycleModalOpen(false)}>
          <div className="max-h-96 overflow-y-auto pr-2">
            <ol className="space-y-3">
              {logs.map((l) => (
                <li key={l.id} className="border-l-2 border-yellow pl-3 text-sm">
                  <p>{(l as unknown as { note?: string }).note ?? (l as unknown as { description?: string }).description ?? "Change logged"}</p>
                  <p className="mt-1 font-mono text-[0.65rem] text-black/45">
                    {day(l.timestamp ?? (l as unknown as { createdAt?: string }).createdAt)} ·{" "}
                    {userName((l as unknown as { loggedBy?: string }).loggedBy ?? "", store)}
                  </p>
                </li>
              ))}
              {logs.length === 0 ? (
                <li className="py-4 text-center text-black/45">No lifecycle entries.</li>
              ) : null}
            </ol>
          </div>
        </ModalPanel>
      ) : null}
    </div>
  );
}

