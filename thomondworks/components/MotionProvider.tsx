"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/* ----------------------------------------------------------------
   Text splitting — a small, dependency-free SplitText equivalent.
   Works on flat markup (text, <br>, inline accent spans).
   ---------------------------------------------------------------- */

function splitIntoLines(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone) {
    return Array.from(el.querySelectorAll<HTMLElement>(".tw-line-inner"));
  }
  const original = el.textContent ?? "";
  const words: HTMLElement[] = [];

  const wrapNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      (node.textContent ?? "").split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
        } else {
          const s = document.createElement("span");
          s.style.display = "inline-block";
          s.textContent = part;
          words.push(s);
          frag.appendChild(s);
        }
      });
      node.parentNode?.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elNode = node as HTMLElement;
      if (elNode.tagName === "BR") return;
      // treat styled inline accents as atomic words
      elNode.style.display = "inline-block";
      words.push(elNode);
    }
  };

  Array.from(el.childNodes).forEach(wrapNode);

  // group words into visual lines by measured offset
  const lines: HTMLElement[][] = [];
  let top: number | null = null;
  words.forEach((w) => {
    if (w.offsetTop !== top) {
      lines.push([]);
      top = w.offsetTop;
    }
    lines[lines.length - 1].push(w);
  });

  const frag = document.createDocumentFragment();
  const inners: HTMLElement[] = [];
  lines.forEach((lineWords) => {
    const line = document.createElement("span");
    line.className = "tw-line";
    const inner = document.createElement("span");
    inner.className = "tw-line-inner";
    lineWords.forEach((w, i) => {
      inner.appendChild(w);
      if (i < lineWords.length - 1) inner.appendChild(document.createTextNode(" "));
    });
    line.appendChild(inner);
    frag.appendChild(line);
    inners.push(inner);
  });

  el.textContent = "";
  el.appendChild(frag);
  el.setAttribute("aria-label", original.replace(/\s+/g, " ").trim());
  frag.childNodes.forEach(() => {});
  el.querySelectorAll(".tw-line").forEach((l) => l.setAttribute("aria-hidden", "true"));
  el.dataset.splitDone = "true";
  return inners;
}

/* ----------------------------------------------------------------
   Scroll-linked animation wiring, driven by data attributes.
   ---------------------------------------------------------------- */

