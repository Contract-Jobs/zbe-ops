# Access control: the complete reference for the frontend

Who can see and do what, how the backend decides, what it returns when it says no, and what the UI should show or hide. This is the enforced behaviour of the code (not a wish list); every rule below has been tested against the database.

Related docs: [`frontend-changes-vat-decimals-cogs.md`](./frontend-changes-vat-decimals-cogs.md) (feature changes) and [`approvals-switch.md`](./approvals-switch.md) (turning the approval step off).

---

## 1. The three rules everything follows

1. **A `site_manager` only sees and touches their own sites.** "Own site" means a site whose `managerId` is that user. Everything attached to a site (its inventory, stock, movements, equipment, rentals, transactions, ledger, payables, tasks) is theirs; everything else is invisible or refused.
2. **Warehouses are names only for a site manager.** They can pick a warehouse as a destination (for example to return equipment), but they cannot see its stock, sales, buyers, prices or location.
3. **Company-wide money is admin only.** Sales analytics, VAT, company financials, license totals, sold-items, tenders.

`admin` and `superadmin` are never restricted by site.

---

## 2. Roles and accounts

| Role           | Who                     | Scope                                          |
| -------------- | ----------------------- | ---------------------------------------------- |
| `site_manager` | runs one or more sites  | own sites only (rules above)                   |
| `admin`        | office staff            | company-wide                                   |
| `superadmin`   | owner / technical admin | company-wide, plus the destructive tools in §8 |

- `admin` and `superadmin` have identical data permissions. They differ in user management (only a superadmin can impersonate admins) and the tools in §8.
- **Accounts are created by an admin only.** Public sign-up is closed: `POST /api/auth/sign-up/email` over HTTP returns `403 "Sign-up is disabled. Ask an administrator to create your account."`. Admins create users with `POST /api/auth/admin/create-user`. Remove any "Sign up" screen.
- **An account with no role gets no access.** If the signed-in user's role is missing or unknown, every API call returns `403 "FORBIDDEN: this account has no role assigned. Ask an administrator."`. (It used to silently behave like a site manager.) New users must be given a role when created.
- Not signed in → `401`.

---

## 3. Permission grants (the first gate)

Each action is first checked as _"may this role `<action>` this resource?"_. Grants by role:

| Resource                               | `site_manager`                                                                                                      | `admin` / `superadmin`                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| site                                   | read; the _update_ grant exists only so they can work on their site's **tasks**. They **cannot edit a site** (§5.1) | create, read, update, delete          |
| warehouse                              | read (names only)                                                                                                   | create, read, update, delete          |
| asset (individual equipment)           | read (own sites)                                                                                                    | create, read, update, delete          |
| inventory (items, movements, balances) | create, read, approve (own sites)                                                                                   | create, read, update, delete, approve |
| transaction                            | create, read (own sites)                                                                                            | create, read, update, delete, approve |
| license                                | read                                                                                                                | create, read, update, delete          |
| **tender**                             | **none (changed: no access at all)**                                                                                | create, read, update, delete          |
| budget                                 | read (own sites)                                                                                                    | create, read, update, delete, approve |
| approval                               | create, read (own submitted)                                                                                        | all                                   |
| rental                                 | create, read, approve (own sites)                                                                                   | all                                   |
| progress_log                           | create, read, update                                                                                                | all                                   |

Passing this gate is not enough for a site manager: the **site scope** in §4 is then applied.

---

## 4. Site scope: how "own site" works

### 4.1 What counts as "mine"

- A **site**: `site.managerId === me`.
- A site's **inventory node**, and everything stored in it: balances, materials, bulk equipment.
- **Equipment**: machines currently at one of my sites, plus machines on a rental agreement that belongs to one of my sites.
- **Movements**: any movement that comes from or goes to my site's inventory, plus sales _to_ my site (my purchase list, `buyerSiteId` = my site).
- **Transactions / ledger / payables / tasks / rentals**: those tied to my site.

### 4.2 Lists vs single records (important for the UI)

- **Lists, in-bulk fetches and totals are silently filtered.** A site manager gets only their own rows. Other sites' ids in an in-bulk request are simply left out. You will see `[]` and `total: 0`, not an error.
- **Opening one record that isn't mine returns `403`** (for example `GET /sites/:otherId`).
- **A required scope that isn't mine returns `403`** (for example asking the transactions list for another site's id).
- **A filter that names something outside my scope returns `403`** (see §5.11). Filters can only narrow what I already see; they never widen it.

