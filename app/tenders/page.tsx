"use client";

import { PageHead, Stamp, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function TendersPage() {
  const store = useStore();
  const rows =
    store.session.licenseId === "all"
      ? store.tenders
      : store.tenders.filter((t) => t.licenseId === store.session.licenseId);

  return (
    <div>
      <PageHead kicker="Pipeline" title="Tenders" />
      <table className="data">
        <thead>
          <tr>
            <th>Tender</th>
            <th>License</th>
            <th>Submit</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="font-medium">{t.name}</td>
              <td>{store.licenses.find((l) => l.id === t.licenseId)?.name}</td>
              <td>{t.submissionDate ? day(t.submissionDate) : "—"}</td>
              <td className="font-mono text-sm">{t.value ? etb(t.value) : "—"}</td>
              <td>
                <Stamp value={t.status} tone={statusTone(t.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
