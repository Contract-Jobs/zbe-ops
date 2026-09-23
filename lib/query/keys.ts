// lib/query/keys.ts
//
// One factory per resource. Every list-type key takes its ListParams object
// as part of the key, so different filter/search/page combos cache separately
// and get invalidated together via the parent key (e.g. inventoryItems.lists()).
//
// A few resources are RBAC-filtered by the backend (Site Managers see a
// restricted view of the same endpoint an Admin calls) — see docs/new_api.md's
// "site_manager grants" notes on Sites, Inventory Balances, Approvals,
// Transactions, and Ledgers. For those, the calling hook passes the current
// userId into the params object so two different users never collide on the
// same cache entry. Resources where site_manager has the same read access as
// admin (Inventory Items, Equipment, Tenders, Licenses, Warehouses,
// Categories) don't need this.

// ---- Reusable factory for the identical simple-CRUD resources ----

function simpleCrudKeys(resource: string) {
  return {
    all: [resource] as const,
    lists: () => [resource, "list"] as const,
    list: (params?: unknown) => [resource, "list", params] as const,
    details: () => [resource, "detail"] as const,
    detail: (id: string) => [resource, "detail", id] as const,
  };
}

export const queryKeys = {
  inventoryItems: {
    ...simpleCrudKeys("inventory-items"),
    subitems: (itemId: string) => ["inventory-items", "detail", itemId, "subitems"] as const,
    balances: (itemId: string, params?: unknown) => ["inventory-items", "detail", itemId, "balances", params] as const,
    history: (itemId: string, params?: unknown) => ["inventory-items", "detail", itemId, "history", params] as const,
  },

  inventoryMovements: {
    all: ["inventory-movements"] as const,
    lists: () => ["inventory-movements", "list"] as const,
    list: (params?: unknown) => ["inventory-movements", "list", params] as const,
  },

  inventoryBalances: {
    all: ["inventory-balances"] as const,
    // scoped: Site Managers restricted to own site(s) — pass userId in params
    list: (params?: unknown) => ["inventory-balances", "list", params] as const,
    movements: (params?: unknown) => ["inventory-balances", "movements", params] as const,
    verify: (itemId: string, inventoryId: string) => ["inventory-balances", "verify", itemId, inventoryId] as const,
  },

  inventories: {
    all: ["inventories"] as const,
    list: (params?: unknown) => ["inventories", "list", params] as const,
    detail: (id: string) => ["inventories", "detail", id] as const,
    materials: (nodeId: string, params?: unknown) => ["inventories", "detail", nodeId, "materials", params] as const,
    equipment: (nodeId: string, params?: unknown) => ["inventories", "detail", nodeId, "equipment", params] as const,
    bulkEquipment: (nodeId: string, params?: unknown) => ["inventories", "detail", nodeId, "bulk-equipment", params] as const,
  },

  equipment: {
    all: ["equipment"] as const,
    lists: () => ["equipment", "list"] as const,
    list: (params?: unknown) => ["equipment", "list", params] as const,
    details: () => ["equipment", "detail"] as const,
    detail: (id: string) => ["equipment", "detail", id] as const,
    trace: (id: string) => ["equipment", "detail", id, "trace"] as const,
    verify: (id: string) => ["equipment", "detail", id, "verify"] as const,
  },

  equipmentMovements: {
    all: ["equipment-movements"] as const,
    lists: () => ["equipment-movements", "list"] as const,
    list: (params?: unknown) => ["equipment-movements", "list", params] as const,
  },

  rentals: {
    all: ["rentals"] as const,
    lists: () => ["rentals", "list"] as const,
    list: (params?: unknown) => ["rentals", "list", params] as const,
    details: () => ["rentals", "detail"] as const,
    detail: (id: string) => ["rentals", "detail", id] as const,
    events: (id: string, params?: unknown) => ["rentals", "detail", id, "events", params] as const,
    allEvents: (params?: unknown) => ["rentals", "events", params] as const,
  },

  sites: {
    all: ["sites"] as const,
    // scoped: Site Managers only see assigned sites — pass userId in params
    lists: () => ["sites", "list"] as const,
    list: (params?: unknown) => ["sites", "list", params] as const,
    details: () => ["sites", "detail"] as const,
    detail: (id: string) => ["sites", "detail", id] as const,
    summary: (id: string) => ["sites", "detail", id, "summary"] as const,
    materials: (id: string, params?: unknown) => ["sites", "detail", id, "materials", params] as const,
    equipment: (id: string, params?: unknown) => ["sites", "detail", id, "equipment", params] as const,
    bulkEquipment: (id: string, params?: unknown) => ["sites", "detail", id, "bulk-equipment", params] as const,
    lifecycle: (id: string, params?: unknown) =>
      ["sites", "detail", id, "lifecycle", params] as const,
    tasks: (id: string, params?: unknown) =>
      ["sites", "detail", id, "tasks", params] as const,
    // Prefix-only variants for invalidating every params variant at once.
    // NOTE: calling `lifecycle(id)`/`tasks(id)` without the params arg does
    // NOT do this — it produces a same-length key with `params: undefined`,
    // which TanStack's partialMatchKey does not treat as a wildcard (an
    // `undefined` slot never structurally matches a real params object, even
    // `{}`), so it silently invalidates nothing. Use these instead.
    lifecycleAll: (id: string) => ["sites", "detail", id, "lifecycle"] as const,
    tasksAll: (id: string) => ["sites", "detail", id, "tasks"] as const,
  },

  tasks: {
    all: ["tasks"] as const,
    lists: () => ["tasks", "list"] as const,
    list: (params?: unknown) => ["tasks", "list", params] as const,
    details: () => ["tasks", "detail"] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },

  tenders: simpleCrudKeys("tenders"),
  licenses: simpleCrudKeys("licenses"),
  warehouses: {
    ...simpleCrudKeys("warehouses"),
    soldItems: (id: string) => ["warehouses", "detail", id, "sold-items"] as const,
    soldEquipment: (id: string, params?: unknown) => ["warehouses", "detail", id, "sold-equipment", params] as const,
    soldMaterials: (id: string, params?: unknown) => ["warehouses", "detail", id, "sold-materials", params] as const,
    materials: (id: string, params?: unknown) => ["warehouses", "detail", id, "materials", params] as const,
    equipment: (id: string, params?: unknown) => ["warehouses", "detail", id, "equipment", params] as const,
    bulkEquipment: (id: string, params?: unknown) => ["warehouses", "detail", id, "bulk-equipment", params] as const,
  },
  categories: simpleCrudKeys("categories"),
  users: simpleCrudKeys("users"),

  transactions: {
    // scoped: "restricted view" — pass userId in params
    all: ["transactions"] as const,
    lists: () => ["transactions", "list"] as const,
    list: (params?: unknown) => ["transactions", "list", params] as const,
    details: () => ["transactions", "detail"] as const,
    detail: (id: string) => ["transactions", "detail", id] as const,
  },

  ledgers: {
    // scoped: Site Managers restricted to own site — pass userId in params
    all: ["ledgers"] as const,
    list: (params?: unknown) => ["ledgers", "list", params] as const,
    costBreakdown: (siteId: string, dateFrom?: string, dateTo?: string) =>
      ["ledgers", "cost-breakdown", siteId, dateFrom, dateTo] as const,
    verify: (siteId: string) => ["ledgers", "verify", siteId] as const,
  },

  approvals: {
    // scoped: Admins see all, Site Managers see own submitted only — pass userId in params
    all: ["approvals"] as const,
    lists: () => ["approvals", "list"] as const,
    list: (params?: unknown) => ["approvals", "list", params] as const,
    details: () => ["approvals", "detail"] as const,
    detail: (id: string) => ["approvals", "detail", id] as const,
  },

  analytics: {
    spend: (params?: unknown) => ["analytics", "spend", params] as const,
    budget: (params?: unknown) => ["analytics", "budget", params] as const,
    budgetHealth: (params?: unknown) => ["analytics", "budget-health", params] as const,
    inventory: (params?: unknown) => ["analytics", "inventory", params] as const,
    licenses: (params?: unknown) => ["analytics", "licenses", params] as const,
    sales: (params?: unknown) => ["analytics", "sales", params] as const,
    company: (params?: unknown) => ["analytics", "company", params] as const,
  },
};
