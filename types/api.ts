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
  // Current market price per unit — a reference price staff maintain, not the
  // weighted-average cost. Materials only; null = not set (never 0).
  marketValue?: string | null;
  // quantity × marketValue across all locations; null when marketValue is.
  totalMarketValue?: string | null;
  // Sales of this item carry 0% VAT.
  vatExempt?: boolean;
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

// GET /api/inventory-items/[id]/balances — row shape. Balances are scoped
// per (item, location, license) — the same location/locationId can repeat
// once per license holding stock there, so key rows by (locationId,
// licenseId), not locationId alone.
export interface ItemBalanceRow {
  location: string;
  locationId: string;
  licenseId: string;
  licenseName: string;
  quantity: number;
  totalValue: string;
  averageUnitValue: string | null;
  marketValue?: string | null;
  totalMarketValue?: string | null;
}

// GET /api/inventory-items/[id]/history — row shape
export interface ItemHistoryRow {
  movement: InventoryMovement;
  fromLabel: string | null;
  toLabel: string | null;
}

// ---- 2. Quantity-Tracked Inventory (Materials & Bulk Equipment) ----

// Scoped per (item, location, license) — the same item/location can
// legitimately appear more than once, one row per license holding stock
// there. Only a `purchase` movement can create a new row.
export interface InventoryBalance {
  id: string;
  inventoryId: string;
  itemId: string;
  item?: InventoryItem;
  licenseId: string;
  quantity: number;
  totalValue: string;
  averageUnitValue: string | null;
  marketValue?: string | null;
  totalMarketValue?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Row shape for GET /api/inventories|sites|warehouses/[id]/materials — and
// the "bulk" half of .../equipments. Pre-joined (itemName/itemSlug/unit
// already resolved), unlike a raw InventoryBalance row. Built on the same
// (item, location, license) scoped balances — itemId can repeat once per
// license holding stock at this location, so key rows by (itemId, licenseId).
export interface MaterialAtInventory {
  itemId: string;
  itemName: string;
  itemSlug: string;
  unit: string;
  licenseId: string;
  licenseName: string;
  quantity: number;
  totalValue: string;
  averageUnitValue: string | null;
  marketValue?: string | null;
  totalMarketValue?: string | null;
}

export type BulkEquipmentAtInventory = MaterialAtInventory;

export type QuantityMovementType = "purchase" | "sale" | "transfer" | "consume" | "loss";

export type SaleStatus = "unpaid" | "partially_paid" | "paid";

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
  note?: string | null;
  metadata: Record<string, unknown> | null;
  isApproved: boolean;
  isReversed: boolean;
  isReversal: boolean;
  reversalOfId: string | null;
  licenseId: string | null;
  transactionId: string | null;
  ledgerId: string | null;
  // null on a sale to a site: it has no per-sale payment, the site pays its
  // warehouse account in bulk instead.
  saleStatus?: SaleStatus | null;
  paidAmount?: string | null;
  // Sale to a site: the site is the buyer (treated as a third party — no
  // stock lands there). clientName holds a snapshot of the site's name.
  buyerSiteId?: string | null;
  isInternal?: boolean;
  // Manual "paid" label on a sale to a site. Tracking only — never changes a
  // balance, analytics or a guard.
  isMarkedPaid?: boolean;
  markedPaidAt?: string | null;
  markedPaidBy?: string | null;
  // Cost of the stock a sale removed. unitCost/totalCost stay as revenue.
  cogsUnitCost?: string | null;
  cogsTotalCost?: string | null;
  cogsEstimated?: boolean;
  // Sale: unitCost/totalCost stay net; the buyer owes grossTotal.
  // Purchase: the price is VAT-inclusive and unchanged; vatAmount is the VAT
  // contained in it, grossTotal is the price paid (net = grossTotal - vatAmount).
  // grossTotal is null until the backfill has run — no VAT recorded.
  vatExempt?: boolean;
  vatRate?: string | null;
  vatAmount?: string | null;
  grossTotal?: string | null;
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

export type InventoryMovementCreatePayload = {
  note?: string | null;
  movementDate?: string;
} & (
  | {
      movementType: "purchase";
      itemId?: string;
      quantity: number;
      destinationInventoryId: string;
      unitCost: string;
      clientName?: string;
      licenseId: string;
      autoCreateItem?: { name: string; slug?: string; category: "material"; unit?: string };
      // unitCost is VAT-inclusive (the invoice total). true = no VAT was charged.
      vatExempt?: boolean;
    }
  | {
      movementType: "sale";
      itemId: string;
      quantity: number;
      sourceInventoryId: string;
      unitCost: string;
      // clientName and buyerSiteId are mutually exclusive. buyerSiteId is
      // for materials sold to an active site.
      clientName?: string;
      buyerSiteId?: string;
      // Optional — auto-resolved when the source location holds the item
      // under one license. Only needed when more than one license's lot is
      // present there (pick the lot from GET /api/inventory-balances).
      licenseId?: string;
      // fullyPaid and paidAmount are gross (incl. VAT).
      fullyPaid?: boolean;
      paidAmount?: string;
      // Charge 0% VAT on this sale.
      vatExempt?: boolean;
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
  });

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
  // The license this unit was purchased/currently carried under — unlike
  // quantity-tracked balances there's no (item, location, license) lot
  // concept here (one physical unit, one id, never repeats per license).
  licenseId: string | null;
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
  saleStatus?: SaleStatus;
  paidAmount?: string;
  vatExempt?: boolean;
  vatRate?: string | null;
  vatAmount?: string | null;
  grossTotal?: string | null;
  note?: string | null;
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

export type EquipmentMovementCreatePayload = {
  note?: string | null;
  movementDate?: string;
} & (
  | {
    movementType: "purchase";
    individualItemId?: string;
    destinationInventoryId: string;
    movementCost?: string;
    clientName?: string;
    licenseId: string;
    autoCreateEquipment?: AutoCreateEquipmentPayload;
    // movementCost is VAT-inclusive. true = no VAT was charged.
    vatExempt?: boolean;
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
    // movementCost is net; fullyPaid and paidAmount are gross (incl. VAT).
    fullyPaid?: boolean;
    paidAmount?: string;
    vatExempt?: boolean;
  }
  | {
    movementType: "dispose";
    individualItemId: string;
  }
  | {
    movementType: "degrade";
    individualItemId: string;
    movementCost: string;
  });

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
    // Per-unit market price; null = not set.
    marketValue?: string | null;
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
  soldEquipmentCash?: string;
  soldEquipmentOutstanding?: string;
  soldMaterialCash?: string;
  soldMaterialOutstanding?: string;
  // The totals above are invoiced INCLUDING VAT (gross).
  soldEquipmentVat?: string;
  soldMaterialVat?: string;
  totalVat?: string;
  totalCashCollected?: string;
  totalOutstanding?: string;
  collectionRate?: string;
  // One account per site that bought from this warehouse (all-time; empty
  // under a saleStatus filter and for site managers).
  bySite?: AccountRow[];
  revenueVsCash?: {
    summary?: {
      totalRevenue: string;
      totalCashCollected: string;
      totalOutstanding: string;
      collectionRate: string;
      totalSaleCount: number;
    };
    byCategory?: {
      material?: {
        revenue: string;
        cashCollected: string;
        outstanding: string;
        collectionRate: string;
        saleCount: number;
      };
      equipment?: {
        revenue: string;
        cashCollected: string;
        outstanding: string;
        collectionRate: string;
        saleCount: number;
      };
    };
    byStatus?: {
      paid?: {
        count: number;
        revenue: string;
        cashCollected: string;
      };
      partiallyPaid?: {
        count: number;
        revenue: string;
        cashCollected: string;
        outstanding: string;
      };
      unpaid?: {
        count: number;
        revenue: string;
        outstanding: string;
      };
    };
  };
}

