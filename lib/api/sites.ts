import { createSimpleCrudApi } from "./simple-crud";
import type { Site, SiteLifecycleLog, SiteTask, SiteSummary } from "@/types/api";
import { apiClient } from "./client";
import { buildListParams, type ListParams } from "./list-params";
import type { Pagination } from "./client";

export interface CreateSitePayload {
  name: string;
  licenseId: string;
  location?: string;
  laborBudget?: string;
  materialBudget?: string;
  tenderId?: string;
  managerId?: string;
}

export interface UpdateSitePayload extends Partial<CreateSitePayload> {
  status?: "active" | "closed";
  reason?: string;
}

export const sitesApi = {
  ...createSimpleCrudApi<Site, CreateSitePayload, UpdateSitePayload>("/api/sites"),
  getSummary: (id: string) => apiClient.get<{ data: SiteSummary }>(`/api/sites/${id}/summary`),
  getLifecycle: (id: string, params: ListParams = {}) => 
    apiClient.get<{ data: SiteLifecycleLog[], pagination?: Pagination }>(`/api/sites/${id}/lifecycle`, buildListParams(params)),
  getTasks: (id: string, params: ListParams = {}) => 
    apiClient.get<{ data: SiteTask[], pagination?: Pagination }>(`/api/sites/${id}/tasks`, buildListParams(params)),
  createTask: (id: string, payload: { title: string; targetDate?: string; notes?: string }) => 
    apiClient.post<{ data: SiteTask }>(`/api/sites/${id}/tasks`, payload),
  updateTask: (id: string, taskId: string, payload: { title?: string; targetDate?: string; notes?: string; review?: string }) => 
    apiClient.patch<{ data: SiteTask }>(`/api/sites/${id}/tasks/${taskId}`, payload),
  deleteTask: (id: string, taskId: string) => 
    apiClient.delete<{ data: { id: string; deletedAt: string } }>(`/api/sites/${id}/tasks/${taskId}`),
  claimTask: (id: string, taskId: string) => 
    apiClient.post<{ data: SiteTask }>(`/api/sites/${id}/tasks/${taskId}/claim`),
  completeTask: (id: string, taskId: string, payload: { review?: string }) => 
    apiClient.post<{ data: SiteTask }>(`/api/sites/${id}/tasks/${taskId}/complete`, payload),
};
