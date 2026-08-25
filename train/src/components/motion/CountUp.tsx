'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

/** Number count-up. Renders the final value immediately under reduced motion. */
export function CountUp({
  to,
  from = 0,
  duration = 1.4,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-8% 0px' });
  const reduced = useReducedMotion();
  // null means "not animating yet" — the server, and the client before the
  // element scrolls into view, both render the real figure. Rendering `from`
  // would publish a wrong number to anyone without JavaScript.
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (reduced || !inView) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      // easeOutExpo — fast settle, no bounce
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, from, duration, reduced]);

  // reduced motion, or before the count-up starts: show the final figure
  const shown = reduced || value === null ? to : value;

  return (
    <span ref={ref} className={`im-mono ${className ?? ''}`}>
      {prefix}
      {shown.toLocaleString('en-IE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