function initAnimations() {
  const qsa = <T extends Element = HTMLElement>(sel: string) =>
    Array.from(document.querySelectorAll<T>(sel));

  // masked line reveals
  qsa("[data-split]").forEach((el) => {
    const inners = splitIntoLines(el as HTMLElement);
    if (!inners.length) return;

    if ((el as HTMLElement).dataset.splitEffect === "color") {
      // editorial statement: lines resolve from muted to bone as they pass
      inners.forEach((inner) => {
        gsap.fromTo(
          inner,
          { color: "rgb(133 137 134 / 0.35)" },
          {
            color: "#f2f0ed",
            ease: "none",
            scrollTrigger: {
              trigger: inner,
              start: "top 85%",
              end: "top 45%",
              scrub: 0.4,
            },
          }
        );
      });
      return;
    }

    gsap.fromTo(
      inners,
      { yPercent: 112 },
      {
        yPercent: 0,
        duration: 1,
        ease: "power4.out",
        stagger: 0.085,
        delay: parseFloat((el as HTMLElement).dataset.splitDelay ?? "0"),
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
  });

  // fade / slide reveals
  qsa("[data-reveal]").forEach((el) => {
    const dir = (el as HTMLElement).dataset.reveal;
    const from: gsap.TweenVars =
      dir === "left" ? { x: -44 } : dir === "right" ? { x: 44 } : dir === "fade" ? {} : { y: 34 };
    gsap.fromTo(
      el,
      { autoAlpha: 0, ...from },
      {
        autoAlpha: 1,
        x: 0,
        y: 0,
        duration: 1.05,
        ease: "power3.out",
        delay: parseFloat((el as HTMLElement).dataset.revealDelay ?? "0"),
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
      }
    );
  });

  // staggered groups
  qsa("[data-reveal-group]").forEach((group) => {
    const children = Array.from(group.children);
    if (!children.length) return;
    gsap.fromTo(
      children,
      { autoAlpha: 0, y: 30 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.09,
        scrollTrigger: { trigger: group, start: "top 88%", once: true },
      }
    );
  });

  // parallax layers (subtle; elements are pre-scaled in CSS to avoid gaps)
  qsa("[data-parallax]").forEach((el) => {
    const amount = parseFloat((el as HTMLElement).dataset.parallax ?? "0.12");
    gsap.fromTo(
      el,
      { yPercent: -amount * 100 },
      {
        yPercent: amount * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement ?? el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      }
    );
  });

  // clip + scale image reveals
  qsa("[data-img-reveal]").forEach((el) => {
    const img = el.querySelector("img");
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
    tl.fromTo(
      el,
      { clipPath: "inset(0 0 100% 0)" },
      { clipPath: "inset(0 0 0% 0)", duration: 1.25, ease: "power4.inOut" }
    );
    if (img) {
      tl.fromTo(img, { scale: 1.22 }, { scale: 1, duration: 1.6, ease: "power3.out" }, 0.1);
    }
  });

  // SVG line drawing
  qsa<SVGPathElement>("[data-draw] path, path[data-draw-path]").forEach((path) => {
    const host = path.closest<HTMLElement>("[data-draw]");
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    if (host?.dataset.draw === "scrub") {
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: host,
          start: "top 75%",
          end: "bottom 55%",
          scrub: 0.5,
        },
      });
    } else {
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1.7,
        ease: "power2.inOut",
        scrollTrigger: { trigger: host ?? path, start: "top 82%", once: true },
      });
    }
  });

  // hero settle: headline compresses gently as the next section overlaps
  qsa("[data-hero-settle]").forEach((el) => {
    gsap.to(el, {
      scale: 0.94,
      autoAlpha: 0.25,
      transformOrigin: "50% 100%",
      ease: "none",
      scrollTrigger: {
        trigger: el.closest("section") ?? el,
        start: "top top",
        end: "bottom 25%",
        scrub: 0.5,
      },
    });
  });

  // magnetic buttons (fine pointers only)
  if (window.matchMedia("(pointer: fine)").matches) {
    qsa("[data-magnetic]").forEach((el) => {
      const strength = 0.28;
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const onMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * strength);
        yTo((e.clientY - r.top - r.height / 2) * strength);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener("mousemove", onMove as EventListener);
      el.addEventListener("mouseleave", onLeave);
    });
  }
}

/* ----------------------------------------------------------------
   Provider — Lenis smooth scroll + per-route animation lifecycle.
   ---------------------------------------------------------------- */

export default function MotionProvider() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  // smooth scrolling (skipped for reduced motion; natural on touch)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.115, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    if (document.documentElement.dataset.intro === "pending") lenis.stop();
    const onIntroDone = () => lenis.start();
    const onLock = (e: Event) =>
      (e as CustomEvent<boolean>).detail ? lenis.stop() : lenis.start();
    window.addEventListener("tw:intro:done", onIntroDone);
    window.addEventListener("tw:scroll-lock", onLock);

    return () => {
      window.removeEventListener("tw:intro:done", onIntroDone);
      window.removeEventListener("tw:scroll-lock", onLock);
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // per-route animation setup + teardown
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      ctx = gsap.context(initAnimations);
      ScrollTrigger.refresh();
    };

    lenisRef.current?.scrollTo(0, { immediate: true });

    // wait for webfonts so line-splitting measures final layout
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      if (cancelled) return;
      if (document.documentElement.dataset.intro === "pending") {
        window.addEventListener("tw:intro:done", start, { once: true });
      } else {
        start();
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("tw:intro:done", start);
      ctx?.revert();
    };
  }, [pathname]);

  return null;
}