// A site's running account with one warehouse: outstanding = sold − paid,
// computed on read. Payments are not allocated to individual sales.
export interface AccountTotals {
  // Gross: what the account owes including VAT. soldNet + soldVat = sold.
  sold: string;
  soldNet?: string;
  soldVat?: string;
  paid: string;
  outstanding: string;
}

export interface AccountRow extends AccountTotals {
  // The other party: the warehouse on a site's payables, the site on a
  // warehouse's sold-items.
  id: string;
  name: string;
  saleCount: number;
  // Split of `sold` by the manual paid label — tracking only.
  markedPaidTotal: string;
  unmarkedTotal: string;
}

export interface SitePayables {
  siteId: string;
  summary: AccountTotals;
  byWarehouse: AccountRow[];
}

export interface SitePayment {
  id: string;
  siteId: string;
  warehouseId: string;
  siteName: string;
  warehouseName: string;
  amount: string;
  paymentDate: string;
  note: string | null;
  transactionId: string | null;
  loggedBy: string;
  isReversed: boolean;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalNote: string | null;
  createdAt: string;
}

export interface RegisterSitePaymentRequest {
  siteId: string;
  amount: string;
  paymentDate?: string;
  note?: string;
  categoryId?: string;
  // Sales to tick as paid in the same step; one bad id fails the whole call.
  markPaidMovementIds?: string[];
}

export interface RegisterSitePaymentResult {
  payment: SitePayment;
  markedPaid: { id: string; isMarkedPaid: boolean; markedPaidAt: string | null }[];
  balance: AccountTotals;
}

export interface RecordSalePaymentRequest {
  amount: string;
  paymentDate?: string;
  note?: string;
  categoryId?: string;
}

export interface ReverseSalePaymentRequest {
  note?: string;
}

// ---- 7. Financial Transactions & Ledger ----

