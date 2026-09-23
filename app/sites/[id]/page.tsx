"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SiteForm, TaskForm } from "@/components/forms/site";
import {
  closedMode,
  ConfirmDialog,
  DeleteConfirm,
  FormPanel,
  ModalPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  Tabs,
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
  useSiteSummary,
  useSiteMaterials,
  useSiteIndividualEquipment,
  useSiteBulkEquipment,
  useCreateSiteTask,
  useUpdateSiteTask,
  useClaimSiteTask,
  useCompleteSiteTask,
  useDeleteSiteTask,
  useSiteLifecycle,
  useDeleteSite,
} from "@/hooks/use-sites";
import { useInventoryNodeId } from "@/hooks/use-inventories";
import { useBudgetOverview } from "@/hooks/use-analytics";

import { useLicenses } from "@/hooks/use-licenses";
import { useTransactions, useReverseTransaction } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { TransactionForm } from "@/components/forms/transaction";
import { InventoryAdjustForm } from "@/components/forms/inventory-adjust";
import { BalanceHistoryPanel } from "@/components/BalanceHistory";
import { LedgerToolsPanel } from "@/components/LedgerTools";
import type { Site, SiteTask, License, Transaction, TransactionCategory } from "@/types/api";
import { BulkEquipmentMovementForm } from "@/components/forms/bulk-equipment-movement";

const getTaskStatus = (task: SiteTask) => {
  if (task.isCompleted) return "completed";
  if (task.completionClaimBy) return "claimed";
  return "open";
};

