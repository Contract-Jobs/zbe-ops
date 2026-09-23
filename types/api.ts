// v2 API types — mirrors docs/new_api.md "Base Data Models" and payload
// tables. See docs/api-v2-migration-plan.md for the migration this replaces.

export type Role = "superadmin" | "admin" | "site_manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
  banned: boolean;
}

// ---- 1. Inventory Catalog & Nodes ----

export interface Inventory {
  id: string;
  inventoryType: "site" | "warehouse";
  siteId: string | null;
  warehouseId: string | null;
  site?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string } | null;
  materialItemCount?: number;
  bulkEquipmentItemCount?: number;
  individualEquipmentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type InventoryItemCategory = "equipment" | "material";
export type InventoryItemTracking = "quantity" | "individual";
export type InventoryItemCompositionType = "single" | "set";

export interface InventoryItem {
  id: string;
  name: string;
  slug: string;
  category: InventoryItemCategory;
  tracking: InventoryItemTracking;
  compositionType: InventoryItemCompositionType;
  unit: string;
  // Sum of this item's balance across every inventory node, computed
  // server-side. 0/"0" for individually-tracked items (no balances).
  totalQuantity: number;
  totalValue: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface InventoryItemSubitem {
  id: string;
  parentItemId: string;
  name: string;
  quantity: string;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// GET /api/inventory-items/[id]/balances — row shape
export interface ItemBalanceRow {
  location: string;
  locationId: string;
  quantity: number;
  totalValue: string;
  averageUnitValue: string | null;
}

// GET /api/inventory-items/[id]/history — row shape
export interface ItemHistoryRow {
  movement: InventoryMovement;
  fromLabel: string | null;
  toLabel: string | null;
}

// ---- 2. Quantity-Tracked Inventory (Materials & Bulk Equipment) ----

export interface InventoryBalance {
  id: string;
  inventoryId: string;
  itemId: string;
  item?: InventoryItem;
  quantity: number;
  totalValue: string;
  averageUnitValue: string | null;
  createdAt: string;
  updatedAt: string;
}

// Row shape for GET /api/inventories|sites|warehouses/[id]/materials — and
// the "bulk" half of .../equipments. Pre-joined (itemName/itemSlug/unit
// already resolved), unlike a raw InventoryBalance row.
export interface MaterialAtInventory {
  itemId: string;
  itemName: string;
  itemSlug: string;
  unit: string;
  quantity: number;
  totalValue: string;
  averageUnitValue: string | null;
}

export type BulkEquipmentAtInventory = MaterialAtInventory;

export type QuantityMovementType = "purchase" | "sale" | "transfer" | "consume" | "loss";

export interface InventoryMovement {
  id: string;
  itemId: string;
  item?: InventoryItem;
  movementType: QuantityMovementType;
  quantity: number;
  unitCost: string;
  totalCost: string;
  sourceInventoryId: string | null;
  destinationInventoryId: string | null;
  clientName: string | null;
  movementDate: string;
  metadata: Record<string, unknown> | null;
  isApproved: boolean;
  isReversed: boolean;
  isReversal: boolean;
  reversalOfId: string | null;
  licenseId: string | null;
  transactionId: string | null;
  ledgerId: string | null;
  loggedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyBalanceResult {
  consistent: boolean;
  expectedQuantity: number;
  storedQuantity: number;
  expectedValue: string;
  storedValue: string;
}

export interface RebuildResult {
  rebuilt: number;
  errors: string[];
}

export type InventoryMovementCreatePayload =
  | {
      movementType: "purchase";
      itemId?: string;
      quantity: number;
      destinationInventoryId: string;
      unitCost: string;
      clientName?: string;
      licenseId: string;
      autoCreateItem?: { name: string; slug?: string; category: "material"; unit?: string };
    }
  | {
      movementType: "sale";
      itemId: string;
      quantity: number;
      sourceInventoryId: string;
      unitCost: string;
      clientName?: string;
      licenseId: string;
    }
  | {
      movementType: "transfer";
      itemId: string;
      quantity: number;
      sourceInventoryId: string;
      destinationInventoryId: string;
    }
  | {
      movementType: "consume";
      itemId: string;
      quantity: number;
      sourceInventoryId: string;
    }
  | {
      movementType: "loss";
      itemId: string;
      quantity: number;
      sourceInventoryId: string;
      metadata: { reason: string };
    };

// ---- 3. Individually-Tracked Equipment ----

export type EquipmentAssignmentStatus = "idle" | "deployed_to_site" | "rented_to_client" | "rented_from_client";
export type EquipmentLifecycleStatus = "active" | "sold" | "disposed";
export type EquipmentCondition = "ok" | "under_maintenance" | "out_of_commission";

export interface IndividualEquipmentItem {
  id: string;
  itemId: string;
  item?: InventoryItem;
  identifier: string;
  vendorName: string | null;
  originalValue: string;
  bookValue: string | null;
  assignmentStatus: EquipmentAssignmentStatus;
  lifecycleStatus: EquipmentLifecycleStatus;
  condition: EquipmentCondition;
  currentInventoryId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// NOTE: `transfer_between_warehouses` is real and supported server-side —
// docs/new_api.md's base-model enum omits it, confirmed wrong (see
// docs/api-v2-migration-plan.md). `rent_to_client`/`return_from_client`/
// `rent_from_client`/`return_to_client` are valid values but only reachable
// via /rentals, never POST /equipment-movements directly.
export type EquipmentMovementType =
  | "purchase"
  | "sale"
  | "dispose"
  | "deploy_to_site"
  | "transfer_between_sites"
  | "transfer_between_warehouses"
  | "return_to_warehouse"
  | "rent_to_client"
  | "return_from_client"
  | "rent_from_client"
  | "return_to_client"
  | "send_to_maintenance"
  | "return_from_maintenance"
  | "degrade";

export interface IndividualEquipmentMovement {
  id: string;
  individualItemId: string;
  equipment?: IndividualEquipmentItem;
  movementType: EquipmentMovementType;
  sourceInventoryId: string | null;
  destinationInventoryId: string | null;
  clientName: string | null;
  movementDate: string;
  metadata: Record<string, unknown> | null;
  movementCost: string | null;
  isApproved: boolean;
  isReversed: boolean;
  isReversal: boolean;
  reversalOfId: string | null;
  licenseId: string | null;
  transactionId: string | null;
  ledgerId: string | null;
  loggedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentTraceResponse {
  equipmentId: string;
  identifier: string;
  currentLocation: { location: string; locationId: string; status: string } | null;
  history: {
    movement: IndividualEquipmentMovement;
    fromLabel: string | null;
    toLabel: string | null;
  }[];
}

export interface VerifyEquipmentStateResult {
  consistent: boolean;
  expectedState: Partial<IndividualEquipmentItem>;
  storedState: Partial<IndividualEquipmentItem>;
}

interface AutoCreateEquipmentPayload {
  itemId?: string;
  autoCreateItem?: { name: string; slug?: string; category: "equipment"; compositionType?: InventoryItemCompositionType };
  identifier?: string;
  vendorName?: string;
  originalValue: string;
  bookValue?: string;
}

export type EquipmentMovementCreatePayload =
  | {
      movementType: "purchase";
      individualItemId?: string;
      destinationInventoryId: string;
      movementCost?: string;
      clientName?: string;
      licenseId: string;
      autoCreateEquipment?: AutoCreateEquipmentPayload;
    }
  | {
      movementType: "deploy_to_site";
      individualItemId: string;
      destinationInventoryId: string;
    }
  | {
      movementType: "return_to_warehouse";
      individualItemId: string;
      destinationInventoryId: string;
    }
  | {
      movementType: "transfer_between_sites";
      individualItemId: string;
      destinationInventoryId: string;
    }
  | {
      movementType: "transfer_between_warehouses";
      individualItemId: string;
      destinationInventoryId: string;
    }
  | {
      movementType: "send_to_maintenance";
      individualItemId: string;
      clientName?: string;
    }
  | {
      movementType: "return_from_maintenance";
      individualItemId: string;
      destinationInventoryId: string;
      movementCost?: string;
      licenseId?: string;
    }
  | {
      movementType: "sale";
      individualItemId: string;
      movementCost?: string;
      clientName?: string;
      licenseId: string;
    }
  | {
      movementType: "dispose";
      individualItemId: string;
    }
  | {
      movementType: "degrade";
      individualItemId: string;
      movementCost: string;
    };

// ---- 4. Rentals ----

export interface RentalAgreement {
  id: string;
  equipmentId: string;
  type: "rent_in" | "rent_out";
  status: "active" | "completed" | "cancelled";
  siteId: string | null;
  warehouseId: string | null;
  licenseId: string | null;
  vendorName: string | null;
  buyerName: string | null;
  rentStartDate: string;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  returnSiteId: string | null;
  returnWarehouseId: string | null;
  currentDailyRate?: string | null;
  // Enriched server-side via a batched join (one query per page, not
  // N+1) — use this instead of fetching the equipment list separately
  // to label a rental row.
  equipment?: {
    id: string;
    identifier: string;
    itemId: string;
    itemName: string;
    vendorName: string | null;
    condition: EquipmentCondition;
    assignmentStatus: EquipmentAssignmentStatus;
    lifecycleStatus: EquipmentLifecycleStatus;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalEvent {
  id: string;
  agreementId: string;
  eventType: "initiation" | "rate_change" | "upfront_payment" | "penalty" | "settlement";
  dailyRate: string | null;
  lumpSumAmount: string | null;
  transactionId: string | null;
  equipmentMovementId: string | null;
  notes: string | null;
  loggedBy: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalCreatePayload {
  equipmentId: string | "new";
  type: "rent_in" | "rent_out";
  siteId?: string;
  warehouseId?: string;
  licenseId?: string;
  vendorName?: string;
  buyerName?: string;
  rentStartDate: string;
  expectedReturnDate?: string;
  dailyRate: number;
  upfrontFee?: number;
  notes?: string;
  autoCreateEquipment?: AutoCreateEquipmentPayload;
}

export interface RentalAdjustPayload {
  dailyRate?: number;
  lumpSumFee?: number;
  notes: string;
}

export interface RentalReturnPayload {
  actualReturnDate: string;
  returnSiteId?: string;
  returnWarehouseId?: string;
  finalCostOverride?: number;
  notes?: string;
}

// ---- 5. Sites, Tasks & Lifecycle ----

export interface Site {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  status: "active" | "closed";
  laborBudget: string | null;
  materialBudget: string | null;
  otherBudget: string | null;
  tenderId: string | null;
  managerId: string | null;
  licenseId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SiteLifecycleLog {
  id: string;
  siteId: string;
  event: "site_created" | "site_updated" | "site_closed";
  description: string;
  affectedFields: Record<string, unknown> | null;
  loggedBy: string;
  timestamp: string;
}

export interface SiteTask {
  id: string;
  siteId: string;
  title: string;
  targetDate: string | null;
  isCompleted: boolean;
  completionClaimBy: string | null;
  completedBy: string | null;
  notes: string | null;
  completedDate: string | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSummary {
  site: Site;
  tasks: {
    total: number;
    completed: number;
    completionPercent: number;
  };
  budget: {
    laborBudget: string;
    laborSpent: string;
    materialBudget: string;
    materialSpent: string;
    otherBudget: string;
    otherSpent: string;
    equipmentSpent: string;
    equipmentValue: string;
    totalBudget: string;
    totalSpent: string;
    remaining: string;
  };
  inventory: {
    itemId: string;
    itemName: string;
    quantity: number;
    averageUnitValue: string | null;
  }[];
  pendingApprovals: number;
  recentTasks: SiteTask[];
}

// ---- 6. Master Data (Tenders, Licenses, Warehouses) ----

export interface Tender {
  id: string;
  licenseId: string;
  name: string;
  location: string | null;
  estimatedBudget: string | null;
  status: "pending" | "won" | "lost";
  submissionDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface License {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  totalMaterials?: number;
  totalEquipment?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SoldItemsOverview {
  soldEquipmentCount: number;
  soldEquipmentTotal: string;
  soldMaterialCount: number;
  soldMaterialTotal: string;
  totalCount: number;
  totalRevenue: string;
}

// ---- 7. Financial Transactions & Ledger ----

export interface Transaction {
  id: string;
  licenseId: string;
  siteId: string | null;
  warehouseId: string | null;
  equipmentId: string | null;
  categoryId: string | null;
  itemId: string | null;
  type: "money_in" | "money_out";
  amount: string;
  description: string | null;
  transactionDate: string | null;
  isApproved: boolean;
  isReversed: boolean;
  isReversal: boolean;
  reversalOfId: string | null;
  isSystemGenerated: boolean;
  ledgerId: string | null;
  loggedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TransactionCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProjectLedger {
  id: string;
  siteId: string;
  licenseId: string;
  amount: string;
  description: string | null;
  sourceRefType: "transaction" | "material" | "equipment";
  sourceRefId: string;
  isReversed: boolean;
  isReversal: boolean;
  reversalOfId: string | null;
  timestamp: string;
  loggedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostBreakdown {
  siteId: string;
  dateFrom?: string;
  dateTo?: string;
  totalSpend: string;
  byCategory: {
    categoryId: string | null;
    categoryName: string;
    total: string;
    count: number;
  }[];
}

export interface VerifyLedgerResult {
  consistent: boolean;
  storedTotal: string;
  expectedTotal: string;
}

// ---- 8. Approvals ----

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalType =
  | "inventory_movement"
  | "equipment_movement"
  | "transaction"
  | "progress_log"
  | "rental_event";

export interface Approval {
  id: string;
  approvalType: ApprovalType;
  recordId: string;
  status: ApprovalStatus;
  submittedBy: string;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ---- 9. Analytics ----

export interface SpendAnalytics {
  materialSpend: string;
  laborSpend: string;
  otherSpend: string;
  equipmentValue: string;
  equipmentLoss: string;
  totalSpend: string;
}

export interface LicenseAnalytics {
  licenseId: string;
  licenseName: string;
  totalSpent: string;
  totalReceived: string;
  netCashFlow: string;
}

export interface InventoryAnalytics {
  totalMaterials: number;
  totalMaterialValue: string;
  totalEquipment: number;
  equipmentValue: string;
  bySite: { siteId: string; siteName: string; materialCount: number; totalQuantity: number }[];
  byWarehouse: { warehouseId: string; warehouseName: string; materialCount: number; totalQuantity: number }[];
  movementVolume: { movementType: string; count: number; totalQuantity: number }[];
}

export interface BudgetHealthEntry {
  siteId: string;
  siteName: string;
  materialBudget: string;
  laborBudget: string;
  totalBudget: string;
  materialSpent: string;
  laborSpent: string;
  equipmentLoss: string;
  otherSpent: string;
  totalSpent: string;
  variance: string;
  isOverBudget: boolean;
}

export interface TaskSummaryRow {
  taskId: string;
  name: string;
  targetDate: string | null;
  isCompleted: boolean;
}

export interface LedgerCostRow {
  amount: string;
  description: string | null;
  timestamp: string;
  sourceRefType: "transaction" | "material" | "equipment";
  isReversal: boolean;
}

export interface BudgetOverview {
  siteId: string;
  laborBudget: string | null;
  materialBudget: string | null;
  otherBudget: string | null;
  materialSpend: string;
  laborSpend: string;
  equipmentCapital: string;
  totalBudgeted: string;
  otherSpend: string;
  totalSpent: string;
  variance: string;
  tasks: TaskSummaryRow[];
  costs: LedgerCostRow[];
}

export interface SalesAnalytics {
  totalMaterialRevenue: string;
  totalEquipmentRevenue: string;
  totalRevenue: string;
  materialSaleCount: number;
  equipmentSaleCount: number;
}

export interface CompanyFinancialSummary {
  expense: {
    siteAttributed: { material: string; labor: string; equipment: string; other: string; total: string };
    nonSite: { warehouseAnchored: string; corporate: string; total: string };
    total: string;
  };
  income: {
    materialSaleRevenue: string;
    equipmentSaleRevenue: string;
    other: string;
    total: string;
  };
  netCashFlow: string;
}
