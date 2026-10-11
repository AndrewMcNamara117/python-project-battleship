/**
 * Navigation icons — a single hairline set drawn on one 24px grid, so the rail
 * reads as one system rather than a mix of borrowed glyphs. No icon font, no
 * sprite sheet, no dependency.
 */
const PATHS: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z',
  today: 'M12 4v8l5 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  calendar: 'M4 7h16v13H4zM4 7V5h16v2M8 3v4M16 3v4M8 12h3M8 16h8',
  run: 'M13 4.5a1.4 1.4 0 1 0 0-.1zM7 21l3-5 3 2 1 3M10 16l-2-4 4-3 3 3h3',
  strength: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  chart: 'M4 20V9M10 20V4M16 20v-7M22 20H2',
  checkin: 'M9 12l2 2 5-5M5 4h14v16H5z',
  board: 'M8 20h8M12 16v4M6 4h12v5a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3',
  community: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M17 8a2.5 2.5 0 1 0 0-5M21 20v-1a4 4 0 0 0-3-3.8',
  coach: 'M4 5h16v11H9l-5 4z',
  forge: 'M12 3 5 9v7l7 5 7-5V9zM12 8v8M9 12h6',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  athletes: 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M16 4.5a3 3 0 0 1 0 5.9M22 20v-1a5 5 0 0 0-4-4.9',
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name] ?? PATHS.home} />
    </svg>
  );
}
