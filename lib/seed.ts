import type {
  Approval,
  Equipment,
  EquipmentLog,
  InventoryBalance,
  License,
  Material,
  MaterialLog,
  MaterialSubitem,
  Site,
  SiteLifecycleLog,
  Task,
  Tender,
  Transaction,
  TxCategory,
  User,
  Warehouse,
} from "./types";

const t = (iso: string) => iso;

export const users: User[] = [
  { id: "usr_abebe", name: "Abebe Tadesse", role: "operations", siteIds: [] },
  { id: "usr_hana", name: "Hana Bekele", role: "site_manager", siteIds: ["site_westin"] },
  { id: "usr_dawit", name: "Dawit Mekonnen", role: "site_manager", siteIds: ["site_ebc"] },
];

export const licenses: License[] = [
  { id: "lic_elec", name: "Electrical contracting", createdAt: t("2021-03-12T08:00:00Z") },
  { id: "lic_ict", name: "ICT infrastructure", createdAt: t("2022-07-01T08:00:00Z") },
];

export const warehouses: Warehouse[] = [
  { id: "wh_bole", name: "Bole central yard", location: "Bole Sub City, Addis Ababa", createdAt: t("2021-03-12T08:00:00Z") },
  { id: "wh_kaliti", name: "Kaliti store", location: "Nifas Silk-Lafto, Addis Ababa", createdAt: t("2023-01-18T08:00:00Z") },
];

export const sites: Site[] = [
  {
    id: "site_westin",
    name: "Westin Addis Ababa",
    licenseId: "lic_elec",
    status: "active",
    laborBudget: 4200000,
    materialBudget: 9100000,
    address: "Kazanchis, Addis Ababa",
    managerUserId: "usr_hana",
    createdAt: t("2025-11-02T08:00:00Z"),
  },
  {
    id: "site_ebc",
    name: "EBC studio block",
    licenseId: "lic_ict",
    status: "active",
    laborBudget: 1800000,
    materialBudget: 3400000,
    address: "Mexico Square, Addis Ababa",
    managerUserId: "usr_dawit",
    createdAt: t("2026-02-14T08:00:00Z"),
  },
  {
    id: "site_factory",
    name: "East Industrial Park — line 4",
    licenseId: "lic_elec",
    status: "on_hold",
    laborBudget: 2600000,
    materialBudget: 5700000,
    address: "Dukem, Oromia",
    managerUserId: "usr_abebe",
    createdAt: t("2025-08-20T08:00:00Z"),
  },
];

export const siteLifecycle: SiteLifecycleLog[] = [
  { id: "lc1", siteId: "site_westin", note: "Site opened. Mobilisation complete.", createdAt: t("2025-11-02T08:00:00Z"), loggedBy: "usr_abebe" },
  { id: "lc2", siteId: "site_westin", note: "Material budget raised after guest-floor addendum.", createdAt: t("2026-04-11T08:00:00Z"), loggedBy: "usr_abebe" },
  { id: "lc3", siteId: "site_factory", note: "Paused pending client power availability.", createdAt: t("2026-06-01T08:00:00Z"), loggedBy: "usr_abebe" },
];

export const tasks: Task[] = [
  { id: "tsk_1", siteId: "site_westin", title: "Pull 4th-floor lighting trunks", body: "Guest rooms 401–428.", targetDate: t("2026-08-28T00:00:00Z"), status: "open", createdAt: t("2026-08-10T08:00:00Z") },
  { id: "tsk_2", siteId: "site_westin", title: "Panel P-L2 termination", targetDate: t("2026-08-22T00:00:00Z"), status: "claimed", claimedBy: "usr_hana", createdAt: t("2026-08-08T08:00:00Z") },
  { id: "tsk_3", siteId: "site_westin", title: "Main incomer IR test", targetDate: t("2026-08-15T00:00:00Z"), status: "completed", claimedBy: "usr_hana", reviewNotes: "Readings filed. Passed.", createdAt: t("2026-08-01T08:00:00Z") },
  { id: "tsk_4", siteId: "site_ebc", title: "Rack grounding grid", targetDate: t("2026-09-02T00:00:00Z"), status: "open", createdAt: t("2026-08-18T08:00:00Z") },
];

