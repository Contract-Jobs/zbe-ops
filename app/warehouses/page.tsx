"use client";

import { PageHead } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function WarehousesPage() {
  const store = useStore();
  return (
    <div>
      <PageHead kicker="Central" title="Yards" />
      <p className="mb-6 max-w-xl text-black/65">
        Warehouses are not scoped to a site manager. Sales can only leave a yard. Transfers onto a job still go through Approvals.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Yard</th>
            <th>Location</th>
            <th>SKUs on hand</th>
            <th>Plant parked</th>
          </tr>
        </thead>
        <tbody>
          {store.warehouses.map((w) => {
            const skus = store.balances.filter((b) => b.locationKind === "warehouse" && b.locationId === w.id && b.quantity > 0).length;
            const plant = store.equipment.filter((e) => e.warehouseId === w.id && !e.deletedAt).length;
            return (
              <tr key={w.id}>
                <td className="font-medium">{w.name}</td>
                <td>{w.location}</td>
                <td className="font-mono">{skus}</td>
                <td className="font-mono">{plant}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
