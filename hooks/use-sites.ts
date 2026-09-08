import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as sitesApi from "@/lib/api/sites"
import type {
    SiteListParams,
    SiteLifecycleParams,
    SiteTaskListParams,
    CreateSitePayload,
    UpdateSitePayload,
    CreateSiteTaskPayload,
    UpdateSiteTaskPayload,
} from "@/lib/api/sites"
import { queryKeys } from "@/lib/query/keys"
import { onActionSettled } from "@/lib/query/approval-invalidation"

export function useSites(params: SiteListParams = {}) {
    return useQuery({
        queryKey: queryKeys.sites.list(params),
        queryFn: () => sitesApi.listSites(params),
    })
}

export function useSite(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.sites.detail(id ?? ""),
        queryFn: () => sitesApi.getSite(id as string),
        enabled: !!id,
    })
}

export function useCreateSite() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: CreateSitePayload) => sitesApi.createSite(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sites.lists() }),
    })
}

export function useUpdateSite() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateSitePayload }) =>
            sitesApi.updateSite(id, payload),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(variables.id) })
        },
    })
}

export function useDeleteSite() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => sitesApi.deleteSite(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(id) })
        },
    })
}

export function useRestoreSite() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => sitesApi.restoreSite(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(id) })
        },
    })
}

export function useSiteSummary(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.sites.summary(id ?? ""),
        queryFn: () => sitesApi.getSiteSummary(id as string),
        enabled: !!id,
    })
}

export function useSiteLifecycle(id: string | undefined, params: SiteLifecycleParams = {}) {
    return useQuery({
        queryKey: queryKeys.sites.lifecycle(id ?? "", params),
        queryFn: () => sitesApi.getSiteLifecycle(id as string, params),
        enabled: !!id,
    })
}

export function useSiteTasks(siteId: string | undefined, params: SiteTaskListParams = {}) {
    return useQuery({
        queryKey: queryKeys.sites.tasks(siteId ?? "", params),
        queryFn: () => sitesApi.listSiteTasks(siteId as string, params),
        enabled: !!siteId,
    })
}

export function useCreateSiteTask(siteId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: CreateSiteTaskPayload) => sitesApi.createSiteTask(siteId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.tasks(siteId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.summary(siteId) })
        },
    })
}

export function useUpdateSiteTask(siteId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateSiteTaskPayload }) =>
            sitesApi.updateSiteTask(siteId, taskId, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sites.tasks(siteId) }),
    })
}

export function useDeleteSiteTask(siteId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (taskId: string) => sitesApi.deleteSiteTask(siteId, taskId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.tasks(siteId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.summary(siteId) })
        },
    })
}

// Claim is approval-gated (progress_log) — goes through onActionSettled
// like Materials/Equipment actions, since the response is the SiteTask
// itself with siteId directly on it, no lookup needed.
export function useClaimSiteTask(siteId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ taskId, notes }: { taskId: string; notes?: string }) =>
            sitesApi.claimSiteTask(siteId, taskId, { notes }),
        onSuccess: ({ data: task }) => {
            onActionSettled(queryClient, "progress_log", task.id, task.isCompleted ? "approved" : "pending", task.siteId)
        },
    })
}

// Complete is a direct Admin action, not approval-gated — no
// onActionSettled needed, just refresh this site's tasks/summary.
export function useCompleteSiteTask(siteId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ taskId, review }: { taskId: string; review?: string }) =>
            sitesApi.completeSiteTask(siteId, taskId, { review }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.tasks(siteId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.summary(siteId) })
        },
    })
}