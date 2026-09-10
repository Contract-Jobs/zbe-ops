export interface MaterialCatalog {
  id: string;
  name: string;
  unit: string;
  type: "single" | "set";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  totalQuantity?: number;
  subitems?: MaterialSubitem[];
}

export interface MaterialSubitem {
  id: string;
  materialId: string;
  name: string;
  quantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MaterialLog {
  id: string
  catalogId: string
  logType: string
  quantity: number
  unitPrice: string
  fromSiteId: string | null
  fromWarehouseId: string | null
  toSiteId: string | null
  toWarehouseId: string | null
  licenseId: string | null
  transactionId: string | null
  categoryId: string | null
  buyerName: string | null
  notes: string | null
  isReversal: boolean
  reversalOfId: string | null
  approvalStatus: ApprovalStatus
  createdAt: string
}

export interface InventoryBalance {
  id: string;
  materialId: string;
  siteId?: string;
  warehouseId?: string;
  quantity: number;
}

export interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  siteId: string | null;
  warehouseId: string | null;
  licenseId: string | null;
  originalValue: string | null;
  value: string | null;
  rentRate: string | null;
  vendorName: string | null;
  currentStatus: string;
  ownershipStatus: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  logType: string;
  fromSiteId: string | null;
  fromWarehouseId: string | null;
  toSiteId: string | null;
  toWarehouseId: string | null;
  price: string | null;
  rentStartDate: string | null;
  rentReturnDate: string | null;
  buyerName: string | null;
  vendorName: string | null;
  notes: string | null;
  isReversal: boolean;
  reversalOfId: string | null;
  approvalStatus: ApprovalStatus;
  affectedFields: Record<string, unknown>;
  createdAt: string;
}

