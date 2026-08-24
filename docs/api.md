# Exhaustive API Feature Details and Constraints

This document comprehensively outlines **every distinct backend feature**, its route, and all business logic, RBAC, and data constraints enforced by the API.

## Global List Parameters (ListParams)

All list endpoints (`GET` routes that return multiple items) universally support the following query parameters for pagination, searching, sorting, and filtering:
- **`page`**: Page number (default: 1).
- **`limit`**: Items per page (default: 20).
- **`search`**: Text-based fuzzy search across key fields.
- **`sortBy`**: Field to sort by.
- **`sortOrder`**: `asc` or `desc`.
- **Filters**: Multi-select filters can be passed as arrays (e.g., `?status=active&status=closed`) or comma-separated strings (e.g. `?status=active,closed`). Single-value filters (e.g., `?siteId=...`) are also supported.

> [!NOTE]  
> **For the Frontend Team:** Strict TypeScript definitions for all API filters (e.g., `EquipmentFilters`, `MaterialFilters`, `TransactionFilters`, etc.) are exported from `lib/services/types.ts`. You should import these types directly into your frontend to ensure your query parameters are strictly typed against the backend schemas.

## 1. Materials & Inventory Features

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **Create Material (Catalog)** | `/api/materials` | `POST` | `name` is required. Optional: `unit` (default: "pcs"), `type` ("single" or "set"). If `type`="set", an array of `subitems` can be passed to create them in bulk. |
| **Update Material** | `/api/materials/[id]` | `PATCH` | Updates material details. Passing `subitems` when `type`="set" will overwrite existing sub-items. |
| **Get Materials** | `/api/materials` | `GET` | Returns paginated catalog items with `totalQuantity`. **Sort**: `name`, `createdAt`. **Filters**: `categoryId`, `unit`, `type`. Includes nested subitems. |
| **Get Material Details** | `/api/materials/[id]` | `GET` | Retrieve single catalog entry. Includes nested subitems. |
| **Delete Material** | `/api/materials/[id]` | `DELETE`| Soft deletes material from catalog. Cascades to sub-items. |
| **Restore Material** | `/api/materials/[id]/restore` | `POST` | Restores soft-deleted material. |
| **List Sub-Items** | `/api/materials/[id]/sub-items` | `GET` | Returns all sub-items belonging to a material set. |
| **Add Sub-Item** | `/api/materials/[id]/sub-items` | `POST` | Adds a new sub-item to a material set. Requires `name` and `quantity`. |
| **Update Sub-Item** | `/api/materials/[id]/sub-items/[subId]`| `PATCH` | Updates an individual sub-item. |
| **Remove Sub-Item** | `/api/materials/[id]/sub-items/[subId]`| `DELETE`| Removes a sub-item from a material set. |
| **Get Inventory Balances** | `/api/inventory/balances` | `GET` | Returns quantities across sites/warehouses. Site managers can only filter their sites. |
| **Trace Material History** | `/api/inventory/trace/[catalogId]`| `GET` | Returns detailed movement history and current balances across all locations. |
| **Purchase Material** | `/api/materials/[id]/purchase` | `POST` | Requires `quantity`, `unitPrice`. Needs `toSiteId` or `toWarehouseId`. Approvals workflow. Auto-generates a `money_out` transaction. |
| **Transfer Material** | `/api/materials/[id]/transfer` | `POST` | Requires `quantity`, source, and destination. Site managers cannot withdraw from warehouses. Approvals workflow. |
| **Sell Material** | `/api/materials/[id]/sale` | `POST` | Requires `quantity`, `unitPrice`, `buyerName`. **Only** central warehouses can sell. Auto-generates a `money_in` transaction. Approvals workflow. |
| **Consume Material**| `/api/materials/[id]/consume` | `POST` | Requires `quantity`, source location. Approvals workflow. |
| **Report Missing Material**| `/api/materials/[id]/report-missing` | `POST` | Requires `quantity`, source location. Approvals workflow. |
| **Get Material Log** | `/api/inventory/logs/[id]` | `GET` | Retrieve single material log details. |
| **List Material Logs** | `/api/inventory/logs` | `GET` | Retrieve list of material movements. **Sort**: `createdAt`. **Filters**: `materialId`, `siteId`, `licenseId`, `logType`. |
| **Reverse Material Movement** | `/api/inventory/logs/[id]/reverse`| `POST` | Requires original log ID. Goes to Approvals Workflow. Cannot reverse a reversal log. |

