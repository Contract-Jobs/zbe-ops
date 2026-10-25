import { useMemo } from "react";
import { useInventoriesInBulk } from "@/hooks/use-inventories";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";

interface Moved {
  sourceInventoryId: string | null;
  destinationInventoryId: string | null;
}

// Reversing (or taking payment on) a movement is allowed only when it
// originated at one of the user's own sites: its source inventory, or, with no
// source (a purchase, a return), its destination. A warehouse sale never
// qualifies. Admins are not restricted. Returns a check to call per movement.
export function useOriginCheck(movements: Moved[]): (m: Moved) => boolean {
  const store = useStore();
  const manager = isSiteManager(store);
  const mine = visibleSiteIds(store);

  const nodeIds = useMemo(() => {
    if (!manager) return [];
    const ids = new Set<string>();
    for (const m of movements) {
      const origin = m.sourceInventoryId ?? m.destinationInventoryId;
      if (origin) ids.add(origin);
    }
    return Array.from(ids);
  }, [manager, movements]);

  const { data } = useInventoriesInBulk(nodeIds);
  const siteByNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of data?.data ?? []) {
      if (node.inventoryType === "site" && node.site?.id) map.set(node.id, node.site.id);
    }
    return map;
  }, [data]);

  return (m) => {
    if (!manager) return true;
    const origin = m.sourceInventoryId ?? m.destinationInventoryId;
    const siteId = origin ? siteByNode.get(origin) : undefined;
    return !!siteId && mine.has(siteId);
  };
}
