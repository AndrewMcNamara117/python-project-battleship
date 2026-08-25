import type { ReactNode } from 'react';

/**
 * RISE — entry motion for product surfaces.
 *
 * Pure CSS, server-rendered, no client JavaScript and no IntersectionObserver.
 *
 * This exists because the scroll-reveal it replaces put `opacity: 0` into the
 * server-rendered HTML and lifted it only once the element scrolled into view.
 * On a dashboard that means: no JavaScript, or an observer that never fires, and
 * half the athlete's training is invisible. Motion must never gate information.
 *
 * A CSS animation runs without JavaScript, and `prefers-reduced-motion` settles
 * it to the final state in `globals.css`. Entry happens once on load rather than
 * on scroll — correct for a dashboard, where content animating as you scroll
 * past it is a distraction rather than a flourish.
 *
 * Marketing surfaces keep `<Reveal>`: there, scroll choreography is the point.
 */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Milliseconds. Keep the total under ~250ms so nothing feels withheld. */
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`im-anim-forge min-w-0 ${className ?? ''}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
