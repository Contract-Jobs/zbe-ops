// lib/api/licenses.ts

import { createSimpleCrudApi } from "./simple-crud"
import type { License } from "@/types/api"

export interface CreateLicensePayload {
    name: string
}

export type UpdateLicensePayload = Partial<CreateLicensePayload>

export const licensesApi = createSimpleCrudApi<License, CreateLicensePayload, UpdateLicensePayload>(
    "/api/licenses"
)