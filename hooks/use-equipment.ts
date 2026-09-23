import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as equipmentApi from "@/lib/api/equipment";
import type { EquipmentListParams, UpdateEquipmentPayload } from "@/lib/api/equipment";
import { queryKeys } from "@/lib/query/keys";

// No useCreateEquipment — POST /api/equipment is disabled server-side in v2.
// Equipment can only originate from usePurchaseEquipment (below) or a
// rental's equipmentId: "new" (hooks/use-rentals.ts).

export function useEquipmentList(params: EquipmentListParams = {}) {
  return useQuery({
    queryKey: queryKeys.equipment.list(params),
    queryFn: () => equipmentApi.listEquipment(params),
  });
}

export function useEquipment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.equipment.detail(id ?? ""),
    queryFn: () => equipmentApi.getEquipment(id as string),
    enabled: !!id,
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEquipmentPayload }) =>
      equipmentApi.updateEquipment(id, payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.detail(variables.id) });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentApi.deleteEquipment(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.detail(id) });
    },
  });
}

export function useRestoreEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentApi.restoreEquipment(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.detail(id) });
    },
  });
}

export function useEquipmentTrace(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.equipment.trace(id ?? ""),
    queryFn: () => equipmentApi.traceEquipment(id as string),
    enabled: !!id,
  });
}

export function useVerifyEquipmentState(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.equipment.verify(id ?? ""),
    queryFn: () => equipmentApi.verifyEquipmentState(id as string),
    enabled: !!id,
  });
}

// Superadmin/admin recovery tool — recomputes every equipment's projected
// state from its movement ledger from scratch.
export function useRebuildEquipmentStates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => equipmentApi.rebuildEquipmentStates(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
  });
}
