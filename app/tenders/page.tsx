"use client";

import { useState } from "react";
import { TenderForm } from "@/components/forms/master";
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
import { isSiteManager, useStore } from "@/lib/store";
import { useTenders, useDeleteTender } from "@/hooks/use-tenders";
import { useLicenses } from "@/hooks/use-licenses";
import type { Tender } from "@/types/api";

export default function TendersPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Tender>>(closedMode);

  const { data: tendersData, isLoading } = useTenders();
  const { data: licensesData } = useLicenses();
  const deleteMutation = useDeleteTender();

  const licensesList = licensesData ? licensesData.data : store.licenses;
  const allTenders = tendersData ? tendersData.data : (store.tenders as unknown as Tender[]);
  const rows =
    store.session.licenseId === "all"
      ? allTenders
      : allTenders.filter((t) => t.licenseId === store.session.licenseId);

  async function handleDelete() {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
      } catch {
        // Handled
      }
    }
  }

  return (
    <div>
      <PageHead
        kicker="Pipeline"
        title="Tenders"
        action={canMutate ? <RecordActions newLabel="New tender" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Pipeline" title="New tender" onClose={() => setMode(closedMode())}>
          <TenderForm licenses={licensesList} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Pipeline" title="Edit tender" onClose={() => setMode(closedMode())}>
          <TenderForm
            initial={mode.record}
            licenses={licensesList}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      {isLoading && !tendersData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading tenders...</div>
      ) : (
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Tender</th>
                <th className="hidden md:table-cell">License</th>
                <th className="hidden sm:table-cell">Submit</th>
                <th>Value</th>
                <th>Status</th>
                {canMutate ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const tenderVal =
                  "value" in t && typeof t.value === "number"
                    ? t.value
                    : t.estimatedBudget
                      ? Number(t.estimatedBudget)
                      : 0;
                return (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td className="hidden md:table-cell">{licensesList.find((l) => l.id === t.licenseId)?.name}</td>
                    <td className="hidden sm:table-cell">{t.submissionDate ? day(t.submissionDate) : "—"}</td>
                    <td className="font-mono text-sm">{tenderVal ? etb(tenderVal) : "—"}</td>
                    <td>
                      <Stamp value={t.status} tone={statusTone(t.status)} />
                    </td>
                    {canMutate ? (
                      <td>
                        <RecordActions
                          onEdit={() => setMode({ kind: "edit", record: t })}
                          onDelete={() => setMode({ kind: "delete", record: t, label: t.name })}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDelete}
      />
    </div>
  );
}
