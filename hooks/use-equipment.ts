import { createSimpleCrudHooks } from "./use-simple-crud";
import { equipmentApi } from "@/lib/api/equipment";

export const equipmentKeys = {
  all: ["equipment"] as const,
  lists: () => [...equipmentKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...equipmentKeys.lists(), filters] as const,
  details: () => [...equipmentKeys.all, "detail"] as const,
  detail: (id: string) => [...equipmentKeys.details(), id] as const,
};

const baseHooks = createSimpleCrudHooks(equipmentApi, equipmentKeys);

export const useEquipmentList = baseHooks.useList;
export const useEquipment = baseHooks.useDetail;
export const useCreateEquipment = baseHooks.useCreate;
export const useUpdateEquipment = baseHooks.useUpdate;
export const useDeleteEquipment = baseHooks.useDelete;
export const useRestoreEquipment = baseHooks.useRestore;
