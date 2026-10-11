'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Minimal route-line graphic — an abstract elevation/route trace.
 * Draws itself on scroll-into-view; static under reduced motion.
 */
export function RouteLine({
  className,
  path = 'M0,58 C40,58 52,20 84,20 C118,20 126,74 162,74 C196,74 206,32 240,32 C272,32 282,52 320,52',
  strokeWidth = 1.5,
  duration = 2.2,
  showNode = true,
}: {
  className?: string;
  path?: string;
  strokeWidth?: number;
  duration?: number;
  showNode?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <svg viewBox="0 0 320 92" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="im-route-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2dff8a" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#2dff8a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2dff8a" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path d={path} stroke="rgba(238,238,238,0.07)" strokeWidth={strokeWidth} />
      <motion.path
        d={path}
        stroke="url(#im-route-grad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: reduced ? 0 : duration, ease: [0.22, 1, 0.36, 1] }}
      />
      {showNode && <circle cx="320" cy="52" r="3" fill="#2dff8a" />}
    </svg>
  );
}
