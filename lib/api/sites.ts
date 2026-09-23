import { apiClient } from "./client";
import { buildListParams } from "./list-params";
import type { ListParams } from "./list-params";
import type { Site, SiteLifecycleLog, SiteSummary, SiteTask, MaterialAtInventory, BulkEquipmentAtInventory, IndividualEquipmentItem } from "@/types/api";

export interface CreateSitePayload {
  name: string;
  licenseId: string;
  slug?: string;
  location?: string;
  laborBudget?: string;
  materialBudget?: string;
  otherBudget?: string;
  tenderId?: string;
  managerId?: string;
}

export interface UpdateSitePayload {
  name?: string;
  status?: "active" | "closed";
  reason?: string;
  location?: string;
  laborBudget?: string;
  materialBudget?: string;
  otherBudget?: string;
  tenderId?: string;
  licenseId?: string;
  managerId?: string;
}

export type SiteListParams = ListParams<{ status?: string[]; licenseId?: string[] }>;
export type SiteLifecycleParams = ListParams<{ eventType?: string[] }>;

export function listSites(params: SiteListParams = {}) {
  return apiClient.get<Site[]>("/api/sites", buildListParams(params));
}

export function getSite(id: string) {
  return apiClient.get<Site>(`/api/sites/${id}`);
}

export function createSite(payload: CreateSitePayload) {
  return apiClient.post<Site>("/api/sites", payload);
}

export function updateSite(id: string, payload: UpdateSitePayload) {
  return apiClient.patch<Site>(`/api/sites/${id}`, payload);
}

export function deleteSite(id: string) {
  return apiClient.delete<void>(`/api/sites/${id}`);
}

export function restoreSite(id: string) {
  return apiClient.post<Site>(`/api/sites/${id}/restore`);
}

// ---- Summary / lifecycle ----

export function getSiteSummary(id: string) {
  return apiClient.get<SiteSummary>(`/api/sites/${id}/summary`);
}

export function getSiteLifecycle(id: string, params: SiteLifecycleParams = {}) {
  return apiClient.get<SiteLifecycleLog[]>(`/api/sites/${id}/lifecycle`, buildListParams(params));
}

// ---- Tasks (nested under a site — for site-scoped views) ----

export interface CreateSiteTaskPayload {
  title: string;
  targetDate?: string;
  notes?: string;
}

export interface UpdateSiteTaskPayload {
  title?: string;
  targetDate?: string;
  notes?: string;
  review?: string;
}

export function listSiteTasks(siteId: string, params: SiteTaskListParams = {}) {
  return apiClient.get<SiteTask[]>(`/api/sites/${siteId}/tasks`, buildListParams(params));
}

export function createSiteTask(siteId: string, payload: CreateSiteTaskPayload) {
  return apiClient.post<SiteTask>(`/api/sites/${siteId}/tasks`, payload);
}

export function updateSiteTask(siteId: string, taskId: string, payload: UpdateSiteTaskPayload) {
  return apiClient.patch<SiteTask>(`/api/sites/${siteId}/tasks/${taskId}`, payload);
}

export function deleteSiteTask(siteId: string, taskId: string) {
  return apiClient.delete<void>(`/api/sites/${siteId}/tasks/${taskId}`);
}

// claim takes {notes?} per the latest doc — was `None` before
export function claimSiteTask(siteId: string, taskId: string, payload: { notes?: string } = {}) {
  return apiClient.post<SiteTask>(`/api/sites/${siteId}/tasks/${taskId}/claim`, payload);
}

export function completeSiteTask(siteId: string, taskId: string, payload: { review?: string } = {}) {
  return apiClient.post<SiteTask>(`/api/sites/${siteId}/tasks/${taskId}/complete`, payload);
}

export type SiteTaskListParams = ListParams<{
  status?: ("completed" | "pending")[]; // anything else is silently ignored by the backend
  targetDateFrom?: string[];
  targetDateTo?: string[];
}>;

// ---- Inventory at this site (resolves the site's node internally; 404s if
// the site has none) — pre-joined, no separate node-id lookup needed. ----

export type MaterialsAtSiteParams = ListParams<{ includeZeroQuantity?: "true" }>;

export function getSiteMaterials(siteId: string, params: MaterialsAtSiteParams = {}) {
  return apiClient.get<MaterialAtInventory[]>(`/api/sites/${siteId}/materials`, buildListParams(params));
}

export function getSiteIndividualEquipment(siteId: string, params: MaterialsAtSiteParams = {}) {
  return apiClient.get<IndividualEquipmentItem[]>(`/api/sites/${siteId}/equipment`, buildListParams(params));
}

export function getSiteBulkEquipment(siteId: string, params: MaterialsAtSiteParams = {}) {
  return apiClient.get<BulkEquipmentAtInventory[]>(`/api/sites/${siteId}/bulk-equipment`, buildListParams(params));
}
