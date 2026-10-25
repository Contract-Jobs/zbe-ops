// Date-range presets for the filter bars. Everything is the device's local
// date as YYYY-MM-DD (what a date input holds and what the API takes), so
// "today" flips at the user's midnight. Weeks start on Monday, and "this week /
// month / year" run from the start of the period up to today.

export type RangePreset = "all" | "today" | "week" | "month" | "year";

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function presetRange(preset: RangePreset, now: Date = new Date()): { from: string; to: string } {
  if (preset === "all") return { from: "", to: "" };
  const to = toISODate(now);
  if (preset === "today") return { from: to, to };
  if (preset === "week") {
    const sinceMonday = (now.getDay() + 6) % 7; // Monday = 0 … Sunday = 6
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);
    return { from: toISODate(start), to };
  }
  if (preset === "month") return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to };
}

// Which preset the current dates are, or "custom". Nothing is stored: the
// active chip is always worked out from the dates themselves.
export function detectPreset(from: string, to: string, now: Date = new Date()): RangePreset | "custom" {
  if (!from && !to) return "all";
  for (const { id } of RANGE_PRESETS) {
    if (id === "all") continue;
    const r = presetRange(id, now);
    if (r.from === from && r.to === to) return id;
  }
  return "custom";
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function parse(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// "1 Oct – 25 Oct 2026", "25 Oct 2026", "From 1 Oct 2026", "Up to 25 Oct 2026".
export function describeRange(from: string, to: string): string {
  const a = from ? parse(from) : null;
  const b = to ? parse(to) : null;
  if (a && b) {
    if (from === to) return dayYearFmt.format(a);
    const sameYear = a.getFullYear() === b.getFullYear();
    return `${(sameYear ? dayFmt : dayYearFmt).format(a)} – ${dayYearFmt.format(b)}`;
  }
  if (a) return `From ${dayYearFmt.format(a)}`;
  if (b) return `Up to ${dayYearFmt.format(b)}`;
  return "Any date";
}