// affectedFields is a JSON diff of the update request (new_api.md §5) — the
// backend hasn't pinned a shape, so this renders either a plain
// {field: newValue} snapshot or a {field: {from, to}} diff.
const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("from" in v || "to" in v) return `${formatFieldValue(v.from)} → ${formatFieldValue(v.to)}`;
    return JSON.stringify(value);
  }
  return String(value);
};

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const allowed = visibleSiteIds(store);

  const { data: siteData, isLoading: isSiteLoading } = useSite(id);
  // Still needed for InventoryAdjustForm's "loss" movement, which requires
  // a real node id — getSiteMaterials/getSiteEquipments below resolve the
  // node internally and never expose it, so this is a separate lookup.
  const { nodeId } = useInventoryNodeId("site", id);
  const [taskPage, setTaskPage] = useState(1);
  const { data: tasksData } = useSiteTasks(id, { page: taskPage, limit: 50 });
  const [equipPage, setEquipPage] = useState(1);
  const { data: equipData } = useSiteIndividualEquipment(id, { page: equipPage, limit: 10 });
  const [bulkEquipPage, setBulkEquipPage] = useState(1);
  const { data: bulkEquipData } = useSiteBulkEquipment(id, { page: bulkEquipPage, limit: 10 });
  const [balPage, setBalPage] = useState(1);
  const { data: materialsData } = useSiteMaterials(id, { page: balPage, limit: 10 });
  const { data: lifecycleData } = useSiteLifecycle(id);
  const { data: summaryData } = useSiteSummary(id);
  const { data: budgetData } = useBudgetOverview({ siteId: id });
  const { data: licensesData } = useLicenses();
  const [txPage, setTxPage] = useState(1);
  const [showSystemTx, setShowSystemTx] = useState(false);
  const { data: transactionsData, isLoading: isTxLoading } = useTransactions({
    siteId: id ? [id] : undefined,
    isSystemGenerated: showSystemTx ? undefined : ["false"],
    page: txPage,
    limit: 10,
    sortBy: "transactionDate",
    sortOrder: "desc",
  });
  const { data: categoriesData } = useCategories();

  const site = siteData?.data ?? (store.sites.find((s) => s.id === id) as unknown as Site | undefined);

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<RecordMode<Site>>(closedMode);
  const [taskMode, setTaskMode] = useState<RecordMode<SiteTask>>(closedMode);
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);
  const [ledgerToolsOpen, setLedgerToolsOpen] = useState(false);
  const [moveMaterialId, setMoveMaterialId] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState<{ itemId: string; materialName: string; unit: string; currentQuantity: number } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ itemId: string; itemName: string; unit: string } | null>(null);
  const [moveEquipmentId, setMoveEquipmentId] = useState<string | null>(null);
  const [purchaseMaterialOpen, setPurchaseMaterialOpen] = useState(false);
  const [purchaseEquipmentOpen, setPurchaseEquipmentOpen] = useState(false);
  const [purchaseBulkEquipmentOpen, setPurchaseBulkEquipmentOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [reverseTxTarget, setReverseTxTarget] = useState<Transaction | null>(null);
  const [reverseTxError, setReverseTxError] = useState<string | null>(null);
  const [tab, setTab] = useState<"materials" | "bulk" | "equipment" | "tasks" | "transactions">("materials");

  const createSiteTaskMutation = useCreateSiteTask(id || "");
  const updateSiteTaskMutation = useUpdateSiteTask(id || "");
  const claimSiteTaskMutation = useClaimSiteTask(id || "");
  const completeSiteTaskMutation = useCompleteSiteTask(id || "");
  const deleteSiteTaskMutation = useDeleteSiteTask(id || "");
  const deleteSiteMutation = useDeleteSite();
  const reverseTransactionMutation = useReverseTransaction();

  const manager = isSiteManager(store);
  const canMutate = !manager;
  const user = currentUser(store);
  const isClosed = site?.status === "closed";

  const summary = summaryData?.data;
  const budget = budgetData?.data;

  if (isSiteLoading && !site) {
    return <p className="p-8 text-center text-sm text-black/50">Loading site...</p>;
  }

  if (!site || (manager && !allowed.has(site.id))) {
    return <p>Site not found, or you are not assigned to it.</p>;
  }

  const tasks: SiteTask[] = tasksData?.data ??
    (store.tasks.filter((t) => t.siteId === site.id) as unknown as SiteTask[]);
  const logs = lifecycleData?.data ?? store.siteLifecycle.filter((l) => l.siteId === site.id);
  const eqs = equipData?.data ?? [];
  const bulkEqs = bulkEquipData?.data ?? [];
  const mats = materialsData?.data ?? [];
  const licenses: License[] = licensesData?.data ?? (store.licenses as unknown as License[]);
  const transactions: Transaction[] = transactionsData?.data ?? [];
  const categories: TransactionCategory[] = categoriesData?.data ?? (store.categories as unknown as TransactionCategory[]);

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
    if (taskMode.kind !== "edit" || !data.title.trim()) return;
    try {
      await updateSiteTaskMutation.mutateAsync({
        taskId: taskMode.record.id,
        payload: { title: data.title.trim(), targetDate: data.targetDate },
      });
      setTaskMode(closedMode());
    } catch {
      // Ignore or show error
    }
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

  const handleReverseTx = async () => {
    if (!reverseTxTarget) return;
    setReverseTxError(null);
    try {
      await reverseTransactionMutation.mutateAsync(reverseTxTarget.id);
      setReverseTxTarget(null);
    } catch (e) {
      setReverseTxError(e instanceof Error ? e.message : "Reversal failed — the API rejected this request.");
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
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setLedgerToolsOpen(true)}>
            Ledger tools
          </button>
          {(!manager || user.siteIds.includes(site.id)) && !isClosed ? (
            <button
              className="btn"
              onClick={() => setAddTxOpen(true)}
            >
              Add Transaction
            </button>
          ) : null}
        </div>
      </div>
      {addTxOpen ? (
        <FormPanel kicker="Money" title="Log Manual Transaction" onClose={() => setAddTxOpen(false)}>
          <TransactionForm initialSiteId={site.id} onDone={() => setAddTxOpen(false)} />
        </FormPanel>
      ) : null}

      <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5 flex flex-col justify-between">
          <div>
            <p className="kicker">Labor Budget</p>
            <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(budget?.laborBudget ?? site.laborBudget))}</p>
          </div>
          {budget && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-black/60 mb-1">
                <span>{etb(Number(budget.laborSpend))} spent</span>
                <span>{Math.min(100, (Number(budget.laborSpend) / Number(budget.laborBudget || 1)) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black/5 h-1.5 overflow-hidden">
                <div className="bg-yellow h-full" style={{ width: `${Math.min(100, (Number(budget.laborSpend) / Number(budget.laborBudget || 1)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="bg-white p-5 flex flex-col justify-between">
          <div>
            <p className="kicker">Materials Budget</p>
            <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(budget?.materialBudget ?? site.materialBudget))}</p>
          </div>
          {budget && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-black/60 mb-1">
                <span>{etb(Number(budget.materialSpend))} spent</span>
                <span>{Math.min(100, (Number(budget.materialSpend) / Number(budget.materialBudget || 1)) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black/5 h-1.5 overflow-hidden">
                <div className="bg-yellow h-full" style={{ width: `${Math.min(100, (Number(budget.materialSpend) / Number(budget.materialBudget || 1)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="bg-white p-5 flex flex-col gap-4 justify-center">
          <div>
            <p className="kicker">Other Spend</p>
            <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(budget?.otherSpend ?? 0))}</p>
          </div>

          <div>
            <p className="kicker">Total Equipment Value</p>
            <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(budget?.equipmentCapital ?? 0))}</p>
          </div>
        </div>
        <div className="bg-white p-5 flex flex-col justify-between">
          <div>
            <p className="kicker">Total Budget</p>
            <p className="mt-2 break-words text-2xl tracking-tight">{etb(Number(budget?.totalBudgeted || 0))}</p>
          </div>
          {budget && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-black/60 mb-1">
                <span>Spent: {etb(Number(budget.totalSpent))}</span>
                <span>{Math.min(100, (Number(budget.totalSpent) / Number(budget.totalBudgeted || 1)) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-black/5 h-1.5 overflow-hidden">
                <div className="bg-black/80 h-full" style={{ width: `${Math.min(100, (Number(budget.totalSpent) / Number(budget.totalBudgeted || 1)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "materials", label: "Materials", count: materialsData?.pagination?.total },
          { id: "bulk", label: "Bulk Equipment", count: bulkEquipData?.pagination?.total },
          { id: "equipment", label: "Equipment", count: equipData?.pagination?.total },
          { id: "tasks", label: "Tasks", count: tasksData?.pagination?.total ?? tasks.length },
          { id: "transactions", label: "Transactions", count: transactionsData?.pagination?.total },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === "tasks" ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="w-1/2 flex flex-col gap-2">
              <p className="kicker">Tasks</p>
              <p>{(summary?.tasks.completionPercent ?? 0).toFixed(0)}% complete</p>
              <div className="w-full bg-black/5 h-1.5 overflow-hidden">
                <div className="bg-yellow h-full" style={{ width: `${(summary?.tasks.completionPercent ?? 0).toFixed(2)}%` }} />
              </div>
            </div>
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
                          user?.role === "site_manager" &&
                          !isClosed ? (
                          <button
                            type="button"
                            disabled={isClosed}
                            className="btn"
                            onClick={() => setTaskMode({ kind: "claim", record: task })}
                          >
                            Claim Completion
                          </button>
                        ) : null}
                        {getTaskStatus(task) === "claimed" && (user?.role === "admin" || user?.role === "superadmin") ? (
                          <button
                            type="button"
                            disabled={isClosed}
                            className="btn btn-ghost"
                            onClick={() => setTaskMode({ kind: "complete", record: task })}
                          >
                            Approve Complete
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-ghost" onClick={() => setTaskMode({ kind: "view", record: task })}>View</button>
                        <RecordActions
                          onEdit={() => setTaskMode({ kind: "edit", record: task, })} editDisabled={isClosed}
                          onDelete={() => setTaskMode({ kind: "delete", record: task, label: task.title })} deleteDisabled={isClosed}
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
      ) : null}

      {tab === "materials" ? (
        <section>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="kicker">Inventory Balances</p>
              {!isClosed && (
                <button className="btn btn-ghost" onClick={() => setPurchaseMaterialOpen(true)}>Purchase material</button>
              )}
            </div>
            {mats.length > 0 ? (
              <TableWrap pagination={materialsData?.pagination} onPageChange={setBalPage}>
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
                    {mats.map((m) => (
                      <tr key={m.itemId}>
                        <td>
                          <p className="font-medium">{m.itemName}</p>
                        </td>
                        <td className="font-mono text-left min-w-[120px]">
                          {m.quantity} {m.unit}
                        </td>

                        <td className="font-mono text-left min-w-[120px]">
                          {m.averageUnitValue ? etb(m.averageUnitValue) : "—"}
                        </td>

                        <td>
                          {canMutate && (
                            <span className="inline-block text-left">
                              <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveMaterialId(m.itemId)}>Move</button>
                              <button
                                className="ml-3 text-xs text-blue-600/80 hover:text-black hover:underline"
                                onClick={() => setAdjustBalance({
                                  itemId: m.itemId,
                                  materialName: m.itemName,
                                  unit: m.unit,
                                  currentQuantity: m.quantity
                                })}
                              >
                                Report loss
                              </button>
                              <button
                                className="ml-3 text-xs text-black/50 hover:text-black hover:underline"
                                onClick={() => setHistoryTarget({ itemId: m.itemId, itemName: m.itemName, unit: m.unit })}
                              >
                                History
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
                No stock recorded at this site.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "bulk" ? (
        <section>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="kicker">Bulk Equipment</p>
              {!isClosed && (
                <button className="btn btn-ghost" onClick={() => setPurchaseBulkEquipmentOpen(true)}>Purchase Bulk Equipment</button>
              )}
            </div>
            {bulkEqs.length > 0 ? (
              <TableWrap pagination={bulkEquipData?.pagination} onPageChange={setBulkEquipPage}>
                <table className="data w-full text-left">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="text-left">Quantity</th>
                      <th className="text-left">Average Unit Value</th>
                      {canMutate && <th className="text-left">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkEqs.map((b) => (
                      <tr key={b.itemId}>
                        <td>
                          <p className="font-medium">{b.itemName}</p>
                        </td>
                        <td className="font-mono text-left min-w-[120px]">
                          {b.quantity} {b.unit}
                        </td>
                        <td className="font-mono text-left min-w-[120px]">
                          {b.averageUnitValue ? etb(b.averageUnitValue) : "—"}
                        </td>
                        <td>
                          {canMutate && (
                            <span className="inline-block text-left">
                              <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveMaterialId(b.itemId)}>Move</button>
                              <button
                                className="ml-3 text-xs text-blue-600/80 hover:text-black hover:underline"
                                onClick={() => setAdjustBalance({
                                  itemId: b.itemId,
                                  materialName: b.itemName,
                                  unit: b.unit,
                                  currentQuantity: b.quantity
                                })}
                              >
                                Report loss
                              </button>
                              <button
                                className="ml-3 text-xs text-black/50 hover:text-black hover:underline"
                                onClick={() => setHistoryTarget({ itemId: b.itemId, itemName: b.itemName, unit: b.unit })}
                              >
                                History
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
                No bulk equipment recorded at this site.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "equipment" ? (
        <section>
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
                      <th>Health</th>
                      <th>Book Value</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eqs.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <p className="font-medium">{e.identifier}</p>
                          <p className="font-mono text-[0.7rem] text-black/50">{e.vendorName ?? "No vendor"}</p>
                        </td>
                        <td>
                          <Stamp
                            value={e.assignmentStatus}
                            tone={e.assignmentStatus === "deployed_to_site" ? "ok" : "ink"}
                          />
                        </td>
                        <td className="text-sm capitalize items-center gap-3 min-w-[140px] h-full!">
                          {e.condition}
                        </td>
                        <td className="text-sm capitalize items-center gap-3 min-w-[140px] h-full!">
                          {etb(e.bookValue)}
                        </td>
                        <td>
                          {canMutate && !isClosed && (
                            <button className="text-xs text-blue-600/80 hover:text-black hover:underline" onClick={() => setMoveEquipmentId(e.id)}>Move</button>
                          )}
                        </td>
                      </tr>
                    ))}
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
      ) : null}

      {tab === "transactions" ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="kicker">Transactions</p>
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                checked={showSystemTx}
                onChange={(e) => {
                  setShowSystemTx(e.target.checked);
                  setTxPage(1);
                }}
              />
              Show system-generated
            </label>
          </div>
          {isTxLoading && !transactionsData ? (
            <div className="p-8 text-center text-sm text-black/40">Loading transactions...</div>
          ) : (
            <TableWrap pagination={transactionsData?.pagination} onPageChange={setTxPage}>
              <table className="data w-full text-left">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="hidden md:table-cell">Category</th>
                    <th>Type</th>
                    <th>Amount</th>
                    {canMutate && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const canReverse = !t.isReversal && !t.isReversed && !t.isSystemGenerated && t.equipmentId === null && t.itemId === null && !isClosed;
                    return (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">{day(t.transactionDate ?? t.createdAt)}</td>
                        <td className="hidden md:table-cell">
                          {categories.find((c) => c.id === t.categoryId)?.name ?? "—"}
                        </td>
                        <td>
                          <Stamp value={t.type} tone={statusTone(t.type)} />
                          {t.isSystemGenerated ? <span className="ml-2"><Stamp value="system" /></span> : null}
                          {t.isReversal ? <span className="ml-2"><Stamp value="reversal" tone="bad" /></span> : null}
                        </td>
                        <td className="whitespace-nowrap font-mono text-sm">{etb(Number(t.amount) || 0)}</td>
                        {canMutate && (
                          <td className="text-right">
                            {canReverse ? (
                              <button
                                type="button"
                                className="btn btn-ghost-bad px-2 py-0.5 text-xs"
                                onClick={() => setReverseTxTarget(t)}
                              >
                                Reverse
                              </button>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={canMutate ? 5 : 4} className="py-8 text-center text-sm text-black/45">
                        No transactions found for this site.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrap>
          )}
        </section>
      ) : null}
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
            allowedActions={["transfer", "consume", "loss"]}
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
            allowedActions={["transfer", "degrade", "send_to_maintenance", "return_from_maintenance", "dispose"]}
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

      {purchaseBulkEquipmentOpen ? (
        <ModalPanel kicker="Site Inventory" title="Purchase Bulk Equipment" onClose={() => setPurchaseBulkEquipmentOpen(false)}>
          <BulkEquipmentMovementForm
            noBg
            fixedDestination={{ id: site.id, type: "site", name: site.name }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseBulkEquipmentOpen(false)}
            onCancel={() => setPurchaseBulkEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {purchaseEquipmentOpen ? (
        <ModalPanel kicker="Site Equipment" title="Purchase Equipment" onClose={() => setPurchaseEquipmentOpen(false)}>
          <EquipmentMovementForm
            noBg
            fixedDestination={{ id: site.id, type: "site", name: site.name }}
            allowedActions={["purchase"]}
            onSuccess={() => setPurchaseEquipmentOpen(false)}
            onCancel={() => setPurchaseEquipmentOpen(false)}
          />
        </ModalPanel>
      ) : null}

      {lifecycleModalOpen ? (
        <ModalPanel kicker="Site" title="Lifecycle Logs" onClose={() => setLifecycleModalOpen(false)}>
          <div className="max-h-96 overflow-y-auto pr-2">
            <ol className="space-y-3">
              {logs.map((l) => {
                const affectedFields = (l as unknown as { affectedFields?: Record<string, unknown> | null }).affectedFields;
                const fieldEntries = affectedFields ? Object.entries(affectedFields) : [];
                return (
                  <li key={l.id} className="border-l-2 border-yellow pl-3 text-sm">
                    <p>{(l as unknown as { note?: string }).note ?? (l as unknown as { description?: string }).description ?? "Change logged"}</p>
                    {fieldEntries.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {fieldEntries.map(([field, value]) => (
                          <li key={field} className="font-mono text-[0.68rem] text-black/55">
                            <span className="text-black/40">{field}:</span> {formatFieldValue(value)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-1 font-mono text-[0.65rem] text-black/45">
                      {day(l.timestamp ?? (l as unknown as { createdAt?: string }).createdAt)} ·{" "}
                      <Username userId={l.loggedBy} />
                      {/* {userName((l as unknown as { loggedBy?: string }).loggedBy ?? "", store)} */}
                    </p>
                  </li>
                );
              })}
              {logs.length === 0 ? (
                <li className="py-4 text-center text-black/45">No lifecycle entries.</li>
              ) : null}
            </ol>
          </div>
        </ModalPanel>
      ) : null}

      {adjustBalance ? (
        <ModalPanel kicker="Site Inventory" title="Report Loss" onClose={() => setAdjustBalance(null)}>
          <InventoryAdjustForm
            noBg
            itemId={adjustBalance.itemId}
            inventoryId={nodeId ?? ""}
            materialName={adjustBalance.materialName}
            unit={adjustBalance.unit}
            currentQuantity={adjustBalance.currentQuantity}
            onSuccess={() => setAdjustBalance(null)}
            onCancel={() => setAdjustBalance(null)}
          />
        </ModalPanel>
      ) : null}

      {historyTarget ? (
        <ModalPanel wide kicker="Site Inventory" title="Movement history" onClose={() => setHistoryTarget(null)}>
          <BalanceHistoryPanel
            itemId={historyTarget.itemId}
            inventoryId={nodeId ?? ""}
            itemName={historyTarget.itemName}
            unit={historyTarget.unit}
          />
        </ModalPanel>
      ) : null}

      {ledgerToolsOpen ? (
        <ModalPanel wide kicker="Site Financials" title="Ledger tools" onClose={() => setLedgerToolsOpen(false)}>
          <LedgerToolsPanel siteId={id ?? site.id} canRebuild={canMutate} />
        </ModalPanel>
      ) : null}

      <ConfirmDialog
        open={reverseTxTarget !== null}
        title="Reverse this transaction?"
        body={`This will create an inverse ${reverseTxTarget?.type === "money_out" ? "money-in" : "money-out"} entry for ${etb(Number(reverseTxTarget?.amount) || 0)}.${reverseTxError ? ` ${reverseTxError}` : ""}`}
        confirmLabel="Reverse transaction"
        danger
        loading={reverseTransactionMutation.isPending}
        onCancel={() => {
          setReverseTxTarget(null);
          setReverseTxError(null);
        }}
        onConfirm={handleReverseTx}
      />
    </div>
  );
}

