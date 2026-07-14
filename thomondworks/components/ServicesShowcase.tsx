"use client";

import Link from "next/link";
import { useState } from "react";
import { services, type Service } from "@/lib/services";

/** Abstract line drawings, one per discipline. Brand system only. */
function ServiceVisual({ visual }: { visual: Service["visual"] }) {
  switch (visual) {
    case "arches":
      return (
        <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${70 + i * 30} 240 v-${90 - i * 12} a${60 - i * 12} ${60 - i * 12} 0 0 1 ${(60 - i * 12) * 2} 0 v${90 - i * 12}`}
              fill="none"
              stroke={i === 1 ? "var(--color-emerald)" : "var(--color-bronze)"}
              strokeWidth="2"
              opacity={1 - i * 0.28}
            />
          ))}
          <line x1="40" y1="242" x2="360" y2="242" stroke="var(--color-bone)" strokeWidth="1.5" opacity="0.4" />
          <line x1="40" y1="60" x2="360" y2="60" stroke="var(--color-bone)" strokeWidth="1.5" opacity="0.25" />
        </svg>
      );
    case "mark":
      return (
        <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
          <circle cx="200" cy="150" r="95" fill="none" stroke="var(--color-bronze)" strokeWidth="2" opacity="0.8" />
          <circle cx="200" cy="150" r="60" fill="none" stroke="var(--color-bone)" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 7" />
          <path d="M150 185 v-40 a50 50 0 0 1 100 0 v40" fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" />
          <line x1="140" y1="112" x2="260" y2="112" stroke="var(--color-bronze)" strokeWidth="2" />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
          {[80, 160, 240, 320].map((x) => (
            <line key={x} x1={x} y1="50" x2={x} y2="250" stroke="var(--color-bone)" strokeWidth="1" opacity="0.2" />
          ))}
          {[90, 150, 210].map((y) => (
            <line key={y} x1="50" y1={y} x2="350" y2={y} stroke="var(--color-bone)" strokeWidth="1" opacity="0.2" />
          ))}
          <path d="M80 210 L160 150 L240 176 L320 90" fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" />
          {[
            [80, 210],
            [160, 150],
            [240, 176],
            [320, 90],
          ].map(([cx, cy]) => (
            <circle key={`${cx}`} cx={cx} cy={cy} r="5" fill="var(--color-bg)" stroke="var(--color-bronze)" strokeWidth="2" />
          ))}
        </svg>
      );
    case "pulse":
      return (
        <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
          <path
            d="M40 150 h80 l22 -52 l34 104 l24 -52 h160"
            fill="none"
            stroke="var(--color-emerald)"
            strokeWidth="2.5"
          />
          <line x1="40" y1="220" x2="360" y2="220" stroke="var(--color-bronze)" strokeWidth="1.5" opacity="0.6" />
          <line x1="40" y1="80" x2="360" y2="80" stroke="var(--color-bone)" strokeWidth="1" opacity="0.2" strokeDasharray="3 8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
          <path d="M130 250 v-90 a70 70 0 0 1 140 0 v90" fill="none" stroke="var(--color-bronze)" strokeWidth="2.5" />
          {/* keystone */}
          <path d="M188 92 l12 -14 l12 14 l-4 22 h-16 z" fill="none" stroke="var(--color-emerald)" strokeWidth="2" />
          <line x1="90" y1="252" x2="310" y2="252" stroke="var(--color-bone)" strokeWidth="1.5" opacity="0.4" />
        </svg>
      );
  }
}

/**
 * Service rows with a changing structural drawing alongside.
 * Hover or keyboard focus swaps the panel; on mobile the panel hides
 * and rows stand alone.
 */
export default function ServicesShowcase() {
  const [active, setActive] = useState(0);

  return (
    <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
      <ul>
        {services.map((s, i) => (
          <li key={s.id} className="border-t border-line-soft last:border-b">
            <Link
              href={`/services#${s.id}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className={`group grid grid-cols-[3rem_1fr] items-baseline gap-4 py-7 transition-colors duration-300 md:grid-cols-[4rem_1fr_auto] md:py-9 ${
                active === i ? "text-bone" : "text-muted"
              }`}
            >
              <span
                className={`label transition-colors duration-300 ${
                  active === i ? "label--emerald" : ""
                }`}
                aria-hidden
              >
                {s.index}
              </span>
              <span>
                <span className="block font-serif text-[clamp(1.4rem,2.6vw,2.1rem)] leading-tight transition-transform duration-500 [transition-timing-function:var(--ease-smooth)] group-hover:translate-x-2">
                  {s.title}
                </span>
                <span className="mt-2 block max-w-[52ch] text-sm leading-relaxed text-muted">
                  {s.description}
                </span>
              </span>
              <span
                className={`hidden text-bronze transition-all duration-300 md:block ${
                  active === i ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
                }`}
                aria-hidden
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="relative hidden lg:block" aria-hidden="true">
        <div className="sticky top-32 aspect-[4/3] border border-line-soft bg-surface">
          {services.map((s, i) => (
            <div
              key={s.id}
              className="absolute inset-0 p-8 transition-opacity duration-500"
              style={{ opacity: active === i ? 1 : 0 }}
            >
              <ServiceVisual visual={s.visual} />
            </div>
          ))}
          <p className="label label--bronze absolute bottom-5 left-6">
            {services[active].index} — {services[active].title}
          </p>
        </div>
      </div>
    </div>
  );
}