export interface Transaction {
  id: string;
  // null on money received against a site account — not tied to a license.
  licenseId: string | null;
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
  note?: string | null;
  reversalOfId: string | null;
  isSystemGenerated: boolean;
  ledgerId: string | null;
  // Taxes contained in `amount` (the amount is the total paid/received).
  taxes?: TransactionTax[];
  loggedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TransactionTax {
  id: string;
  taxType: "vat" | "other";
  label: string;
  rate: string | null;
  amount: string;
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
  note?: string | null;
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
  // Resolved server-side so the list needs no user lookups.
  submittedByName?: string | null;
  approvedByName?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BulkApprovalResultRow {
  approvalId: string;
  ok: boolean;
  // Only on failures.
  code?: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "ERROR";
  error?: string;
}

// POST /api/approvals/bulk. In partial mode this is 200 even when some
// approvals fail — read `results`. In atomic mode any failure is an error
// response instead and nothing changes.
export interface BulkApprovalResult {
  decision: "approved" | "rejected";
  total: number;
  succeeded: number;
  failed: number;
  results: BulkApprovalResultRow[];
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

export interface SalesProfitability {
  saleCount: number;
  revenue: string;
  cogs: string;
  grossProfit: string;
  marginPct: string;
  cashCollected: string;
  actualProfit: string;
  unrealizedProfit: string;
  // Sales whose COGS was backfilled by replay (an estimate).
  estimatedCogsSaleCount: number;
  // Sales with no COGS snapshot — excluded from every figure above.
  missingCogsSaleCount: number;
}

// Sales to sites. Profit is accrual-based: payments are not tied to sales, so
// there is no per-sale "actual profit". cashReceived / outstandingBalance are
// null under a licenseId or saleStatus filter (account cash has no license or
// status).
export interface SiteSalesAnalytics {
  saleCount: number;
  // Net. cashReceived and outstandingBalance are gross (site payments include VAT).
  revenue: string;
  vat?: string;
  profitability: Omit<SalesProfitability, "cashCollected" | "actualProfit" | "unrealizedProfit">;
  cashReceived: string | null;
  outstandingBalance: string | null;
}

export interface SalesAnalytics {
  // External-buyer material sales only.
  profitability?: SalesProfitability;
  siteSales?: SiteSalesAnalytics;
  totalMaterialRevenue: string;
  totalEquipmentRevenue: string;
  // Net of VAT.
  totalRevenue: string;
  totalVat?: string;
  totalGrossRevenue?: string;
  // Cash, outstanding and collection rate are measured against gross.
  totalCashCollected?: string;
  totalOutstanding?: string;
  collectionRate?: string;
  materialSaleCount: number;
  equipmentSaleCount: number;
  revenueVsCash?: {
    summary: {
      totalRevenue: string;
      totalCashCollected: string;
      totalOutstanding: string;
      collectionRate: string;
      totalSaleCount: number;
    };
    byCategory: {
      material: {
        revenue: string;
        cashCollected: string;
        outstanding: string;
        collectionRate: string;
        saleCount: number;
      };
      equipment: {
        revenue: string;
        cashCollected: string;
        outstanding: string;
        collectionRate: string;
        saleCount: number;
        bulkEquipment?: {
          revenue: string;
          cashCollected: string;
          outstanding: string;
          saleCount: number;
        };
        individualEquipment?: {
          revenue: string;
          cashCollected: string;
          outstanding: string;
          saleCount: number;
        };
      };
    };
    byStatus: {
      paid: {
        count: number;
        revenue: string;
        cashCollected: string;
      };
      partiallyPaid: {
        count: number;
        revenue: string;
        cashCollected: string;
        outstanding: string;
      };
      unpaid: {
        count: number;
        revenue: string;
        outstanding: string;
      };
    };
  };
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
    materialSaleCash?: string;
    equipmentSaleCash?: string;
    totalSalesRevenue?: string;
    totalSalesCash?: string;
    outstandingSalesReceivables?: string;
    // VAT is a liability, not income: `total` and netIncome exclude it.
    // vatOutput = VAT charged on sales in the period; vatCollected = the VAT
    // part of what external buyers have paid so far.
    vatOutput?: string;
    vatCollected?: string;
    // Revenue from sales to sites, recognised at the sale (no transaction
    // exists then); already inside materialSaleRevenue and `total`.
    siteSaleRevenue?: string;
    other: string;
    total: string;
  };
  // Cash in − expense.
  netCashFlow: string;
  // income.total − expense.total: site sales counted when sold.
  netIncome?: string;
  vat?: { output: string; input: string; netPayable: string };
}

export interface VatCategoryTotals {
  saleCount: number;
  net: string;
  vat: string;
  gross: string;
}

// GET /api/analytics/vat (admin only).
export interface VatReport {
  outputVat: string;
  taxableNet: string;
  exemptNet: string;
  grossInvoiced: string;
  byCategory: {
    material: VatCategoryTotals;
    equipment: VatCategoryTotals;
    siteSales: VatCategoryTotals;
  };
  externalVatCollected: string;
  externalVatOutstanding: string;
  notBackfilledSaleCount: number;
  // Input VAT: VAT paid on purchases and in manual transactions (reclaimable).
  inputVat?: {
    materialPurchases: string;
    equipmentPurchases: string;
    transactions: string;
    total: string;
  };
  // outputVat - inputVat; negative = refundable / carried forward.
  netVatPayable?: string;
  notBackfilledPurchaseCount?: number;
}