### 4.3 The "origin" rule for writes

Creating, reversing or paying on a movement is allowed only if it **originates at my site**: its source inventory, or, when there is no source (a purchase or a return), its destination.

- Because sales leave a **warehouse**, a site manager **cannot create, reverse or take payment on warehouse sales**.
- **Destination rule:** stock or equipment leaving my site may go to a **warehouse** (a return) or stay at **my own site**. It can never be sent into **another site's** inventory.
- Material cannot be transferred to or from a site at all (existing business rule); sell it to the site instead.

---

## 5. Endpoint by endpoint

Legend: ✅ allowed · 🔒 allowed but scoped to own sites · 🏷️ names only · ❌ refused (`403`) · 👤 admin/superadmin only.

### 5.1 Sites

| Endpoint                                                                             | site_manager | Notes                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /sites` (incl. `?managerId=`, `search`, paging)                                 | 🔒           | Always only their own sites. `managerId` may only be their own id; anyone else's → `403`.                                                                                                                                        |
| `GET /sites/:id`, `POST/GET /sites/in-bulk`                                          | 🔒           | Other site → `403` (single) or left out (bulk).                                                                                                                                                                                  |
| `PATCH /sites/:id`                                                                   | ❌ 👤        | **Site managers cannot edit sites at all** (name, location, budgets, status / close-reopen, manager, tender, license). Admins only. `403 "FORBIDDEN: site managers cannot edit sites"`. Hide every "edit site" control for them. |
| `POST /sites`, `DELETE /sites/:id`, `POST /sites/:id/restore`                        | 👤           |                                                                                                                                                                                                                                  |
| `GET /sites/:id/summary`, `/lifecycle`, `/tasks…`, `/payables`, `/payables/payments` | 🔒           | Own site only.                                                                                                                                                                                                                   |
| `GET /sites/:id/materials`, `/equipment`, `/bulk-equipment`                          | 🔒           | Own site only.                                                                                                                                                                                                                   |
| Tasks: create/update `POST/PATCH /sites/:id/tasks…`                                  | 🔒           | Own site. Review and `/complete` are 👤. Claim: see §7. Delete is 👤.                                                                                                                                                            |
| `GET /tasks`, `GET /tasks/:id`                                                       | 🔒           | Own sites' tasks.                                                                                                                                                                                                                |

### 5.2 Warehouses

| Endpoint                                                                 | site_manager | Notes                                                                                                                                            |
| ------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /warehouses`, `/warehouses/:id`, `POST/GET /warehouses/in-bulk`     | 🏷️           | Returns **`{ id, name }` only** (list rows also carry `totalMaterials: "0"`, `totalEquipment: "0"`, which mean "not available", not zero stock). |
| `GET /warehouses/:id/materials`, `/equipment`, `/bulk-equipment`         | ❌           |                                                                                                                                                  |
| `GET /warehouses/:id/sold-items` and `/materials`, `/equipment`          | ❌           | Sales, buyers, prices, COGS, margins.                                                                                                            |
| `GET/POST /warehouses/:id/site-payments…`, `POST …/sold-items/mark-paid` | ❌           | Warehouse side only.                                                                                                                             |
| `POST /warehouses`, `PATCH`, `DELETE`, `restore`                         | 👤           |                                                                                                                                                  |

### 5.3 Inventory nodes, items, balances

