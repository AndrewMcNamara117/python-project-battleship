import type { Metadata } from 'next';
import Link from 'next/link';
import { buildDemoDataset, DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { PACKAGES } from '@/data/packages';
import { adherence, buildWeekBuckets } from '@/lib/domain/analytics';
import { addDays, startOfWeek, toISODate } from '@/lib/domain/dates';
import { currentStreakWeeks, totalScore } from '@/lib/domain/forge-score';
import { Hero } from '@/components/landing/Hero';
import { DashboardPreview } from '@/components/landing/DashboardPreview';
import { SessionCards } from '@/components/landing/SessionCards';
import { Faq } from '@/components/public/Faq';
import { Marquee } from '@/components/public/Marquee';
import { PricingCard } from '@/components/public/PricingCard';
import { Section, SectionHead } from '@/components/public/Section';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { RouteLine } from '@/components/motion/RouteLine';
import { Badge, Dot } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';

export const metadata: Metadata = {
  title: 'Iron Miles Training — Train With Purpose',
  description:
    'Personalised endurance coaching and a full athlete training hub. Built around your goal. Driven by one mindset: Forge One More.',
};

const FAQ = [
  {
    q: 'Do I need to be fast to be coached?',
    a: 'No. The programme is written around where you actually are, not where you wish you were. Most people who start here are training for a first half marathon, a first ultra, or a return after a long time away. The plan is the same shape either way: consistent, progressive, and honest about your week.',
  },
  {
    q: 'How is this different from a downloadable plan?',
    a: 'A downloadable plan cannot see that you slept badly for four nights, that your calf has been talking to you, or that work swallowed Tuesday. This one adjusts every week off your logged sessions and your check-in, and a human coach reads both.',
  },
  {
    q: 'What if I miss sessions?',
    a: 'You will. Everyone does. The programme adapts rather than pretending the week went to plan, and nothing in the app is designed to make you feel worse about it. One session does not define a block.',
  },
  {
    q: 'Do I need a gym?',
    a: 'It helps, but the strength plan is written around what you actually have. There are full-gym, home-gym and bodyweight versions of every session, and you tell us which during onboarding.',
  },
  {
    q: 'Does it work with my watch?',
    a: 'Manual logging works properly today — it takes about twenty seconds a session. Strava, Garmin, COROS, Apple Health and Google Fit are architected for and will connect in a later release; you can see the placeholder in your settings.',
  },
  {
    q: 'Is my health data private?',
    a: 'Your training and check-in data is visible to you and to your coach. Nothing else. The leaderboard is opt-in and off by default, and you can export or delete everything from your profile at any time.',
  },
  {
    q: 'Can I cancel?',
    a: 'Any time, from your billing settings. Coaching runs to the end of the period you have paid for. No notice period, no exit conversation.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. Iron Miles Training is a coaching service. If something hurts in a way that concerns you, we will tell you to stop and see a doctor or physiotherapist — and the platform is built to route that to a human rather than guess at it.',
  },
];

export default function LandingPage() {
  // The preview below runs on the same engine as the signed-in product.
  const today = toISODate(new Date());
  const demo = buildDemoDataset(today);
  const buckets = buildWeekBuckets(demo.scheduled, demo.completed, demo.strengthSessions, 12, today);
  const weekStart = startOfWeek(today);
  const forge = demo.forgeEvents.filter((e) => e.athleteId === DEMO_ATHLETE_ID);

  const stats = {
    adherence: adherence(demo.scheduled, addDays(weekStart, -84), today, today).pct,
    weeklyKm: buckets[buckets.length - 1]?.actualKm ?? 0,
    forgeScore: totalScore(forge),
    streak: currentStreakWeeks(forge, today),
  };

  return (
    <>
      <Hero />

      <Marquee
        words={['FORGE ONE MORE', 'SHOW UP', 'ADAPT', 'GO AGAIN', 'THE WORK ADDS UP']}
        className="bg-iron-2"
      />

      {/* ---------------- A ---------------- */}
      <Section id="your-plan">
        <div className="grid gap-14 lg:grid-cols-[1fr_0.85fr] lg:items-start lg:gap-20">
          <SectionHead
            eyebrow="Individual programming"
            title={
              <>
                Your goal.
                <br />
                <span className="text-green">Your plan.</span>
              </>
            }
            lead="No template with your name typed into the header. Your programme is written from your goal, your history, the days you can actually train, and what your body has told us so far — then rewritten every week as you respond to it."
          />

          <RevealGroup className="space-y-px">
            {[
              {
                n: '01',
                t: 'We start with the start line',
                d: 'A date, a distance, and the real reason you picked it. Everything downstream is built backwards from there.',
              },
              {
                n: '02',
                t: 'Then your actual week',
                d: 'Five days is not better than four if the fifth never happens. We build around the week you have, not the one you would like.',
              },
              {
                n: '03',
                t: 'Then it changes',
                d: 'Every session you log and every check-in you submit feeds the next week. The plan moves toward you.',
              },
            ].map((s) => (
              <RevealItem key={s.n}>
                <div className="flex gap-6 border-b border-line py-7 first:border-t">
                  <span className="im-mono im-display text-[1.6rem] text-green">{s.n}</span>
                  <div>
                    <h3 className="text-[1.05rem] font-bold uppercase tracking-[0.04em]">{s.t}</h3>
                    <p className="mt-2.5 max-w-[46ch] text-[14px] leading-relaxed text-muted">{s.d}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </Section>

      {/* ---------------- B ---------------- */}
      <Section id="sessions" tone="raised">
        <SectionHead
          eyebrow="Run · Endurance · Strength"
          title="Every session has a reason."
          lead="You should never open a plan and wonder what a session is for. Every prescribed workout carries its intent, its intensity, and the numbers to hold — so you know what a good day looks like before you start."
        />
        <SessionCards />
      </Section>

      {/* ---------------- C ---------------- */}
      <Section id="progress">
        <div className="grid gap-14 lg:grid-cols-[0.82fr_1fr] lg:items-center lg:gap-16">
          <SectionHead
            eyebrow="Progress you can read"
            title={
              <>
                See the work
                <br />
                <span className="text-green">add up.</span>
              </>
            }
            lead="Volume, pace, effort, adherence, long-run progression — measured against what was actually prescribed, not against someone else's week. Restrained charts, no vanity metrics, and nothing that rewards you for running further than you were asked to."
          />
          <Reveal delay={0.1}>
            <DashboardPreview buckets={buckets} stats={stats} />
          </Reveal>
        </div>
      </Section>

      {/* ---------------- D ---------------- */}
      <Section id="community" tone="raised">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          <Reveal>
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <span className="im-micro">Forge Score · this month</span>
                <Badge tone="neutral">Opt-in</Badge>
              </div>
              <ol>
                {[
                  { r: 1, n: 'Ciara N.', g: 'Marathon Block', v: 284 },
                  { r: 2, n: 'Andrew', g: 'Ultra Squad', v: 271, me: true },
                  { r: 3, n: 'Dara O.', g: 'Ultra Squad', v: 248 },
                  { r: 4, n: 'Sinead M.', g: 'Half Block', v: 226 },
                ].map((row) => (
                  <li
                    key={row.r}
                    className={`flex items-center gap-4 border-b border-line px-6 py-4 last:border-b-0 ${
                      row.me ? 'bg-green/6' : ''
                    }`}
                  >
                    <span className="im-mono w-6 text-[13px] font-bold text-muted-2">{row.r}</span>
                    <span className="flex-1">
                      <span className="block text-[14px] font-bold">{row.n}</span>
                      <span className="im-micro mt-1 block">{row.g}</span>
                    </span>
                    {row.me && <Dot />}
                    <span className="im-mono text-[15px] font-extrabold text-green">{row.v}</span>
                  </li>
                ))}
              </ol>
              <p className="px-6 py-4 text-[11px] leading-relaxed text-muted-2">
                Forge Score rewards prescribed sessions, consistency, check-ins and showing up for
                the club. It does not reward raw mileage — running further than you were asked to
                earns nothing.
              </p>
            </Panel>
          </Reveal>

          <SectionHead
            eyebrow="The club behind the plan"
            title={
              <>
                You&apos;re not
                <br />
                <span className="text-green">training alone.</span>
              </>
            }
            lead="Saturday mornings at the bridge. A leaderboard built on consistency rather than speed, so the person who has never missed a session can top it. Announcements, milestones and shoutouts — and none of the follower counts, feeds or noise of an actual social network."
          />
        </div>
      </Section>

      {/* ---------------- E ---------------- */}
      <Section id="coaching">
        <SectionHead
          eyebrow="Coaching that adapts"
          title="Show up. Adapt. Go again."
          lead="Once a week you rate seven things and answer six questions. It takes two minutes and it is the most useful data in the platform — because it is the part a watch cannot see."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <Panel className="h-full p-7">
              <span className="im-micro">Weekly check-in</span>
              <div className="mt-7 space-y-5">
                {[
                  { k: 'Fatigue', v: 6 },
                  { k: 'Sleep', v: 7 },
                  { k: 'Soreness', v: 4 },
                  { k: 'Motivation', v: 9 },
                ].map((s) => (
                  <div key={s.k}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-bold uppercase tracking-[0.1em]">{s.k}</span>
                      <span className="im-mono text-[13px] font-bold text-green">{s.v}/10</span>
                    </div>
                    <div className="mt-2 h-px w-full bg-line-2">
                      <div className="h-px bg-green" style={{ width: `${s.v * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-muted">
                Rules flag repeated soreness, poor sleep, low motivation, missed sessions or pain
                described in your own words. A flag routes your check-in to your coach sooner. It is
                never a diagnosis, and it never replaces one.
              </p>
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <Panel edge className="h-full p-7">
              <span className="im-micro">From your coach</span>
              <blockquote className="mt-7 text-[clamp(1.1rem,2vw,1.35rem)] leading-relaxed">
                &ldquo;Saw the 22K on Sunday. Pace held from start to finish — that&apos;s the first
                time this block. Keep Monday genuinely easy.&rdquo;
              </blockquote>
              <p className="im-micro mt-6">R. Doyle · Coach</p>

              <div className="mt-9 border-t border-line pt-7">
                <div className="flex items-center gap-2">
                  <Dot />
                  <span className="im-micro text-green">FORGE · training assistant</span>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-muted">
                  &ldquo;Day 5. Easy 8K today. Keep it controlled — the goal is to arrive tomorrow
                  ready to work. Forge One More.&rdquo;
                </p>
                <p className="mt-5 text-[11px] leading-relaxed text-muted-2">
                  FORGE summarises your training and answers questions about the platform. It is an
                  assistant, not a coach, and your coach can switch it off for you entirely.
                </p>
              </div>
            </Panel>
          </Reveal>
        </div>
      </Section>

      {/* ---------------- F ---------------- */}
      <Section id="philosophy" tone="raised" className="text-center">
        <Reveal>
          <p className="im-eyebrow">The whole idea</p>
          <h2 className="im-display mx-auto mt-7 max-w-[16ch] text-[clamp(2.6rem,9vw,6rem)]">
            Forge <span className="text-green">one more.</span>
          </h2>
          <RouteLine className="mx-auto mt-10 h-16 w-full max-w-[520px]" />
          <p className="mx-auto mt-10 max-w-[52ch] text-[clamp(1.05rem,1.8vw,1.25rem)] leading-relaxed text-muted">
            One more session when it would be easier not to. One more kilometre when the plan says
            so — and not one more when it doesn&apos;t. Endurance is not built in the session you
            were excited about. It is built in the ordinary ones you did anyway.
          </p>
        </Reveal>
      </Section>

      {/* ---------------- G ---------------- */}
      <Section id="pricing">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1fr] lg:gap-16">
          <SectionHead
            eyebrow="Founding athletes"
            title="One package. Everything in it."
            lead="Coaching starts with an application rather than a checkout, because taking money from someone we cannot actually help is not a business we want. If it is not a fit, we will say so and point you somewhere better."
          />
          <Reveal delay={0.08}>
            <PricingCard pkg={PACKAGES[0]} />
          </Reveal>
        </div>
      </Section>

      {/* ---------------- H ---------------- */}
      <Section id="faq" tone="raised">
        <div className="grid gap-14 lg:grid-cols-[0.7fr_1fr] lg:gap-20">
          <SectionHead eyebrow="Before you apply" title="Questions." />
          <Reveal>
            <Faq items={FAQ} />
          </Reveal>
        </div>
      </Section>

      {/* ---------------- I ---------------- */}
      <Section id="start" className="im-topo">
        <Reveal className="mx-auto max-w-[52ch] text-center">
          <p className="im-eyebrow">Start here</p>
          <h2 className="im-display mt-7 text-[clamp(2.4rem,7vw,4.4rem)]">
            Pick the start line.
          </h2>
          <p className="mt-6 text-[clamp(1.05rem,1.7vw,1.2rem)] leading-relaxed text-muted">
            Tell us the goal and where you are right now. The application takes about five minutes
            and a person reads every one.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/apply" size="lg">
              Apply for coaching
            </ButtonLink>
            <ButtonLink href="/app" variant="ghost" size="lg">
              Explore the platform
            </ButtonLink>
          </div>
          <p className="mt-8 text-[12px] text-muted-2">
            Already coached?{' '}
            <Link href="/login" className="text-white underline underline-offset-4 hover:text-green">
              Log in
            </Link>
          </p>
        </Reveal>
      </Section>
    </>
  );
}
