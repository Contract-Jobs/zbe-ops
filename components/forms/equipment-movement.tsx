"use client";

import { useMemo, useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";
import { useStore } from "@/lib/store";
import {
  usePurchaseEquipment,
  useDeployToSite,
  useReturnToWarehouse,
  useTransferBetweenSites,
  useTransferBetweenWarehouses,
  useSendToMaintenance,
  useReturnFromMaintenance,
  useSellEquipment,
  useDisposeEquipment,
  useDegradeEquipment,
} from "@/hooks/use-equipment-movements";
import { useEquipmentList, useEquipment } from "@/hooks/use-equipment";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import { useInventoryNodeId, useInventoryNodeMap } from "@/hooks/use-inventories";
import { useLicenses } from "@/hooks/use-licenses";
import type { LocationKind } from "@/lib/types";
import { SearchableSelect } from "@/components/ui";
import type { EquipmentMovementType } from "@/types/api";

// A user-facing action can resolve to more than one wire movementType (the
// "Transfer" action picks between four v2 types by current/destination node
// kind — see docs/api-v2-migration-plan.md §3.2). movementType values are
// internal wire names — never rendered raw.
type UiAction = "purchase" | "transfer" | "sale" | "send_to_maintenance" | "return_from_maintenance" | "dispose" | "degrade";

const UI_ACTION_LABELS: Record<UiAction, string> = {
  purchase: "Purchase",
  transfer: "Transfer",
  sale: "Sell",
  send_to_maintenance: "Send to maintenance",
  return_from_maintenance: "Return from maintenance",
  dispose: "Dispose",
  degrade: "Write down value",
};

const TRANSFER_MOVEMENT_LABELS: Record<"deploy_to_site" | "return_to_warehouse" | "transfer_between_sites" | "transfer_between_warehouses", string> = {
  deploy_to_site: "Deploy to site",
  return_to_warehouse: "Return to warehouse",
  transfer_between_sites: "Send to other site",
  transfer_between_warehouses: "Send to other warehouse",
};

const actions: Array<{ type: UiAction; label: string }> = (Object.keys(UI_ACTION_LABELS) as UiAction[]).map((type) => ({
  type,
  label: UI_ACTION_LABELS[type],
}));

// Individually-tracked equipment only — purchase/transfer/sale/maintenance/
// dispose/write-down movements against one serialized asset via
// /equipment-movements (individualItemId). Quantity-tracked (bulk)
// equipment moves through BulkEquipmentMovementForm instead, against
// /inventory-movements (itemId) — the two are never interchangeable, so
// this form's equipment picker and "new catalog item" flow are both
// filtered to tracking: "individual" and never show a bulk item.
export interface EquipmentMovementFormProps {
  equipmentId?: string | "new";
  defaultDestination?: { id: string; type: LocationKind };
  fixedDestination?: { id: string; type: LocationKind; name: string };
  allowedActions?: UiAction[];
  noBg?: boolean,
  title?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EquipmentMovementForm({
  equipmentId,
  defaultDestination,
  fixedDestination,
  allowedActions,
  noBg,
  title,
  onSuccess,
  onCancel,
}: EquipmentMovementFormProps) {
  const store = useStore();
  const { data: licensesData } = useLicenses();
  const licenses = licensesData?.data ?? store.licenses;
  // SearchableSelect filters client-side over whatever's fetched — there's
  // no server-side search wired to it, so both lists below need a real pull
  // instead of the endpoints' default page size of 10 (was silently
  // limiting the picker/name-lookup to the first 10 records).
  const { data: eqData } = useEquipmentList({ limit: 50 });
  const equipment = eqData?.data ?? [];
  // tracking: "individual" — the catalog also holds bulk (quantity-tracked)
  // equipment items, which this form must never offer.
  const { data: eqItemsData } = useInventoryItems({ category: "equipment", limit: 50, tracking: "individual" });
  const equipmentItems = eqItemsData?.data ?? [];
  const { byId: nodeById } = useInventoryNodeMap();

  const availableActions = actions.filter(a => !allowedActions || allowedActions.includes(a.type));

  const [selectedEqId, setSelectedEqId] = useState<string>(equipmentId ?? "new");
  const eId = equipmentId || selectedEqId;
  const isCreating = eId === "new";

  const [type, setType] = useState<UiAction>(isCreating ? "purchase" : (allowedActions?.[0] ?? "transfer"));

  const { data: currentEquipment } = useEquipment(isCreating ? undefined : eId);
  const currentNodeKind = currentEquipment?.data.currentInventoryId
    ? nodeById.get(currentEquipment.data.currentInventoryId)?.kind
    : undefined;

  // New-equipment fields (purchase, eId === "new")
  const [catalogItemId, setCatalogItemId] = useState("");
  const [newCatalogName, setNewCatalogName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [originalValue, setOriginalValue] = useState("");

  // Financial & entity fields
  const [cost, setCost] = useState("");
  const [clientName, setClientName] = useState("");
  const [licenseId, setLicenseId] = useState("");

  // Destination (source is always server-derived in v2 — never sent by the client)
  const [toKind, setToKind] = useState<LocationKind | "">(defaultDestination?.type ?? "");
  const [toId, setToId] = useState(defaultDestination?.id ?? "");
  const destKind = fixedDestination?.type ?? toKind;
  const destRefId = fixedDestination?.id ?? toId;
  const { nodeId: destNodeId } = useInventoryNodeId(destKind, destRefId || undefined);

  const [msg, setMsg] = useState<string | null>(null);

  const purchaseMutation = usePurchaseEquipment();
  const deployMutation = useDeployToSite();
  const returnWarehouseMutation = useReturnToWarehouse();
  const transferSitesMutation = useTransferBetweenSites();
  const transferWarehousesMutation = useTransferBetweenWarehouses();
  const maintenanceOutMutation = useSendToMaintenance();
  const maintenanceInMutation = useReturnFromMaintenance();
  const sellMutation = useSellEquipment();
  const disposeMutation = useDisposeEquipment();
  const degradeMutation = useDegradeEquipment();

  const isPending =
    purchaseMutation.isPending ||
    deployMutation.isPending ||
    returnWarehouseMutation.isPending ||
    transferSitesMutation.isPending ||
    transferWarehousesMutation.isPending ||
    maintenanceOutMutation.isPending ||
    maintenanceInMutation.isPending ||
    sellMutation.isPending ||
    disposeMutation.isPending ||
    degradeMutation.isPending;

  // Which of the four wire movement types "Transfer" resolves to, given the
  // equipment's current node kind and the chosen destination kind.
  const resolvedTransfer = useMemo(() => {
    if (!currentNodeKind || !destKind) return undefined;
    if (currentNodeKind === "warehouse" && destKind === "site") return "deploy_to_site" as const;
    if (currentNodeKind === "site" && destKind === "warehouse") return "return_to_warehouse" as const;
    if (currentNodeKind === "site" && destKind === "site") return "transfer_between_sites" as const;
    return "transfer_between_warehouses" as const;
  }, [currentNodeKind, destKind]);

  const submit = async () => {
    setMsg(null);
    try {
      if (!eId) throw new Error("Please select an equipment");

      if (type === "purchase") {
        setOriginalValue(cost)
        // console.log(originalValue)
        // if (isCreating && !originalValue) throw new Error("Original value is required");
        if (!licenseId) throw new Error("License is required");
        if (!destNodeId) throw new Error("Destination is required");
        if (isCreating && !identifier) throw new Error("Identifier is required");
        if (isCreating && !catalogItemId && !newCatalogName) throw new Error("Pick a catalog item or name a new one");
        await purchaseMutation.mutateAsync({
          individualItemId: isCreating ? undefined : eId,
          destinationInventoryId: destNodeId,
          movementCost: cost || undefined,
          clientName: clientName || undefined,
          licenseId,
          autoCreateEquipment: isCreating
            ? {
              itemId: catalogItemId || undefined,
              autoCreateItem: catalogItemId ? undefined : { name: newCatalogName, category: "equipment" },
              identifier,
              originalValue: cost,
            }
            : undefined,
        });
      } else if (type === "transfer") {
        if (!destNodeId) throw new Error("Destination is required");
        if (!resolvedTransfer) throw new Error("Could not determine the destination type");
        const payload = { individualItemId: eId, destinationInventoryId: destNodeId };
        if (resolvedTransfer === "deploy_to_site") await deployMutation.mutateAsync(payload);
        else if (resolvedTransfer === "return_to_warehouse") await returnWarehouseMutation.mutateAsync(payload);
        else if (resolvedTransfer === "transfer_between_sites") await transferSitesMutation.mutateAsync(payload);
        else await transferWarehousesMutation.mutateAsync(payload);
      } else if (type === "sale") {
        if (!licenseId) throw new Error("License is required");
        await sellMutation.mutateAsync({
          individualItemId: eId,
          movementCost: cost || undefined,
          clientName: clientName || undefined,
          licenseId,
        });
      } else if (type === "send_to_maintenance") {
        await maintenanceOutMutation.mutateAsync({ individualItemId: eId, clientName: clientName || undefined });
      } else if (type === "return_from_maintenance") {
        if (!destNodeId) throw new Error("Destination is required");
        await maintenanceInMutation.mutateAsync({
          individualItemId: eId,
          destinationInventoryId: destNodeId,
          movementCost: cost || undefined,
          licenseId: licenseId || undefined,
        });
      } else if (type === "dispose") {
        await disposeMutation.mutateAsync({ individualItemId: eId });
      } else if (type === "degrade") {
        if (!cost) throw new Error("Value write-down amount is required");
        await degradeMutation.mutateAsync({ individualItemId: eId, movementCost: cost });
      }

      setMsg("Queued for approval.");
      if (onSuccess) onSuccess();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className={isCreating || noBg ? "" : "border border-black/10 bg-paper/40 p-5 h-max"}>
      {!isCreating && <p className="kicker mb-3">{title || "Raise a movement"}</p>}

      {!equipmentId && (
        <label className="mb-3 block z-10 relative text-sm">
          Individual equipment
          <div className="mt-1">
            <SearchableSelect
              value={selectedEqId}
              onChange={(val) => {
                setSelectedEqId(val);
                if (val === "new") setType("purchase");
              }}
              options={equipment.map(e => ({ id: e.id, label: e.identifier, subLabel: e.vendorName || "No vendor" }))}
              placeholder="Search individual equipment..."
              onCreateNew={() => {
                setSelectedEqId("new");
                setType("purchase");
              }}
              createNewLabel="+ Purchase new individual equipment"
            />
          </div>
        </label>
      )}

      {!isCreating && availableActions.length > 1 && (
        <label className="mb-3 block text-sm">
          Action
          <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as UiAction)}>
            {availableActions.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {type === "transfer" && resolvedTransfer ? (
        <p className="mb-3 text-sm text-black/55">This will: {TRANSFER_MOVEMENT_LABELS[resolvedTransfer]}</p>
      ) : null}

      {isCreating && (
        <>
          <label className="mb-3 block z-10 relative text-sm">
            Individual equipment catalog item
            <select className="field mt-1" value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
              <option value="">+ New catalog item</option>
              {equipmentItems.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </label>
          {!catalogItemId ? (
            <label className="mb-3 block text-sm">
              New catalog item name
              <input className="field mt-1" value={newCatalogName} onChange={(e) => setNewCatalogName(e.target.value)} />
            </label>
          ) : null}
          <label className="mb-3 block text-sm">
            Identifier
            <input className="field mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </label>
          {/* <label className="mb-3 block text-sm">
            Original value (ETB)
            <input className="field mt-1" value={originalValue} onChange={(e) => setOriginalValue(e.target.value)} />
          </label> */}
        </>
      )}

      {["purchase", "sale", "return_from_maintenance"].includes(type) && (
        <label className="mb-3 block text-sm">
          Cost (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {type === "degrade" && (
        <label className="mb-3 block text-sm">
          Value write-down (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {["sale", "send_to_maintenance"].includes(type) && (
        <label className="mb-3 block text-sm">
          {type === "sale" ? "Buyer" : "Vendor"}
          <input className="field mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </label>
      )}

      {["purchase", "sale"].includes(type) && (
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
      )}

      {type === "return_from_maintenance" && cost ? (
        <label className="mb-3 block text-sm">
          License (required for a paid repair)
          <select className="field mt-1" value={licenseId} onChange={(e) => setLicenseId(e.target.value)}>
            <option value="">Select license</option>
            {licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {["purchase", "transfer", "return_from_maintenance"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Destination</p>
          {fixedDestination ? (
            <div className="field mt-1 cursor-not-allowed bg-black/5 text-black/50">
              {fixedDestination.name}
            </div>
          ) : (
            <LocationSelect kind={toKind} id={toId} onKind={setToKind} onId={setToId} />
          )}
        </div>
      )}

      {["purchase", "send_to_maintenance"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Client Name</p>
          <input className="field mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
      )}

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
