"use client";

import { useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";
import { isSiteManager, useStore } from "@/lib/store";
import {
  usePurchaseMaterial,
  useTransferMaterial,
  useSellMaterial,
  useConsumeMaterial,
  useReportMissingMaterial,
} from "@/hooks/use-materials";
import { useLicenses } from "@/hooks/use-licenses";
import { useCategories } from "@/hooks/use-categories";
import type { LocationKind } from "@/lib/types";
import type { MaterialLogAction } from "@/types/api";

type ActionType = MaterialLogAction["action"];

export interface MaterialMovementFormProps {
  materialId?: string | "new";
  defaultSource?: { id: string; type: LocationKind };
  defaultDestination?: { id: string; type: LocationKind };
  fixedSource?: { id: string; type: LocationKind; name: string };
  allowedActions?: ActionType[];
  title?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MaterialMovementForm({
  materialId,
  defaultSource,
  defaultDestination,
  fixedSource,
  allowedActions,
  title,
  onSuccess,
  onCancel,
}: MaterialMovementFormProps) {
  const store = useStore();
  const manager = isSiteManager(store);
  
  const { data: licensesData } = useLicenses();
  const licenses = licensesData?.data ?? store.licenses;
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data ?? store.categories;

  const allActions: Array<{ type: ActionType; label: string; disabled?: boolean }> = [
    { type: "purchase", label: "Purchase" },
    { type: "transfer", label: "Transfer" },
    { type: "sold", label: "Sell (warehouse only)", disabled: manager },
    { type: "used_up", label: "Consume" },
    { type: "missing", label: "Report missing" },
  ];
  const actions = allActions.filter(a => !allowedActions || allowedActions.includes(a.type));

  const [type, setType] = useState<ActionType>(materialId === "new" ? "purchase" : (allowedActions?.[0] ?? "transfer"));
  
  // New Material fields
  const [matName, setMatName] = useState("");
  const [matUnit, setMatUnit] = useState("pcs");
  const [matType, setMatType] = useState<"single" | "set">("single");

  // Core fields
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [notes, setNotes] = useState("");

  // Location fields
  const [fromKind, setFromKind] = useState<LocationKind | "">(defaultSource?.type ?? "");
  const [fromId, setFromId] = useState(defaultSource?.id ?? "");
  const [toKind, setToKind] = useState<LocationKind | "">(defaultDestination?.type ?? "");
  const [toId, setToId] = useState(defaultDestination?.id ?? "");

  const [msg, setMsg] = useState<string | null>(null);

  const purchaseMutation = usePurchaseMaterial();
  const transferMutation = useTransferMaterial();
  const sellMutation = useSellMaterial();
  const consumeMutation = useConsumeMaterial();
  const missingMutation = useReportMissingMaterial();

  const isPending =
    purchaseMutation.isPending ||
    transferMutation.isPending ||
    sellMutation.isPending ||
    consumeMutation.isPending ||
    missingMutation.isPending;

  const submit = async () => {
    setMsg(null);
    try {
      const qn = Number(quantity);
      if (!qn || qn <= 0) throw new Error("Quantity required");

      const source = fixedSource ? { id: fixedSource.id, type: fixedSource.type as "site" | "warehouse" } : (fromKind && fromId ? { id: fromId, type: fromKind as "site" | "warehouse" } : undefined);
      const destination = toKind && toId ? { id: toId, type: toKind as "site" | "warehouse" } : undefined;
      
      const mId = materialId || "new";

      if (type === "purchase") {
        if (!unitPrice) throw new Error("Unit Price is required");
        if (!destination) throw new Error("Destination is required");
        await purchaseMutation.mutateAsync({
          materialId: mId,
          quantity: qn,
          purchaseCost: unitPrice,
          destination,
          categoryId: categoryId || undefined,
          licenseId: licenseId || undefined,
          notes: notes || undefined,
          newMaterial: mId === "new" ? { name: matName, unit: matUnit || "pcs", type: matType } : undefined,
        });
      } else if (type === "transfer") {
        if (!source || !destination) throw new Error("Source and Destination are required for transfer");
        await transferMutation.mutateAsync({
          materialId: mId,
          quantity: qn,
          source,
          destination,
          notes: notes || undefined,
        });
      } else if (type === "sold") {
        if (!unitPrice) throw new Error("Unit Price is required");
        if (!source || source.type !== "warehouse") throw new Error("Source must be a warehouse for sales");
        if (manager) throw new Error("Site managers cannot sell");
        
        await sellMutation.mutateAsync({
          materialId: mId,
          quantity: qn,
          sellingPrice: unitPrice,
          source: { id: source.id, type: "warehouse" },
          buyerName: buyerName || undefined,
          categoryId: categoryId || undefined,
          licenseId: licenseId || undefined,
          notes: notes || undefined,
        });
      } else if (type === "used_up") {
        if (!source) throw new Error("Source is required");
        await consumeMutation.mutateAsync({
          materialId: mId,
          quantity: qn,
          source,
          notes: notes || undefined,
        });
      } else if (type === "missing") {
        if (!source) throw new Error("Source is required");
        await missingMutation.mutateAsync({
          materialId: mId,
          quantity: qn,
          source,
          notes: notes || undefined,
        });
      }

      setMsg("Queued for approval.");
      if (onSuccess) onSuccess();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const isCreating = materialId === "new";

  return (
    <div className={isCreating ? "" : "border border-black/10 bg-paper/40 p-5"}>
      {!isCreating && <p className="kicker mb-3">{title || "Raise a movement"}</p>}
      
      {!isCreating && actions.length > 1 && (
        <label className="mb-3 block text-sm">
          Action
          <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as ActionType)}>
            {actions.map((a) => (
              <option key={a.type} value={a.type} disabled={a.disabled}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {isCreating && (
        <>
          <label className="mb-3 block text-sm">
            Material Name
            <input className="field mt-1" value={matName} onChange={(e) => setMatName(e.target.value)} />
          </label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block text-sm">
              Unit
              <input className="field mt-1" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} />
            </label>
            <label className="block text-sm">
              Type
              <select className="field mt-1" value={matType} onChange={(e) => setMatType(e.target.value as "single" | "set")}>
                <option value="single">Single</option>
                <option value="set">Set</option>
              </select>
            </label>
          </div>
        </>
      )}

      <label className="mb-3 block text-sm">
        Quantity
        <input className="field mt-1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>

      {["purchase", "sold"].includes(type) && (
        <label className="mb-3 block text-sm">
          Unit Price (ETB)
          <input className="field mt-1" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </label>
      )}

      {type === "sold" && (
        <label className="mb-3 block text-sm">
          Buyer
          <input className="field mt-1" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
        </label>
      )}

      {["purchase", "sold"].includes(type) && (
        <>
          <label className="mb-3 block text-sm">
            Category
            <select className="field mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block text-sm">
            License
            <select className="field mt-1" value={licenseId} onChange={(e) => setLicenseId(e.target.value)}>
              <option value="">Select license</option>
              {licenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {["transfer", "sold", "used_up", "missing"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Source</p>
          {fixedSource ? (
            <div className="field mt-1 cursor-not-allowed bg-black/5 text-black/50">
              {fixedSource.name}
            </div>
          ) : (
            <LocationSelect 
              kind={fromKind} 
              id={fromId} 
              onKind={setFromKind} 
              onId={setFromId} 
              allowSite={type !== "sold"} // Only warehouses can sell
            />
          )}
        </div>
      )}

      {["purchase", "transfer"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Destination</p>
          <LocationSelect kind={toKind} id={toId} onKind={setToKind} onId={setToId} />
        </div>
      )}

      <label className="mb-3 block text-sm">
        Notes
        <input className="field mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex gap-2 mt-4">
        {onCancel && (
          <button type="button" className="btn btn-ghost w-full" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn w-full" disabled={isPending} onClick={submit}>
          {isPending ? "Confirming..." : "Confirm"}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
