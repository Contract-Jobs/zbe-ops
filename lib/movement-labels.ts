import type { QuantityMovementType, EquipmentMovementType } from "@/types/api";

// movementType values are internal wire names — never rendered raw. Shared
// across the movement forms and the balance-history panel so the same
// wire value always reads the same way everywhere.
export const QUANTITY_MOVEMENT_LABELS: Record<QuantityMovementType, string> = {
  purchase: "Purchase",
  transfer: "Transfer",
  sale: "Sell",
  consume: "Consume",
  loss: "Report loss",
};

export const EQUIPMENT_MOVEMENT_LABELS: Record<EquipmentMovementType, string> = {
  purchase: "Purchase",
  sale: "Sell",
  dispose: "Dispose",
  deploy_to_site: "Deploy to site",
  return_to_warehouse: "Return to warehouse",
  transfer_between_sites: "Send to other site",
  transfer_between_warehouses: "Send to other warehouse",
  rent_to_client: "Rent out",
  return_from_client: "Return from rental",
  rent_from_client: "Rent in",
  return_to_client: "Return to vendor",
  send_to_maintenance: "Send to maintenance",
  return_from_maintenance: "Return from maintenance",
  degrade: "Write down value",
};
