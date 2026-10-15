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
  { href: '/app/activities', label: 'Activities', short: 'Files', icon: 'activity', group: 'train' },
  { href: '/app/record', label: 'Record', short: 'Record', icon: 'record', group: 'train' },
  { href: '/app/strength', label: 'Strength', short: 'Lift', icon: 'strength', group: 'train' },
  { href: '/app/progress', label: 'Progress', short: 'Progress', icon: 'chart', group: 'progress' },
  { href: '/app/check-in', label: 'Check-in', short: 'Check-in', icon: 'checkin', group: 'progress' },
  { href: '/app/leaderboard', label: 'Leaderboard', short: 'Board', icon: 'board', group: 'club' },
  { href: '/app/club', label: 'Club feed', short: 'Feed', icon: 'activity', group: 'club' },
  { href: '/app/segments', label: 'Segments', short: 'Segments', icon: 'segment', group: 'club' },
  { href: '/app/challenges', label: 'Challenges', short: 'Challenges', icon: 'flag', group: 'club' },
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
const byHref = (href: string) => ATHLETE_NAV.find((n) => n.href === href) as NavItem;

// by address rather than position, so adding a destination cannot reshuffle the phone bar
export const MOBILE_NAV: NavItem[] = [
  byHref('/app/today'),
  byHref('/app/calendar'),
  byHref('/app/progress'),
  byHref('/app/forge'),
  byHref('/app/profile'),
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
  { href: '/coach/segments', label: 'Segments', short: 'Segments', icon: 'segment', group: 'club' },
  { href: '/coach/challenges', label: 'Challenges', short: 'Challenges', icon: 'flag', group: 'club' },
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
const coachByHref = (href: string) => COACH_NAV_ITEMS.find((n) => n.href === href) as NavItem;

export const COACH_MOBILE_NAV: NavItem[] = [
  coachByHref('/coach'),
  coachByHref('/coach/athletes'),
  coachByHref('/coach/checkins'),
  coachByHref('/coach/messages'),
  coachByHref('/coach/notifications'),
];
