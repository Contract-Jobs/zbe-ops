"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { day } from "@/lib/format";
import { useTasks } from "@/hooks/use-tasks";
import { useSites } from "@/hooks/use-sites";
import type { SiteTask } from "@/types/api";

const getTaskStatus = (task: SiteTask) => {
  if (task.isCompleted) return "completed";
  if (task.completionClaimBy) return "claimed";
  return "open";
};

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");

  const { data: tasksData, isLoading } = useTasks({
    page,
    limit: 10,
    status: status ? [status as "completed" | "pending"] : undefined,
    siteId: siteId ? [siteId] : undefined,
  });
  const { data: sitesData } = useSites({ limit: 50 });

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sitesData?.data ?? []) map.set(s.id, s.name);
    return map;
  }, [sitesData]);

  const tasks = tasksData?.data ?? [];

  return (
    <div>
      <PageHead kicker="Sites" title="Tasks" />
      <p className="mb-6 max-w-xl text-black/65">
        Every site task across every job — flat, not scoped to one site. Editing and completion still happen on the site page.
      </p>

      <div className="mb-5 flex flex-wrap gap-3">
        <select
          className="field w-full max-w-xs"
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All sites</option>
          {(sitesData?.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="field w-full max-w-xs"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading && !tasksData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading tasks...</div>
      ) : (
        <TableWrap pagination={tasksData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Task</th>
                <th>Site</th>
                <th>Target date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="min-w-0 font-medium">{t.title}</td>
                  <td>
                    <Link href={`/sites/${t.siteId}`} className="hover:text-yellow">
                      {siteNameById.get(t.siteId) ?? t.siteId}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-sm">{t.targetDate ? day(t.targetDate) : "—"}</td>
                  <td>
                    <Stamp value={getTaskStatus(t)} tone={statusTone(getTaskStatus(t))} />
                  </td>
                </tr>
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-black/45">
                    No tasks found.
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
