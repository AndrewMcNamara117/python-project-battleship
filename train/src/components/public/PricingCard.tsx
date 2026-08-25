import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { formatPrice, type CoachingPackage } from '@/data/packages';

export function PricingCard({ pkg, cta = '/apply' }: { pkg: CoachingPackage; cta?: string }) {
  return (
    <Panel edge className="im-topo p-8 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="im-display text-[clamp(1.5rem,3vw,2rem)]">{pkg.name}</h3>
          <p className="mt-2 max-w-[36ch] text-[14px] text-green">{pkg.position}</p>
        </div>
        {pkg.badge && <Badge tone="green">{pkg.badge}</Badge>}
      </div>

      <div className="mt-8 flex items-baseline gap-2">
        <span className="im-mono im-display text-[clamp(2.6rem,6vw,3.6rem)]">
          {formatPrice(pkg.priceCents, pkg.currency)}
        </span>
        <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-muted-2">
          / {pkg.interval}
        </span>
      </div>

      {pkg.foundingSpots && (
        <p className="mt-3 text-[12px] text-muted">
          {pkg.foundingSpots.remaining} of {pkg.foundingSpots.total} founding places left. The rate
          holds for as long as you stay coached.
        </p>
      )}

      <p className="mt-6 max-w-[54ch] text-[15px] leading-relaxed text-muted">{pkg.summary}</p>

      <ul className="mt-8 space-y-3">
        {pkg.includes.map((item) => (
          <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-white">
            <span aria-hidden className="mt-2 block h-px w-4 shrink-0 bg-green" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-9 flex flex-wrap gap-3">
        <ButtonLink href={cta} size="lg">
          Apply for coaching
        </ButtonLink>
        <ButtonLink href="/coaching" variant="ghost" size="lg">
          How it works
        </ButtonLink>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-2">
        Monthly, cancel any time from your billing settings. Coaching begins after a short
        application — it is not a subscription you buy and figure out alone.
      </p>
    </Panel>
  );
}
