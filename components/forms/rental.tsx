"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { LocationSelect } from "@/components/LocationSelect";
import { useCreateRental, useAdjustRental, useReturnRental } from "@/hooks/use-rentals";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import type { IndividualEquipmentItem, License, RentalCreatePayload } from "@/types/api";
import type { LocationKind } from "@/lib/types";

export function RentalForm({
  equipmentList,
  licenses,
  onCancel,
  onDone,
}: {
  equipmentList: IndividualEquipmentItem[];
  licenses: License[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const createMutation = useCreateRental();
  // Full catalog pull, not the endpoint's default page size of 10 — this
  // feeds a plain <select>, not a server-searched picker.
  const { data: eqItemsData } = useInventoryItems({ category: "equipment", limit: 50 });
  const equipmentItems = eqItemsData?.data ?? [];
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"rent_in" | "rent_out">("rent_in");
  const [eqId, setEqId] = useState<string>("new");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [newCatalogName, setNewCatalogName] = useState("");
  const [locKind, setLocKind] = useState<LocationKind | "">("");
  const [locId, setLocId] = useState("");

  const isPending = createMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const dailyRate = String(fd.get("dailyRate") ?? "").trim();
    const upfrontFee = String(fd.get("upfrontFee") ?? "").trim();
    const rentStartDate = String(fd.get("rentStartDate") ?? "").trim();
    const expectedReturnDate = String(fd.get("expectedReturnDate") ?? "").trim();
    const licenseId = String(fd.get("licenseId") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    try {
      if (!dailyRate) throw new Error("Daily rate is required");

      const payload: RentalCreatePayload = {
        type,
        equipmentId: eqId,
        dailyRate: Number(dailyRate),
        upfrontFee: upfrontFee ? Number(upfrontFee) : undefined,
        rentStartDate,
        expectedReturnDate: expectedReturnDate || undefined,
        licenseId: licenseId || undefined,
        notes: notes || undefined,
        siteId: locKind === "site" && locId ? locId : undefined,
        warehouseId: locKind === "warehouse" && locId ? locId : undefined,
        vendorName: type === "rent_in" ? String(fd.get("vendorName") ?? "").trim() || undefined : undefined,
        buyerName: type === "rent_out" ? String(fd.get("buyerName") ?? "").trim() || undefined : undefined,
      };

      if (eqId === "new") {
        payload.autoCreateEquipment = {
          itemId: catalogItemId || undefined,
          autoCreateItem: catalogItemId ? undefined : { name: newCatalogName, category: "equipment" },
          identifier: String(fd.get("newEqIdentifier") ?? "").trim(),
          originalValue: String(fd.get("newEqValue") ?? "").trim(),
        };
      }

      await createMutation.mutateAsync(payload);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rental");
    }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)] sm:col-span-2">
          {error}
        </p>
      ) : null}

      <Field label="Type">
        <select className="field" name="type" value={type} onChange={(e) => setType(e.target.value as "rent_in" | "rent_out")} disabled={isPending}>
          <option value="rent_in">Rent In (from Vendor)</option>
          <option value="rent_out">Rent Out (to Customer)</option>
        </select>
      </Field>

      <Field label="Equipment">
        <select className="field" name="equipmentId" value={eqId} onChange={(e) => setEqId(e.target.value)} disabled={isPending}>
          <option value="new">-- Create New Equipment --</option>
          {equipmentList.map((e) => (
            <option key={e.id} value={e.id}>{e.identifier}{e.vendorName ? ` (${e.vendorName})` : ""}</option>
          ))}
        </select>
      </Field>

      {eqId === "new" ? (
        <>
          <Field label="Catalog item">
            <select className="field" value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)} disabled={isPending}>
              <option value="">+ New catalog item</option>
              {equipmentItems.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </Field>
          {!catalogItemId ? (
            <Field label="New catalog item name">
              <input className="field" value={newCatalogName} onChange={(e) => setNewCatalogName(e.target.value)} disabled={isPending} />
            </Field>
          ) : null}
          <Field label="Identifier">
            <input className="field" name="newEqIdentifier" required disabled={isPending} />
          </Field>
          <Field label="Original Value (ETB)">
            <input className="field" name="newEqValue" type="number" step="0.01" required disabled={isPending} />
          </Field>
        </>
      ) : null}

      <Field label="License">
        <select className="field" name="licenseId" required disabled={isPending}>
          <option value="">-- Select License --</option>
          {licenses.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>

      <Field label="Daily Rate (ETB)">
        <input className="field" name="dailyRate" type="number" step="0.01" required disabled={isPending} />
      </Field>

      <Field label="Upfront Fee (ETB)">
        <input className="field" name="upfrontFee" type="number" step="0.01" disabled={isPending} />
      </Field>

      <Field label="Start Date">
        <input className="field" name="rentStartDate" type="date" required disabled={isPending} />
      </Field>

      <Field label="Expected Return">
        <input className="field" name="expectedReturnDate" type="date" disabled={isPending} />
      </Field>

      {type === "rent_in" ? (
        <>
          <Field label="Vendor Name">
            <input className="field" name="vendorName" disabled={isPending} />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">Deliver To</p>
            <LocationSelect kind={locKind} id={locId} onKind={setLocKind} onId={setLocId} />
          </div>
        </>
      ) : (
        <>
          <Field label="Buyer / Customer Name">
            <input className="field" name="buyerName" disabled={isPending} />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium">Dispatch From</p>
            <LocationSelect kind={locKind} id={locId} onKind={setLocKind} onId={setLocId} />
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea className="field min-h-[4rem]" name="notes" disabled={isPending} />
        </Field>
      </div>

      <FormActions saveLabel="Queue Rental" onCancel={onCancel} loading={isPending} />
    </form>
  );
}

export function RentalAdjustForm({
  rentalId,
  onCancel,
  onDone,
}: {
  rentalId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const mutation = useAdjustRental(rentalId);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const dailyRate = String(fd.get("dailyRate") ?? "").trim();
    const lumpSumFee = String(fd.get("lumpSumFee") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    try {
      if (!notes) throw new Error("Notes are required");
      await mutation.mutateAsync({
        dailyRate: dailyRate ? Number(dailyRate) : undefined,
        lumpSumFee: lumpSumFee ? Number(lumpSumFee) : undefined,
        notes,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust rental");
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      {error && <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>}

      <Field label="New Daily Rate (ETB)">
        <input className="field" name="dailyRate" type="number" step="0.01" disabled={mutation.isPending} placeholder="Leave blank for no change" />
      </Field>

      <Field label="One-off Lump Sum Fee (ETB)">
        <input className="field" name="lumpSumFee" type="number" step="0.01" disabled={mutation.isPending} />
      </Field>

      <Field label="Notes">
        <textarea className="field min-h-[4rem]" name="notes" required disabled={mutation.isPending} placeholder="Reason for adjustment" />
      </Field>

      <FormActions saveLabel="Queue Adjustment" onCancel={onCancel} loading={mutation.isPending} />
    </form>
  );
}

export function RentalReturnForm({
  rentalId,
  onCancel,
  onDone,
}: {
  rentalId: string;
  isRentIn: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const mutation = useReturnRental(rentalId);
  const [error, setError] = useState<string | null>(null);

  const [locKind, setLocKind] = useState<LocationKind | "">("");
  const [locId, setLocId] = useState("");

  const nowString = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const actualReturnDate = String(fd.get("actualReturnDate") ?? "").trim();
    const finalCostOverride = String(fd.get("finalCostOverride") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    try {
      await mutation.mutateAsync({
        actualReturnDate,
        finalCostOverride: finalCostOverride ? Number(finalCostOverride) : undefined,
        notes: notes || undefined,
        returnSiteId: locKind === "site" && locId ? locId : undefined,
        returnWarehouseId: locKind === "warehouse" && locId ? locId : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to return rental");
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      {error && <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>}

      <Field label="Actual Return Date">
        <input className="field" name="actualReturnDate" type="date" required defaultValue={nowString} disabled={mutation.isPending} />
      </Field>

      <Field label="Final Cost Override (ETB)">
        <input className="field" name="finalCostOverride" type="number" step="0.01" disabled={mutation.isPending} placeholder="Leave blank for auto-calc" />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium">Return location</p>
        <LocationSelect kind={locKind} id={locId} onKind={setLocKind} onId={setLocId} />
      </div>

      <Field label="Notes">
        <textarea className="field min-h-[4rem]" name="notes" disabled={mutation.isPending} />
      </Field>

      <FormActions saveLabel="Queue Return" onCancel={onCancel} loading={mutation.isPending} />
    </form>
  );
}