export const materials: Material[] = [
  { id: "mat_nyy", name: "NYY 4×25 mm² cable", unit: "m", type: "single", categoryId: "cat_cable", createdAt: t("2024-01-10T08:00:00Z") },
  { id: "mat_mcb", name: "MCB 32A 1P", unit: "pcs", type: "single", categoryId: "cat_switch", createdAt: t("2024-01-10T08:00:00Z") },
  { id: "mat_din", name: "DIN rail 35 mm", unit: "m", type: "single", categoryId: "cat_panel", createdAt: t("2024-01-10T08:00:00Z") },
  { id: "mat_pvc", name: "PVC conduit 25 mm", unit: "m", type: "single", categoryId: "cat_contain", createdAt: t("2024-02-02T08:00:00Z") },
  { id: "mat_board", name: "Floor DB set — 12 way", unit: "set", type: "set", categoryId: "cat_panel", createdAt: t("2024-05-16T08:00:00Z") },
  { id: "mat_cat6", name: "Cat6 UTP drum", unit: "m", type: "single", categoryId: "cat_ict", createdAt: t("2024-09-01T08:00:00Z") },
];

export const subitems: MaterialSubitem[] = [
  { id: "sub_1", materialId: "mat_board", name: "12-way enclosure", quantity: 1 },
  { id: "sub_2", materialId: "mat_board", name: "MCB 32A 1P", quantity: 10 },
  { id: "sub_3", materialId: "mat_board", name: "Main switch 63A", quantity: 1 },
  { id: "sub_4", materialId: "mat_board", name: "DIN rail 35 mm", quantity: 2 },
];

export const balances: InventoryBalance[] = [
  { catalogId: "mat_nyy", locationKind: "warehouse", locationId: "wh_bole", quantity: 1800 },
  { catalogId: "mat_nyy", locationKind: "site", locationId: "site_westin", quantity: 420 },
  { catalogId: "mat_mcb", locationKind: "warehouse", locationId: "wh_bole", quantity: 640 },
  { catalogId: "mat_mcb", locationKind: "site", locationId: "site_westin", quantity: 86 },
  { catalogId: "mat_din", locationKind: "warehouse", locationId: "wh_bole", quantity: 210 },
  { catalogId: "mat_pvc", locationKind: "warehouse", locationId: "wh_kaliti", quantity: 900 },
  { catalogId: "mat_pvc", locationKind: "site", locationId: "site_westin", quantity: 140 },
  { catalogId: "mat_board", locationKind: "warehouse", locationId: "wh_bole", quantity: 12 },
  { catalogId: "mat_board", locationKind: "site", locationId: "site_westin", quantity: 4 },
  { catalogId: "mat_cat6", locationKind: "warehouse", locationId: "wh_bole", quantity: 2500 },
  { catalogId: "mat_cat6", locationKind: "site", locationId: "site_ebc", quantity: 600 },
];

export const materialLogs: MaterialLog[] = [
  { id: "ml_1", materialId: "mat_nyy", logType: "purchase", quantity: 2000, unitPrice: 185, toKind: "warehouse", toId: "wh_bole", createdAt: t("2026-03-04T08:00:00Z"), loggedBy: "usr_abebe", isReversal: false },
  { id: "ml_2", materialId: "mat_nyy", logType: "transfer", quantity: 420, fromKind: "warehouse", fromId: "wh_bole", toKind: "site", toId: "site_westin", createdAt: t("2026-06-12T08:00:00Z"), loggedBy: "usr_abebe", isReversal: false },
  { id: "ml_3", materialId: "mat_mcb", logType: "consume", quantity: 14, fromKind: "site", fromId: "site_westin", createdAt: t("2026-08-09T08:00:00Z"), loggedBy: "usr_hana", isReversal: false },
];

