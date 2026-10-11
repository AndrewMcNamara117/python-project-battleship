import type { Metadata } from 'next';
import { Marquee } from '@/components/public/Marquee';
import { Section, SectionHead } from '@/components/public/Section';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { RouteLine } from '@/components/motion/RouteLine';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';

export const metadata: Metadata = {
  title: 'Personalised Coaching',
  description:
    'How Iron Miles coaching works: an individual programme built from your goal, your week and your history — adjusted every week by a human coach.',
};

const PILLARS = [
  {
    n: '01',
    t: 'One goal at a time',
    d: 'A block is built backwards from a single start line. Everything in it either serves that date or it comes out. Trying to peak for three things at once is how people end up peaking for none.',
  },
  {
    n: '02',
    t: 'Easy days genuinely easy',
    d: 'Most runners train their easy runs too hard and their hard runs too soft, then wonder why nothing moves. Your zones are set from your data, and the plan tells you exactly what a good easy day looks like.',
  },
  {
    n: '03',
    t: 'Strength is not optional',
    d: 'Two sessions a week, written around the running rather than bolted onto it. It is the single highest-return thing most endurance athletes are not doing.',
  },
  {
    n: '04',
    t: 'The plan bends first',
    d: 'Bad week at work, four hours of sleep, a calf that is talking to you — the programme moves. You are not asked to force a session that will cost you the next two.',
  },
];

const WEEK = [
  { d: 'Mon', s: 'Easy 8K', k: 'Zone 2' },
  { d: 'Tue', s: 'Strength — Foundation A', k: '45 min' },
  { d: 'Wed', s: 'Threshold 6 x 5 min', k: 'Zone 4' },
  { d: 'Thu', s: 'Recovery 6K', k: 'Zone 1' },
  { d: 'Fri', s: 'Strength — Foundation B', k: '45 min' },
  { d: 'Sat', s: 'Iron Miles club run', k: 'Social' },
  { d: 'Sun', s: 'Long run 22K', k: 'Fuel from 40 min' },
];

export default function CoachingPage() {
  return (
    <>
      <Section className="pt-[clamp(56px,8vw,96px)]">
        <SectionHead
          eyebrow="Personalised coaching"
          title={
            <>
              You pick the start line.
              <br />
              <span className="text-green">We get you there.</span>
            </>
          }
          lead="Iron Miles coaching is one-to-one. Your programme is written from your goal, your history and the week you actually have — then adjusted every seven days off what you logged and what you told us."
        />
        <RouteLine className="mt-14 h-24 w-full max-w-[720px]" />
      </Section>

      <Marquee words={['SHOW UP', 'ADAPT', 'GO AGAIN']} className="bg-iron-2" />

      <Section tone="raised">
        <SectionHead eyebrow="How it works" title="Four things we hold to." />
        <RevealGroup className="mt-14 grid gap-5 md:grid-cols-2">
          {PILLARS.map((p) => (
            <RevealItem key={p.n}>
              <Panel hover className="h-full p-8">
                <span className="im-mono im-display text-[1.5rem] text-green">{p.n}</span>
                <h3 className="mt-5 text-[1.15rem] font-bold uppercase tracking-[0.03em]">{p.t}</h3>
                <p className="mt-3.5 text-[14px] leading-relaxed text-muted">{p.d}</p>
              </Panel>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section>
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1fr] lg:gap-16">
          <SectionHead
            eyebrow="A week in a build block"
            title="What it actually looks like."
            lead="This is a real week from an ultra build — two strength sessions, one quality run, one long run, and three days that exist to let the hard ones work."
          />
          <Reveal>
            <Panel className="overflow-hidden p-0">
              <ol>
                {WEEK.map((w) => (
                  <li
                    key={w.d}
                    className="flex items-center gap-5 border-b border-line px-6 py-4 last:border-b-0"
                  >
                    <span className="im-micro w-10">{w.d}</span>
                    <span className="flex-1 text-[14px] font-bold">{w.s}</span>
                    <span className="im-mono text-[11px] tracking-[0.12em] text-green">{w.k}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </Reveal>
        </div>
      </Section>

      <Section tone="raised">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <SectionHead
            eyebrow="What you get"
            title="Coaching, and the hub behind it."
            lead="The programme is the product. The platform is what makes it possible to actually run it — and what lets your coach see the week you had rather than the week you meant to have."
          />
          <Reveal>
            <ul className="space-y-4">
              {[
                'A written programme, updated weekly',
                'Run, endurance and strength sessions in one calendar',
                'Session logging that takes twenty seconds',
                'Progress analytics measured against what was prescribed',
                'A weekly check-in that a human reads',
                'Direct messaging with your coach',
                'Race preparation and a pacing plan',
                'FORGE, the daily training assistant',
                'The Iron Miles club, Saturday mornings included',
              ].map((f) => (
                <li key={f} className="flex gap-4 border-b border-line pb-4 text-[15px]">
                  <span aria-hidden className="mt-3 block h-px w-5 shrink-0 bg-green" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <Section className="im-topo">
        <Reveal className="mx-auto max-w-[48ch] text-center">
          <h2 className="im-display text-[clamp(2.2rem,6vw,3.6rem)]">Forge one more.</h2>
          <p className="mt-6 text-[15px] leading-relaxed text-muted">
            Places are limited because the coaching is individual. If there is no place right now,
            we will tell you when there is.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/apply" size="lg">
              Apply for coaching
            </ButtonLink>
            <ButtonLink href="/pricing" variant="ghost" size="lg">
              See pricing
            </ButtonLink>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
