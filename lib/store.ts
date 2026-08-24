"use client";

import { useSyncExternalStore } from "react";
import { nid } from "./id";
import * as seed from "./seed";
import type {
  Approval,
  ApprovalPayload,
  ApprovalType,
  Equipment,
  EquipmentLog,
  InventoryBalance,
  License,
  LocationKind,
  Material,
  MaterialLog,
  Session,
  Site,
  Task,
  Tender,
  Transaction,
  User,
  Warehouse,
} from "./types";

export type Store = {
  session: Session;
  users: User[];
  licenses: License[];
  warehouses: Warehouse[];
  sites: Site[];
  siteLifecycle: typeof seed.siteLifecycle;
  tasks: Task[];
  materials: Material[];
  subitems: typeof seed.subitems;
  balances: InventoryBalance[];
  materialLogs: MaterialLog[];
  equipment: Equipment[];
  equipmentLogs: EquipmentLog[];
  tenders: Tender[];
  categories: typeof seed.categories;
  transactions: Transaction[];
  approvals: Approval[];
};

function clone(): Store {
  return {
    session: { userId: "usr_abebe", licenseId: "all" },
    users: structuredClone(seed.users),
    licenses: structuredClone(seed.licenses),
    warehouses: structuredClone(seed.warehouses),
    sites: structuredClone(seed.sites),
    siteLifecycle: structuredClone(seed.siteLifecycle),
    tasks: structuredClone(seed.tasks),
    materials: structuredClone(seed.materials),
    subitems: structuredClone(seed.subitems),
    balances: structuredClone(seed.balances),
    materialLogs: structuredClone(seed.materialLogs),
    equipment: structuredClone(seed.equipment),
    equipmentLogs: structuredClone(seed.equipmentLogs),
    tenders: structuredClone(seed.tenders),
    categories: structuredClone(seed.categories),
    transactions: structuredClone(seed.transactions),
    approvals: structuredClone(seed.approvals),
  };
}

const KEY = "zbe-ops-store";

function load(): Store {
  if (typeof window === "undefined") return clone();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return clone();
    const parsed = JSON.parse(raw) as Store;
    if (!parsed.session || !Array.isArray(parsed.approvals)) return clone();
    return parsed;
  } catch {
    return clone();
  }
}

let state = clone();
const listeners = new Set<() => void>();

function emit() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  }
  listeners.forEach((fn) => fn());
}

export function hydrateStore() {
  const loaded = load();
  state = loaded;
  listeners.forEach((fn) => fn());
}

function set(patch: Partial<Store> | ((prev: Store) => Store)) {
  state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
  emit();
}

