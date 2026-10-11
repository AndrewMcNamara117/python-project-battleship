import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { ForgeMessageCard } from '@/components/app/ForgeMessageCard';
import { Rise } from '@/components/motion/Rise';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { dailyMessage, explainSession, weeklySummary } from '@/lib/forge/assistant';
import { ForgeChat } from './ForgeChat';

export const metadata: Metadata = { title: 'FORGE' };

export default async function ForgePage() {
  const ctx = await loadAthleteContext();

  const forgeCtx = {
    profile: ctx.profile,
    today: ctx.today,
    week: ctx.week,
    todaySessions: ctx.todaySessions,
    completedThisWeek: ctx.completedThisWeek,
    lastCheckIn: ctx.checkins[0] ?? null,
    race: ctx.race,
    daysToRace: ctx.daysToRace,
    goalName: ctx.race?.name ?? null,
  };

  const daily = dailyMessage(forgeCtx);
  const weekly = weeklySummary(forgeCtx);
  const enabled = ctx.profile.forgeAssistantEnabled;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Training assistant"
        title="FORGE"
        lead="Reflects your logged training back to you and explains what is scheduled. It is not your coach, and it will not pretend to be."
        action={<Badge tone={enabled ? 'green' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>}
      />

      {!enabled && (
        <Panel className="mt-8 border-warn/35 bg-warn/6 p-6">
          <p className="im-micro text-warn">FORGE is switched off</p>
          <p className="mt-2.5 max-w-[60ch] text-[13px] leading-relaxed text-white">
            Either you turned it off in your profile, or your coach did. Daily messages are paused;
            the question box below still works.
          </p>
          <ButtonLink href="/app/profile" variant="ghost" size="sm" className="mt-5">
            Open profile settings
          </ButtonLink>
        </Panel>
      )}

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <Rise>
            <ForgeChat />
          </Rise>

          <Rise delay={60}>
            <Panel className="p-6 sm:p-8">
              <PanelHeader label="What FORGE will not do" />
              <ul className="mt-5 space-y-3">
                {[
                  'Diagnose, name or grade an injury or condition',
                  'Tell you to push through pain, or to ignore a symptom',
                  'Mention or recommend medication',
                  'Override anything your coach has written',
                  'Invent an answer it does not have',
                ].map((rule) => (
                  <li key={rule} className="flex gap-3 text-[14px] leading-relaxed text-white">
                    <span aria-hidden className="mt-2.5 block h-px w-4 shrink-0 bg-alert" />
                    {rule}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-line pt-5 text-[12px] leading-relaxed text-muted">
                If you describe chest pain, dizziness, fainting, numbness, sharp pain or anything
                worsening, FORGE stops everything else and tells you to seek qualified medical care.
                That path is not optional and cannot be turned off.
              </p>
            </Panel>
          </Rise>
        </div>

        <div className="space-y-5">
          <Rise delay={40}>
            <ForgeMessageCard message={daily} />
          </Rise>
          <Rise delay={80}>
            <ForgeMessageCard message={weekly} />
          </Rise>

          {ctx.todaySessions.filter((s) => s.type !== 'rest').length > 0 && (
            <Rise delay={120}>
              <Panel className="p-6">
                <PanelHeader label="Today's session, explained" />
                <ul className="mt-5 space-y-5">
                  {ctx.todaySessions
                    .filter((s) => s.type !== 'rest')
                    .map((s) => (
                      <li key={s.id}>
                        <p className="text-[14px] font-bold">{s.name}</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">{explainSession(s)}</p>
                      </li>
                    ))}
                </ul>
              </Panel>
            </Rise>
          )}
        </div>
      </div>
    </AppPage>
  );
}