export const equipment: Equipment[] = [
  { id: "eq_gen", name: "Perkins 45 kVA generator", serialNumber: "PK-45-8841", warehouseId: "wh_bole", licenseId: "lic_elec", status: "available", ownershipStatus: "owned", value: 980000, isOnLoan: false, createdAt: t("2023-04-01T08:00:00Z") },
  { id: "eq_lift", name: "Scissor lift 8 m", serialNumber: "SL-08-221", siteId: "site_westin", licenseId: "lic_elec", status: "deployed", ownershipStatus: "rented_in", value: 0, rentRate: 4500, isOnLoan: true, createdAt: t("2026-07-01T08:00:00Z") },
  { id: "eq_tracer", name: "Cable tracer kit", serialNumber: "CT-19-04", siteId: "site_ebc", licenseId: "lic_ict", status: "deployed", ownershipStatus: "owned", value: 42000, isOnLoan: false, createdAt: t("2024-11-20T08:00:00Z") },
  { id: "eq_drill", name: "Hilti TE 70", serialNumber: "HT-70-1190", warehouseId: "wh_kaliti", licenseId: "lic_elec", status: "maintenance", ownershipStatus: "owned", value: 86000, isOnLoan: false, createdAt: t("2022-09-14T08:00:00Z") },
  { id: "eq_megger", name: "Insulation tester 1 kV", serialNumber: "MG-1K-77", siteId: "site_westin", licenseId: "lic_elec", status: "deployed", ownershipStatus: "owned", value: 31000, isOnLoan: false, createdAt: t("2025-01-09T08:00:00Z") },
];

export const equipmentLogs: EquipmentLog[] = [
  { id: "el_1", equipmentId: "eq_lift", logType: "rent_in", price: 4500, toKind: "site", toId: "site_westin", vendorName: "LiftHire Addis", rentStartDate: t("2026-07-01T08:00:00Z"), createdAt: t("2026-07-01T08:00:00Z"), loggedBy: "usr_abebe", isReversal: false },
  { id: "el_2", equipmentId: "eq_drill", logType: "maintenance_dispatch", fromKind: "warehouse", fromId: "wh_kaliti", createdAt: t("2026-08-18T08:00:00Z"), loggedBy: "usr_abebe", isReversal: false },
];

export const tenders: Tender[] = [
  { id: "tn_1", name: "Sheraton ballroom electrical rehab", licenseId: "lic_elec", status: "submitted", submissionDate: t("2026-08-30T00:00:00Z"), value: 12800000, createdAt: t("2026-07-22T08:00:00Z") },
  { id: "tn_2", name: "National Bank ICT backbone", licenseId: "lic_ict", status: "draft", value: 6400000, createdAt: t("2026-08-12T08:00:00Z") },
  { id: "tn_3", name: "Hawassa industrial feeder", licenseId: "lic_elec", status: "lost", submissionDate: t("2026-03-01T00:00:00Z"), value: 21000000, createdAt: t("2026-01-15T08:00:00Z") },
];

export const categories: TxCategory[] = [
  { id: "cat_labor", name: "Labor", createdAt: t("2021-03-12T08:00:00Z") },
  { id: "cat_mat", name: "Materials", createdAt: t("2021-03-12T08:00:00Z") },
  { id: "cat_plant", name: "Plant & equipment", createdAt: t("2021-03-12T08:00:00Z") },
  { id: "cat_mob", name: "Mobilisation", createdAt: t("2021-03-12T08:00:00Z") },
  { id: "cat_rev", name: "Client receipts", createdAt: t("2021-03-12T08:00:00Z") },
];

