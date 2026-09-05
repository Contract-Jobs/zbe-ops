// lib/query/keys.ts
//
// One factory per resource. Every list-type key takes its ListParams object
// as part of the key, so different filter/search/page combos cache separately
// and get invalidated together via the parent key (e.g. materials.lists()).
//
// A few resources are RBAC-filtered by the backend (Site Managers see a
// restricted view of the same endpoint an Admin calls) — see the doc's
// "restricted to own site(s)" / "own submitted only" notes on Sites,
// Inventory Balances, Approvals, Transactions, and Ledgers. For those, the
// calling hook passes the current userId into the params object so two
// different users never collide on the same cache entry. Resources where
// the doc says "RBAC: All roles" with no scoping note (Materials, Equipment,
// Tenders, Licenses, Warehouses, Categories) don't need this.

// ---- Reusable factory for the four identical simple-CRUD resources ----

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
  materials: {
    all: ["materials"] as const,
    lists: () => ["materials", "list"] as const,
    list: (params?: unknown) => ["materials", "list", params] as const,
    details: () => ["materials", "detail"] as const,
    detail: (id: string) => ["materials", "detail", id] as const,
    subItems: (materialId: string) =>
      ["materials", "detail", materialId, "sub-items"] as const,
    logs: (params?: unknown) => ["material-logs", "list", params] as const,
    log: (id: string) => ["material-logs", "detail", id] as const,
  },

  equipment: {
    all: ["equipment"] as const,
    lists: () => ["equipment", "list"] as const,
    list: (params?: unknown) => ["equipment", "list", params] as const,
    details: () => ["equipment", "detail"] as const,
    detail: (id: string) => ["equipment", "detail", id] as const,
    logs: (params?: unknown) => ["equipment-logs", "list", params] as const,
    log: (id: string) => ["equipment-logs", "detail", id] as const,
  },

  inventory: {
    // scoped: Site Managers get a restricted view — pass userId in params
    balances: (params?: unknown) => ["inventory", "balances", params] as const,
    trace: (catalogId: string) => ["inventory", "trace", catalogId] as const,
  },

  rentals: {
    all: ["rentals"] as const,
    lists: () => ["rentals", "list"] as const,
    list: (params?: unknown) => ["rentals", "list", params] as const,
    details: () => ["rentals", "detail"] as const,
    detail: (id: string) => ["rentals", "detail", id] as const,
  },

  sites: {
    all: ["sites"] as const,
    // scoped: Site Managers only see assigned sites — pass userId in params
    lists: () => ["sites", "list"] as const,
    list: (params?: unknown) => ["sites", "list", params] as const,
    details: () => ["sites", "detail"] as const,
    detail: (id: string) => ["sites", "detail", id] as const,
    summary: (id: string) => ["sites", "detail", id, "summary"] as const,
    lifecycle: (id: string, params?: unknown) =>
      ["sites", "detail", id, "lifecycle", params] as const,
    tasks: (id: string, params?: unknown) =>
      ["sites", "detail", id, "tasks", params] as const,
  },

  tenders: simpleCrudKeys("tenders"),
  licenses: simpleCrudKeys("licenses"),
  warehouses: simpleCrudKeys("warehouses"),
  categories: simpleCrudKeys("categories"),

  transactions: {
    // scoped: "All roles (restricted view)" — pass userId in params
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
    spend: ["analytics", "spend"] as const,
    budget: ["analytics", "budget"] as const,
    budgetHealth: ["analytics", "budget-health"] as const,
    inventory: ["analytics", "inventory"] as const,
    licenses: ["analytics", "licenses"] as const,
    costBreakdown: (siteId: string, dateFrom?: string, dateTo?: string) =>
      ["analytics", "cost-breakdown", siteId, dateFrom, dateTo] as const,
  },
};
