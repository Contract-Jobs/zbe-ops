"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RANGE_PRESETS, describeRange, detectPreset, presetRange, type RangePreset } from "@/lib/date-range";

type Choice = RangePreset | "custom";
const CHOICES: { id: Choice; label: string }[] = [...RANGE_PRESETS, { id: "custom", label: "Custom" }];

// A date range as presets (All, Today, This week, This month, This year) plus
// Custom. It reads and writes plain YYYY-MM-DD strings, so whatever holds
// `from` / `to` keeps working unchanged. The active chip is worked out from the
// dates, never stored.
//
// The control is always one fixed-height row, so a filter bar never reflows:
// the range is spelled out in the chip's tooltip (and on the Custom chip itself),
// and the From / To inputs float in a panel under the row instead of pushing
// the layout down.
export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
  disabled,
  className = "",
}: {
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [pickedCustom, setPickedCustom] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Dates going from set to empty from outside (a "Clear" button) drops Custom.
  const hasDates = Boolean(from || to);
  const [hadDates, setHadDates] = useState(hasDates);
  if (hasDates !== hadDates) {
    setHadDates(hasDates);
    if (!hasDates) setPickedCustom(false);
  }

  // On a Monday "This week" is the same range as "Today" (and on 1 January,
  // "This month" and "This year" are): keep the chip that was actually clicked
  // while its dates still match.
  const [pickedPreset, setPickedPreset] = useState<RangePreset | null>(null);
  const detected = detectPreset(from, to);
  const pickedRange = pickedPreset ? presetRange(pickedPreset) : null;
  const pickedStillApplies = !!pickedRange && pickedRange.from === from && pickedRange.to === to;
  const active: Choice = pickedCustom || detected === "custom" ? "custom" : pickedStillApplies ? pickedPreset! : detected;

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setPos(null);
    setError(null);
  }, []);

  function choose(id: Choice) {
    setError(null);
    if (id === "custom") {
      setPickedCustom(true);
      setPanelOpen(true);
      return;
    }
    setPickedCustom(false);
    setPickedPreset(id);
    closePanel();
    const range = presetRange(id);
    onChange(range.from, range.to);
  }

  // Place the panel under the chip row, left-aligned; flip above when it would
  // run off the bottom and keep it inside the viewport sideways.
  useLayoutEffect(() => {
    if (!panelOpen) return;
    const group = groupRef.current;
    const panel = panelRef.current;
    if (!group || !panel) return;
    const g = group.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(g.left, window.innerWidth - width - margin));
    let top = g.bottom + 4;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, g.top - height - 4);
    setPos({ top, left });
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || groupRef.current?.contains(t)) return;
      closePanel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closePanel();
        refs.current.custom?.focus();
      }
    };
    // A panel anchored to a row that scrolls away would float in the wrong place.
    const onMove = () => closePanel();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [panelOpen, closePanel]);

  // Put the cursor in the first input once the panel is placed.
  useEffect(() => {
    if (panelOpen && pos) panelRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, pos !== null]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = CHOICES[(index + step + CHOICES.length) % CHOICES.length];
    if (!next) return;
    refs.current[next.id]?.focus();
    // Arrowing across the chips picks presets; Custom is opened on purpose.
    if (next.id !== "custom") choose(next.id);
  }

  function setDate(which: "from" | "to", value: string) {
    const nextFrom = which === "from" ? value : from;
    const nextTo = which === "to" ? value : to;
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setError(which === "from" ? "“From” can't be after “To”." : "“To” can't be before “From”.");
      return;
    }
    setError(null);
    onChange(nextFrom, nextTo);
  }

  const range = describeRange(from, to);

  return (
    <div className={`w-full sm:w-auto ${className}`}>
      <p className="text-sm">{label}</p>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={label}
        className="mt-1 flex max-w-full overflow-x-auto border border-black/20"
      >
        {CHOICES.map((c, i) => {
          const on = c.id === active;
          // The Custom chip carries its own dates, so nothing else is needed
          // to say what range is applied.
          const text = c.id === "custom" && on && hasDates ? range : c.label;
          return (
            <button
              key={c.id}
              ref={(el) => {
                refs.current[c.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-haspopup={c.id === "custom" ? "dialog" : undefined}
              aria-expanded={c.id === "custom" ? panelOpen : undefined}
              tabIndex={on ? 0 : -1}
              disabled={disabled}
              title={on && c.id !== "all" ? range : undefined}
              onClick={() => choose(c.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`shrink-0 whitespace-nowrap border-r border-black/20 px-3 py-2 text-sm last:border-r-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--yellow)] ${
                on ? "bg-black text-white" : "bg-white text-black hover:bg-black/5"
              } disabled:opacity-40`}
            >
              {text}
            </button>
          );
        })}
      </div>

      {panelOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              data-floating-panel
              aria-label={`${label}: custom range`}
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
              className="fixed z-[70] w-[min(20rem,calc(100vw-1rem))] border border-black bg-white p-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-black/60">
                  From
                  <input
                    className="field mt-1"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setDate("from", e.target.value)}
                  />
                </label>
                <label className="block text-xs text-black/60">
                  To
                  <input
                    className="field mt-1"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setDate("to", e.target.value)}
                  />
                </label>
              </div>
              {error ? (
                <p role="alert" className="mt-2 text-xs text-bad">
                  {error}
                </p>
              ) : null}
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn" onClick={closePanel}>
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