| Endpoint                                                          | site_manager | Notes                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /inventories`, `/inventories/:id`, in-bulk                   | 🔒 + 🏷️      | Own sites' nodes in full. **Warehouse nodes are returned redacted**: `warehouse: { id, name, slug: null, location: null }` and all counts `0`. **Other sites' nodes do not appear** (`403` if opened by id). Use the node `id` as a destination for returns. |
| `GET /inventories/:id/materials`, `/equipment`, `/bulk-equipment` | 🔒           | Own site's node only; a warehouse or another site → `403`.                                                                                                                                                                                                   |
| `GET /inventory-balances`                                         | 🔒           | Only balances at own sites.                                                                                                                                                                                                                                  |
| `GET /inventory-balances/movements`, `/verify`                    | 🔒           | `inventoryId` must be an own site's.                                                                                                                                                                                                                         |
| `GET /inventory-items`, `/:id`, in-bulk, `/:id/subitems`          | ✅           | The item catalog is shared. **`totalQuantity` / `totalValue` are totals over the manager's own sites only.**                                                                                                                                                 |
| `GET /inventory-items/:id/balances`, `/:id/history`               | 🔒           | Only own sites' stock and movements for that item.                                                                                                                                                                                                           |
| `POST /inventory-items`, `…/subitems`                             | ✅           | Catalog entries are global (anyone who can create a purchase may add a new item).                                                                                                                                                                            |
| `PATCH`/`DELETE` item or subitem, `restore`                       | 👤           |                                                                                                                                                                                                                                                              |

### 5.4 Movements, reversals, payments

| Endpoint                                                           | site_manager | Notes                                                                                                                                                                    |
| ------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /inventory-movements` (purchase, consume, loss, transfer…)   | 🔒           | Origin rule (§4.3). Purchases into their own site, consumption and losses at their own site. Sales are never possible (they leave a warehouse). Never into another site. |
| `POST /equipment-movements`                                        | 🔒           | Same. Equipment at their site may be moved to a warehouse or kept at their site, never to another site.                                                                  |
| `GET /inventory-movements`, `GET /equipment-movements`             | 🔒           | Only movements touching their sites (+ sales to their sites).                                                                                                            |
| `POST …/:id/reverse` (inventory and equipment)                     | 🔒           | Only movements that originated at their own site. Warehouse sales → `403`.                                                                                               |
| `POST …/:id/payments`, `GET …/:id/payments`                        | 🔒           | Only on movements that originated at their own site. In practice this means site-origin items; warehouse sales → `403`.                                                  |
| `POST …/:id/payments/:paymentId/reverse`                           | 👤           | Needs _delete transaction_, which only admins have.                                                                                                                      |
| `PATCH /inventory-movements/:id` (edit sale price / VAT exemption) | 👤           |                                                                                                                                                                          |

### 5.5 Equipment

| Endpoint                                                | site_manager | Notes                                                                         |
| ------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| `GET /equipment`, `/equipment/in-bulk`                  | 🔒           | Only equipment at their sites or on their sites' rentals.                     |
| `GET /equipment/:id`, `/equipment/:id/trace`            | 🔒           | Other equipment → `403`.                                                      |
| `GET /equipment-states`, `/equipment-states/:id/verify` | 🔒           |                                                                               |
| `PATCH`/`DELETE /equipment/:id`, `restore`              | 👤           |                                                                               |
| `POST /equipment`                                       | ❌           | Disabled for everyone. Equipment is created by a purchase / rent-in movement. |

### 5.6 Transactions

| Endpoint                         | site_manager | Notes                                                                                                                                                                                            |
| -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /transactions`             | 🔒           | **A `siteId` is required and must be theirs.** `warehouseId` → `403`. `equipmentId` must be at their site. `licenseId`, if sent, must be the site's license. (Optional `taxes` list is allowed.) |
| `GET /transactions`              | 🔒           | `siteId` filter is **required**, and **every** site id listed must be theirs.                                                                                                                    |
| `GET /transactions/:id`          | 🔒           | Transactions with **no site** (warehouse or corporate money) → `403`.                                                                                                                            |
| `POST /transactions/:id/reverse` | 🔒           | Same rule as reading it.                                                                                                                                                                         |
| Categories `GET`, `POST`         | ✅           | Global. Update and delete are 👤. The `labor` category is protected for everyone.                                                                                                                |

### 5.7 Rentals

| Endpoint                                                                           | site_manager | Notes                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /rentals` (start)                                                            | 🔒           | **A `siteId` is required and must be theirs.** A warehouse-only rental → `403`. For rent-out, the equipment must currently be at their site.                                              |
| `POST /rentals/:id/return`, `/adjust`                                              | 🔒           | Only agreements of their own sites; **warehouse rentals → `403`**. `returnSiteId` must be their own site (a warehouse is fine). For rent-in returns, the equipment must be at their site. |
| `GET /rentals`, `/rental-events`, `/rentals/in-bulk`, `/rental-agreements/in-bulk` | 🔒           | Own sites' rentals only.                                                                                                                                                                  |
| `GET /rentals/:id`, `/rentals/:id/events`                                          | 🔒           | Other site or a warehouse rental → `403`.                                                                                                                                                 |

### 5.8 Ledger, budget, approvals

