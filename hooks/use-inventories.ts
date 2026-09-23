import { useQuery } from "@tanstack/react-query";
import * as inventoriesApi from "@/lib/api/inventories";
import type { InventoryNodeListParams, MaterialsAtLocationParams } from "@/lib/api/inventories";
import { queryKeys } from "@/lib/query/keys";

export function useInventoryNodes(params: InventoryNodeListParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventories.list(params),
    queryFn: () => inventoriesApi.listInventoryNodes(params),
  });
}

// Single node by its own id — joined with site/warehouse + item counts.
// Use this instead of listing nodes and filtering client-side whenever the
// id at hand is already a node id.
export function useInventoryNode(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventories.detail(id ?? ""),
    queryFn: () => inventoriesApi.getInventoryNode(id as string),
    enabled: !!id,
  });
}

// Resolves a site or warehouse's own id to its inventory node id — every
// movement/balance call needs the node id, not the site's/warehouse's id
// (docs/migration.md §2.3). Returns undefined while loading or if the kind
// isn't picked yet.
export function useInventoryNodeId(kind: "site" | "warehouse" | "", refId: string | undefined) {
  const enabled = !!kind && !!refId;
  const params: InventoryNodeListParams =
    kind === "site" ? { siteId: refId } : kind === "warehouse" ? { warehouseId: refId } : {};
  const query = useQuery({
    queryKey: queryKeys.inventories.list(params),
    queryFn: () => inventoriesApi.listInventoryNodes(params),
    enabled,
  });
  return { nodeId: query.data?.data?.[0]?.id, isLoading: enabled && query.isLoading };
}

// Pre-joined materials/equipment sitting at one inventory node — prefer
// these over resolving a node id and filtering the generic balances/
// equipment lists, wherever the id at hand is already a node id.
export function useInventoryMaterials(nodeId: string | undefined, params: MaterialsAtLocationParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventories.materials(nodeId ?? "", params),
    queryFn: () => inventoriesApi.getInventoryMaterials(nodeId as string, params),
    enabled: !!nodeId,
  });
}

// Individually-tracked and bulk equipment paginate independently now — two
// calls instead of one combined response.
export function useInventoryIndividualEquipment(nodeId: string | undefined, params: MaterialsAtLocationParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventories.equipment(nodeId ?? "", params),
    queryFn: () => inventoriesApi.getInventoryIndividualEquipment(nodeId as string, params),
    enabled: !!nodeId,
  });
}

export function useInventoryBulkEquipment(nodeId: string | undefined, params: MaterialsAtLocationParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventories.bulkEquipment(nodeId ?? "", params),
    queryFn: () => inventoriesApi.getInventoryBulkEquipment(nodeId as string, params),
    enabled: !!nodeId,
  });
}

// The reverse direction — a lookup table from inventory node id to a
// display label, for rendering `currentInventoryId`/`sourceInventoryId`/
// `destinationInventoryId` fields that come back from movement/equipment
// records without a joined name. Node count is small (one per site/
// warehouse), so a single high-limit list covers it.
export function useInventoryNodeMap() {
  const query = useInventoryNodes({ limit: 50 });
  const byId = new Map<string, { kind: "site" | "warehouse"; name: string }>();
  for (const node of query.data?.data ?? []) {
    const name = node.site?.name ?? node.warehouse?.name ?? "Unknown";
    byId.set(node.id, { kind: node.inventoryType, name });
  }
  return { byId, isLoading: query.isLoading };
}
