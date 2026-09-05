import { createSimpleCrudApi } from "./simple-crud"
import type { Tender } from "@/types/api"

export interface CreateTenderPayload {
    name: string
    licenseId: string
    location?: string
    estimatedBudget?: string
    submissionDate?: string
    status?: string
}

export type UpdateTenderPayload = Partial<CreateTenderPayload>

export const tendersApi = createSimpleCrudApi<Tender, CreateTenderPayload, UpdateTenderPayload>(
    "/api/tenders"
)