| Endpoint                                                 | site_manager | Notes                                                                                                                            |
| -------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /ledgers`                                           | 🔒           | Own sites' entries.                                                                                                              |
| `GET /ledgers/cost-breakdown`, `/ledgers/:siteId/verify` | 🔒           | Own site only.                                                                                                                   |
| `POST /ledgers/:siteId/rebuild`                          | 👤           |                                                                                                                                  |
| `GET /approvals`, `/approvals/:id`                       | 🔒           | Only approvals they submitted.                                                                                                   |
| `PATCH /approvals/:id`, `POST /approvals/bulk`           | 🔒           | Only inventory / equipment movement and rental-event approvals whose destination is their own site. Never transaction approvals. |

### 5.9 Analytics

| Endpoint                                                                   | site_manager | Notes                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /analytics/spend`, `/analytics/inventory`, `/analytics/budget-health` | 🔒           | `siteId` omitted → their (first) site; **another site's `siteId` → `403`**; a manager with **no site assigned → `403`** (it no longer falls back to company-wide totals). A `warehouseId` filter → `403`. A manager with several sites should pass `siteId` explicitly to pick one. |
| `GET /analytics/budget?siteId=`                                            | 🔒           | Own site only.                                                                                                                                                                                                                                                                      |
| `GET /analytics/licenses`                                                  | ❌           | Company money per license.                                                                                                                                                                                                                                                          |
| `GET /analytics/sales`, `/analytics/vat`, `/analytics/company`             | ❌           | 👤 only.                                                                                                                                                                                                                                                                            |

### 5.10 Licenses, tenders

| Endpoint                                  | site_manager | Notes                                                                                                                     |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /licenses`, `/licenses/:id`, in-bulk | ✅           | Licenses are only names; site managers still need them.                                                                   |
| `POST/PATCH/DELETE/restore` licenses      | 👤           |                                                                                                                           |
| **All `/tenders` endpoints**              | **❌ / 👤**  | Site managers have no tender access at all (budgets). The `tenderId` on a site is still returned but they cannot open it. |

### 5.11 Filters (query parameters) and access control

**The rule.** For a site manager, every list is first limited to their own scope (§4.1) and the filters you send are applied **on top of that, never instead of it**. A filter can only narrow the result; no filter, sort or search value can bring in another site's data. On top of that, a filter that **names** a site, inventory or warehouse outside the manager's scope is **refused with `403`**, rather than silently ignored or answered with an empty page, so the UI can tell "not yours" from "nothing there".

| Endpoint                                                                       | Scope filter                                                                                                 | For a site manager                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /sites`                                                                   | `managerId`                                                                                                  | must be their own id, else `403`                                                                      |
| `GET /inventories`                                                             | `siteId`                                                                                                     | must be their own site, else `403`                                                                    |
|                                                                                | `warehouseId`, `inventoryType`, `search`                                                                     | allowed (a warehouse node still comes back redacted, names only)                                      |
| `GET /inventory-balances`                                                      | `inventoryId`                                                                                                | must be an inventory of their own site; a warehouse or another site → `403`                           |
| `GET /inventory-balances/movements`, `/verify`                                 | `inventoryId` (required)                                                                                     | same                                                                                                  |
| `GET /inventory-movements`                                                     | `buyerSiteId`                                                                                                | must be their own site, else `403`                                                                    |
|                                                                                | `itemId`, `movementType`, dates, `saleStatus`, `isInternal`, `isMarkedPaid`, `isReversal`, `includeReversed` | free; only narrow their own rows                                                                      |
| `GET /equipment-movements`                                                     | `individualItemId`, `movementType`, dates …                                                                  | free; only narrow their own rows                                                                      |
| `GET /equipment`                                                               | `inventoryId`                                                                                                | must be their own site's inventory, else `403`                                                        |
|                                                                                | `itemId`, `licenseId`, status filters, `search`                                                              | free; only narrow their own equipment                                                                 |
| `GET /equipment-states`                                                        | `currentInventoryId`                                                                                         | must be their own site's inventory, else `403`                                                        |
| `GET /transactions`                                                            | `siteId` (required, may be repeated)                                                                         | **every** id must be their own, else `403`                                                            |
|                                                                                | `warehouseId`                                                                                                | `403` (warehouse money is not theirs)                                                                 |
|                                                                                | `buyerSiteId`                                                                                                | must be their own site, else `403`                                                                    |
|                                                                                | `categoryId`, `type`, `minAmount`, dates, `search`, `includeReversed` …                                      | free; only narrow their own site's rows                                                               |
| `GET /ledgers`                                                                 | `siteId` (may be repeated)                                                                                   | every id must be their own, else `403`; omitted → all of their sites                                  |
|                                                                                | `licenseId`, `sourceRefType`, `sourceRefId`, `categoryId`, `loggedBy`, dates, amounts                        | free; only narrow their own ledger rows                                                               |
| `GET /tasks`                                                                   | `siteId` (may be repeated)                                                                                   | every id must be their own, else `403`; omitted → all of their sites                                  |
| `GET /rentals`                                                                 | `siteId` (may be repeated)                                                                                   | every id must be their own, else `403`; omitted → all of their sites                                  |
| `GET /rentals`, `/rental-events`                                               | `agreementId`, `type`, `status`, `equipmentId`, `eventType`                                                  | free; only narrow their own rentals                                                                   |
| `GET /approvals`                                                               | `submittedBy`, `approvedBy`, `status`, `approvalType`, `recordId` …                                          | free; always limited to approvals they submitted                                                      |
| `GET /analytics/spend`, `/inventory`, `/budget-health`, `/budget`              | `siteId`                                                                                                     | must be their own, else `403`; omitted → their first site (send it explicitly if they manage several) |
|                                                                                | `warehouseId`                                                                                                | `403`                                                                                                 |
|                                                                                | `licenseId`, `materialId`, dates                                                                             | free; only narrow their own site                                                                      |
| `GET /sites/:id/payables`                                                      | `warehouseId`                                                                                                | free; only narrows their own site's accounts                                                          |
| `GET /sites/:id/payables/payments`                                             | `warehouseId`, dates                                                                                         | free; their own site is fixed by the URL                                                              |
| Sold-items, site-payments, `/analytics/licenses`, `/sales`, `/vat`, `/company` | any                                                                                                          | the whole endpoint is refused for site managers (§5.2, §5.9)                                          |
| Bulk fetches (`…/in-bulk`)                                                     | list of ids                                                                                                  | ids outside their scope are silently left out (no error)                                              |

