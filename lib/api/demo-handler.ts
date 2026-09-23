import { getStore, updateStore } from "../store";
import { nid } from "../id";

export async function demoHandler(method: string, path: string, body?: any): Promise<any> {
  const store = getStore();
  const now = new Date().toISOString();

  const respond = (data: any = { success: true }) => ({ data });

  // --- MATERIALS ---
  if (path === "/api/materials" && method === "POST") {
    const material = {
      id: nid("mat"),
      createdAt: now,
      ...body,
    };
    updateStore((prev) => ({ ...prev, materials: [...prev.materials, material] }));
    return respond(material);
  }
  if (path.match(/^\/api\/materials\/([^/]+)$/) && method === "PATCH") {
    const id = path.split("/")[3];
    let updated: any;
    updateStore((prev) => {
      const materials = prev.materials.map((m) => {
        if (m.id === id) {
          updated = { ...m, ...body, updatedAt: now };
          return updated;
        }
        return m;
      });
      return { ...prev, materials };
    });
    return respond(updated);
  }
  if (path.match(/^\/api\/materials\/([^/]+)$/) && method === "DELETE") {
    const id = path.split("/")[3];
    updateStore((prev) => ({
      ...prev,
      materials: prev.materials.map((m) => (m.id === id ? { ...m, deletedAt: now } : m)),
    }));
    return respond();
  }

  if (path.match(/^\/api\/rentals\/([^/]+)$/) && method === "GET") {
    const id = path.split("/")[3];
    const rental = getStore().rentals.find((r) => r.id === id);
    if (!rental) return respond({ error: { code: "NOT_FOUND", message: "Rental not found" } });
    return respond(rental);
  }

  if (path.match(/^\/api\/rentals\/([^/]+)\/events/) && method === "GET") {
    const id = path.split("/")[3];
    const url = new URL(`http://localhost${path}`);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const allEvents = getStore().rentalEvents.filter((e) => e.agreementId === id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const start = (page - 1) * limit;
    const paginated = allEvents.slice(start, start + limit);
    return respond({
      data: paginated,
      pagination: { total: allEvents.length, page, limit, totalPages: Math.ceil(allEvents.length / limit) }
    });
  }

  // --- INVENTORY LOGS (Movements) ---
  if (path === "/api/inventory/logs" && method === "POST") {
    const log = {
      id: nid("ml"),
      createdAt: now,
      ...body,
    };
    // We also need to update the balances!
    // To be thorough we should probably update the store balances, but for a simple demo
    // fallback, just creating the log and letting the UI refresh might be enough... wait,
    // UI uses local store balances. So we need to update them.
    updateStore((prev) => {
      let balances = [...prev.balances];
      const qty = Number(body.quantity || 0);

      if (body.fromSiteId || body.fromWarehouseId) {
        const kind = body.fromSiteId ? "site" : "warehouse";
        const id = body.fromSiteId || body.fromWarehouseId;
        const hit = balances.find(
          (b) => b.materialId === body.materialId && b.locationKind === kind && b.locationId === id,
        );
        if (hit) hit.quantity -= qty;
      }
      if (body.toSiteId || body.toWarehouseId) {
        const kind = body.toSiteId ? "site" : "warehouse";
        const id = body.toSiteId || body.toWarehouseId;
        const hit = balances.find(
          (b) => b.materialId === body.materialId && b.locationKind === kind && b.locationId === id,
        );
        if (hit) {
          hit.quantity += qty;
        } else {
          balances.push({
            materialId: body.materialId,
            locationKind: kind,
            locationId: id,
            quantity: qty,
          });
        }
      }
      return { ...prev, balances, materialLogs: [log, ...prev.materialLogs] };
    });
    return respond(log);
  }

  // --- SITES ---
  if (path === "/api/sites" && method === "POST") {
    const site = {
      id: nid("sit"),
      createdAt: now,
      status: "active",
      ...body,
    };
    updateStore((prev) => ({ ...prev, sites: [...prev.sites, site] }));
    return respond(site);
  }
  if (path.match(/^\/api\/sites\/([^/]+)$/) && method === "PATCH") {
    const id = path.split("/")[3];
    let updated: any;
    updateStore((prev) => ({
      ...prev,
      sites: prev.sites.map((s) => {
        if (s.id === id) {
          updated = { ...s, ...body, updatedAt: now };
          return updated;
        }
        return s;
      }),
    }));
    return respond(updated);
  }

  // --- SITE TASKS ---
  if (path.match(/^\/api\/sites\/([^/]+)\/tasks$/) && method === "POST") {
    const siteId = path.split("/")[3];
    const task = {
      id: nid("tsk"),
      siteId,
      createdAt: now,
      status: "open",
      ...body,
    };
    updateStore((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
    return respond(task);
  }
  if (path.match(/^\/api\/sites\/([^/]+)\/tasks\/([^/]+)$/) && method === "PATCH") {
    const taskId = path.split("/")[5];
    let updated: any;
    updateStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id === taskId) {
          updated = { ...t, ...body, updatedAt: now };
          return updated;
        }
        return t;
      }),
    }));
    return respond(updated);
  }
  if (path.match(/^\/api\/sites\/([^/]+)\/tasks\/([^/]+)$/) && method === "DELETE") {
    const taskId = path.split("/")[5];
    updateStore((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    return respond();
  }
  if (path.match(/^\/api\/sites\/([^/]+)\/tasks\/([^/]+)\/claim$/) && method === "POST") {
    const taskId = path.split("/")[5];
    updateStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: "claimed" } : t)),
    }));
    const task = getStore().tasks.find((t) => t.id === taskId);
    return respond(task);
  }
  if (path.match(/^\/api\/sites\/([^/]+)\/tasks\/([^/]+)\/complete$/) && method === "POST") {
    const taskId = path.split("/")[5];
    updateStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: "completed", reviewNotes: body?.review } : t)),
    }));
    return respond();
  }

  // --- EQUIPMENT ---
  if (path === "/api/equipment" && method === "POST") {
    const equipment = {
      id: nid("eq"),
      createdAt: now,
      status: "available",
      ...body,
    };
    updateStore((prev) => ({ ...prev, equipment: [...prev.equipment, equipment] }));
    return respond(equipment);
  }
  if (path.match(/^\/api\/equipment\/([^/]+)$/) && method === "PATCH") {
    const id = path.split("/")[3];
    let updated: any;
    updateStore((prev) => ({
      ...prev,
      equipment: prev.equipment.map((e) => {
        if (e.id === id) {
          updated = { ...e, ...body, updatedAt: now };
          return updated;
        }
        return e;
      }),
    }));
    return respond(updated);
  }

  // --- WAREHOUSES ---
  if (path === "/api/warehouses" && method === "POST") {
    const warehouse = {
      id: nid("wh"),
      createdAt: now,
      ...body,
    };
    updateStore((prev) => ({ ...prev, warehouses: [...prev.warehouses, warehouse] }));
    return respond(warehouse);
  }

  // --- TRANSACTIONS ---
  if (path === "/api/transactions" && method === "POST") {
    const tx = {
      id: nid("tx"),
      createdAt: now,
      ...body,
    };
    updateStore((prev) => ({ ...prev, transactions: [tx, ...prev.transactions] }));
    return respond(tx);
  }

  // --- RENTALS ---
  if (path === "/api/rentals" && method === "POST") {
    const isRentIn = body.type === "rent_in";
    let eqId = body.equipmentId;
    
    // Auto-create equipment if requested
    if (eqId === "new" && body.newEquipment) {
      const eq = {
        id: nid("eq"),
        createdAt: now,
        status: "available", // will be changed by rent
        ...body.newEquipment
      };
      updateStore(prev => ({ ...prev, equipment: [...prev.equipment, eq] }));
      eqId = eq.id;
    }

    const agreement = {
      id: nid("ra"),
      equipmentId: eqId,
      type: body.type as any,
      status: "active" as any,
      siteId: isRentIn ? (body.siteId || null) : null,
      warehouseId: isRentIn ? (body.warehouseId || null) : null,
      returnSiteId: null,
      returnWarehouseId: null,
      licenseId: body.licenseId || null,
      vendorName: body.vendorName || null,
      buyerName: body.buyerName || null,
      rentStartDate: body.rentStartDate,
      expectedReturnDate: body.expectedReturnDate,
      actualReturnDate: null,
      createdAt: now,
      updatedAt: now,
    };

    const event = {
      id: nid("re"),
      agreementId: agreement.id,
      eventType: "initiation" as any,
      timestamp: now,
      dailyRate: body.dailyRate != null ? String(body.dailyRate) : null,
      lumpSumAmount: body.upfrontFee != null ? String(body.upfrontFee) : null,
      notes: body.notes || null,
      transactionId: nid("tx"),
      equipmentMovementId: null,
      loggedBy: getStore().session.userId,
      createdAt: now,
      updatedAt: now,
    };
    
    const approval = {
      id: nid("ap"),
      approvalType: "rental_event" as any,
      status: "approved" as any,
      payload: { agreementId: agreement.id, eventId: event.id } as any,
      createdAt: now,
      createdBy: getStore().session.userId,
      summary: `Create rental ${body.type} for equipment ${eqId}`,
    };

    updateStore((prev) => ({
      ...prev,
      rentals: [agreement, ...prev.rentals],
      rentalEvents: [event, ...prev.rentalEvents],
      approvals: [approval, ...prev.approvals],
    }));

    // For a real implementation, applying the rental to equipment/transactions would happen here.
    return respond({ agreement, event, approval });
  }

  if (path.match(/^\/api\/rentals\/([^/]+)\/adjust$/) && method === "POST") {
    const agreementId = path.split("/")[3];
    const event = {
      id: nid("re"),
      agreementId,
      eventType: "rate_change" as any,
      timestamp: now,
      dailyRate: body.dailyRate != null ? String(body.dailyRate) : null,
      lumpSumAmount: body.lumpSumFee != null ? String(body.lumpSumFee) : null,
      notes: body.notes || null,
      transactionId: nid("tx"),
      equipmentMovementId: null,
      loggedBy: getStore().session.userId,
      createdAt: now,
      updatedAt: now,
    };
    const approval = {
      id: nid("ap"),
      approvalType: "rental_event" as any,
      status: "approved" as any,
      payload: { agreementId, eventId: event.id } as any,
      createdAt: now,
      createdBy: getStore().session.userId,
      summary: `Adjust rental ${agreementId}`,
    };

    updateStore((prev) => ({
      ...prev,
      rentalEvents: [event, ...prev.rentalEvents],
      approvals: [approval, ...prev.approvals],
    }));
    return respond({ event, approval });
  }

  if (path.match(/^\/api\/rentals\/([^/]+)\/return$/) && method === "POST") {
    const agreementId = path.split("/")[3];
    const event = {
      id: nid("re"),
      agreementId,
      eventType: "settlement" as any,
      timestamp: now,
      dailyRate: null,
      lumpSumAmount: body.finalCostOverride != null ? String(body.finalCostOverride) : null,
      notes: body.notes || null,
      transactionId: nid("tx"),
      equipmentMovementId: null,
      loggedBy: getStore().session.userId,
      createdAt: now,
      updatedAt: now,
    };
    const approval = {
      id: nid("ap"),
      approvalType: "rental_event" as any,
      status: "approved" as any,
      payload: { agreementId, eventId: event.id } as any,
      createdAt: now,
      createdBy: getStore().session.userId,
      summary: `Return rental ${agreementId}`,
    };

    updateStore((prev) => ({
      ...prev,
      rentals: prev.rentals.map(r => r.id === agreementId ? {
        ...r,
        status: "completed" as any,
        actualReturnDate: body.actualReturnDate,
        returnSiteId: body.returnSiteId ?? null,
        returnWarehouseId: body.returnWarehouseId ?? null,
        updatedAt: now,
      } : r),
      rentalEvents: [event, ...prev.rentalEvents],
      approvals: [approval, ...prev.approvals],
    }));
    return respond({ event, approval });
  }

  // Default fallback
  console.warn(`[DEMO] Unhandled mock mutation: ${method} ${path}`);
  return respond({ id: "demo_mock_" + Date.now(), ...body });
}