## 2. Equipment Features

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **Create Equipment** | `/api/equipment` | `POST` | `name` required. Can include `serialNumber`, initial `originalValue` (`rentRate` is strictly forbidden). |
| **Update Equipment** | `/api/equipment/[id]` | `PATCH` | Edit basic equipment properties. Modifying `siteId`, `warehouseId`, `value`, or `rentRate` is strictly forbidden (must use log actions). |
| **Get Equipment List** | `/api/equipment` | `GET` | Returns paginated equipment. **Sort**: `name`, `createdAt`, `value`, `rentRate`. **Filters**: `siteId`, `warehouseId`, `licenseId`, `status`, `ownershipStatus`. |
| **Get Equipment Details** | `/api/equipment/[id]` | `GET` | Retrieve single equipment details. |
| **Delete / Restore Equipment** | `/api/equipment/[id]` | `DEL`/`POST`| Soft delete and restore endpoints (using `/restore`). |
| **Purchase Equipment** | `/api/equipment/[id]/purchase` | `POST` | Requires `price`, `vendorName`, destination. Approvals workflow. |
| **Transfer Equipment** | `/api/equipment/[id]/transfer` | `POST` | Requires source and destination. Approvals workflow. |
| **Rent Equipment IN** | `/api/equipment/[id]/rent-in` | `POST` | Requires `price` (rate), `rentStartDate`. Equipment cannot be currently `isOnLoan`. Approvals workflow. |
| **Return Rented Eq. IN** | `/api/equipment/[id]/return-in` | `POST` | Requires `rentReturnDate`. Must originate from current site. Equipment gets `returned` status. Auto-posts `money_out` rental cost. Approvals workflow. |
| **Rent Equipment OUT** | `/api/equipment/[id]/rent-out` | `POST` | Requires `price` (rate), `rentStartDate`, source, `buyerName`. Cannot be currently `isOnLoan`. Approvals workflow. |
| **Return Rented Eq. OUT**| `/api/equipment/[id]/return-out` | `POST` | Requires `rentReturnDate`, destination. Must be `isOnLoan`. Auto-posts `money_in` rental revenue. Status becomes `deployed`/`available`. Approvals workflow. |
| **Sell Equipment** | `/api/equipment/[id]/sale` | `POST` | Requires `buyerName`, `price`, source. Status becomes `sold`. Approvals workflow. |
| **Report Degraded** | `/api/equipment/[id]/degrade` | `POST` | Adjusts `value` down by `price`. Approvals workflow. |
| **Report Appreciated** | `/api/equipment/[id]/appreciate` | `POST` | Adjusts `value` up by `price`. Approvals workflow. |
| **Maintenance Dispatch**| `/api/equipment/[id]/maintenance-dispatch` | `POST` | Status becomes `maintenance`. Approvals workflow. |
| **Maintenance Return**| `/api/equipment/[id]/maintenance-return` | `POST` | Requires `price` (repair cost). Status becomes `deployed`/`available`. Auto-posts `money_out` maintenance transaction. Approvals workflow. |
| **Consume Equipment**| `/api/equipment/[id]/consume` | `POST` | Status becomes `disposed`. Approvals workflow. |
| **Report Missing**| `/api/equipment/[id]/report-missing` | `POST` | Status becomes `missing`. Approvals workflow. |
| **Get / List Equipment Logs** | `/api/equipment/logs` | `GET` | Retrieve paginated equipment events. **Sort**: `createdAt`. **Filters**: `equipmentId`, `siteId`, `warehouseId`, `logType`. |
| **Reverse Equipment Event** | `/api/equipment/logs/[id]/reverse`| `POST` | Goes to Approvals Workflow. Cannot reverse a reversal log. |