Notes:

- **Search** (`search=`) only looks inside what the manager is allowed to see. Searching another site's name returns nothing.
- **Sorting and paging** parameters have no access impact.
- **Free-text and id filters that are not a site / inventory / warehouse** (items, licenses, categories, users, record ids) are never a way to widen scope: they are combined with the scope using AND.
- A manager with **no assigned site** gets empty lists (and `403` on the analytics above), whatever filters they send.

---

## 6. Approvals and the approvals switch

By default a non-admin's movement, loss, rental event or manual transaction is **staged as pending** and needs an approval; admin actions are auto-approved. The switch `APPROVALS_ENABLED=false` makes **every** operation approve itself immediately (see [`approvals-switch.md`](./approvals-switch.md)).

**With approvals off, the scope rules in §4–5 are what protect the data**: a site manager's writes now take effect at once, so the ownership checks above are the only gate. They are enforced regardless of the switch.

Who may approve / reject when approvals are on: admins any; a site manager only movement / rental-event approvals destined for their own site, never transaction approvals.

---

## 7. Behaviour notes the UI should know

- **Task completion:** with approvals off, a site manager's _claim_ completes the task immediately. With approvals on, an admin completes it.
- **Reversals** of movements are immediate (no approval) and allowed on the manager's own site.
- **Sale payments** are a warehouse-side activity; in practice a site manager can only see and record payments on movements that originated at their own site.
- **Sales to a site** (the site as buyer): the site manager sees them in the movements list (`GET /inventory-movements?buyerSiteId=<mine>`) and in `GET /sites/:id/payables`; they cannot create, reverse or pay them.
- **VAT-exempt flag** on a sale: sales are admin-created (site managers cannot create sales), so only admins use it. On **purchases** the `vatExempt` flag is available to any role that can create a purchase.
- **Single site default:** analytics endpoints without `siteId` use the manager's first site, so send `siteId` for managers with several sites.

---

## 8. Admin / superadmin tools

