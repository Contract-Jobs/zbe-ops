"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import {
  addTask,
  claimTask,
  completeTask,
  currentUser,
  isSiteManager,
  siteSpend,
  useStore,
  userName,
  visibleSiteIds,
} from "@/lib/store";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const allowed = visibleSiteIds(store);
  const site = store.sites.find((s) => s.id === id);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  if (!site || !allowed.has(site.id)) return <p>Site not found, or you are not assigned to it.</p>;

  const spend = siteSpend(site.id, store);
  const tasks = store.tasks.filter((t) => t.siteId === site.id);
  const logs = store.siteLifecycle.filter((l) => l.siteId === site.id);
  const eqs = store.equipment.filter((e) => e.siteId === site.id);
  const bals = store.balances.filter((b) => b.locationKind === "site" && b.locationId === site.id);
  const manager = isSiteManager(store);
  const user = currentUser(store);

  return (
    <div>
      <PageHead
        kicker="Site"
        title={site.name}
        action={<Stamp value={site.status} tone={statusTone(site.status)} />}
      />
      <p className="mb-8 text-black/60">{site.address}</p>

      <div className="grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="kicker">Labor</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(spend.labor)}</p>
          <p className="text-sm text-black/45">Budget {etb(site.laborBudget)}</p>
        </div>
        <div className="bg-white p-5">
          <p className="kicker">Materials</p>
          <p className="mt-2 break-words text-2xl tracking-tight">{etb(spend.material)}</p>
          <p className="text-sm text-black/45">Budget {etb(site.materialBudget)}</p>
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
          <form
            className="mb-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              addTask(site.id, title.trim());
              setTitle("");
            }}
          >
            <input className="field w-full sm:max-w-sm" placeholder="New task" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn w-full sm:w-auto" type="submit">
              Add
            </button>
          </form>
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
                  {task.reviewNotes ? <p className="text-sm text-black/50">{task.reviewNotes}</p> : null}
                </td>
                <td className="hidden sm:table-cell">{task.targetDate ? day(task.targetDate) : "—"}</td>
                <td>
                  <Stamp value={task.status} tone={statusTone(task.status)} />
                  {task.claimedBy ? (
                    <span className="ml-2 text-sm text-black/50">{userName(task.claimedBy, store)}</span>
                  ) : null}
                </td>
                <td className="text-right">
                  {task.status === "open" ? (
                    <button type="button" className="btn btn-ghost" onClick={() => claimTask(task.id)}>
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
                        onClick={() => {
                          completeTask(task.id, notes || "Approved");
                          setNotes("");
                        }}
                      >
                        Complete
                      </button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableWrap>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <p className="kicker mb-3">On this site</p>
          <ul className="text-sm">
            {bals.map((b) => {
              const mat = store.materials.find((m) => m.id === b.catalogId);
              return (
                <li key={`${b.catalogId}-${b.locationId}`} className="flex justify-between gap-3 border-b border-black/10 py-2">
                  <span className="min-w-0 pr-2">{mat?.name}</span>
                  <span className="font-mono">
                    {b.quantity} {mat?.unit}
                  </span>
                </li>
              );
            })}
            {eqs.map((e) => (
              <li key={e.id} className="flex justify-between border-b border-black/10 py-2">
                <span>{e.name}</span>
                <Stamp value={e.status} tone={statusTone(e.status)} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <p className="kicker mb-3">Lifecycle</p>
          <ol className="space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="border-l-2 border-yellow pl-3 text-sm">
                <p>{l.note}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-black/45">
                  {day(l.createdAt)} · {userName(l.loggedBy, store)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
