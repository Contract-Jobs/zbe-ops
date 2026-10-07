"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { useAllRentalEvents, useRentalsInBulk } from "@/hooks/use-rentals";

const EVENT_TYPES = ["initiation", "rate_change", "upfront_payment", "penalty", "settlement"] as const;

export default function RentalEventsPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<string>("");

  const { data: eventsData, isLoading } = useAllRentalEvents({
    page,
    limit: 10,
    eventType: eventType || undefined,
  });

  const events = eventsData?.data ?? [];

  const agreementIds = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.agreementId).filter(Boolean)));
  }, [events]);

  const { data: agreementsData } = useRentalsInBulk(agreementIds);

  const agreementLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agreementsData?.data ?? []) {
      map.set(a.id, a.equipment?.identifier ?? a.equipment?.itemName ?? a.vendorName ?? a.buyerName ?? a.id);
    }
    return map;
  }, [agreementsData]);

  return (
    <div>
      <PageHead kicker="Operations" title="Rental Events" />
      <p className="mb-6 max-w-xl text-black/65">
        Every rate change, payment, penalty and settlement logged across every rental agreement — flat, not scoped to one rental.
      </p>

      <select
        className="field mb-5 w-full max-w-sm"
        value={eventType}
        onChange={(e) => {
          setEventType(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All event types</option>
        {EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      {isLoading && !eventsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading rental events...</div>
      ) : (
        <TableWrap pagination={eventsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Agreement</th>
                <th>Event</th>
                <th>Amount</th>
                <th className="hidden sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{day(e.timestamp)}</td>
                  <td>
                    <Link href={`/rentals/${e.agreementId}`} className="font-medium hover:text-yellow">
                      {agreementLabelById.get(e.agreementId) ?? e.agreementId}
                    </Link>
                  </td>
                  <td>
                    <Stamp value={e.eventType.replace(/_/g, " ")} />
                  </td>
                  <td className="font-mono text-sm">
                    {e.lumpSumAmount ? etb(Number(e.lumpSumAmount)) : e.dailyRate ? `${etb(Number(e.dailyRate))}/day` : "—"}
                  </td>
                  <td className="hidden text-sm text-black/60 sm:table-cell">{e.notes ?? "—"}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-black/45">
                    No rental events found.
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
