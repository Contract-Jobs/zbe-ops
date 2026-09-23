"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { RentalAdjustForm, RentalReturnForm } from "@/components/forms/rental";
import {
  closedMode,
  FormPanel,
  ModalPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  Username,
} from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useRental, useRentalEvents } from "@/hooks/use-rentals";

export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const manager = isSiteManager(store);

  const { data: rentalData, isLoading } = useRental(id);
  const [page, setPage] = useState(1);
  const { data: eventsData, isLoading: eventsLoading } = useRentalEvents(id, { page, limit: 10 });

  const item = rentalData?.data ?? store.rentals.find((r) => r.id === id);

  const [mode, setMode] = useState<"closed" | "adjust" | "return">("closed");

  if (isLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading rental...</p>;
  }

  if (!item) return <p>Rental not found.</p>;

  // Enriched server-side on the rental itself — no separate equipment/
  // catalog lookup needed.
  const equipmentDisplayName = item.equipment?.itemName ?? item.equipment?.identifier;
  const isRentIn = item.type === "rent_in";
  
  const relatedEvents = eventsData?.data ?? store.rentalEvents.filter(e => e.agreementId === id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div>
      <PageHead
        kicker="Rental Agreement"
        title={item.id.toUpperCase()}
        action={
          !manager && item.status === "active" ? (
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setMode("adjust")}>Adjust</button>
              <button className="btn" onClick={() => setMode("return")}>Return</button>
            </div>
          ) : undefined
        }
      />

      {mode === "adjust" ? (
        <ModalPanel kicker="Rental" title="Adjust terms" onClose={() => setMode("closed")}>
          <RentalAdjustForm rentalId={item.id} onCancel={() => setMode("closed")} onDone={() => setMode("closed")} />
        </ModalPanel>
      ) : null}

      {mode === "return" ? (
        <ModalPanel kicker="Rental" title="Process return" onClose={() => setMode("closed")}>
          <RentalReturnForm rentalId={item.id} isRentIn={isRentIn} onCancel={() => setMode("closed")} onDone={() => setMode("closed")} />
        </ModalPanel>
      ) : null}

      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_25rem] lg:gap-10">
        <div>
          <div className="mb-8 flex flex-wrap gap-2">
            <Stamp value={item.status} tone={statusTone(item.status)} />
            <Stamp value={item.type} tone={isRentIn ? "yellow" : "ok"} />
          </div>
          
          <dl className="mb-10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="kicker">Equipment</dt>
              <dd className="mt-1">{equipmentDisplayName ?? item.equipmentId}</dd>
            </div>
            <div>
              <dt className="kicker">{isRentIn ? "Vendor" : "Customer"}</dt>
              <dd className="mt-1">{isRentIn ? (item.vendorName || "—") : (item.buyerName || "—")}</dd>
            </div>
            <div>
              <dt className="kicker">Dates</dt>
              <dd className="mt-1 font-mono text-xs">{day(item.rentStartDate)} — {day(item.expectedReturnDate)}</dd>
            </div>
            <div>
              <dt className="kicker">Actual Return</dt>
              <dd className="mt-1 font-mono text-xs">{item.actualReturnDate ? day(item.actualReturnDate) : "—"}</dd>
            </div>
          </dl>
          
          <p className="kicker mb-2">Event log</p>
          <TableWrap pagination={eventsData?.pagination} onPageChange={setPage}>
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Daily Rate</th>
                  <th>Lump Sum Amount</th>
                  <th>Logger</th>
                </tr>
              </thead>
              <tbody>
                {relatedEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs">{day(e.timestamp)}</td>
                    <td><Stamp value={e.eventType} /></td>
                    <td className="font-mono text-sm">{e.dailyRate ? etb(Number(e.dailyRate)) : "—"}</td>
                    <td className="font-mono text-sm">
                      {e.lumpSumAmount ? etb(Number(e.lumpSumAmount)) : "—"}
                    </td>
                    <td className="text-sm">
                      <span className="text-black/50"><Username userId={e.loggedBy} /></span>
                    </td>
                  </tr>
                ))}
                {relatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-black/45">
                      No events recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </div>
    </div>
  );
}
