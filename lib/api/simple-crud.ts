import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Pagination } from "@/lib/api/client"

interface SoftDeletable {
    id: string
    deletedAt: string | null
}


export interface SimpleCrudApi<T, TCreate, TUpdate = Partial<TCreate>> {
    list: (params?: ListParams) => Promise<{ data: T[]; pagination?: Pagination }>
    get: (id: string) => Promise<{ data: T; pagination?: Pagination }>
    create: (payload: TCreate) => Promise<{ data: T; pagination?: Pagination }>
    update: (id: string, payload: TUpdate) => Promise<{ data: T; pagination?: Pagination }>
    delete: (id: string) => Promise<{ data: void }>
    restore: (id: string) => Promise<{ data: T }>
}

export function createSimpleCrudApi<T extends SoftDeletable, TCreate, TUpdate = Partial<TCreate>>(
    basePath: string
): SimpleCrudApi<T, TCreate, TUpdate> {
    return {
        list: (params = {}) => apiClient.get<T[]>(basePath, buildListParams(params)),
        get: (id) => apiClient.get<T>(`${basePath}/${id}`),
        create: (payload) => apiClient.post<T>(basePath, payload),
        update: (id, payload) => apiClient.patch<T>(`${basePath}/${id}`, payload),
        delete: (id) => apiClient.delete<void>(`${basePath}/${id}`),      // was {id, deletedAt: string}
        restore: (id) => apiClient.post<T>(`${basePath}/${id}/restore`),  // was {id, deletedAt: null} — now full entity
    }
}