import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { SiteTask } from "@/types/api"

export function listTasks(params: TaskListParams = {}) {
    return apiClient.get<SiteTask[]>("/api/tasks", buildListParams(params))
}

export function getTask(id: string) {
    return apiClient.get<SiteTask>(`/api/tasks/${id}`)
}

export interface UpdateTaskPayload {
    title?: string
    targetDate?: string
    notes?: string
    review?: string
}

export function updateTask(id: string, payload: UpdateTaskPayload) {
    return apiClient.patch<SiteTask>(`/api/tasks/${id}`, payload)
}

export function deleteTask(id: string) {
    return apiClient.delete<void>(`/api/tasks/${id}`)
}

export type TaskListParams = ListParams<{
    siteId?: string[]
    status?: ("completed" | "pending")[]
    targetDateFrom?: string[]
    targetDateTo?: string[]
}>