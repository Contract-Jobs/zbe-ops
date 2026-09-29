"use client";

import type { ReactNode } from "react";
import { Field } from "@/components/ui";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import { useInventoryNodes } from "@/hooks/use-inventories";
import { useLicenses } from "@/hooks/use-licenses";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import type {
  EquipmentAssignmentStatus,
  EquipmentCondition,
  EquipmentLifecycleStatus,
  InventoryItemCategory,
  InventoryItemTracking,
} from "@/types/api";

export type QueryFilterKey =
  | "search"
  | "category"
  | "tracking"
  | "dateFrom"
  | "dateTo"
  | "licenseId"
  | "siteId"
  | "warehouseId"
  | "itemId"
  | "inventoryId"
  | "lifecycleStatus"
  | "assignmentStatus"
  | "condition";

export type QueryFilterValues = Partial<Record<QueryFilterKey, string>>;

const TRACKING: { value: InventoryItemTracking; label: string }[] = [
  { value: "quantity", label: "Quantity" },
  { value: "individual", label: "Individual" },
];

const CATEGORY: { value: InventoryItemCategory; label: string }[] = [
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
];

const LIFECYCLE: { value: EquipmentLifecycleStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "sold", label: "Sold" },
  { value: "disposed", label: "Disposed" },
];

const ASSIGNMENT: { value: EquipmentAssignmentStatus; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "deployed_to_site", label: "Deployed to site" },
  { value: "rented_to_client", label: "Rented to client" },
  { value: "rented_from_client", label: "Rented from client" },
];

const CONDITION: { value: EquipmentCondition; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "under_maintenance", label: "Under maintenance" },
  { value: "out_of_commission", label: "Out of commission" },
];

export function QueryFilters({
  fields,
  values,
  onChange,
  searchPlaceholder = "Search",
  itemCategory = "equipment",
  title,
  className = "mb-6",
}: {
  fields: QueryFilterKey[];
  values: QueryFilterValues;
  onChange: (next: QueryFilterValues) => void;
  searchPlaceholder?: string;
  itemCategory?: InventoryItemCategory;
  title?: string;
  className?: string;
}) {
  function set(key: QueryFilterKey, value: string) {
    onChange({ ...values, [key]: value });
  }

  const active = fields.some((key) => Boolean(values[key]));

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      {title ? <p className="kicker w-full">{title}</p> : null}
      {fields.map((key) => (
        <FilterControl
          key={key}
          field={key}
          value={values[key] ?? ""}
          searchPlaceholder={searchPlaceholder}
          itemCategory={itemCategory}
          onChange={(value) => set(key, value)}
        />
      ))}
      {active ? (
        <button type="button" className="btn btn-ghost" onClick={() => onChange({})}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

function FilterControl({
  field,
  value,
  onChange,
  searchPlaceholder,
  itemCategory,
}: {
  field: QueryFilterKey;
  value: string;
  onChange: (value: string) => void;
  searchPlaceholder: string;
  itemCategory: InventoryItemCategory;
}) {
  if (field === "search") {
    return (
      <Wrap wide>
        <Field label="Search">
          <input
            className="field"
            placeholder={searchPlaceholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      </Wrap>
    );
  }

  if (field === "dateFrom" || field === "dateTo") {
    return (
      <Wrap>
        <Field label={field === "dateFrom" ? "From" : "To"}>
          <input className="field" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
        </Field>
      </Wrap>
    );
  }

  if (field === "category") return <StaticSelect label="Category" empty="All categories" value={value} options={CATEGORY} onChange={onChange} />;
  if (field === "tracking") return <StaticSelect label="Tracking" empty="All tracking" value={value} options={TRACKING} onChange={onChange} />;
  if (field === "lifecycleStatus") return <StaticSelect label="Ownership" empty="Any ownership" value={value} options={LIFECYCLE} onChange={onChange} />;
  if (field === "assignmentStatus") return <StaticSelect label="Status" empty="Any status" value={value} options={ASSIGNMENT} onChange={onChange} />;
  if (field === "condition") return <StaticSelect label="Condition" empty="Any condition" value={value} options={CONDITION} onChange={onChange} />;
  if (field === "licenseId") return <LicenseSelect value={value} onChange={onChange} />;
  if (field === "siteId") return <SiteSelect value={value} onChange={onChange} />;
  if (field === "warehouseId") return <WarehouseSelect value={value} onChange={onChange} />;
  if (field === "itemId") return <ItemSelect value={value} category={itemCategory} onChange={onChange} />;
  return <InventorySelect value={value} onChange={onChange} />;
}

function Wrap({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "w-full sm:w-64" : "w-full sm:w-44"}>{children}</div>;
}

function StaticSelect({
  label,
  empty,
  value,
  options,
  onChange,
}: {
  label: string;
  empty: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Wrap>
      <Field label={label}>
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{empty}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function LicenseSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useLicenses({ limit: 50 });
  const options = (data?.data ?? []).filter((license) => !license.deletedAt);
  return (
    <Wrap>
      <Field label="License">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All licenses</option>
          {options.map((license) => (
            <option key={license.id} value={license.id}>
              {license.name}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function SiteSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowed = visibleSiteIds(store);
  const { data } = useSites({ limit: 50 });
  const options = (data?.data ?? []).filter((site) => !site.deletedAt && (!manager || allowed.has(site.id)));
  return (
    <Wrap>
      <Field label="Site">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All sites</option>
          {options.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function WarehouseSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useWarehouses({ limit: 50 });
  const options = (data?.data ?? []).filter((warehouse) => !warehouse.deletedAt);
  return (
    <Wrap>
      <Field label="Warehouse">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All warehouses</option>
          {options.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function ItemSelect({
  value,
  category,
  onChange,
}: {
  value: string;
  category: InventoryItemCategory;
  onChange: (value: string) => void;
}) {
  const { data } = useInventoryItems({ category, limit: 50 });
  const options = (data?.data ?? []).filter((item) => !item.deletedAt);
  return (
    <Wrap wide>
      <Field label="Item">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All items</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function InventorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useInventoryNodes({ limit: 50 });
  const options = data?.data ?? [];
  return (
    <Wrap wide>
      <Field label="Location">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All locations</option>
          {options.map((node) => {
            const name = node.site?.name ?? node.warehouse?.name ?? "Unknown";
            const kind = node.inventoryType === "site" ? "Site" : "Warehouse";
            return (
              <option key={node.id} value={node.id}>
                {kind} · {name}
              </option>
            );
          })}
        </select>
      </Field>
    </Wrap>
  );
}
