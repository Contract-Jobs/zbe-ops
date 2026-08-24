"use client";

import { PageHead } from "@/components/ui";
import { etb } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function LicensesPage() {
  const store = useStore();
  return (
    <div>
      <PageHead kicker="Entities" title="Licenses" />
      <p className="mb-6 max-w-xl text-black/65">
        Licenses are the top of the money tree. Sites, plant, and ledger lines hang off one of these.
      </p>
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
              <h2 className="text-xl tracking-tight">{l.name}</h2>
              <p className="mt-1 font-mono text-[0.7rem] text-black/40">{l.id}</p>
              <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="kicker">Sites</dt>
                  <dd className="mt-1 font-mono text-lg">{sites}</dd>
                </div>
                <div>
                  <dt className="kicker">In</dt>
                  <dd className="mt-1">{etb(inn)}</dd>
                </div>
                <div>
                  <dt className="kicker">Out</dt>
                  <dd className="mt-1">{etb(out)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}
