"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoHorizontal, BridgeMark } from "./Logo";
import { nav, site } from "@/lib/site";

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // scroll lock + focus management while the menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    window.dispatchEvent(new CustomEvent("tw:scroll-lock", { detail: open }));
    if (open) {
      firstLinkRef.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[var(--z-header)] transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled && !open
            ? "border-b border-line-soft bg-bg/80 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="container-tw flex h-[4.5rem] items-center justify-between md:h-20">
          <Link
            href="/"
            aria-label="Thomond Works — home"
            className="group relative z-[var(--z-menu)] transition-opacity hover:opacity-80"
          >
            <LogoHorizontal />
          </Link>

          {/* desktop nav */}
          <nav aria-label="Primary" className="hidden items-center gap-9 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                className={`link-line text-[0.72rem] font-medium tracking-[0.2em] uppercase transition-colors ${
                  isCurrent(item.href) ? "text-bone" : "text-muted hover:text-bone"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className="btn btn--ghost !px-5 !py-3 text-[0.66rem]"
              data-magnetic
            >
              Start a Project
            </Link>
          </nav>

          {/* mobile toggle */}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="tw-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="relative z-[var(--z-menu)] -mr-2 grid h-11 w-11 cursor-pointer place-items-center md:hidden"
          >
            <span className="relative block h-[10px] w-6">
              <span
                className={`absolute left-0 top-0 h-px w-full bg-bone transition-transform duration-300 ${
                  open ? "translate-y-[5px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 h-px w-full bg-bone transition-transform duration-300 ${
                  open ? "-translate-y-[4px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      {/* mobile menu */}
      <div
        id="tw-mobile-menu"
        aria-hidden={!open}
        className={`fixed inset-0 z-[calc(var(--z-menu)-1)] flex flex-col justify-between bg-surface pb-10 pt-28 transition-[clip-path] duration-700 md:hidden ${
          open
            ? "[clip-path:inset(0_0_0%_0)]"
            : "pointer-events-none [clip-path:inset(0_0_100%_0)]"
        }`}
        style={{ transitionTimingFunction: "var(--ease-premium)" }}
      >
        <nav aria-label="Mobile" className="container-tw">
          <ul>
            {nav.map((item, i) => (
              <li
                key={item.href}
                className="border-b border-line-soft"
                style={{
                  transition: `opacity .5s var(--ease-smooth) ${0.15 + i * 0.06}s, transform .5s var(--ease-smooth) ${0.15 + i * 0.06}s`,
                  opacity: open ? 1 : 0,
                  transform: open ? "none" : "translateY(22px)",
                }}
              >
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                  className="group flex items-baseline justify-between py-4"
                >
                  <span className="font-serif text-[2.1rem] leading-none text-bone">
                    {item.label}
                  </span>
                  <span className="label label--bronze">
                    {isCurrent(item.href) ? "● Here" : `0${i + 1}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className="container-tw flex items-end justify-between"
          style={{
            transition: "opacity .5s var(--ease-smooth) .5s",
            opacity: open ? 1 : 0,
          }}
        >
          <div className="space-y-2">
            <p className="label">{site.location}</p>
            <a
              href={`mailto:${site.email}`}
              tabIndex={open ? 0 : -1}
              className="link-line text-sm text-bone"
            >
              {site.email}
            </a>
            <div className="flex gap-5 pt-2">
              <a
                href={site.social.instagram}
                tabIndex={open ? 0 : -1}
                className="label transition-colors hover:text-bone"
                rel="noopener noreferrer"
                target="_blank"
              >
                Instagram
              </a>
              <a
                href={site.social.linkedin}
                tabIndex={open ? 0 : -1}
                className="label transition-colors hover:text-bone"
                rel="noopener noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
            </div>
          </div>
          <BridgeMark className="h-12 w-auto opacity-60" />
        </div>
      </div>
    </>
  );
}