| Tool                                                                          | Who                                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST /inventory-balances/rebuild`, `POST /equipment-states/rebuild`          | superadmin only                                                                                            |
| `POST /inventory-balances/backfill-sale-cogs`                                 | superadmin only                                                                                            |
| `POST /ledgers/:siteId/rebuild`                                               | admin                                                                                                      |
| User management (`/api/auth/admin/*`: create / ban / set role / impersonate…) | admin; `impersonate-admins` is superadmin only                                                             |
| One-time VAT backfills                                                        | run by the backend team as scripts (`pnpm backfill:sale-vat`, `pnpm backfill:purchase-vat`), not endpoints |

---

## 9. Error reference

| Status | Meaning                                         | Message starts with |
| ------ | ----------------------------------------------- | ------------------- |
| 401    | not signed in                                   | `UNAUTHORIZED`      |
| 403    | not allowed for your role or outside your sites | `FORBIDDEN:`        |
| 404    | record doesn't exist                            | `NOT_FOUND:`        |
| 409    | conflict (already reversed, closed site…)       | `CONFLICT:`         |
| 400    | malformed request or schema validation          | `VALIDATION_FAILED` |
| 422    | business rule violated                          | `VALIDATION:`       |

Messages you will see for scope refusals (safe to show as-is):

- `FORBIDDEN: site managers cannot edit sites`
- `FORBIDDEN: site managers can only filter by their own sites`
- `FORBIDDEN: site managers cannot filter transactions by warehouse`
- `FORBIDDEN: site managers can only act on their own site`
- `FORBIDDEN: site manager can only access their own site`
- `FORBIDDEN: site managers can only act on movements tied to a site, not a warehouse`
- `FORBIDDEN: site managers can only access equipment at their own sites`
- `FORBIDDEN: site managers can only access their own site's transactions`
- `FORBIDDEN: site managers can only log transactions for their own site`
- `FORBIDDEN: site managers cannot log transactions against a warehouse`
- `FORBIDDEN: site managers can only log transactions under their site's license`
- `FORBIDDEN: site managers can only start rentals for their own site`
- `FORBIDDEN: site managers cannot access warehouse rentals`
- `FORBIDDEN: sold items are not available to site managers`
- `FORBIDDEN: site managers cannot query warehouse figures`
- `FORBIDDEN: license totals are admin/superadmin only`
- `FORBIDDEN: no site is assigned to this site manager`
- `FORBIDDEN: this account has no role assigned. Ask an administrator.`

---

## 10. UI cheat sheet

**`site_manager` should see:** their site(s) (dashboard, tasks, materials/equipment stock, movements, rentals, transactions for the site, ledger/cost breakdown, payables), purchase/consume/loss forms for their site, equipment returns to a warehouse (warehouse picker shows names only), reversal and payment buttons on their own site's items.

**`site_manager` should NOT see:** other sites; warehouse pages, stock, sold-items or sales; tenders; license totals; sales/VAT/company analytics; sale creation, price edit, site-account payments; any "sign up" screen; user management.

**Handle gracefully:**

- An empty list for a site manager usually means "nothing of yours", not an error.
- A `403` on an id the user typed or bookmarked means "not your site": show "You don't have access to this".
- A manager with **no assigned site** will get `403` on spend / inventory / budget analytics and empty lists elsewhere: show "No site assigned. Ask an administrator."

**`admin` / `superadmin`:** everything, unchanged.

---

## 11. What changed from before (re-test these screens as a site manager)

| Screen / call                                  | Before                                     | Now                                   |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| Sites list / site detail                       | all sites                                  | own sites only                        |
| Warehouses list / detail                       | full details and totals                    | names only                            |
| Warehouse stock, sold items, site accounts     | visible                                    | refused                               |
| Inventory nodes list                           | all nodes with counts                      | own site + warehouse names (counts 0) |
| Balances, movements, item history, item totals | company-wide                               | own sites only                        |
| Equipment list / detail / trace                | all equipment                              | own sites' equipment only             |
| Transactions with no site; multi-site filter   | readable                                   | refused / every site must be theirs   |
| Spend / inventory / budget-health analytics    | any `siteId`, or company-wide with no site | own site only; refused otherwise      |
| License totals analytics                       | visible                                    | refused                               |
| Tenders                                        | read-only                                  | no access                             |
| Rentals of a warehouse                         | readable / creatable                       | refused                               |
| Edit a site (any site, including their own)    | allowed                                    | admin only                            |
| Log a transaction without a site               | allowed                                    | refused                               |
| Filter by another site / inventory / warehouse | ignored, dropped or leaked                 | `403`                                 |
| Reverse / pay any movement                     | allowed                                    | own site's movements only             |
| Public sign-up                                 | open                                       | closed                                |
| Account with no role                           | acted as site manager                      | refused                               |
