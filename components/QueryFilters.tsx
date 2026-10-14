"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Field } from "@/components/ui";
import { useCategories } from "@/hooks/use-categories";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import { useInventoryNodes } from "@/hooks/use-inventories";
import { useLicenses } from "@/hooks/use-licenses";
import { useSites } from "@/hooks/use-sites";
import { useUsers } from "@/hooks/use-users";
import { useWarehouses } from "@/hooks/use-warehouses";
import { QUANTITY_MOVEMENT_LABELS } from "@/lib/movement-labels";
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
  | "condition"
  | "buyerSiteId"
  | "categoryId"
  | "type"
  | "direction"
  | "sourceRefType"
  | "saleStatus"
  | "isApproved"
  | "isInternal"
  | "includeReversed"
  | "minAmount"
  | "maxAmount"
  | "approvalType"
  | "submittedBy"
  | "approvedBy"
  | "resolvedFrom"
  | "resolvedTo"
  | "loggedBy"
  | "isReversed"
  | "buyerType"
  | "isMarkedPaid"
  | "movementType";

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

const TX_TYPE = [
  { value: "money_in", label: "Money in" },
  { value: "money_out", label: "Money out" },
];

// Ledger amounts are signed: debit adds cost, credit removes it.
const DIRECTION = [
  { value: "debit", label: "Debit (cost added)" },
  { value: "credit", label: "Credit (cost removed)" },
];

const SOURCE_REF_TYPE = [
  { value: "transaction", label: "Transaction" },
  { value: "material_log", label: "Material log" },
  { value: "equipment_log", label: "Equipment log" },
  { value: "rental_event", label: "Rental event" },
];

const SALE_STATUS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

const APPROVED = [
  { value: "true", label: "Approved" },
  { value: "false", label: "Awaiting approval" },
];

const INTERNAL = [
  { value: "true", label: "Sold to a site" },
  { value: "false", label: "Not sold to a site" },
];

const INCLUDE_REVERSED = [{ value: "true", label: "Show reversed and reversals" }];

const MOVEMENT_TYPE = Object.entries(QUANTITY_MOVEMENT_LABELS).map(([value, label]) => ({ value, label }));

const BUYER_TYPE = [
  { value: "site", label: "Sites" },
  { value: "external", label: "Outside clients" },
];

const MARKED_PAID = [
  { value: "true", label: "Marked paid" },
  { value: "false", label: "Not marked paid" },
];

const REVERSED = [
  { value: "false", label: "Not reversed" },
  { value: "true", label: "Reversed" },
];

const APPROVAL_TYPE = [
  { value: "inventory_movement", label: "Inventory movement" },
  { value: "equipment_movement", label: "Equipment movement" },
  { value: "transaction", label: "Transaction" },
  { value: "progress_log", label: "Progress log" },
  { value: "rental_event", label: "Rental event" },
];

