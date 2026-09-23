"use client";

import { useState } from "react";
import { LicenseForm } from "@/components/forms/master";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, type RecordMode } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useLicenses, useDeleteLicense, useRestoreLicense } from "@/hooks/use-licenses";
import type { License } from "@/types/api";
import { useLicenseAnalytics } from "@/hooks/use-analytics";
import { useSites } from "@/hooks/use-sites";

export default function LicensesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<License>>(closedMode);
  const [showDeleted, setShowDeleted] = useState(false);

  const { data: licensesData, isLoading } = useLicenses();
  const { data: licenseAnalytics } = useLicenseAnalytics();
  const { data: sites } = useSites();
  const deleteMutation = useDeleteLicense();
  const restoreMutation = useRestoreLicense();


  const licenses = (licensesData ? licensesData.data : (store.licenses as unknown as License[])).filter(
    (l) => showDeleted || !l.deletedAt
  );

  async function handleDelete() {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
      } catch {
        // Keep open or handle error
      }
    }
  }

  async function handleRestore(id: string) {
    try {
      await restoreMutation.mutateAsync(id);
    } catch {
      // Handle silently
    }
  }

  return (
    <div>
      <PageHead
        kicker="Entities"
        title="Licenses"
        action={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show deleted
            </label>
            {canMutate ? <RecordActions newLabel="New license" onNew={() => setMode({ kind: "create" })} /> : undefined}
          </div>
        }
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
      {isLoading && !licensesData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading licenses...</div>
      ) : (
        <div className="grid gap-px bg-black/10 sm:grid-cols-2">
          {licenses.map((l) => {
            return (
              <article key={l.id} className="bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl tracking-tight">{l.name}</h2>
                    <p className="mt-1 font-mono text-[0.7rem] text-black/40">{l.id}</p>
                  </div>
                  {canMutate ? (
                    <RecordActions
                      onEdit={!l.deletedAt ? () => setMode({ kind: "edit", record: l }) : undefined}
                      onDelete={!l.deletedAt ? () => setMode({ kind: "delete", record: l, label: l.name }) : undefined}
                      onRestore={l.deletedAt ? () => handleRestore(l.id) : undefined}
                      restoreDisabled={restoreMutation.isPending}
                    />
                  ) : null}
                </div>
                <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="kicker">Sites</dt>
                    <dd className="mt-1 font-mono text-lg">{sites?.data.filter(s => s.licenseId === l.id).length || 0}</dd>
                  </div>
                  <div>
                    <dt className="kicker">In</dt>
                    {/* A brand-new (or otherwise transaction-less) license has
                        no row in licenseAnalytics at all — find() rather than
                        filter()[0], and etb() already treats undefined as 0. */}
                    <dd className="mt-1 break-words">{etb(licenseAnalytics?.data.find(lic => lic.licenseId === l.id)?.totalReceived)}</dd>
                  </div>
                  <div>
                    <dt className="kicker">Out</dt>
                    <dd className="mt-1 break-words">{etb(licenseAnalytics?.data.find(lic => lic.licenseId === l.id)?.totalSpent)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
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
