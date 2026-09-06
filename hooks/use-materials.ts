import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { materialsApi } from "@/lib/api/materials";
import { createSimpleCrudHooks } from "./use-simple-crud";

export const materialKeys = {
  all: ["materials"] as const,
  lists: () => [...materialKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...materialKeys.lists(), filters] as const,
  details: () => [...materialKeys.all, "detail"] as const,
  detail: (id: string) => [...materialKeys.details(), id] as const,
  subitems: (id: string) => [...materialKeys.detail(id), "subitems"] as const,
};

const baseHooks = createSimpleCrudHooks(materialsApi, materialKeys);

export const useMaterials = baseHooks.useList;
export const useMaterial = baseHooks.useDetail;
export const useCreateMaterial = baseHooks.useCreate;
export const useUpdateMaterial = baseHooks.useUpdate;
export const useDeleteMaterial = baseHooks.useDelete;
export const useRestoreMaterial = baseHooks.useRestore;

export function useMaterialSubitems(id: string) {
  return useQuery({
    queryKey: materialKeys.subitems(id),
    queryFn: () => materialsApi.getSubitems(id),
    enabled: !!id,
  });
}

export function useAddSubitem(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; quantity: number; unit?: string }) => 
      materialsApi.addSubitem(materialId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.subitems(materialId) });
      queryClient.invalidateQueries({ queryKey: materialKeys.detail(materialId) });
    },
  });
}

export function useUpdateSubitem(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, payload }: { subId: string; payload: { name?: string; quantity?: number; unit?: string } }) => 
      materialsApi.updateSubitem(materialId, subId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.subitems(materialId) });
      queryClient.invalidateQueries({ queryKey: materialKeys.detail(materialId) });
    },
  });
}

export function useDeleteSubitem(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) => materialsApi.deleteSubitem(materialId, subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.subitems(materialId) });
      queryClient.invalidateQueries({ queryKey: materialKeys.detail(materialId) });
    },
  });
}
