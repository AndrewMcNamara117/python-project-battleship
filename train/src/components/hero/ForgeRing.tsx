'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'motion/react';
import { ACCENT, INK, SURFACE } from '@/lib/tokens';

/** Three.js is code-split out of the initial bundle and never server-rendered. */
const ForgeRingScene = dynamic(() => import('./ForgeRingScene'), {
  ssr: false,
  loading: () => <ForgeRingStatic />,
});

/**
 * Static fallback — the same object, drawn flat.
 * Used under prefers-reduced-motion, while the scene loads, on the server,
 * and on any device that cannot give us WebGL.
 */
export function ForgeRingStatic() {
  const bars = Array.from({ length: 96 }, (_, i) => {
    const t = (i / 96) * Math.PI * 2;
    const e =
      Math.sin(t * 3) * 0.34 + Math.sin(t * 7 + 1.1) * 0.19 + Math.sin(t * 13 + 2.7) * 0.1;
    return { t, len: 8 + Math.abs(e) * 34 };
  });

  return (
    <svg viewBox="-160 -160 320 320" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <linearGradient id="fr-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT.mint} stopOpacity="0.9" />
          <stop offset="100%" stopColor={SURFACE.steel} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <circle r="102" fill="none" stroke={ACCENT.mint} strokeOpacity="0.45" strokeWidth="0.8" />
      <circle r="132" fill="none" stroke={INK.body} strokeOpacity="0.14" strokeWidth="0.5" />
      <circle r="62" fill="none" stroke={INK.body} strokeOpacity="0.05" strokeWidth="0.5" />
      {bars.map(({ t, len }, i) => {
        const x1 = Math.cos(t) * 108;
        const y1 = Math.sin(t) * 108;
        const x2 = Math.cos(t) * (108 + len);
        const y2 = Math.sin(t) * (108 + len);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#fr-bar)"
            strokeWidth="2.1"
            strokeLinecap="round"
            opacity={0.5 + (i % 12) / 22}
          />
        );
      })}
    </svg>
  );
}

/** Probed once and cached — creating a canvas per render would be wasteful. */
let webglSupport: boolean | null = null;

function detectWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

// WebGL support is an external fact about the device, not React state.
// useSyncExternalStore reads it without an effect and keeps the server
// snapshot (the static fallback) stable through hydration.
const subscribeToNothing = () => () => {};

export function ForgeRing() {
  const reduced = useReducedMotion();
  const webgl = useSyncExternalStore(subscribeToNothing, detectWebGL, () => false);

  if (reduced || !webgl) return <ForgeRingStatic />;
  return <ForgeRingScene />;
}
