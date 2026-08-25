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
import type { Tender } from "@/lib/types";

export default function TendersPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Tender>>(closedMode);
  const rows =
    store.session.licenseId === "all"
      ? store.tenders
      : store.tenders.filter((t) => t.licenseId === store.session.licenseId);

  return (
    <div>
      <PageHead
        kicker="Pipeline"
        title="Tenders"
        action={canMutate ? <RecordActions newLabel="New tender" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Pipeline" title="New tender" onClose={() => setMode(closedMode())}>
          <TenderForm licenses={store.licenses} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Pipeline" title="Edit tender" onClose={() => setMode(closedMode())}>
          <TenderForm
            initial={mode.record}
            licenses={store.licenses}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
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
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td className="hidden md:table-cell">{store.licenses.find((l) => l.id === t.licenseId)?.name}</td>
                <td className="hidden sm:table-cell">{t.submissionDate ? day(t.submissionDate) : "—"}</td>
                <td className="font-mono text-sm">{t.value ? etb(t.value) : "—"}</td>
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
            ))}
          </tbody>
        </table>
      </TableWrap>
      <DeleteConfirm mode={mode} restore onClose={() => setMode(closedMode())} />
    </div>
  );
}
