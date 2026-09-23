import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Inventory, MaterialAtInventory, BulkEquipmentAtInventory, IndividualEquipmentItem } from "@/types/api"

// A site's/warehouse's own `id` is NOT its inventory node id — every
// movement/balance call needs the node id, resolved here first. See
// docs/migration.md §2.3 and docs/api-v2-migration-plan.md §5.
export type InventoryNodeListParams = ListParams<{
    inventoryType?: "site" | "warehouse"
    siteId?: string
    warehouseId?: string
}>

export function listInventoryNodes(params: InventoryNodeListParams = {}) {
    return apiClient.get<Inventory[]>("/api/inventories", buildListParams(params))
}

// Single node lookup by its own id — joined with site/warehouse and the
// same item counts the list rows carry. 404s if the node doesn't exist.
export function getInventoryNode(id: string) {
    return apiClient.get<Inventory>(`/api/inventories/${id}`)
}

export type MaterialsAtLocationParams = ListParams<{ includeZeroQuantity?: "true" }>

// Pre-joined materials sitting at one inventory node — no separate
// itemId→name lookup needed, unlike raw /api/inventory-balances rows.
export function getInventoryMaterials(nodeId: string, params: MaterialsAtLocationParams = {}) {
    return apiClient.get<MaterialAtInventory[]>(`/api/inventories/${nodeId}/materials`, buildListParams(params))
}

// Individually-tracked and bulk (quantity-tracked) equipment at one node
// each paginate independently now — the old combined /equipments endpoint
// shared one page/limit across both sub-lists, so neither could be paged
// on its own.
export function getInventoryIndividualEquipment(nodeId: string, params: MaterialsAtLocationParams = {}) {
    return apiClient.get<IndividualEquipmentItem[]>(`/api/inventories/${nodeId}/equipment`, buildListParams(params))
}

export function getInventoryBulkEquipment(nodeId: string, params: MaterialsAtLocationParams = {}) {
    return apiClient.get<BulkEquipmentAtInventory[]>(`/api/inventories/${nodeId}/bulk-equipment`, buildListParams(params))
}
