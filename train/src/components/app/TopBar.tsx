import Link from 'next/link';
import { IronMilesLogo } from '@/components/brand/IronMilesMark';
import { Badge } from '@/components/ui/Badge';
import { SignOutButton } from './SignOutButton';

export function TopBar({
  name,
  role,
  isDemo,
  unread,
}: {
  name: string;
  role: string;
  isDemo: boolean;
  unread: number;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-iron/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-5 py-3 lg:px-8">
        <Link href="/app" className="lg:hidden" aria-label="Iron Miles Training">
          <IronMilesLogo sub="Training" markClassName="h-5 w-auto" />
        </Link>

        <div className="hidden min-w-0 lg:block">
          <p className="im-micro">{role}</p>
          <p className="truncate text-[13px] font-bold uppercase tracking-[0.08em]">{name}</p>
        </div>

        <div className="flex items-center gap-3">
          {isDemo && <Badge tone="warn">Demo data</Badge>}
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