export function QueryFilters({
  fields,
  values,
  onChange,
  searchPlaceholder = "Search",
  itemCategory = "equipment",
  title,
  className = "mb-6",
  labels,
  popover = false,
  pinned = [],
}: {
  fields: QueryFilterKey[];
  values: QueryFilterValues;
  onChange: (next: QueryFilterValues) => void;
  searchPlaceholder?: string;
  itemCategory?: InventoryItemCategory;
  title?: string;
  className?: string;
  // Override a control's label where the generic one is ambiguous (e.g. the
  // date range means "submitted" on one screen and "posted" on another).
  labels?: Partial<Record<QueryFilterKey, string>>;
  // For bars with many fields: keep `pinned` controls inline and put the rest
  // behind a Filters button. Pinned controls apply as you change them; the ones
  // in the popover are drafted and only apply on Apply.
  popover?: boolean;
  pinned?: QueryFilterKey[];
}) {
  function set(key: QueryFilterKey, value: string) {
    onChange({ ...values, [key]: value });
  }

  const active = fields.some((key) => Boolean(values[key]));

  if (popover) {
    const pinnedFields = fields.filter((key) => pinned.includes(key));
    const popoverFields = fields.filter((key) => !pinned.includes(key));
    return (
      <div className={`flex flex-wrap items-end gap-3 ${className}`}>
        {title ? <p className="kicker w-full">{title}</p> : null}
        {pinnedFields.map((key) => (
          <FilterControl
            key={key}
            field={key}
            value={values[key] ?? ""}
            searchPlaceholder={searchPlaceholder}
            itemCategory={itemCategory}
            label={labels?.[key]}
            onChange={(value) => set(key, value)}
          />
        ))}
        <FilterPopover
          fields={popoverFields}
          values={values}
          onChange={onChange}
          itemCategory={itemCategory}
          searchPlaceholder={searchPlaceholder}
          labels={labels}
        />
        {active ? (
          <button type="button" className="btn btn-ghost" onClick={() => onChange({})}>
            Clear
          </button>
        ) : null}
      </div>
    );
  }

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
          label={labels?.[key]}
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

// The Filters button and its panel. The trigger shows how many of its filters
// are applied (a count badge and an inverted button), so a closed panel still
// tells you the list is narrowed. Edits are drafted and only take effect on
// Apply; closing any other way discards them.
function FilterPopover({
  fields,
  values,
  onChange,
  itemCategory,
  searchPlaceholder,
  labels,
}: {
  fields: QueryFilterKey[];
  values: QueryFilterValues;
  onChange: (next: QueryFilterValues) => void;
  itemCategory: InventoryItemCategory;
  searchPlaceholder: string;
  labels?: Partial<Record<QueryFilterKey, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QueryFilterValues>({});
  const rootRef = useRef<HTMLDivElement>(null);

  const appliedCount = fields.filter((key) => Boolean(values[key])).length;
  const draftCount = fields.filter((key) => Boolean(draft[key])).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      // Start each visit from what is actually applied.
      setDraft(Object.fromEntries(fields.map((key) => [key, values[key] ?? ""])));
    }
    setOpen(!open);
  }

  function apply() {
    const next: QueryFilterValues = { ...values };
    for (const key of fields) {
      const value = draft[key]?.trim();
      if (value) next[key] = value;
      else delete next[key];
    }
    onChange(next);
    setOpen(false);
  }

  function clearAll() {
    const next: QueryFilterValues = { ...values };
    for (const key of fields) delete next[key];
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`btn ${appliedCount > 0 ? "" : "btn-ghost"} flex items-center gap-2`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={appliedCount > 0 ? `Filters, ${appliedCount} applied` : "Filters"}
        onClick={toggle}
      >
        Filters
        {appliedCount > 0 ? (
          <span className="min-w-5 border border-current px-1 text-center font-mono text-[0.7rem] leading-5">
            {appliedCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filters"
          className="fixed inset-x-4 top-28 z-40 max-h-[75vh] overflow-y-auto border border-black bg-white p-4 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1 sm:w-[44rem] sm:max-w-[calc(100vw-3rem)]"
        >
          <div className="flex flex-wrap items-end gap-3">
            {fields.map((key) => {
              const applied = values[key] ?? "";
              const current = draft[key] ?? "";
              // Solid = applied and untouched. Hollow = changed here and not
              // applied yet (including a filter about to be removed).
              const state: "none" | "applied" | "changed" =
                current === applied ? (applied ? "applied" : "none") : "changed";
              return (
                <div
                  key={key}
                  className={`relative border-l-2 pl-3 ${
                    state === "applied"
                      ? "border-yellow [&_label]:text-yellow"
                      : state === "changed"
                        ? "border-dashed border-yellow [&_label]:text-yellow"
                        : "border-transparent"
                  }`}
                >
                  {state !== "none" ? (
                    <span
                      aria-hidden
                      className={`absolute left-1 top-[0.42rem] h-1.5 w-1.5 border border-yellow ${
                        state === "applied" ? "bg-yellow" : "bg-transparent"
                      }`}
                    />
                  ) : null}
                  {current ? (
                    <button
                      type="button"
                      aria-label={`Clear ${labels?.[key] ?? key}`}
                      className="absolute right-0 top-0 px-1 text-sm leading-none text-black/50 hover:text-black"
                      onClick={() => setDraft((prev) => ({ ...prev, [key]: "" }))}
                    >
                      ×
                    </button>
                  ) : null}
                  <FilterControl
                    field={key}
                    value={current}
                    searchPlaceholder={searchPlaceholder}
                    itemCategory={itemCategory}
                    label={labels?.[key]}
                    onChange={(value) => setDraft((prev) => ({ ...prev, [key]: value }))}
                  />
                </div>
              );
            })}
          </div>
          {appliedCount > 0 || draftCount > 0 ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/50">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 border border-yellow bg-yellow" /> Applied
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 border border-yellow" /> Changed, not applied yet
              </span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3">
            <button
              type="button"
              className="text-xs text-black/60 hover:underline disabled:opacity-40"
              disabled={appliedCount === 0 && draftCount === 0}
              onClick={clearAll}
            >
              Clear these filters
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={apply}>
                Apply
              </button>
            </div>
          </div>
        </div>
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
  label,
}: {
  field: QueryFilterKey;
  value: string;
  onChange: (value: string) => void;
  searchPlaceholder: string;
  itemCategory: InventoryItemCategory;
  label?: string;
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

  if (field === "dateFrom" || field === "dateTo" || field === "resolvedFrom" || field === "resolvedTo") {
    const fallback =
      field === "dateFrom" ? "From" : field === "dateTo" ? "To" : field === "resolvedFrom" ? "Resolved from" : "Resolved to";
    return (
      <Wrap>
        <Field label={label ?? fallback}>
          <input className="field" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
        </Field>
      </Wrap>
    );
  }

  if (field === "approvalType") return <StaticSelect label="Request type" empty="All types" value={value} options={APPROVAL_TYPE} onChange={onChange} />;
  if (field === "movementType") return <StaticSelect label="Movement" empty="All movement types" value={value} options={MOVEMENT_TYPE} onChange={onChange} />;
  if (field === "buyerType") return <StaticSelect label="Buyer type" empty="All buyers" value={value} options={BUYER_TYPE} onChange={onChange} />;
  if (field === "isMarkedPaid") return <StaticSelect label="Paid label" empty="Any paid label" value={value} options={MARKED_PAID} onChange={onChange} />;
  if (field === "isReversed") return <StaticSelect label="Reversal" empty="Reversed or not" value={value} options={REVERSED} onChange={onChange} />;
  if (field === "loggedBy") return <UserSelect label={label ?? "Logged by"} empty="Anyone" value={value} onChange={onChange} />;
  if (field === "submittedBy") return <UserSelect label={label ?? "Submitted by"} empty="Anyone" value={value} onChange={onChange} />;
  if (field === "approvedBy") return <UserSelect label={label ?? "Resolved by"} empty="Anyone" value={value} onChange={onChange} />;
  if (field === "category") return <StaticSelect label="Category" empty="All categories" value={value} options={CATEGORY} onChange={onChange} />;
  if (field === "tracking") return <StaticSelect label="Tracking" empty="All tracking" value={value} options={TRACKING} onChange={onChange} />;
  if (field === "lifecycleStatus") return <StaticSelect label="Ownership" empty="Any ownership" value={value} options={LIFECYCLE} onChange={onChange} />;
  if (field === "assignmentStatus") return <StaticSelect label="Status" empty="Any status" value={value} options={ASSIGNMENT} onChange={onChange} />;
  if (field === "condition") return <StaticSelect label="Condition" empty="Any condition" value={value} options={CONDITION} onChange={onChange} />;
  if (field === "licenseId") return <LicenseSelect value={value} onChange={onChange} />;
  if (field === "siteId") return <SiteSelect value={value} onChange={onChange} />;
  if (field === "buyerSiteId") return <SiteSelect label="Buyer site" empty="Any buyer site" value={value} onChange={onChange} />;
  if (field === "categoryId") return <CategorySelect value={value} onChange={onChange} />;
  if (field === "type") return <StaticSelect label="Type" empty="Money in or out" value={value} options={TX_TYPE} onChange={onChange} />;
  if (field === "direction") return <StaticSelect label="Direction" empty="Debit or credit" value={value} options={DIRECTION} onChange={onChange} />;
  if (field === "sourceRefType") return <StaticSelect label="Source" empty="All sources" value={value} options={SOURCE_REF_TYPE} onChange={onChange} />;
  if (field === "saleStatus") return <StaticSelect label="Payment" empty="Any payment status" value={value} options={SALE_STATUS} onChange={onChange} />;
  if (field === "isApproved") return <StaticSelect label="Approval" empty="Any approval state" value={value} options={APPROVED} onChange={onChange} />;
  if (field === "isInternal") return <StaticSelect label="Buyer" empty="All buyers" value={value} options={INTERNAL} onChange={onChange} />;
  if (field === "includeReversed") return <StaticSelect label="Reversals" empty="Hide reversed" value={value} options={INCLUDE_REVERSED} onChange={onChange} />;
  if (field === "minAmount" || field === "maxAmount") {
    return (
      <Wrap>
        <Field label={field === "minAmount" ? "Min amount" : "Max amount"}>
          <input
            className="field"
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      </Wrap>
    );
  }
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

// Listing users is an admin call — only offer this filter to admins.
function UserSelect({
  label,
  empty,
  value,
  onChange,
}: {
  label: string;
  empty: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data } = useUsers();
  const options = data?.users ?? [];
  return (
    <Wrap>
      <Field label={label}>
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{empty}</option>
          {options.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data } = useCategories();
  const options = (data?.data ?? []).filter((category) => !category.deletedAt);
  return (
    <Wrap>
      <Field label="Category">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All categories</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
    </Wrap>
  );
}

function SiteSelect({
  value,
  onChange,
  label = "Site",
  empty = "All sites",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  empty?: string;
}) {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowed = visibleSiteIds(store);
  const { data } = useSites({ limit: 50 });
  const options = (data?.data ?? []).filter((site) => !site.deletedAt && (!manager || allowed.has(site.id)));
  return (
    <Wrap>
      <Field label={label}>
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{empty}</option>
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
