'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Cinematic scroll reveal. Transform + opacity only.
 * Under prefers-reduced-motion the content renders static and fully readable.
 *
 * These are pure layout wrappers, so they carry `min-w-0`: as a grid or flex
 * item, a wrapper defaulting to min-width:auto would size the track to its
 * widest descendant and push a scrollable table or chart out of the viewport
 * instead of letting it scroll inside its own container.
 */
const WRAPPER = 'min-w-0';
const cx = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' ');
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={cx(WRAPPER, className)}>{children}</div>;

  return (
    <motion.div
      className={cx(WRAPPER, className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-12% 0px -8% 0px' }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered children — for card grids and lists. */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={cx(WRAPPER, className)}>{children}</div>;

  return (
    <motion.div
      className={cx(WRAPPER, className)}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-10% 0px' }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={cx(WRAPPER, className)}>{children}</div>;

  return (
    <motion.div
      className={cx(WRAPPER, className)}
      variants={{
        hidden: { opacity: 0, y: 22 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
