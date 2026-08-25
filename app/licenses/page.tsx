"use client";

import { useState } from "react";
import { LicenseForm } from "@/components/forms/master";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, type RecordMode } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import type { License } from "@/lib/types";

export default function LicensesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<License>>(closedMode);

  return (
    <div>
      <PageHead
        kicker="Entities"
        title="Licenses"
        action={canMutate ? <RecordActions newLabel="New license" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      <p className="mb-6 max-w-xl text-black/65">
        Licenses are the top of the money tree. Sites, plant, and ledger lines hang off one of these.
      </p>
      {mode.kind === "create" ? (
        <FormPanel kicker="Entities" title="New license" onClose={() => setMode(closedMode())}>
          <LicenseForm onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Entities" title="Edit license" onClose={() => setMode(closedMode())}>
          <LicenseForm initial={mode.record} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      <div className="grid gap-px bg-black/10 sm:grid-cols-2">
        {store.licenses.map((l) => {
          const sites = store.sites.filter((s) => s.licenseId === l.id && !s.deletedAt).length;
          const out = store.transactions
            .filter((t) => t.licenseId === l.id && t.type === "money_out" && !t.isReversal)
            .reduce((s, t) => s + t.amount, 0);
          const inn = store.transactions
            .filter((t) => t.licenseId === l.id && t.type === "money_in" && !t.isReversal)
            .reduce((s, t) => s + t.amount, 0);
          return (
            <article key={l.id} className="bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl tracking-tight">{l.name}</h2>
                  <p className="mt-1 font-mono text-[0.7rem] text-black/40">{l.id}</p>
                </div>
                {canMutate ? (
                  <RecordActions
                    onEdit={() => setMode({ kind: "edit", record: l })}
                    onDelete={() => setMode({ kind: "delete", record: l, label: l.name })}
                  />
                ) : null}
              </div>
              <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="kicker">Sites</dt>
                  <dd className="mt-1 font-mono text-lg">{sites}</dd>
                </div>
                <div>
                  <dt className="kicker">In</dt>
                  <dd className="mt-1 break-words">{etb(inn)}</dd>
                </div>
                <div>
                  <dt className="kicker">Out</dt>
                  <dd className="mt-1 break-words">{etb(out)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      <DeleteConfirm mode={mode} restore onClose={() => setMode(closedMode())} />
    </div>
  );
}
