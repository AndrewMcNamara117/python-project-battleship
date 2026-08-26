import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { WorkoutRow } from '@/components/app/WorkoutCard';
import {
  HeartRateChart,
  LongRunChart,
  MileageChart,
  PaceChart,
  WellbeingSmallMultiples,
} from '@/components/charts/TrainingCharts';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import {
  adherence,
  buildWeekBuckets,
  consistency,
  loadRatio,
  wellbeingSeries,
} from '@/lib/domain/analytics';
import { attentionLabel } from '@/lib/domain/checkin-rules';
import { addDays, daysBetween, endOfWeek, formatDayMonth, startOfWeek, toISODate, WEEKDAY_LABELS, weekDates } from '@/lib/domain/dates';
import { totalScore } from '@/lib/domain/forge-score';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';
import { CoachNoteForm, CheckInResponder } from './CoachControls';
import { SessionEditor } from './SessionEditor';
import { SaveAsTemplate } from '@/components/programme/SaveAsTemplate';
import { WeekAdaptation } from '@/components/adaptation/WeekAdaptation';
import { CoachingContextControl } from './PhaseControl';
import { AthleteContext } from '@/components/forge/AthleteContext';

export const metadata: Metadata = { title: 'Athlete' };

export default async function AthleteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCoach();
  const repo = await getRepo();

  // RLS returns nothing for an athlete this coach is not linked to
  const roster = await repo.listAthletesForCoach(session.userId);
  const profile = roster.find((p) => p.id === id);
  if (!profile) notFound();

  const today = toISODate(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const from = addDays(weekStart, -7 * 19);

  const [goal, program, scheduled, completed, strength, checkins, notes, forgeEvents, messages] =
    await Promise.all([
      repo.getPrimaryGoal(id),
      repo.getProgram(id),
      repo.listScheduled(id, from, addDays(weekEnd, 21)),
      repo.listCompleted(id, from, weekEnd),
      repo.listStrengthSessions(id, from, weekEnd),
      repo.listCheckIns(id, 16),
      repo.listCoachNotes(id, 'coach'),
      repo.listForgeEvents(id),
      repo.listMessages(id),
    ]);

  const race = goal?.raceId ? await repo.getRace(goal.raceId) : null;

  // what saving this programme as a template would produce, read before the
  // coach is offered the action at all
  const extraction = program ? await repo.previewProgrammeExtraction(program.id) : null;

  // the week the coach would actually be adapting: the one containing today,
  // or the next one if the programme has not started
  const blocks = program ? await repo.listBlocks(program.id) : [];
  const allWeeks = blocks.flatMap((b) => b.weeks);
  const currentWeek =
    allWeeks.find((w) => today >= w.startDate && today < addDays(w.startDate, 7)) ??
    allWeeks.find((w) => w.startDate > today) ??
    null;
  const [weekSessions, checkInContext] = currentWeek
    ? await Promise.all([
        repo.getWeekAdaptationContext(currentWeek.id),
        repo.getCheckInContext(id),
      ])
    : [[], null];
  const buckets = buildWeekBuckets(scheduled, completed, strength, 12, today);
  const week = scheduled.filter((w) => w.date >= weekStart && w.date <= weekEnd);
  const blockAdherence = adherence(scheduled, addDays(weekStart, -7 * 11), weekEnd, today);
  const latestCheckIn = checkins[0] ?? null;
  const daysToRace = race ? daysBetween(today, race.date) : goal ? daysBetween(today, goal.targetDate) : null;
  const days = weekDates(weekStart);

  return (
    <AppPage>
      <PageHeader
        eyebrow={race?.name ?? (goal ? EVENT_TYPE_LABELS[goal.eventType] : 'No goal set')}
        title={profile.fullName}
        lead={
          program
            ? `${program.name} · ${formatDayMonth(program.startDate)} → ${formatDayMonth(program.endDate)}`
            : 'No active programme.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {daysToRace != null && <Badge tone="green">{daysToRace} days to race</Badge>}
            {latestCheckIn && (
              <Badge
                tone={
                  latestCheckIn.attentionLevel === 'attention'
                    ? 'alert'
                    : latestCheckIn.attentionLevel === 'watch'
                      ? 'warn'
                      : 'neutral'
                }
              >
                {attentionLabel(latestCheckIn.attentionLevel)}
              </Badge>
            )}
          </div>
        }
      />

      <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatCard
            label="Block adherence"
            value={blockAdherence.pct}
            suffix="%"
            meter={blockAdherence.pct / 100}
            note={`${blockAdherence.completed} of ${blockAdherence.prescribed} sessions.`}
          />
        </RevealItem>
        <RevealItem>
          <StatCard label="Consistency" value={consistency(buckets)} suffix="%" meter={consistency(buckets) / 100} />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Load ratio"
            value={loadRatio(completed, today) ?? 0}
            decimals={2}
            note="Last 7 days against the 28-day average."
          />
        </RevealItem>
        <RevealItem>
          <StatCard label="Forge Score" value={totalScore(forgeEvents)} />
        </RevealItem>
      </RevealGroup>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Reveal>
            <Panel className="p-6 sm:p-8">
              <PanelHeader label="This week" />
              <div className="im-scroll mt-6 overflow-x-auto">
                <div className="grid min-w-[700px] grid-cols-7 gap-px bg-line">
                  {days.map((d, i) => {
                    const sessions = week.filter((w) => w.date === d);
                    return (
                      <div key={d} className="min-h-[150px] bg-surface p-3">
                        <div className="flex items-baseline justify-between">
                          <span className={`im-micro ${d === today ? 'text-green' : ''}`}>
                            {WEEKDAY_LABELS[i]}
                          </span>
                          <span className="im-mono text-[10px] text-muted-2">{d.slice(8)}</span>
                        </div>
                        <ul className="mt-3 space-y-2.5">
                          {sessions.map((w) => (
                            <li key={w.id}>
                              <WorkoutRow workout={w} units={profile.units} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.05}>
            <SessionEditor
              athleteId={id}
              sessions={scheduled
                .filter((w) => w.date >= addDays(today, -7))
                .slice(0, 24)}
            />
            {extraction && <SaveAsTemplate preview={extraction} athleteId={id} />}
          </Reveal>

          {currentWeek && weekSessions.length > 0 && (
            <Reveal delay={0.055}>
              <WeekAdaptation
                athleteId={id}
                weekStart={currentWeek.startDate}
                weekNo={currentWeek.programWeekNo}
                sessions={weekSessions}
                checkIn={checkInContext}
                programmeEnd={program!.endDate}
              />
            </Reveal>
          )}

          <Reveal delay={0.06}>
            <Panel className="p-6 sm:p-8">
              <MileageChart data={buckets} />
            </Panel>
          </Reveal>

          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <Reveal delay={0.08}>
              <Panel className="h-full p-6 sm:p-8">
                <LongRunChart data={buckets} height={180} />
              </Panel>
            </Reveal>
            <Reveal delay={0.1}>
              <Panel className="h-full p-6 sm:p-8">
                <PaceChart data={buckets} height={180} />
              </Panel>
            </Reveal>
            <Reveal delay={0.12}>
              <Panel className="h-full p-6 sm:p-8">
                <HeartRateChart data={buckets} height={180} />
              </Panel>
            </Reveal>
            <Reveal delay={0.14}>
              <Panel className="h-full p-6 sm:p-8">
                <PanelHeader label="Recent sessions" />
                <ul className="mt-5 space-y-3">
                  {completed.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-b-0">
                      <span className="im-mono text-[11px] text-muted-2">{formatDayMonth(c.date)}</span>
                      <span className="im-mono text-[12px]">
                        {c.actualDistanceKm ?? '—'} km · RPE {c.rpe ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          </div>

          <Reveal delay={0.16}>
            <Panel className="p-6 sm:p-8">
              <PanelHeader label="Wellbeing trend" />
              <div className="mt-8">
                <WellbeingSmallMultiples data={wellbeingSeries(checkins)} />
              </div>
            </Panel>
          </Reveal>
        </div>

        <div className="min-w-0 space-y-5">
          <Reveal delay={0.02}>
            <AthleteContext
              profile={profile}
              units={profile.units}
              control={
                <CoachingContextControl
                  athleteId={id}
                  phase={profile.trainingPhase}
                  experience={profile.experienceLevel}
                />
              }
            />
          </Reveal>

          <Reveal delay={0.04}>
            <Panel className="p-6">
              <PanelHeader label="Goal" />
              {goal ? (
                <>
                  <p className="mt-4 text-[15px] font-bold">{race?.name ?? EVENT_TYPE_LABELS[goal.eventType]}</p>
                  <p className="im-mono mt-2 text-[12px] text-muted">
                    {formatDayMonth(goal.targetDate)} · {goal.outcome}
                  </p>
                  {goal.why && (
                    <blockquote className="mt-4 border-l-2 border-green pl-4 text-[13px] leading-relaxed text-white">
                      {goal.why}
                    </blockquote>
                  )}
                </>
              ) : (
                <p className="mt-4 text-[14px] text-muted">No goal recorded.</p>
              )}
            </Panel>
          </Reveal>

          {latestCheckIn && (
            <Reveal delay={0.08}>
              <Panel className="p-6" edge={latestCheckIn.attentionLevel !== 'none'}>
                <PanelHeader
                  label={`Check-in · ${formatDayMonth(latestCheckIn.weekStart)}`}
                  action={
                    <Badge
                      tone={
                        latestCheckIn.attentionLevel === 'attention'
                          ? 'alert'
                          : latestCheckIn.attentionLevel === 'watch'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {attentionLabel(latestCheckIn.attentionLevel)}
                    </Badge>
                  }
                />

                <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
                  {Object.entries(latestCheckIn.scores).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-2">
                        {k.replace(/([A-Z])/g, ' $1')}
                      </dt>
                      <dd className="im-mono text-[13px] font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>

                {latestCheckIn.attentionReasons.length > 0 && (
                  <ul className="mt-5 space-y-1.5 border-t border-line pt-4">
                    {latestCheckIn.attentionReasons.map((r) => (
                      <li key={r} className="text-[12px] leading-relaxed text-warn">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 space-y-3.5 border-t border-line pt-4">
                  {[
                    ['Went well', latestCheckIn.wentWell],
                    ['Felt difficult', latestCheckIn.feltDifficult],
                    ['Pain or niggles', latestCheckIn.painOrNiggles],
                    ['For you', latestCheckIn.forCoach],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label}>
                        <p className="im-micro">{label}</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-white">{value}</p>
                      </div>
                    ))}
                </div>

                <div className="mt-6 border-t border-line pt-5">
                  <CheckInResponder
                    checkInId={latestCheckIn.id}
                    athleteId={id}
                    existing={latestCheckIn.coachResponse}
                  />
                </div>
              </Panel>
            </Reveal>
          )}

          <Reveal delay={0.12}>
            <Panel className="p-6">
              <PanelHeader label="Coach notes" />
              <ul className="mt-5 space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="im-mono text-[11px] text-muted-2">
                        {formatDayMonth(n.createdAt.slice(0, 10))}
                      </span>
                      <Badge tone={n.visibility === 'shared' ? 'green' : 'neutral'}>
                        {n.visibility === 'shared' ? 'Shared' : 'Private'}
                      </Badge>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-white">{n.body}</p>
                  </li>
                ))}
                {!notes.length && <p className="text-[13px] text-muted">No notes yet.</p>}
              </ul>
              <div className="mt-6 border-t border-line pt-5">
                <CoachNoteForm athleteId={id} />
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.16}>
            <Panel className="p-6">
              <PanelHeader label="Recent messages" />
              <ul className="mt-5 space-y-3.5">
                {messages.slice(-4).map((m) => (
                  <li key={m.id}>
                    <p className="im-micro">{m.senderId === id ? profile.fullName : 'You'}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{m.body}</p>
                  </li>
                ))}
                {!messages.length && <p className="text-[13px] text-muted">No messages.</p>}
              </ul>
            </Panel>
          </Reveal>
        </div>
      </div>
    </AppPage>
  );
}
