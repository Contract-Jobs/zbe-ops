
// // Generates the six API functions shared identically by Tenders, Licenses,
// // Warehouses, and Categories — plain CRUD + soft delete + restore, no
// // approval workflow, no action verbs.

// import { apiClient } from "./client"
// import { buildListParams } from "./list-params"
// import type { ListParams } from "./list-params"

// interface SoftDeletable {
//     id: string
//     deletedAt: string | null
// }

// export function createSimpleCrudApi<T extends SoftDeletable, TCreate, TUpdate = Partial<TCreate>>(
//     basePath: string
// ) {
//     return {
//         list: (params: ListParams = {}) => apiClient.get<T[]>(basePath, buildListParams(params)),
//         get: (id: string) => apiClient.get<T>(`${basePath}/${id}`),
//         create: (payload: TCreate) => apiClient.post<T>(basePath, payload),
//         update: (id: string, payload: TUpdate) => apiClient.patch<T>(`${basePath}/${id}`, payload),
//         delete: (id: string) => apiClient.delete<{ id: string; deletedAt: string }>(`${basePath}/${id}`),
//         restore: (id: string) => apiClient.post<{ id: string; deletedAt: null }>(`${basePath}/${id}/restore`),
//     }
// }

// export type SimpleCrudApi<T, TCreate, TUpdate> = ReturnType<typeof createSimpleCrudApi<T, TCreate, TUpdate>>
// lib/api/simple-crud.ts

import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Pagination } from "@/lib/api/client" // or types/api.ts, wherever you settled it

interface SoftDeletable {
    id: string
    deletedAt: string | null
}

// Now a plain interface — not derived from ReturnType<>. This is what lets
// TS infer T/TCreate/TUpdate correctly when this type shows up as a
// parameter type in createSimpleCrudHooks.
export interface SimpleCrudApi<T, TCreate, TUpdate = Partial<TCreate>> {
    list: (params?: ListParams) => Promise<{ data: T[]; pagination?: Pagination }>
    get: (id: string) => Promise<{ data: T; pagination?: Pagination }>
    create: (payload: TCreate) => Promise<{ data: T; pagination?: Pagination }>
    update: (id: string, payload: TUpdate) => Promise<{ data: T; pagination?: Pagination }>
    delete: (id: string) => Promise<{ data: { id: string; deletedAt: string }; pagination?: Pagination }>
    restore: (id: string) => Promise<{ data: { id: string; deletedAt: null }; pagination?: Pagination }>
}

export function createSimpleCrudApi<T extends SoftDeletable, TCreate, TUpdate = Partial<TCreate>>(
    basePath: string
): SimpleCrudApi<T, TCreate, TUpdate> {
    return {
        list: (params = {}) => apiClient.get<T[]>(basePath, buildListParams(params)),
        get: (id) => apiClient.get<T>(`${basePath}/${id}`),
        create: (payload) => apiClient.post<T>(basePath, payload),
        update: (id, payload) => apiClient.patch<T>(`${basePath}/${id}`, payload),
        delete: (id) => apiClient.delete<{ id: string; deletedAt: string }>(`${basePath}/${id}`),
        restore: (id) => apiClient.post<{ id: string; deletedAt: null }>(`${basePath}/${id}/restore`),
    }
}