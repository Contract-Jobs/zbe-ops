"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LifecycleForm, SiteForm, TaskForm } from "@/components/forms/site";
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
import type { Site, SiteTask, Equipment, InventoryBalance, MaterialCatalog, License } from "@/types/api";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const allowed = visibleSiteIds(store);

  const { data: siteData, isLoading: isSiteLoading } = useSite(id);
  const { data: tasksData } = useSiteTasks(id);
  const { data: equipData } = useEquipmentList({ siteId: id ? [id] : undefined });
  const { data: balancesData } = useInventoryBalances({ siteId: id ? [id] : undefined });
  const { data: materialsData } = useMaterials();
  const { data: lifecycleData } = useSiteLifecycle(id);
  const { data: txData } = useTransactions({ siteId: id ? [id] : undefined });
  const { data: licensesData } = useLicenses();

  const site = siteData?.data ?? (store.sites.find((s) => s.id === id) as unknown as Site | undefined);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<RecordMode<Site>>(closedMode);
  const [taskMode, setTaskMode] = useState<RecordMode<SiteTask>>(closedMode);
  const [logOpen, setLogOpen] = useState(false);

  const createSiteTaskMutation = useCreateSiteTask(id || "");
  const claimSiteTaskMutation = useClaimSiteTask(id || "");
  const completeSiteTaskMutation = useCompleteSiteTask(id || "");
  const deleteSiteTaskMutation = useDeleteSiteTask(id || "");
  const deleteSiteMutation = useDeleteSite();

  const manager = isSiteManager(store);
  const canMutate = !manager;
  const user = currentUser(store);

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
  const materials: MaterialCatalog[] = materialsData?.data ?? (store.materials as unknown as MaterialCatalog[]);
  const licenses: License[] = licensesData?.data ?? (store.licenses as unknown as License[]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      if (tasksData) {
        await createSiteTaskMutation.mutateAsync({ title: title.trim() });
      } else {
        addTask(site.id, title.trim());
      }
      setTitle("");
    } catch {
      // Ignore or show error
    }
  };

  const handleClaimTask = async (taskId: string) => {
    try {
      if (tasksData) {
        await claimSiteTaskMutation.mutateAsync({ taskId });
      } else {
        claimTask(taskId);
      }
    } catch {
      // Ignore
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      if (tasksData) {
        await completeSiteTaskMutation.mutateAsync({ taskId, review: notes || "Approved" });
      } else {
        completeTask(taskId, notes || "Approved");
      }
      setNotes("");
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
        title={site.name}
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

      <div className="grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="kicker">Labor</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(spend.labor)}</p>
          <p className="text-sm text-black/45">Budget {etb(Number(site.laborBudget) || 0)}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Materials</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(spend.material)}</p>
          <p className="text-sm text-black/45">Budget {etb(Number(site.materialBudget) || 0)}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Posted out</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(spend.out)}</p>
          <p className="text-sm text-black/45">In {etb(spend.inn)}</p>
        </div>
      </div>

      <section className="mt-10">
        <p className="kicker mb-3">Tasks</p>
        {!manager || user.siteIds.includes(site.id) ? (
          <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleAddTask}>
            <input
              className="field w-full sm:max-w-sm"
              placeholder="New task"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              className="btn w-full sm:w-auto"
              type="submit"
              disabled={createSiteTaskMutation.isPending}
            >
              {createSiteTaskMutation.isPending ? "Adding..." : "Add"}
            </button>
          </form>
        ) : null}
        {taskMode.kind === "edit" ? (
          <FormPanel kicker="Task" title="Edit task" onClose={() => setTaskMode(closedMode())}>
            <TaskForm
              initial={taskMode.record}
              onCancel={() => setTaskMode(closedMode())}
              onDone={() => setTaskMode(closedMode())}
            />
          </FormPanel>
        ) : null}
        <TableWrap>
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
                    <Stamp value={task.status} tone={statusTone(task.status)} />
                    {task.notes ? (
                      <span className="ml-2 text-sm text-black/50">{task.notes}</span>
                    ) : null}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      {task.status === "open" || task.status === "pending" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={claimSiteTaskMutation.isPending}
                          onClick={() => handleClaimTask(task.id)}
                        >
                          Claim
                        </button>
                      ) : null}
                      {task.status === "claimed" ? (
                        <span className="flex flex-col gap-2 sm:inline-flex sm:flex-row">
                          <input
                            className="field w-full sm:w-40"
                            placeholder="Review notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn"
                            disabled={completeSiteTaskMutation.isPending}
                            onClick={() => handleCompleteTask(task.id)}
                          >
                            Complete
                          </button>
                        </span>
                      ) : null}
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

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <p className="kicker mb-3">On this site</p>
          <ul className="text-sm">
            {bals.map((b) => {
              const materialId = (b as unknown as { catalogId?: string }).catalogId ?? b.materialId;
              const mat = materials.find((m) => m.id === materialId);
              return (
                <li
                  key={`${materialId}-${b.id ?? b.siteId}`}
                  className="flex justify-between gap-3 border-b border-black/10 py-2"
                >
                  <span className="min-w-0 pr-2">{mat?.name ?? materialId}</span>
                  <span className="font-mono">
                    {b.quantity} {mat?.unit ?? "pcs"}
                  </span>
                </li>
              );
            })}
            {eqs.map((e) => (
              <li key={e.id} className="flex justify-between border-b border-black/10 py-2">
                <span>{e.name}</span>
                <Stamp value={e.currentStatus ?? (e as unknown as { status: string }).status} tone={statusTone(e.currentStatus ?? (e as unknown as { status: string }).status)} />
              </li>
            ))}
            {bals.length === 0 && eqs.length === 0 ? (
              <li className="py-4 text-center text-black/45">No materials or plant currently on site.</li>
            ) : null}
          </ul>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="kicker">Lifecycle</p>
            {canMutate ? (
              <button type="button" className="btn btn-ghost" onClick={() => setLogOpen(true)}>
                Log note
              </button>
            ) : null}
          </div>
          {logOpen ? (
            <FormPanel kicker="Lifecycle" title="Log a change" onClose={() => setLogOpen(false)}>
              <LifecycleForm onCancel={() => setLogOpen(false)} onDone={() => setLogOpen(false)} />
            </FormPanel>
          ) : null}
          <ol className="space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="border-l-2 border-yellow pl-3 text-sm">
                <p>{(l as unknown as { note?: string }).note ?? (l as unknown as { description?: string }).description ?? "Change logged"}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-black/45">
                  {day((l as unknown as { createdAt?: string }).createdAt ?? new Date().toISOString())} ·{" "}
                  {userName((l as unknown as { loggedBy?: string }).loggedBy ?? "", store)}
                </p>
              </li>
            ))}
            {logs.length === 0 ? (
              <li className="py-4 text-center text-black/45">No lifecycle entries.</li>
            ) : null}
          </ol>
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
    </div>
  );
}

