# Design guide

Visual language for this ops desk. Tokens live in `app/globals.css`. Do not hardcode hex in components.

This is a dense internal console: tables, stamps, copper actions. No GSAP. No Lenis. No CAD drawings. Do not restyle it into a SaaS dashboard.

---

## Tokens

`--yellow` is the **accent token** (copper). UI reads `var(--yellow)`, `var(--black)`, `var(--ink)`, `var(--paper)`, `var(--white)`.

```css
:root {
  --white: #f4efe8;
  --paper: #eadcc8;
  --yellow: #e08a3c;
  --black: #1c1410;
  --ink: #2c221c;
  --raised: #322820;
  --grey-750: #4d4038;
  --grey-700: #6a5a50;
  --grey-550: #8c7b6e;
  --grey-350: #d2c4b6;
  --grey-150: #ebe3d9;
  --line: color-mix(in hsl, var(--ink) 16%, transparent);
  --ok: #3d6b4f;
  --warn: #9a5b1f;
  --bad: #8a3a32;
}
```

`@theme inline` bridges these into Tailwind. `--font-sans` is Instrument Sans. `--font-mono` is IBM Plex Mono.

**Rules**

- Page: `--white`. Sidebar: `--black`.
- Selection: accent fill, `--ink` text.
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

- Sidebar: copper “Ops desk” kicker. Active nav = copper fill / black type. Pending count in mono.
- Hamburger: `h-11 w-11` square black. Close on route change. Lock body scroll while open.
- Pending badge in the mobile header → `/approvals`.
- `.btn` copper fill, black border, hover inverts to black fill / white type. `.btn-ghost` and `.btn-ink` as in `globals.css`. `.btn-bad` for confirm-delete.
- `.field` full width, 1px line, copper focus ring (`outline: 2px solid var(--yellow)`).
- `<Stamp>`: mono, uppercase, hairline. `statusTone()` — ok / yellow / bad / warn.
- Record create/edit: paper `FormPanel` in `components/ui.tsx`. Delete: sharp overlay (`ConfirmDialog`). New/Edit/Delete buttons: `RecordActions`.

---

## Copy

Board, Approvals, Sites, Materials, Inventory, Equipment, Yards, Tenders, Licenses, Ledger. Buttons: **Queue for approval**, **Approve and post**, **Post**. Short. Field language.

---

## Quality bar

No page-level horizontal scroll at 390px. Tables may swipe inside `.table-wrap`. Verify: open the drawer, Board, a site, a material, Ledger, an approval.
