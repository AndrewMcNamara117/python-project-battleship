'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IronMilesLogo } from '@/components/brand/IronMilesMark';
import { ButtonLink } from '@/components/ui/Button';

const LINKS = [
  { href: '/coaching', label: 'Coaching' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/app', label: 'The Platform' },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // navigating closes the menu — derived during render rather than in an effect,
  // so there is no frame where the old route's menu is still open
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);



  return (
    <header
      className={`sticky top-0 z-70 border-b transition-colors duration-300 ${
        scrolled ? 'border-line bg-iron/85 backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-5 py-3.5">
        <Link href="/" aria-label="Iron Miles Training home">
          <IronMilesLogo sub="Training" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-colors ${
                pathname === l.href ? 'text-white' : 'text-muted hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-[11px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-white sm:block"
          >
            Log in
          </Link>
          <ButtonLink href="/apply" size="sm" className="hidden sm:inline-flex">
            Apply
          </ButtonLink>
          <button
            type="button"
            className="flex size-10 items-center justify-center border border-line-2 text-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="relative block h-3 w-[18px]" aria-hidden>
              <span
                className={`absolute left-0 block h-px w-full bg-current transition-transform duration-300 ${
                  open ? 'top-1.5 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 block h-px w-full bg-current transition-opacity duration-200 ${
                  open ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`absolute left-0 block h-px w-full bg-current transition-transform duration-300 ${
                  open ? 'top-1.5 -rotate-45' : 'top-3'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-iron-2 md:hidden" aria-label="Mobile">
          {[...LINKS, { href: '/login', label: 'Log in' }, { href: '/apply', label: 'Apply for coaching' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block border-b border-line px-5 py-4 text-[12px] font-bold uppercase tracking-[0.2em] text-muted"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
