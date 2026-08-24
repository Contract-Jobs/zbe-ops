"use client";

import { locationName, useStore } from "@/lib/store";
import type { LocationKind } from "@/lib/types";

export function LocationSelect({
  kind,
  id,
  onKind,
  onId,
  allowWarehouse = true,
  allowSite = true,
}: {
  kind: LocationKind | "";
  id: string;
  onKind: (k: LocationKind) => void;
  onId: (id: string) => void;
  allowWarehouse?: boolean;
  allowSite?: boolean;
}) {
  const store = useStore();
  const options =
    kind === "warehouse"
      ? store.warehouses.map((w) => ({ id: w.id, name: w.name }))
      : kind === "site"
        ? store.sites.filter((s) => !s.deletedAt).map((s) => ({ id: s.id, name: s.name }))
        : [];

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        className="field"
        value={kind}
        onChange={(e) => onKind(e.target.value as LocationKind)}
      >
        <option value="">Location type</option>
        {allowWarehouse ? <option value="warehouse">Warehouse</option> : null}
        {allowSite ? <option value="site">Site</option> : null}
      </select>
      <select className="field" value={id} onChange={(e) => onId(e.target.value)} disabled={!kind}>
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function locLabel(kind?: LocationKind, id?: string) {
  return locationName(kind, id);
}
