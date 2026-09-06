import { createSimpleCrudApi } from "./simple-crud";
import type { Equipment } from "@/types/api";

export interface CreateEquipmentPayload {
  name: string;
  serialNumber?: string;
  siteId?: string;
  warehouseId?: string;
  licenseId?: string;
  originalValue?: string;
  vendorName?: string;
}

export interface UpdateEquipmentPayload {
  name?: string;
  serialNumber?: string;
  licenseId?: string;
  vendorName?: string;
}

export const equipmentApi = createSimpleCrudApi<Equipment, CreateEquipmentPayload, UpdateEquipmentPayload>("/api/equipment");
