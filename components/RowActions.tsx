"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface RowActionItem {
  label: ReactNode;
  onClick?: () => void;
  // Renders a link instead of a button.
  href?: string;
  tone?: "default" | "bad";
  disabled?: boolean;
  hidden?: boolean;
  // Hairline above this item — use before a destructive one.
  separatorBefore?: boolean;
}

// Table row actions collapsed into one menu. The panel is portalled to <body>
// and fixed-positioned from the trigger: `.table-wrap` is `overflow-x: auto`,
// which would clip (or scroll inside) an absolutely positioned panel.
export function RowActions({
  items,
  primary,
  label = "Actions",
  ariaLabel,
}: {
  items: RowActionItem[];
  // One action kept visible next to the menu — the one used most.
  primary?: { label: ReactNode; onClick: () => void; disabled?: boolean } | null;
  label?: string;
  ariaLabel?: string;
}) {
  const visible = items.filter((item) => !item.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Place under the trigger, right-aligned to it; flip above if it would run
  // off the bottom; keep inside the viewport horizontally.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const t = trigger.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const margin = 8;
    let left = t.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    let top = t.bottom + 4;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, t.top - height - 4);
    setPos({ top, left, minWidth: t.width });
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close(true);
      }
    };
    // A menu anchored to a row that scrolls away would float in the wrong place.
    const onMove = () => close(false);
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
  }, [open, close]);

  // Focus the first enabled item once the panel is placed.
  useEffect(() => {
    if (open && pos) panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos !== null]);

  if (visible.length === 0 && !primary) return null;

  const onPanelKey = (e: React.KeyboardEvent) => {
    const nodes = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => nodes[(i + nodes.length) % nodes.length]?.focus();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusAt(index + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(nodes.length - 1);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const itemClass = (item: RowActionItem) =>
    `block w-full px-4 py-2.5 text-left text-sm sm:py-2 ${
      item.disabled
        ? "cursor-not-allowed opacity-40"
        : item.tone === "bad"
          ? "text-bad hover:bg-bad hover:text-white focus-visible:bg-bad focus-visible:text-white"
          : "hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white"
    } outline-none`;

  return (
    // Stops a click on the actions from also opening the row's own handler.
    <span className="inline-flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {primary ? (
        <button
          type="button"
          className="text-xs text-blue-600/80 hover:text-black hover:underline"
          disabled={primary.disabled}
          onClick={primary.onClick}
        >
          {primary.label}
        </button>
      ) : null}
      {visible.length > 0 ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={ariaLabel}
            onClick={() => (open ? close(false) : setOpen(true))}
          >
            {label}
            <span aria-hidden className="text-[0.6rem]">
              ▾
            </span>
          </button>
          {open && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={panelRef}
                  id={menuId}
                  role="menu"
                  onKeyDown={onPanelKey}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    top: pos?.top ?? 0,
                    left: pos?.left ?? 0,
                    minWidth: Math.max(pos?.minWidth ?? 0, 160),
                    visibility: pos ? "visible" : "hidden",
                  }}
                  className="fixed z-[70] border border-black bg-white"
                >
                  {visible.map((item, i) => (
                    <div key={i} className={item.separatorBefore && i > 0 ? "border-t border-black/15" : undefined}>
                      {item.href && !item.disabled ? (
                        <Link href={item.href} role="menuitem" className={itemClass(item)} onClick={() => close(false)}>
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          aria-disabled={item.disabled || undefined}
                          className={itemClass(item)}
                          onClick={() => {
                            if (item.disabled) return;
                            close(false);
                            item.onClick?.();
                          }}
                        >
                          {item.label}
                        </button>
                      )}
                    </div>
                  ))}
                </div>,
                document.body,
              )
            : null}
        </>
      ) : null}
    </span>
  );
}
