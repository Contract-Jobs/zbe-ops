import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { sitesApi } from "@/lib/api/sites";
import { createSimpleCrudHooks } from "./use-simple-crud";

export const siteKeys = {
  all: ["sites"] as const,
  lists: () => [...siteKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...siteKeys.lists(), filters] as const,
  details: () => [...siteKeys.all, "detail"] as const,
  detail: (id: string) => [...siteKeys.details(), id] as const,
  summaries: () => [...siteKeys.all, "summary"] as const,
  summary: (id: string) => [...siteKeys.summaries(), id] as const,
};

const baseHooks = createSimpleCrudHooks(sitesApi, siteKeys);

export const useSites = baseHooks.useList;
export const useSite = baseHooks.useDetail;
export const useCreateSite = baseHooks.useCreate;
export const useUpdateSite = baseHooks.useUpdate;
export const useDeleteSite = baseHooks.useDelete;
export const useRestoreSite = baseHooks.useRestore;

export function useSiteSummary(id: string) {
  return useQuery({
    queryKey: siteKeys.summary(id),
    queryFn: () => sitesApi.getSummary(id),
    enabled: !!id,
  });
}