## 3. Projects, Sites & Tasks

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **List Sites** | `/api/sites` | `GET` | Paginated sites. **Sort**: `name`, `createdAt`, `laborBudget`, `materialBudget`. **Filters**: `status`, `licenseId`. |
| **Create Site** | `/api/sites` | `POST` | `name` and `licenseId` required. |
| **Update Site** | `/api/sites/[id]` | `PATCH` | Edit site details, budgets, status. |
| **Get / Delete / Restore Site** | `/api/sites/[id]` | `GET/DEL/POST`| CRUD operations. Site managers only see assigned sites. |
| **Get Site Summary** | `/api/sites/[id]/summary` | `GET` | Returns aggregated overview of the site. |
| **Get Site Budget** | `/api/sites/[id]/budget` | `GET` | Returns labor and material budget info. |
| **Get Site Lifecycle Logs** | `/api/sites/[id]/lifecycle` | `GET` | Returns historical changes to the site. **Sort**: `createdAt`. |
| **Create Site Task** | `/api/sites/[id]/tasks` | `POST` | `title` required. |
| **List Tasks** | `/api/sites/[id]/tasks` | `GET` | **Sort**: `targetDate`, `createdAt`. |
| **Get / Update / Delete Task** | `/api/sites/[id]/tasks/[taskId]` | `GET/PATCH/DEL`| Manage site tasks and milestones. |
| **Claim Task Completion** | `/api/sites/[id]/tasks/[taskId]/claim`| `POST` | User claims task is done. Places task in "Claimed" status. |
| **Approve Task Completion** | `/api/sites/[id]/tasks/[taskId]/complete`| `POST` | Manager approves claim with review notes. Marks task "Completed". |

## 4. Master Data (Tenders, Licenses, Warehouses)

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **List Tenders** | `/api/tenders` | `GET` | **Sort**: `name`, `createdAt`, `submissionDate`, `status`. **Filters**: `status`, `licenseId`. |
| **CRUD Tender** | `/api/tenders/[id]` & `/restore`| `POST/GET/PATCH/DEL` | `name` and `licenseId` required for creation. |
| **List Licenses** | `/api/licenses` | `GET` | **Sort**: `name`, `createdAt`. |
| **CRUD License** | `/api/licenses/[id]` & `/restore`| `POST/GET/PATCH/DEL`| `name` required. Top-level financial entities. |
| **List Warehouses** | `/api/warehouses` | `GET` | **Sort**: `name`, `createdAt`, `location`. |
| **CRUD Warehouse** | `/api/warehouses/[id]` & `/restore`| `POST/GET/PATCH/DEL`| `name` required. Central locations not restricted by site managers. |

## 5. Financial Transactions & Ledger

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **List Ledgers** | `/api/ledgers` | `GET` | **Sort**: `timestamp`, `amount`. **Filters**: `siteId`, `licenseId`, `sourceRefType`, `isReversal`, `loggedBy`. Site managers can only view their sites' ledgers. |
| **Log Manual Income / Expense** | `/api/transactions` | `POST` | `type` (`money_in` or `money_out`), `amount`, `licenseId` required. Direct transactions bypass the Approval Workflow. |
| **Log Security Deposit** | `/api/transactions` | `POST` | Pass `equipmentId` with transaction details. |
| **List Transactions** | `/api/transactions` | `GET` | **Sort**: `transactionDate`, `createdAt`, `amount`. **Filters**: `siteId`, `categoryId`, `licenseId`, `equipmentId`, `type`. |
| **Get Transaction** | `/api/transactions/[id]` | `GET` | |
| **Reverse Transaction** | `/api/transactions/[id]/reverse`| `POST` | Generates inverse transaction. Cannot reverse already reversed. |
| **List Categories** | `/api/transactions/categories` | `GET` | **Sort**: `name`, `createdAt`. |
| **CRUD Transaction Categories** | `/api/transactions/categories` | `POST/DEL`| Create and manage categories for manual logging. |
| **Get Cost Breakdown** | `/api/transactions/cost-breakdown`| `GET` | Aggregates project ledger transactions grouped by category, including material/equipment allocations. |

## 6. Approvals Workflow

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **List Approvals** | `/api/approvals` | `GET` | **Sort**: `createdAt`, `status`. **Filters**: `status`, `approvalType`. |
| **Get Approval** | `/api/approvals/[id]` | `GET` | Retrieve pending/approved/rejected requests. |
| **Approve Event** | `/api/approvals/[id]/approve`| `POST` | Applies state changes to balances, equipment states, and project ledger. May trigger auto-calculation of rental cost/revenue. |
| **Reject Event** | `/api/approvals/[id]/reject` | `POST` | Stops the event from modifying state. |

## 7. Analytics

| Feature | Route | Method | Constraints & Requirements |
|---------|-------|--------|----------------------------|
| **Get Spend Analytics** | `/api/analytics/spend` | `GET` | High-level aggregated spend data across licenses/sites. |
| **Get Inventory Analytics**| `/api/analytics/inventory` | `GET` | High-level inventory value aggregations. |
| **Get Budget Health** | `/api/analytics/budget-health`| `GET` | Compares actual ledger costs against `laborBudget` and `materialBudget`. |
| **Get License Analytics** | `/api/analytics/licenses` | `GET` | Aggregated metrics per license. |
