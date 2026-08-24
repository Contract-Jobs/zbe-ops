export type Role = "operations" | "site_manager";

export type License = {
  id: string;
  name: string;
  createdAt: string;
  deletedAt?: string;
};

export type Warehouse = {
  id: string;
  name: string;
  location: string;
  createdAt: string;
  deletedAt?: string;
};

export type SiteStatus = "active" | "on_hold" | "closed";

export type Site = {
  id: string;
  name: string;
  licenseId: string;
  status: SiteStatus;
  laborBudget: number;
  materialBudget: number;
  address: string;
  managerUserId: string;
  createdAt: string;
  deletedAt?: string;
};

export type SiteLifecycleLog = {
  id: string;
  siteId: string;
  note: string;
  createdAt: string;
  loggedBy: string;
};

export type TaskStatus = "open" | "claimed" | "completed";

export type Task = {
  id: string;
  siteId: string;
  title: string;
  body?: string;
  targetDate?: string;
  status: TaskStatus;
  claimedBy?: string;
  reviewNotes?: string;
  createdAt: string;
};

export type MaterialType = "single" | "set";

export type MaterialSubitem = {
  id: string;
  materialId: string;
  name: string;
  quantity: number;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  type: MaterialType;
  categoryId?: string;
  createdAt: string;
  deletedAt?: string;
};

export type LocationKind = "site" | "warehouse";

export type InventoryBalance = {
  catalogId: string;
  locationKind: LocationKind;
  locationId: string;
  quantity: number;
};

export type MaterialLogType =
  | "purchase"
  | "transfer"
  | "sale"
  | "consume"
  | "missing"
  | "reversal";

export type MaterialLog = {
  id: string;
  materialId: string;
  logType: MaterialLogType;
  quantity: number;
  unitPrice?: number;
  fromKind?: LocationKind;
  fromId?: string;
  toKind?: LocationKind;
  toId?: string;
  buyerName?: string;
  createdAt: string;
  loggedBy: string;
  isReversal: boolean;
  reversesId?: string;
};

export type EquipmentStatus =
  | "available"
  | "deployed"
  | "maintenance"
  | "missing"
  | "sold"
  | "disposed"
  | "returned";

export type OwnershipStatus = "owned" | "rented_in" | "rented_out";

export type Equipment = {
  id: string;
  name: string;
  serialNumber?: string;
  siteId?: string;
  warehouseId?: string;
  licenseId: string;
  status: EquipmentStatus;
  ownershipStatus: OwnershipStatus;
  value: number;
  rentRate?: number;
  isOnLoan: boolean;
  createdAt: string;
  deletedAt?: string;
};

export type EquipmentLogType =
  | "purchase"
  | "transfer"
  | "rent_in"
  | "return_in"
  | "rent_out"
  | "return_out"
  | "sale"
  | "degrade"
  | "appreciate"
  | "maintenance_dispatch"
  | "maintenance_return"
  | "consume"
  | "missing"
  | "reversal";

export type EquipmentLog = {
  id: string;
  equipmentId: string;
  logType: EquipmentLogType;
  price?: number;
  fromKind?: LocationKind;
  fromId?: string;
  toKind?: LocationKind;
  toId?: string;
  buyerName?: string;
  vendorName?: string;
  rentStartDate?: string;
  rentReturnDate?: string;
  createdAt: string;
  loggedBy: string;
  isReversal: boolean;
};

export type TenderStatus = "draft" | "submitted" | "won" | "lost";

export type Tender = {
  id: string;
  name: string;
  licenseId: string;
  status: TenderStatus;
  submissionDate?: string;
  value?: number;
  createdAt: string;
  deletedAt?: string;
};

export type TxType = "money_in" | "money_out";

export type TxCategory = {
  id: string;
  name: string;
  createdAt: string;
};

export type SourceRefType =
  | "manual"
  | "material"
  | "equipment"
  | "rental"
  | "maintenance";

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  licenseId: string;
  siteId?: string;
  categoryId?: string;
  equipmentId?: string;
  transactionDate: string;
  createdAt: string;
  note: string;
  sourceRefType: SourceRefType;
  sourceRefId?: string;
  isReversal: boolean;
  loggedBy: string;
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalType =
  | "material_purchase"
  | "material_transfer"
  | "material_sale"
  | "material_consume"
  | "material_missing"
  | "material_reverse"
  | "equipment_purchase"
  | "equipment_transfer"
  | "equipment_rent_in"
  | "equipment_return_in"
  | "equipment_rent_out"
  | "equipment_return_out"
  | "equipment_sale"
  | "equipment_degrade"
  | "equipment_appreciate"
  | "equipment_maintenance_dispatch"
  | "equipment_maintenance_return"
  | "equipment_consume"
  | "equipment_missing"
  | "equipment_reverse";

export type ApprovalPayload = {
  materialId?: string;
  equipmentId?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  fromKind?: LocationKind;
  fromId?: string;
  toKind?: LocationKind;
  toId?: string;
  buyerName?: string;
  vendorName?: string;
  rentStartDate?: string;
  rentReturnDate?: string;
  logId?: string;
  note?: string;
};

export type Approval = {
  id: string;
  approvalType: ApprovalType;
  status: ApprovalStatus;
  payload: ApprovalPayload;
  createdAt: string;
  createdBy: string;
  decidedAt?: string;
  decidedBy?: string;
  summary: string;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  siteIds: string[];
};

export type Session = {
  userId: string;
  licenseId: string | "all";
};

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};
