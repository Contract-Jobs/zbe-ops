# Design guide

Visual language for this ops desk. Tokens live in `app/globals.css`. Do not hardcode hex in components.

This is a dense internal console: tables, stamps, blue actions. No GSAP. No Lenis. No CAD drawings. Do not restyle it into a SaaS dashboard.

---

## Tokens

`--yellow` is the **accent token** (official brand blue). UI reads `var(--yellow)`, `var(--black)`, `var(--ink)`, `var(--paper)`, `var(--white)`.

```css
:root {
  --white: #f4f7fa;
  --paper: #e4ebf2;
  --yellow: #0072c3;
  --mark: #ffffff;
  --black: #0c1824;
  --ink: #122436;
  --raised: #1a3044;
  --grey-750: #3d5166;
  --grey-700: #5a7084;
  --grey-550: #7d92a3;
  --grey-350: #c5d0db;
  --grey-150: #e8eef3;
  --line: color-mix(in hsl, var(--ink) 18%, transparent);
  --line-strong: color-mix(in hsl, var(--ink) 55%, transparent);
  --line-light: color-mix(in hsl, var(--white) 18%, transparent);
  --ok: #15803d;
  --warn: #d97706;
  --bad: #c53030;
}
```

`@theme inline` bridges these into Tailwind. `--font-sans` is Instrument Sans. `--font-mono` is IBM Plex Mono.

**Rules**

- Page: `--white`. Sidebar: `--black`.
- Selection: accent fill, `--white` text.
- Hairlines: 1px `--line`.
- **Hard no:** drop shadows, gradients, glass, rounded-xl cards, Inter, purple chrome.

---

## Type

Instrument Sans 400 / 500 / 600 / 700. IBM Plex Mono 400 / 500 for IDs, quantities, money, stamps.

| Role | Spec |
|---|---|
| Body | 0.95rem / 1.45 / tracking `-0.015em` |
| Page title | `1.65rem` → `sm:2rem` / weight 400 / `-0.04em` |
| Kicker | `.kicker` 0.72rem / 600 / uppercase / `0.08em` / `--grey-550` |
| Mono | stamps, ETB, qty, user ids |

---

## Layout

- **Sharp corners.** Radius 0 on sidebar, hamburger, tables, stamps. `.btn` may use `0.15rem`. `.field` is square.
- Shell: black rail `15.5rem`, sticky on `lg`, **fixed drawer** below `lg` with `bg-black/50` overlay. Main `px-4 py-6` → `sm:px-6 sm:py-8`. Header sticky; license + user on a second row.
- Stat blocks: `gap-px bg-black/10`, cells `bg-white`.
- Tables: class `.data`, always inside `TableWrap` (`.table-wrap { overflow-x: auto }`). Hide extra columns with `hidden sm:table-cell` / `md:table-cell`.
- Detail: title first, then `flex-col-reverse` so the raise-movement / raise-event aside sits under the title on small screens and on the right from `lg`.
- `html, body { overflow-x: clip }` — only tables swipe sideways, not the page.

---

## Chrome

- Sidebar: brand-blue “Ops desk” kicker. Active nav = blue fill / white type. Pending count in mono.
- Hamburger: `h-11 w-11` square black. Close on route change. Lock body scroll while open.
- Pending badge in the mobile header → `/approvals`.
- `.btn` blue fill, blue border, white type, hover inverts to black fill / white type. `.btn-ghost` (dark type, inverts to black on hover), `.btn-ghost-bad` (red hairline and type, inverts to red on hover), `.btn-ink`, and `.btn-bad` (crimson red fill / white type for confirm-delete).
- `.field` full width, 1px line, brand-blue focus ring (`outline: 2px solid var(--yellow)`).
- `<Stamp>`: mono, uppercase, hairline. `statusTone()` — ok (green) / yellow (blue tint) / bad (crimson) / warn (amber).
- Record create/edit: paper `FormPanel` in `components/ui.tsx`. Delete: sharp overlay (`ConfirmDialog`). New/Edit/Delete buttons: `RecordActions`.

---

## Copy

Board, Approvals, Sites, Materials, Inventory, Equipment, Yards, Tenders, Licenses, Ledger. Buttons: **Queue for approval**, **Approve and post**, **Post**. Short. Field language.

---

## Quality bar

No page-level horizontal scroll at 390px. Tables may swipe inside `.table-wrap`. Verify: open the drawer, Board, a site, a material, Ledger, an approval.