export function getStore(): Store {
  return state;
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore(): Store {
  return useSyncExternalStore(subscribe, getStore, getStore);
}

export function currentUser(store: Store = state): User {
  const user = store.users.find((u) => u.id === store.session.userId);
  if (!user) throw new Error("Signed-in user missing");
  return user;
}

export function isSiteManager(store: Store = state): boolean {
  return currentUser(store).role === "site_manager";
}

export function visibleSites(store: Store = state): Site[] {
  const user = currentUser(store);
  let list = store.sites.filter((s) => !s.deletedAt);
  if (user.role === "site_manager") {
    list = list.filter((s) => user.siteIds.includes(s.id));
  }
  if (store.session.licenseId !== "all") {
    list = list.filter((s) => s.licenseId === store.session.licenseId);
  }
  return list;
}

export function visibleSiteIds(store: Store = state): Set<string> {
  return new Set(visibleSites(store).map((s) => s.id));
}

export function switchUser(userId: string) {
  set({ session: { ...state.session, userId } });
}

export function switchLicense(licenseId: string | "all") {
  set({ session: { ...state.session, licenseId } });
}

export function locationName(kind: LocationKind | undefined, id: string | undefined, store: Store = state): string {
  if (!kind || !id) return "—";
  if (kind === "site") return store.sites.find((s) => s.id === id)?.name ?? id;
  return store.warehouses.find((w) => w.id === id)?.name ?? id;
}

export function materialName(id: string, store: Store = state): string {
  return store.materials.find((m) => m.id === id)?.name ?? id;
}

export function equipmentName(id: string, store: Store = state): string {
  return store.equipment.find((e) => e.id === id)?.name ?? id;
}

export function userName(id: string, store: Store = state): string {
  return store.users.find((u) => u.id === id)?.name ?? id;
}

function bumpBalance(
  balances: InventoryBalance[],
  catalogId: string,
  kind: LocationKind,
  locationId: string,
  delta: number
): InventoryBalance[] {
  const next = balances.map((b) => ({ ...b }));
  const hit = next.find(
    (b) => b.catalogId === catalogId && b.locationKind === kind && b.locationId === locationId
  );
  if (hit) {
    hit.quantity += delta;
    return next;
  }
  next.push({ catalogId, locationKind: kind, locationId, quantity: delta });
  return next;
}

function requireQty(balances: InventoryBalance[], catalogId: string, kind: LocationKind, locationId: string, qty: number) {
  const hit = balances.find(
    (b) => b.catalogId === catalogId && b.locationKind === kind && b.locationId === locationId
  );
  if (!hit || hit.quantity < qty) {
    throw new Error("Insufficient quantity at source");
  }
}

export function submitApproval(approvalType: ApprovalType, payload: ApprovalPayload, summary: string) {
  const user = currentUser();
  if (user.role === "site_manager" && payload.fromKind === "warehouse") {
    throw new Error("Site managers cannot withdraw from warehouses");
  }
  const approval: Approval = {
    id: nid("ap"),
    approvalType,
    status: "pending",
    payload,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    summary,
  };
  set({ approvals: [approval, ...state.approvals] });
  return approval;
}

export function rejectApproval(id: string) {
  const user = currentUser();
  set({
    approvals: state.approvals.map((a) =>
      a.id === id && a.status === "pending"
        ? { ...a, status: "rejected", decidedAt: new Date().toISOString(), decidedBy: user.id }
        : a
    ),
  });
}

export function approveApproval(id: string) {
  const approval = state.approvals.find((a) => a.id === id);
  if (!approval) throw new Error("Approval not found");
  if (approval.status !== "pending") throw new Error("Already decided");
  applyApproval(approval);
  const user = currentUser();
  set((prev) => ({
    ...prev,
    approvals: prev.approvals.map((a) =>
      a.id === id
        ? { ...a, status: "approved", decidedAt: new Date().toISOString(), decidedBy: user.id }
        : a
    ),
  }));
}

function applyApproval(approval: Approval) {
  const p = approval.payload;
  const now = new Date().toISOString();
  const actor = approval.createdBy;

  if (approval.approvalType.startsWith("material_")) {
    applyMaterial(approval.approvalType, p, now, actor);
    return;
  }
  applyEquipment(approval.approvalType, p, now, actor);
}

function applyMaterial(type: ApprovalType, p: ApprovalPayload, now: string, actor: string) {
  const materialId = p.materialId;
  if (!materialId) throw new Error("materialId required");
  const qty = p.quantity ?? 0;
  let balances = state.balances;
  const logs = [...state.materialLogs];
  const txs = [...state.transactions];
  const material = state.materials.find((m) => m.id === materialId);

  const log = (partial: Omit<MaterialLog, "id" | "createdAt" | "loggedBy" | "isReversal" | "materialId">): MaterialLog => ({
    id: nid("ml"),
    materialId,
    createdAt: now,
    loggedBy: actor,
    isReversal: false,
    ...partial,
  });

  if (type === "material_purchase") {
    if (!p.toKind || !p.toId) throw new Error("Destination required");
    balances = bumpBalance(balances, materialId, p.toKind, p.toId, qty);
    const ml = log({ logType: "purchase", quantity: qty, unitPrice: p.unitPrice, toKind: p.toKind, toId: p.toId });
    logs.unshift(ml);
    const amount = qty * (p.unitPrice ?? 0);
    if (amount > 0) {
      txs.unshift({
        id: nid("tx"),
        type: "money_out",
        amount,
        licenseId: destinationLicense(p.toKind, p.toId),
        siteId: p.toKind === "site" ? p.toId : undefined,
        categoryId: "cat_mat",
        transactionDate: now,
        createdAt: now,
        note: `Purchase ${material?.name ?? materialId}`,
        sourceRefType: "material",
        sourceRefId: ml.id,
        isReversal: false,
        loggedBy: actor,
      });
    }
  } else if (type === "material_transfer") {
    if (!p.fromKind || !p.fromId || !p.toKind || !p.toId) throw new Error("Source and destination required");
    requireQty(balances, materialId, p.fromKind, p.fromId, qty);
    balances = bumpBalance(balances, materialId, p.fromKind, p.fromId, -qty);
    balances = bumpBalance(balances, materialId, p.toKind, p.toId, qty);
    logs.unshift(log({ logType: "transfer", quantity: qty, fromKind: p.fromKind, fromId: p.fromId, toKind: p.toKind, toId: p.toId }));
  } else if (type === "material_sale") {
    if (!p.fromKind || !p.fromId) throw new Error("Warehouse source required");
    if (p.fromKind !== "warehouse") throw new Error("Only central warehouses can sell");
    requireQty(balances, materialId, p.fromKind, p.fromId, qty);
    balances = bumpBalance(balances, materialId, p.fromKind, p.fromId, -qty);
    const ml = log({ logType: "sale", quantity: qty, unitPrice: p.unitPrice, fromKind: p.fromKind, fromId: p.fromId, buyerName: p.buyerName });
    logs.unshift(ml);
    const amount = qty * (p.unitPrice ?? 0);
    if (amount > 0) {
      txs.unshift({
        id: nid("tx"),
        type: "money_in",
        amount,
        licenseId: "lic_elec",
        categoryId: "cat_rev",
        transactionDate: now,
        createdAt: now,
        note: `Sale ${material?.name ?? materialId} to ${p.buyerName ?? "buyer"}`,
        sourceRefType: "material",
        sourceRefId: ml.id,
        isReversal: false,
        loggedBy: actor,
      });
    }
  } else if (type === "material_consume" || type === "material_missing") {
    if (!p.fromKind || !p.fromId) throw new Error("Source required");
    requireQty(balances, materialId, p.fromKind, p.fromId, qty);
    balances = bumpBalance(balances, materialId, p.fromKind, p.fromId, -qty);
    logs.unshift(log({
      logType: type === "material_consume" ? "consume" : "missing",
      quantity: qty,
      fromKind: p.fromKind,
      fromId: p.fromId,
    }));
  }

  set({ balances, materialLogs: logs, transactions: txs });
}

function destinationLicense(kind: LocationKind, id: string): string {
  if (kind === "site") {
    return state.sites.find((s) => s.id === id)?.licenseId ?? "lic_elec";
  }
  return "lic_elec";
}

function applyEquipment(type: ApprovalType, p: ApprovalPayload, now: string, actor: string) {
  const equipmentId = p.equipmentId;
  if (!equipmentId) throw new Error("equipmentId required");
  const item = state.equipment.find((e) => e.id === equipmentId);
  if (!item) throw new Error("Equipment not found");
  const next: Equipment = { ...item };
  const logs = [...state.equipmentLogs];
  const txs = [...state.transactions];

  const pushLog = (logType: EquipmentLog["logType"]) => {
    logs.unshift({
      id: nid("el"),
      equipmentId,
      logType,
      price: p.price,
      fromKind: p.fromKind,
      fromId: p.fromId,
      toKind: p.toKind,
      toId: p.toId,
      buyerName: p.buyerName,
      vendorName: p.vendorName,
      rentStartDate: p.rentStartDate,
      rentReturnDate: p.rentReturnDate,
      createdAt: now,
      loggedBy: actor,
      isReversal: false,
    });
  };

  const park = (kind?: LocationKind, id?: string) => {
    next.siteId = kind === "site" ? id : undefined;
    next.warehouseId = kind === "warehouse" ? id : undefined;
  };

  switch (type) {
    case "equipment_purchase":
      next.value = p.price ?? next.value;
      next.status = "available";
      park(p.toKind, p.toId);
      pushLog("purchase");
      if (p.price) {
        txs.unshift({
          id: nid("tx"),
          type: "money_out",
          amount: p.price,
          licenseId: next.licenseId,
          categoryId: "cat_plant",
          equipmentId,
          transactionDate: now,
          createdAt: now,
          note: `Purchase ${next.name}`,
          sourceRefType: "equipment",
          isReversal: false,
          loggedBy: actor,
        });
      }
      break;
    case "equipment_transfer":
      park(p.toKind, p.toId);
      next.status = p.toKind === "site" ? "deployed" : "available";
      pushLog("transfer");
      break;
    case "equipment_rent_in":
      if (next.isOnLoan) throw new Error("Already on loan");
      next.isOnLoan = true;
      next.ownershipStatus = "rented_in";
      next.rentRate = p.price;
      next.status = "deployed";
      park(p.toKind ?? "site", p.toId);
      pushLog("rent_in");
      break;
    case "equipment_return_in": {
      const days = 30;
      const cost = (next.rentRate ?? p.price ?? 0) * days;
      next.isOnLoan = false;
      next.status = "returned";
      next.ownershipStatus = "owned";
      park(p.toKind ?? "warehouse", p.toId ?? "wh_bole");
      pushLog("return_in");
      if (cost > 0) {
        txs.unshift({
          id: nid("tx"),
          type: "money_out",
          amount: cost,
          licenseId: next.licenseId,
          siteId: item.siteId,
          categoryId: "cat_plant",
          equipmentId,
          transactionDate: now,
          createdAt: now,
          note: `Rental cost ${next.name}`,
          sourceRefType: "rental",
          isReversal: false,
          loggedBy: actor,
        });
      }
      break;
    }
    case "equipment_rent_out":
      if (next.isOnLoan) throw new Error("Already on loan");
      next.isOnLoan = true;
      next.ownershipStatus = "rented_out";
      next.rentRate = p.price;
      next.status = "deployed";
      next.siteId = undefined;
      next.warehouseId = undefined;
      pushLog("rent_out");
      break;
    case "equipment_return_out": {
      const revenue = (next.rentRate ?? p.price ?? 0) * 30;
      next.isOnLoan = false;
      next.ownershipStatus = "owned";
      next.status = p.toKind === "site" ? "deployed" : "available";
      park(p.toKind, p.toId);
      pushLog("return_out");
      if (revenue > 0) {
        txs.unshift({
          id: nid("tx"),
          type: "money_in",
          amount: revenue,
          licenseId: next.licenseId,
          categoryId: "cat_rev",
          equipmentId,
          transactionDate: now,
          createdAt: now,
          note: `Rental revenue ${next.name}`,
          sourceRefType: "rental",
          isReversal: false,
          loggedBy: actor,
        });
      }
      break;
    }
    case "equipment_sale":
      next.status = "sold";
      next.siteId = undefined;
      next.warehouseId = undefined;
      pushLog("sale");
      if (p.price) {
        txs.unshift({
          id: nid("tx"),
          type: "money_in",
          amount: p.price,
          licenseId: next.licenseId,
          categoryId: "cat_rev",
          equipmentId,
          transactionDate: now,
          createdAt: now,
          note: `Sale ${next.name} to ${p.buyerName ?? "buyer"}`,
          sourceRefType: "equipment",
          isReversal: false,
          loggedBy: actor,
        });
      }
      break;
    case "equipment_degrade":
      next.value = Math.max(0, next.value - (p.price ?? 0));
      pushLog("degrade");
      break;
    case "equipment_appreciate":
      next.value += p.price ?? 0;
      pushLog("appreciate");
      break;
    case "equipment_maintenance_dispatch":
      next.status = "maintenance";
      pushLog("maintenance_dispatch");
      break;
    case "equipment_maintenance_return":
      next.status = next.siteId ? "deployed" : "available";
      park(p.toKind, p.toId);
      pushLog("maintenance_return");
      if (p.price) {
        txs.unshift({
          id: nid("tx"),
          type: "money_out",
          amount: p.price,
          licenseId: next.licenseId,
          categoryId: "cat_plant",
          equipmentId,
          transactionDate: now,
          createdAt: now,
          note: `Maintenance ${next.name}`,
          sourceRefType: "maintenance",
          isReversal: false,
          loggedBy: actor,
        });
      }
      break;
    case "equipment_consume":
      next.status = "disposed";
      pushLog("consume");
      break;
    case "equipment_missing":
      next.status = "missing";
      pushLog("missing");
      break;
    default:
      break;
  }

  set({
    equipment: state.equipment.map((e) => (e.id === equipmentId ? next : e)),
    equipmentLogs: logs,
    transactions: txs,
  });
}

export function logManualTx(input: {
  type: Transaction["type"];
  amount: number;
  licenseId: string;
  siteId?: string;
  categoryId?: string;
  note: string;
}) {
  const user = currentUser();
  const now = new Date().toISOString();
  const tx: Transaction = {
    id: nid("tx"),
    type: input.type,
    amount: input.amount,
    licenseId: input.licenseId,
    siteId: input.siteId,
    categoryId: input.categoryId,
    transactionDate: now,
    createdAt: now,
    note: input.note,
    sourceRefType: "manual",
    isReversal: false,
    loggedBy: user.id,
  };
  set({ transactions: [tx, ...state.transactions] });
}

export function claimTask(taskId: string) {
  const user = currentUser();
  set({
    tasks: state.tasks.map((t) =>
      t.id === taskId && t.status === "open" ? { ...t, status: "claimed", claimedBy: user.id } : t
    ),
  });
}

export function completeTask(taskId: string, reviewNotes: string) {
  set({
    tasks: state.tasks.map((t) =>
      t.id === taskId && t.status === "claimed"
        ? { ...t, status: "completed", reviewNotes }
        : t
    ),
  });
}

export function addTask(siteId: string, title: string, targetDate?: string) {
  const task: Task = {
    id: nid("tsk"),
    siteId,
    title,
    targetDate,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  set({ tasks: [task, ...state.tasks] });
}

export function siteSpend(siteId: string, store: Store = state) {
  const txs = store.transactions.filter((t) => t.siteId === siteId && !t.isReversal);
  const out = txs.filter((t) => t.type === "money_out").reduce((s, t) => s + t.amount, 0);
  const inn = txs.filter((t) => t.type === "money_in").reduce((s, t) => s + t.amount, 0);
  const labor = txs.filter((t) => t.type === "money_out" && t.categoryId === "cat_labor").reduce((s, t) => s + t.amount, 0);
  const material = txs.filter((t) => t.type === "money_out" && t.categoryId === "cat_mat").reduce((s, t) => s + t.amount, 0);
  return { out, inn, labor, material };
}

export function resetStore() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(KEY);
  }
  state = clone();
  emit();
}
