import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { RouteLine } from '@/components/motion/RouteLine';

interface PreviewSession {
  day: string;
  name: string;
  meta: string;
  intensity: string;
  tone: 'green' | 'neutral';
  detail: { label: string; value: string }[];
  why: string;
}

const SESSIONS: PreviewSession[] = [
  {
    day: 'Wednesday',
    name: 'Threshold — 6 x 5 min',
    meta: '13KM · 65 min',
    intensity: 'Hard',
    tone: 'green',
    detail: [
      { label: 'Zone', value: 'HR 4' },
      { label: 'Pace', value: '4:30–4:50 /km' },
      { label: 'RPE', value: '8' },
      { label: 'Recovery', value: '90s jog' },
    ],
    why: 'Raises the pace you can hold before fatigue takes over. One of these a week is enough.',
  },
  {
    day: 'Friday',
    name: 'Strength — Foundation B',
    meta: '45 min · Full gym',
    intensity: 'Steady',
    tone: 'neutral',
    detail: [
      { label: 'Focus', value: 'Single leg' },
      { label: 'Sets', value: '16 working' },
      { label: 'RPE', value: '7' },
      { label: 'Rest', value: '90–120s' },
    ],
    why: 'Single-leg strength and lateral control. This is the session that keeps you on the road.',
  },
  {
    day: 'Sunday',
    name: 'Long Run 22K',
    meta: '22KM · 2h 16m',
    intensity: 'Easy',
    tone: 'neutral',
    detail: [
      { label: 'Zone', value: 'HR 2' },
      { label: 'Pace', value: '5:55–6:20 /km' },
      { label: 'Fuel', value: 'From 40 min' },
      { label: 'RPE', value: '5' },
    ],
    why: 'Time on feet, and a rehearsal of race-day fuelling. Start controlled, finish stronger.',
  },
];

export function SessionCards() {
  return (
    <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
      {SESSIONS.map((s) => (
        <RevealItem key={s.name}>
          <Panel hover className="flex h-full flex-col p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="im-micro">{s.day}</span>
              <Badge tone={s.tone}>{s.intensity}</Badge>
            </div>

            <h3 className="im-display mt-5 text-[1.35rem] leading-tight">{s.name}</h3>
            <p className="im-mono mt-2 text-[12px] tracking-[0.14em] text-green">{s.meta}</p>

            <RouteLine className="mt-6 h-10 w-full opacity-70" showNode={false} />

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-6">
              {s.detail.map((d) => (
                <div key={d.label}>
                  <dt className="im-micro">{d.label}</dt>
                  <dd className="im-mono mt-1.5 text-[13px] font-bold">{d.value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 border-t border-line pt-5 text-[13px] leading-relaxed text-muted">
              {s.why}
            </p>
          </Panel>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
