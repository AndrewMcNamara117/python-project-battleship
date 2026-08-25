import Link from 'next/link';
import { IronMilesLogo } from '@/components/brand/IronMilesLogo';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/app', label: 'Athlete hub' },
      { href: '/coaching', label: 'Coaching' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/apply', label: 'Apply' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/register', label: 'Create account' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
  {
    title: 'Iron Miles',
    links: [
      { href: 'https://ironmiles.ie', label: 'Main site' },
      { href: 'https://ironmiles.ie/club.html', label: 'The Club' },
      { href: 'https://ironmiles.ie/reviews/', label: 'Reviews' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-iron-2">
      <div className="mx-auto max-w-[1240px] px-5 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <IronMilesLogo sub="Training" markHeight={28} />
            <p className="mt-5 max-w-[34ch] text-[13px] leading-relaxed text-muted">
              Endurance coaching and an athlete training hub, built in Limerick for people training
              for something that matters.
            </p>
            <p className="im-micro mt-6 text-green">Forge One More</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="im-micro">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13px] text-muted transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] tracking-[0.1em] text-muted-2">
            © {new Date().getFullYear()} Iron Miles. Limerick, Ireland.
          </p>
          <p className="max-w-[62ch] text-[11px] leading-relaxed text-muted-2">
            Iron Miles Training provides coaching and training guidance. It is not a medical service
            and does not replace advice from a doctor or physiotherapist.
          </p>
        </div>
      </div>
    </footer>
  );
}
