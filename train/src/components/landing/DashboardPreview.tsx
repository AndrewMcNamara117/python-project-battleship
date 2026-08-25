'use client';

import { CountUp } from '@/components/motion/CountUp';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { MileageChart } from '@/components/charts/TrainingCharts';
import type { WeekBucket } from '@/lib/domain/analytics';

/**
 * A real slice of the athlete dashboard, driven by the same components and the
 * same demo dataset the signed-in product uses — not a screenshot.
 */
export function DashboardPreview({
  buckets,
  stats,
}: {
  buckets: WeekBucket[];
  stats: { adherence: number; weeklyKm: number; forgeScore: number; streak: number };
}) {
  return (
    <Panel className="im-topo overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <span className="im-micro">Progress · last 12 weeks</span>
        <Badge tone="green">Live preview</Badge>
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-4">
        {[
          { label: 'Adherence', value: stats.adherence, suffix: '%' },
          { label: 'This week', value: stats.weeklyKm, suffix: 'km', decimals: 1 },
          { label: 'Forge Score', value: stats.forgeScore, suffix: '' },
          { label: 'Week streak', value: stats.streak, suffix: '' },
        ].map((s) => (
          <div key={s.label} className="bg-surface px-6 py-6">
            <p className="im-micro">{s.label}</p>
            <p className="mt-3 text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold leading-none">
              <CountUp to={s.value} decimals={s.decimals ?? 0} suffix={s.suffix} />
            </p>
          </div>
        ))}
      </div>

      <div className="px-6 py-8">
        <MileageChart data={buckets} height={230} />
      </div>
    </Panel>
  );
}
