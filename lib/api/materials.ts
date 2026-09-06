import { createSimpleCrudApi } from "./simple-crud";
import type { MaterialCatalog, MaterialSubitem } from "@/types/api";
import { apiClient } from "./client";

export interface CreateMaterialPayload {
  name: string;
  unit?: string;
  type?: "single" | "set";
  subitems?: { name: string; quantity: number; unit?: string }[];
}

export interface UpdateMaterialPayload extends Partial<CreateMaterialPayload> {}

export const materialsApi = {
  ...createSimpleCrudApi<MaterialCatalog, CreateMaterialPayload, UpdateMaterialPayload>("/api/materials"),
  getSubitems: (id: string) => 
    apiClient.get<{ data: MaterialSubitem[] }>(`/api/materials/${id}/sub-items`),
  addSubitem: (id: string, payload: { name: string; quantity: number; unit?: string }) => 
    apiClient.post<{ data: MaterialSubitem }>(`/api/materials/${id}/sub-items`, payload),
  updateSubitem: (id: string, subId: string, payload: { name?: string; quantity?: number; unit?: string }) => 
    apiClient.patch<{ data: MaterialSubitem }>(`/api/materials/${id}/sub-items/${subId}`, payload),
  deleteSubitem: (id: string, subId: string) => 
    apiClient.delete<{ data: { id: string; deletedAt: string } }>(`/api/materials/${id}/sub-items/${subId}`),
};
