"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { BridgeMark } from "./Logo";

/**
 * Cinematic first-visit intro: the Thomond mark assembles like an
 * architectural drawing, the wordmark reveals, then the overlay lifts
 * into the page. Runs once per session; skippable; honours
 * prefers-reduced-motion (gated by the inline script in layout.tsx,
 * which sets data-intro="done" so this never renders at all).
 */
export default function IntroLoader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const doc = document.documentElement;
    const root = rootRef.current;
    // already seen / reduced motion — CSS keeps the overlay hidden
    if (doc.dataset.intro !== "pending" || !root) return;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      doc.dataset.intro = "done";
      try {
        sessionStorage.setItem("tw-intro", "1");
      } catch {
        /* private mode */
      }
      window.dispatchEvent(new Event("tw:intro:done"));
      root.style.display = "none";
    };

    const q = gsap.utils.selector(root);
    const structure = q<SVGPathElement>(
      ".bm-deck1, .bm-deck2, .bm-pier-l, .bm-pier-r, .bm-arch-l, .bm-arch-r, .bm-base"
    );
    const stem = q<SVGPathElement>(".bm-stem");
    const water = q<SVGPathElement>(".bm-water");
    const prep = (paths: SVGPathElement[]) =>
      paths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
    prep(structure);
    prep(stem);

    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        gsap.to(root, {
          yPercent: -100,
          duration: 0.85,
          ease: "power4.inOut",
          onComplete: finish,
        });
      },
    });
    tlRef.current = tl;

    tl
      // 1 — a bronze line draws itself across the dark
      .fromTo(q(".ti-rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.65 })
      // 2 — deck + arches draw like a technical elevation
      .to(q(".bm-deck1, .bm-deck2"), { strokeDashoffset: 0, duration: 0.55 }, "-=0.15")
      .to(q(".bm-arch-l, .bm-arch-r"), { strokeDashoffset: 0, duration: 0.7 }, "-=0.25")
      .to(q(".bm-pier-l, .bm-pier-r"), { strokeDashoffset: 0, duration: 0.45 }, "-=0.4")
      // 3 — the central pier drops into place
      .to(stem, { strokeDashoffset: 0, duration: 0.4, ease: "power2.in" }, "-=0.2")
      .to(q(".bm-base"), { strokeDashoffset: 0, duration: 0.5 }, "-=0.1")
      // 4 — the Shannon settles beneath
      .fromTo(
        water,
        { autoAlpha: 0, x: -14 },
        { autoAlpha: 1, x: 0, duration: 0.7, ease: "power2.out", stagger: 0.12 },
        "-=0.2"
      )
      // 5 — wordmark, letter by letter through a mask
      .fromTo(
        q(".ti-char"),
        { yPercent: 115 },
        { yPercent: 0, duration: 0.6, ease: "power4.out", stagger: 0.035 },
        "-=0.35"
      )
      .fromTo(
        q(".ti-works"),
        { autoAlpha: 0, letterSpacing: "0.9em" },
        { autoAlpha: 1, letterSpacing: "0.6em", duration: 0.6, ease: "power3.out" },
        "-=0.25"
      )
      // 6 — tagline
      .fromTo(
        q(".ti-tag"),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
        "-=0.1"
      )
      .to({}, { duration: 0.45 }); // hold

    // failsafe: never trap the visitor behind the overlay
    const failsafe = window.setTimeout(finish, 8000);
    return () => {
      window.clearTimeout(failsafe);
      tl.kill();
    };
  }, []);

  return (
    <div
      id="tw-intro"
      ref={rootRef}
      className="fixed inset-0 z-[var(--z-intro)] flex flex-col items-center justify-center bg-bg"
      aria-hidden="true"
    >
      <div className="ti-rule mb-10 h-px w-[min(20rem,60vw)] origin-left bg-bronze" />
      <BridgeMark className="h-24 w-auto sm:h-28" />
      <p className="mt-8 flex overflow-clip font-serif text-[clamp(2rem,6vw,3.2rem)] leading-none tracking-[0.16em] text-bone">
        {"THOMOND".split("").map((c, i) => (
          <span key={i} className="ti-char inline-block">
            {c}
          </span>
        ))}
      </p>
      <p className="ti-works mt-4 text-[0.8rem] font-semibold tracking-[0.6em] text-emerald-bright">
        WORKS
      </p>
      <p className="ti-tag label mt-10 text-center leading-relaxed">
        Built in Limerick.
        <br />
        Made for everywhere.
      </p>
      <button
        type="button"
        onClick={() => tlRef.current?.progress(1)}
        className="label absolute bottom-8 right-8 cursor-pointer p-2 transition-colors hover:text-bone"
        aria-hidden="true"
        tabIndex={-1}
      >
        Skip
      </button>
    </div>
  );
}
