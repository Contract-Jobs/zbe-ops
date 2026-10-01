# Inventory API Changelog — License-Scoped Balances

Oct 1, 2026 · @Tesfaye

## Overview

Inventory balances used to be pooled per `(item, location)` regardless of which license paid for the stock. Cement bought under License A and the same cement bought under License B, delivered to the same warehouse, collapsed into a single quantity and a single blended cost — there was no way to tell how much of either license's stock remained, and a consume/sale tagged to one license could silently draw down stock actually bought under another.

Balances are now scoped per `(item, location, license)`: each license's stock at a location is its own row (its own quantity, its own cost). Only a `purchase` movement can create a new one — every other movement resolves against existing stock instead of asserting a license.

## Balance endpoints

| Endpoint | Change |
| --- | --- |
| `GET /api/inventory-balances` | Now returns one row per `(item, location, license)` instead of one per `(item, location)`. The same item/location can legitimately appear more than once. Accepts a new optional `licenseId` filter. |
| `GET /api/inventory-balances/verify` | Now requires `licenseId` alongside `itemId`/`inventoryId`. |
| `GET /api/inventory-items/[id]/balances` | Each row now includes `licenseId` and `licenseName`. The same `location`/`locationId` can repeat once per license holding stock there — key rows by `(locationId, licenseId)`, not `locationId` alone. |

## Movement creation (`POST /api/inventory-movements`)

| Movement type | Change |
| --- | --- |
| `purchase` | Unchanged — `licenseId` still required. It's the only movement that can assign a license to new stock. |
| `sale` | `licenseId` is now OPTIONAL (was required). Omit it when the source location holds the item under one license — it's auto-resolved. Only pass it when the location holds the item under more than one license, picking the lot from the balances list. |
| `consume` / `transfer` / `loss` | No request shape change — these never accepted `licenseId`. Behavior is corrected underneath: they now draw down the correct license's lot instead of a blended pool. |

## New validation errors to handle

- `VALIDATION: No stock of this item at this location under any license.` — an outflow (sale/consume/transfer/loss) was attempted where no balance exists at all.
- `VALIDATION: Multiple licenses hold stock of this item at this location — specify licenseId.` — ambiguous: more than one license's lot is present. The UI should let the user pick a lot from `GET /api/inventory-balances` results and pass its `licenseId`.

## Migration note

This change only affected the dev database, which has been reset as part of applying it. There's no production data and nothing the frontend needs to migrate.
