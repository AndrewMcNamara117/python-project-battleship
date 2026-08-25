'use client';

import { useReducedMotion } from 'motion/react';

/**
 * Velocity marquee — an Iron Miles signature carried over from the main site.
 * Under reduced motion it becomes a single static line of the same words.
 */
export function Marquee({ words, className }: { words: string[]; className?: string }) {
  const reduced = useReducedMotion();
  const line = words.join('  ·  ');

  if (reduced) {
    return (
      <div className={`overflow-hidden border-y border-line py-5 ${className ?? ''}`}>
        <p className="im-display px-5 text-center text-[clamp(1.4rem,3vw,2.2rem)] text-muted-2">
          {line}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden border-y border-line py-5 ${className ?? ''}`}
      aria-label={line}
      role="img"
    >
      <div className="im-marquee-track flex w-max whitespace-nowrap" aria-hidden>
        {[0, 1].map((copy) => (
          <span key={copy} className="flex">
            {words.map((w, i) => (
              <span
                key={`${copy}-${i}`}
                className="im-display px-7 text-[clamp(1.4rem,3.4vw,2.4rem)] text-muted-2"
              >
                {w}
                <span className="ml-7 text-green">/</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
