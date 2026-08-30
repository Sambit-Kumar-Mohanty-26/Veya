"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Fixed height, not a proportional thumb; the width matches the panel gap. */
const H = 71;

/**
 * The design replaces the scrollbar with a pill that floats *over* the content
 * at a fixed height - a native thumb can do neither, since it always reserves a
 * gutter and always stretches to the content ratio. So the native bar is hidden
 * (see `.thin-scroll` in globals.css) and this rides on top of it instead.
 *
 * Position is written straight to the node rather than held in state: a scroll
 * handler that re-renders the list on every frame is the one way to make this
 * feel worse than the bar it replaces.
 */
export function ScrollPill({
  target,
  className = "right-1.5"
}: {
  target: RefObject<HTMLElement | null>;
  /** Horizontal placement only — the vertical offset measures itself. */
  className?: string;
}) {
  const pill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = target.current;
    const knob = pill.current;
    if (!el || !knob) return;

    const sync = () => {
      const range = el.scrollHeight - el.clientHeight;
      const travel = el.clientHeight - H;
      // The pill's containing block is not always the scroller - at the panel
      // seam it is a grandparent that also holds a header - so the scroller's
      // own top is measured rather than assumed to be zero.
      const parent = knob.offsetParent;
      const top = parent ? el.getBoundingClientRect().top - parent.getBoundingClientRect().top : 0;
      knob.style.opacity = range > 1 && travel > 0 ? "1" : "0";
      knob.style.transform = `translateY(${top + (range > 1 ? (el.scrollTop / range) * travel : 0)}px)`;
    };

    let grabbedAt = 0;
    let scrolledTo = 0;
    const move = (e: PointerEvent) => {
      const range = el.scrollHeight - el.clientHeight;
      el.scrollTop = scrolledTo + ((e.clientY - grabbedAt) / (el.clientHeight - H)) * range;
    };
    const release = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
    };
    const grab = (e: PointerEvent) => {
      e.preventDefault();
      grabbedAt = e.clientY;
      scrolledTo = el.scrollTop;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", release);
    };

    // The children are observed as well as the box: the scroller's own size
    // never changes when a row expands or another page finishes rasterising,
    // but the content's does, and that is what decides whether the pill shows.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);

    knob.addEventListener("pointerdown", grab);
    el.addEventListener("scroll", sync, { passive: true });
    sync();

    return () => {
      knob.removeEventListener("pointerdown", grab);
      el.removeEventListener("scroll", sync);
      ro.disconnect();
      release();
    };
  }, [target]);

  return (
    <div
      ref={pill}
      aria-hidden="true"
      // Desktop only: a touch device scrolls by dragging the content itself, so
      // the pill would just cover it. Hiding the element leaves scrolling alone.
      className={`absolute top-0 z-10 hidden h-[71px] w-3 cursor-grab rounded-[48px] bg-white/80 opacity-0 shadow-[0_4px_22.5px_rgba(0,0,0,0.25)] backdrop-blur-md transition-opacity active:cursor-grabbing md:block ${className}`}
    />
  );
}
