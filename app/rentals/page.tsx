"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RentalForm } from "@/components/forms/rental";
import {
  closedMode,
  FormPanel,
  ModalPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  type RecordMode,
} from "@/components/ui";
import { etb, day } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useRentals } from "@/hooks/use-rentals";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useLicenses } from "@/hooks/use-licenses";
import type { RentalAgreement, IndividualEquipmentItem, License } from "@/types/api";

export default function RentalsPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const canMutate = !manager;

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<RecordMode<RentalAgreement>>(closedMode);
  const [page, setPage] = useState(1);

  const { data: rentalsData, isLoading } = useRentals({ page, limit: 10 });
  // Only for RentalForm's "pick existing equipment to rent out" selector —
  // row labels below use the rental's own enriched `equipment` field, not
  // this list.
  const { data: equipmentData } = useEquipmentList({ limit: 50 });
  const { data: licensesData } = useLicenses();

  const rentalsList = (rentalsData ? rentalsData.data : store.rentals) as unknown as RentalAgreement[];
  const equipmentList = (equipmentData ? equipmentData.data : []) as IndividualEquipmentItem[];
  const licensesList = (licensesData ? licensesData.data : store.licenses) as unknown as License[];

  const rows = useMemo(() => {
    return rentalsList.filter((r) => {
      // Very basic local search filter on rental type or status just for demo
      if (q) {
        return r.type.includes(q) || r.status.includes(q);
      }
      return true;
    });
  }, [rentalsList, q]);

  return (
    <div>
      <PageHead
        kicker="Operations"
        title="Rentals"
        action={
          <div className="flex items-center gap-3">
            <Link href="/rentals/events" className="btn btn-ghost">
              All events
            </Link>
            {canMutate ? (
              <RecordActions newLabel="New rental" onNew={() => setMode({ kind: "create" })} />
            ) : null}
          </div>
        }
      />

      {mode.kind === "create" ? (
        <ModalPanel kicker="Operations" title="New rental" onClose={() => setMode(closedMode())}>
          <RentalForm
            equipmentList={equipmentList}
            licenses={licensesList}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </ModalPanel>
      ) : null}

      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Filter by type or status"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {isLoading && !rentalsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading rentals...</div>
      ) : (
        <TableWrap pagination={rentalsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Agreement</th>
                <th>Type</th>
                <th>Equipment</th>
                <th>Party</th>
                <th className="hidden sm:table-cell">Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/rentals/${r.id}`} className="font-medium hover:text-yellow font-mono">
                      {"AGR-" + r.id.toLowerCase().split('-')[0]}
                    </Link>
                  </td>
                  <td>
                    <Stamp value={r.type} tone={r.type === "rent_in" ? "yellow" : "ok"} />
                  </td>
                  <td>
                    {r.equipment?.itemName ?? r.equipment?.identifier ?? r.equipmentId}
                  </td>
                  <td>
                    {r.type === "rent_in" ? r.vendorName : r.buyerName}
                  </td>
                  <td className="hidden text-sm text-black/70 sm:table-cell">
                    {day(r.rentStartDate)} — {day(r.expectedReturnDate)}
                  </td>
                  <td>
                    <Stamp value={r.status} tone={statusTone(r.status)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-black/50">
                    No rentals found.
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
