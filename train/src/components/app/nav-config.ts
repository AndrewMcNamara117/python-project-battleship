export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: string;
  group: 'train' | 'progress' | 'club' | 'account';
}

/** Full navigation. The desktop rail shows all of it, grouped. */
export const ATHLETE_NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', short: 'Home', icon: 'home', group: 'train' },
  { href: '/app/today', label: 'Today', short: 'Today', icon: 'today', group: 'train' },
  { href: '/app/calendar', label: 'Calendar', short: 'Plan', icon: 'calendar', group: 'train' },
  { href: '/app/training', label: 'Endurance', short: 'Run', icon: 'run', group: 'train' },
  { href: '/app/strength', label: 'Strength', short: 'Lift', icon: 'strength', group: 'train' },
  { href: '/app/progress', label: 'Progress', short: 'Progress', icon: 'chart', group: 'progress' },
  { href: '/app/check-in', label: 'Check-in', short: 'Check-in', icon: 'checkin', group: 'progress' },
  { href: '/app/leaderboard', label: 'Leaderboard', short: 'Board', icon: 'board', group: 'club' },
  { href: '/app/community', label: 'Community', short: 'Club', icon: 'community', group: 'club' },
  { href: '/app/coach', label: 'Coach', short: 'Coach', icon: 'coach', group: 'club' },
  { href: '/app/forge', label: 'FORGE', short: 'FORGE', icon: 'forge', group: 'club' },
  { href: '/app/profile', label: 'Profile', short: 'You', icon: 'profile', group: 'account' },
];

/**
 * Mobile bottom navigation — five destinations, no more.
 * Today first, because the whole product's promise is seeing today's session
 * in under two seconds.
 */
export const MOBILE_NAV: NavItem[] = [
  ATHLETE_NAV[1], // Today
  ATHLETE_NAV[2], // Plan
  ATHLETE_NAV[5], // Progress
  ATHLETE_NAV[10], // FORGE
  ATHLETE_NAV[11], // Profile
];

export const NAV_GROUPS: { key: NavItem['group']; label: string }[] = [
  { key: 'train', label: 'Train' },
  { key: 'progress', label: 'Progress' },
  { key: 'club', label: 'Club' },
  { key: 'account', label: 'Account' },
];

const COACH_NAV_ITEMS: NavItem[] = [
  { href: '/coach', label: 'Overview', short: 'Home', icon: 'home', group: 'train' },
  { href: '/coach/athletes', label: 'Athletes', short: 'Athletes', icon: 'athletes', group: 'train' },
  { href: '/coach/applications', label: 'Applications', short: 'Intake', icon: 'checkin', group: 'train' },
  { href: '/coach/checkins', label: 'Check-ins', short: 'Check-ins', icon: 'checkin', group: 'train' },
  { href: '/coach/messages', label: 'Messages', short: 'Messages', icon: 'coach', group: 'train' },
  { href: '/coach/programs', label: 'Programmes', short: 'Programmes', icon: 'calendar', group: 'progress' },
  { href: '/coach/workouts', label: 'Workout library', short: 'Workouts', icon: 'run', group: 'progress' },
  { href: '/coach/strength', label: 'S&C library', short: 'Strength', icon: 'strength', group: 'progress' },
  { href: '/coach/races', label: 'Race calendar', short: 'Races', icon: 'board', group: 'club' },
  { href: '/coach/analytics', label: 'Analytics', short: 'Analytics', icon: 'chart', group: 'club' },
  { href: '/coach/notifications', label: 'Notifications', short: 'Alerts', icon: 'checkin', group: 'account' },
];

export const COACH_NAV = COACH_NAV_ITEMS;

/**
 * The coach's five, for a phone.
 *
 * Coaches were being given the athlete's bottom bar — Today, Plan, Progress,
 * FORGE, You — every one of which redirects them back out of the coach app.
 * On a phone that made the notification centre unreachable, which is the one
 * place a coach reads an alert.
 */
export const COACH_MOBILE_NAV: NavItem[] = [
  COACH_NAV_ITEMS[0],  // Overview
  COACH_NAV_ITEMS[1],  // Athletes
  COACH_NAV_ITEMS[3],  // Check-ins
  COACH_NAV_ITEMS[4],  // Messages
  COACH_NAV_ITEMS[10], // Notifications
];
