'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { IronMilesLogo } from '@/components/brand/IronMilesLogo';
import { NavIcon } from './NavIcon';
import { NAV_GROUPS, type NavItem } from './nav-config';

function isActive(pathname: string, href: string) {
  return href === '/app' || href === '/coach' ? pathname === href : pathname.startsWith(href);
}

/** Desktop rail. Grouped, hairline separators, the active item marked by a teal edge. */
function Rail({ items, sub }: { items: NavItem[]; sub: string }) {
  const pathname = usePathname();

  return (
    <aside className="im-scroll sticky top-0 hidden h-dvh w-[232px] shrink-0 overflow-y-auto border-r border-hairline bg-slate lg:block">
      <div className="px-6 py-6">
        <Link href={items[0].href} aria-label="Iron Miles Training">
          <IronMilesLogo sub={sub} />
        </Link>
      </div>

      <nav className="pb-8" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group.key);
          if (!groupItems.length) return null;
          return (
            <div key={group.key} className="mt-5 first:mt-0">
              <p className="im-micro px-6 pb-2.5">{group.label}</p>
              <ul>
                {groupItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex items-center gap-3 px-6 py-2.5 text-[13px] transition-colors duration-200 ${
                          active ? 'text-ink-body' : 'text-ink-secondary hover:text-ink-body'
                        }`}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-mint"
                          />
                        )}
                        <NavIcon name={item.icon} className={`size-4.5 ${active ? 'text-mint' : ''}`} />
                        <span className="font-bold uppercase tracking-[0.1em]">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mobile bottom navigation — five destinations, thumb-reachable, safe-area aware. */
function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    <nav
      aria-label="Primary"
      className="im-safe-b fixed inset-x-0 bottom-0 z-60 border-t border-hairline bg-onyx/95 backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1.5 py-2.5 transition-colors duration-200 ${
                  active ? 'text-mint' : 'text-ink-tertiary'
                }`}
              >
                {active && !reduced && (
                  <motion.span
                    layoutId="im-bottom-nav-marker"
                    className="absolute inset-x-5 top-0 h-0.5 bg-mint"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                {active && reduced && <span className="absolute inset-x-5 top-0 h-0.5 bg-mint" />}
                <NavIcon name={item.icon} className="size-5.5" />
                <span className="text-[9px] font-bold uppercase tracking-[0.14em]">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({
  children,
  items,
  mobileItems,
  sub,
  topBar,
}: {
  children: ReactNode;
  items: NavItem[];
  /** Five destinations for the bottom bar — the same app the rail is showing. */
  mobileItems: NavItem[];
  sub: string;
  topBar: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-onyx">
      <Rail items={items} sub={sub} />
      <div className="im-grain relative flex min-w-0 flex-1 flex-col">
        {topBar}
        <main id="main" className="relative z-2 flex-1 pb-24 lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav items={mobileItems} />
    </div>
  );
}
