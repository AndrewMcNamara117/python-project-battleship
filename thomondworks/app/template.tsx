/**
 * Remounts on every route change so the entrance animation
 * (motion-gated in CSS) replays between pages.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="tw-page">{children}</div>;
}