export const transactions: Transaction[] = [
  { id: "tx_1", type: "money_in", amount: 3500000, licenseId: "lic_elec", siteId: "site_westin", categoryId: "cat_rev", transactionDate: t("2026-05-02T00:00:00Z"), createdAt: t("2026-05-02T00:00:00Z"), note: "Westin mobilisation certificate 1", sourceRefType: "manual", isReversal: false, loggedBy: "usr_abebe" },
  { id: "tx_2", type: "money_out", amount: 370000, licenseId: "lic_elec", categoryId: "cat_mat", transactionDate: t("2026-03-04T00:00:00Z"), createdAt: t("2026-03-04T00:00:00Z"), note: "NYY 4×25 purchase → Bole yard", sourceRefType: "material", sourceRefId: "ml_1", isReversal: false, loggedBy: "usr_abebe" },
  { id: "tx_3", type: "money_out", amount: 186000, licenseId: "lic_elec", siteId: "site_westin", categoryId: "cat_labor", transactionDate: t("2026-08-01T00:00:00Z"), createdAt: t("2026-08-01T00:00:00Z"), note: "July site wages", sourceRefType: "manual", isReversal: false, loggedBy: "usr_hana" },
  { id: "tx_4", type: "money_out", amount: 135000, licenseId: "lic_elec", siteId: "site_westin", categoryId: "cat_plant", transactionDate: t("2026-08-01T00:00:00Z"), createdAt: t("2026-08-01T00:00:00Z"), note: "Scissor lift July hire", sourceRefType: "rental", sourceRefId: "el_1", equipmentId: "eq_lift", isReversal: false, loggedBy: "usr_abebe" },
  { id: "tx_5", type: "money_out", amount: 94000, licenseId: "lic_ict", siteId: "site_ebc", categoryId: "cat_labor", transactionDate: t("2026-08-01T00:00:00Z"), createdAt: t("2026-08-01T00:00:00Z"), note: "EBC crew July", sourceRefType: "manual", isReversal: false, loggedBy: "usr_dawit" },
];

export const approvals: Approval[] = [
  {
    id: "ap_1",
    approvalType: "material_transfer",
    status: "pending",
    payload: { materialId: "mat_mcb", quantity: 40, fromKind: "warehouse", fromId: "wh_bole", toKind: "site", toId: "site_westin", note: "4th floor DBs" },
    createdAt: t("2026-08-23T09:12:00Z"),
    createdBy: "usr_hana",
    summary: "Transfer 40 pcs MCB 32A 1P · Bole central yard → Westin Addis Ababa",
  },
  {
    id: "ap_2",
    approvalType: "material_purchase",
    status: "pending",
    payload: { materialId: "mat_cat6", quantity: 1000, unitPrice: 28, toKind: "warehouse", toId: "wh_bole" },
    createdAt: t("2026-08-22T14:40:00Z"),
    createdBy: "usr_abebe",
    summary: "Purchase 1000 m Cat6 UTP drum @ ETB 28 → Bole central yard",
  },
  {
    id: "ap_3",
    approvalType: "equipment_maintenance_return",
    status: "pending",
    payload: { equipmentId: "eq_drill", price: 6400, toKind: "warehouse", toId: "wh_kaliti" },
    createdAt: t("2026-08-21T11:02:00Z"),
    createdBy: "usr_abebe",
    summary: "Return Hilti TE 70 from maintenance · repair ETB 6,400 → Kaliti store",
  },
  {
    id: "ap_4",
    approvalType: "material_consume",
    status: "approved",
    payload: { materialId: "mat_mcb", quantity: 14, fromKind: "site", fromId: "site_westin" },
    createdAt: t("2026-08-09T08:00:00Z"),
    createdBy: "usr_hana",
    decidedAt: t("2026-08-09T10:00:00Z"),
    decidedBy: "usr_abebe",
    summary: "Consume 14 pcs MCB 32A 1P on Westin Addis Ababa",
  },
];