export interface RentalAgreement {
  id: string;
  equipmentId: string;
  type: "rent_in" | "rent_out";
  status: "active" | "completed" | "cancelled"
  siteId: string | null;
  licenseId: string | null;
  vendorName: string | null;
  buyerName: string | null;
  rentStartDate: string;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalEvent {
  id: string;
  agreementId: string;
  eventType: "initiation" | "rate_change" | "upfront_payment" | "penalty" | "settlement"
  eventDate: string;
  dailyRate: string | null;
  upfrontFee: string | null;
  adjustmentAmount: string | null;
  notes: string | null;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export interface Site {
  id: string;
  name: string;
  location: string | null;
  status: "active" | "closed" | string;
  laborBudget: string | null;
  materialBudget: string | null;
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
  event: string;
  description: string;
  affectedFields: Record<string, unknown>;
  loggedBy: string;
  timestamp: string;
}
export interface SiteTask {
  id: string;
  siteId: string;
  title: string;
  targetDate: string | null;
  notes: string | null;
  review: string | null;
  isCompleted: boolean;
  status: "pending" | "claimed" | "completed" | string; // verify exact values
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
    materialBudget: string;
    totalAllocated: string;
    spent: string;
    remaining: string;
  };
  inventory: {
    materialId: string;
    assetName: string;
    quantity: number;
    avgUnitPrice: string;
  }[];
  pendingApprovals: number;
  recentTasks: {
    id: string;
    title: string;
    isCompleted: boolean;
    notes: string;
    review: string;
  }[];
}

export interface Tender {
  id: string;
  name: string;
  licenseId: string;
  location: string | null;
  estimatedBudget: string | null;
  submissionDate: string | null;
  status: string;
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
  location: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Transaction {
  id: string;
  licenseId: string;
  siteId: string | null;
  warehouseId: string | null;
  equipmentId: string | null;
  categoryId: string | null;
  type: "money_in" | "money_out";
  amount: string;
  description: string | null;
  transactionDate: string;
  isReversal: boolean;
  reversalOfId: string | null;
  approvalStatus: ApprovalStatus;
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
  siteId: string | null;
  licenseId: string;
  sourceRefType: string;
  sourceRefId: string;
  amount: string;
  isReversal: boolean;
  reversalOfId: string | null;
  createdAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalType =
  | "material_movement"
  | "equipment_movement"
  | "transaction"
  | "progress_log"
  | "rental_event";

export type Role = "superadmin" | "admin" | "site_manager"

export interface Approval {
  id: string
  approvalType: ApprovalType
  recordId: string
  status: ApprovalStatus
  submittedBy: string
  approvedBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
  updatedAt: string
  banned: boolean
}

interface LocationRef {
  id: string;
  type: "site" | "warehouse";
}

export type MaterialLogAction =
  | {
    action: "purchase";
    materialId: string | "new";
    quantity: number;
    purchaseCost: string;
    destination?: LocationRef;
    categoryId?: string;
    licenseId?: string;
    notes?: string;
    newMaterial?: {
      name: string;
      unit?: string;
      type?: "single" | "set";
      subitems?: { name: string; quantity: number; unit?: string }[];
    };
  }
  | {
    action: "transfer";
    materialId: string;
    quantity: number;
    source?: LocationRef;
    destination?: LocationRef;
    notes?: string;
  }
  | {
    action: "sold";
    materialId: string;
    quantity: number;
    sellingPrice: string;
    source?: LocationRef;
    categoryId?: string;
    licenseId?: string;
    buyerName?: string;
    notes?: string;
  }
  | {
    action: "used_up";
    materialId: string;
    quantity: number;
    source?: LocationRef;
    notes?: string;
  }
  | {
    action: "missing";
    materialId: string;
    quantity: number;
    source?: LocationRef;
    notes?: string;
  };

export type EquipmentLogAction =
  | {
    action: "purchased";
    equipmentId: string | "new";
    purchaseCost: string;
    destination?: LocationRef;
    vendorName?: string;
    licenseId?: string;
    notes?: string;
    newEquipment?: {
      name: string;
      serialNumber?: string;
      originalValue?: string;
      vendorName?: string;
    };
  }
  | {
    action: "transferred";
    equipmentId: string;
    source?: LocationRef;
    destination?: LocationRef;
    notes?: string;
  }
  | {
    action: "sold";
    equipmentId: string;
    sellingPrice: string;
    source?: LocationRef;
    buyerName?: string;
    licenseId?: string;
    notes?: string;
  }
  | {
    action: "used_up";
    equipmentId: string;
    source?: LocationRef;
    notes?: string;
  }
  | {
    action: "missing";
    equipmentId: string;
    source?: LocationRef;
    notes?: string;
  }
  | {
    action: "maintenance_dispatch";
    equipmentId: string;
    source?: LocationRef;
    vendorName?: string;
    notes?: string;
  }
  | {
    action: "maintenance_return";
    equipmentId: string;
    destination?: LocationRef;
    repairCost?: string;
    notes?: string;
  }
  | {
    action: "degraded";
    equipmentId: string;
    valueAdjustment?: string;
    notes?: string;
  }
  | {
    action: "appreciated";
    equipmentId: string;
    valueAdjustment?: string;
    notes?: string;
  };

export interface RentalAdjustPayload {
  adjustmentAmount: string;
  notes?: string;
}

export interface RentalReturnPayload {
  rentReturnDate: string;
  notes?: string;
}

export type RentalCreatePayload =
  | {
    type: "rent_in"
    equipmentId: string | "new"
    dailyRate: string
    upfrontFee?: string
    rentStartDate: string
    expectedReturnDate?: string
    licenseId?: string
    notes?: string
    vendorName?: string
    toSiteId?: string
    toWarehouseId?: string
    newEquipment?: { name: string; serialNumber?: string; originalValue?: string; vendorName?: string }
  }
  | {
    type: "rent_out"
    equipmentId: string
    dailyRate: string
    upfrontFee?: string
    rentStartDate: string
    expectedReturnDate?: string
    licenseId?: string
    notes?: string
    buyerName?: string
    fromSiteId?: string
    fromWarehouseId?: string
  }

export interface RentalAdjustPayload {
  dailyRate?: string
  lumpSumFee?: string
  notes?: string
}

export interface RentalReturnPayload {
  actualReturnDate: string
  finalCostOverride?: string
  fromSiteId?: string
  fromWarehouseId?: string
  toSiteId?: string
  toWarehouseId?: string
  notes?: string
}
export interface CostBreakdown {
  siteId: string
  dateFrom?: string
  dateTo?: string
  totalSpend: string
  byCategory: {
    categoryId: string | null
    categoryName: string
    total: string
    count: number
  }[]
}

export interface SpendAnalytics {
  totalCashIn: string
  totalCashOut: string
  netCashExpenses: string
  materialAllocation: string
  equipmentAllocation: string
  assetAllocation: string
  totalCost: string
  byCategory: { categoryId: string | null; categoryName: string; total: string; count: number }[]
  bySite: {
    siteId: string
    siteName: string
    cashIn: string
    cashOut: string
    netCashExpenses: string
    assetAllocation: string
    totalCost: string
  }[]
}

export interface BudgetHealthEntry {
  siteId: string
  siteName: string
  budgetAllocated: string
  cashSpent: string
  assetAllocation: string
  totalSpent: string
  variance: string
  isOverBudget: boolean
}

export interface LicenseAnalytics {
  licenseId: string
  licenseName: string
  totalSpent: string
  totalReceived: string
  netCashFlow: string
}

export interface TaskSummaryRow {
  taskId: string
  name: string
  targetDate: string | null
  isCompleted: boolean
}

export interface LedgerCostRow {
  amount: string
  description: string | null
  timestamp: string
  sourceRefType: "transaction" | "material_log" | "equipment_log"
  isReversal: boolean
}

export interface BudgetOverview {
  siteId: string
  laborBudget: string | null
  materialBudget: string | null
  totalBudgeted: string
  totalSpent: string
  variance: string
  tasks: TaskSummaryRow[]
  costs: LedgerCostRow[]
}

export interface InventoryAnalytics {
  totalMaterials: number
  totalEquipment: number
  totalMaterialValue: string
  bySite: { siteId: string; siteName: string; materialCount: number; totalQuantity: number }[]
  byWarehouse: { warehouseId: string; warehouseName: string; materialCount: number; totalQuantity: number }[]
  movementVolume: { movementType: string; count: number; totalQuantity: number }[]
}