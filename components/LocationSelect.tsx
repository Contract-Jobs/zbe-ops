"use client";

import { locationName } from "@/lib/store";
import type { LocationKind } from "@/lib/types";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";

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
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();

  const options =
    kind === "warehouse"
      ? (warehousesData?.data ?? []).map((w) => ({ id: w.id, name: w.name }))
      : kind === "site"
        ? (sitesData?.data ?? []).filter((s) => !s.deletedAt).map((s) => ({ id: s.id, name: s.name }))
        : [];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
