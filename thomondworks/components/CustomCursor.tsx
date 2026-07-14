"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Desktop-only cursor: a small dot that grows on interactive elements
 * and shows a label ("View", "Drag") over elements with data-cursor.
 * Hidden via CSS on coarse pointers; skipped for reduced motion.
 */
export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
    let shown = false;

    const onMove = (e: MouseEvent) => {
      if (!shown) {
        gsap.set(el, { x: e.clientX, y: e.clientY });
        gsap.to(el, { opacity: 1, duration: 0.3 });
        shown = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const labelled = t?.closest<HTMLElement>("[data-cursor]");
      const interactive = t?.closest("a, button, [role='button'], input, select, textarea, label");
      if (labelled) {
        if (labelRef.current) labelRef.current.textContent = labelled.dataset.cursor ?? "";
        el.classList.add("is-label");
        gsap.to(el, { width: 68, height: 68, duration: 0.35, ease: "power3.out" });
      } else {
        el.classList.remove("is-label");
        gsap.to(el, {
          width: interactive ? 28 : 12,
          height: interactive ? 28 : 12,
          duration: 0.3,
          ease: "power3.out",
        });
      }
    };

    const onLeave = () => {
      gsap.to(el, { opacity: 0, duration: 0.3 });
      shown = false;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="tw-cursor -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
      <span ref={labelRef} />
    </div>
  );
}
