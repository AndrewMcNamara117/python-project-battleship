import Link from 'next/link';
import { IronMilesLogo } from '@/components/brand/IronMilesLogo';
import { Badge } from '@/components/ui/Badge';
import { SignOutButton } from './SignOutButton';

export function TopBar({
  name,
  role,
  isDemo,
  unread,
  notifications = 0,
  home = '/app',
}: {
  name: string;
  role: string;
  isDemo: boolean;
  unread: number;
  /** Unread notifications. Shown as a count, never as a bare dot: a coach
   *  deciding whether to stop what they are doing needs to know how many. */
  notifications?: number;
  /** Where the mobile logo goes. A coach tapping it landed in the athlete app. */
  home?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-onyx/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-5 py-3 lg:px-8">
        <Link href={home} className="lg:hidden" aria-label="Iron Miles Training">
          <IronMilesLogo sub={home === '/app' ? 'Training' : 'Coach'} markHeight={20} />
        </Link>

        <div className="hidden min-w-0 lg:block">
          <p className="im-micro">{role}</p>
          <p className="truncate text-[13px] font-bold uppercase tracking-[0.08em]">{name}</p>
        </div>

        <div className="flex items-center gap-3">
          {isDemo && <Badge tone="warn">Demo data</Badge>}
          {notifications > 0 && (
            <Link
              href="/coach/notifications"
              aria-label={`${notifications} unread ${notifications === 1 ? 'notification' : 'notifications'}`}
            >
              <Badge tone="alert">
                {notifications} new
              </Badge>
            </Link>
          )}
          {unread > 0 && (
            <Link href="/app/coach" className="hidden sm:block">
              <Badge tone="green">
                {unread} new {unread === 1 ? 'message' : 'messages'}
              </Badge>
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
