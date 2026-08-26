import { Panel } from '@/components/ui/Panel';
import { SectionHeading } from './AppHeader';
import { StatusTag } from '@/components/ui/StatusTag';
import { formatDistance } from '@/lib/domain/dates';
import {
  EXPERIENCE_LABELS,
  PHASE_INTENT,
  PHASE_LABELS,
  WEEKDAY_SHORT,
  type Profile,
  type Units,
  type Weekday,
} from '@/lib/domain/types';

const GYM_LABELS: Record<string, string> = {
  full_gym: 'Full gym',
  home_gym: 'Home gym',
  bodyweight: 'Bodyweight only',
  none: 'No equipment',
};

/**
 * ATHLETE CONTEXT — what a coach needs before writing a session.
 *
 * These answers used to live inside an onboarding JSONB blob, which meant the
 * person writing the programme could not see them without opening the database.
 * Availability in particular is the constraint the whole programme is built
 * against: prescribing five days to someone who can train three is the most
 * common way a plan fails.
 */
export function AthleteContext({
  profile,
  units = 'metric',
  control,
}: {
  profile: Profile;
  units?: Units;
  /** Coach-only controls for phase and experience. */
  control?: React.ReactNode;
}) {
  const available = profile.availableTrainingDays;
  const preferred = profile.preferredTrainingDays;

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Athlete context" action={control} />

      {/* availability — the constraint the programme is written against */}
      <div className="mt-5">
        <p className="im-micro">Training days available</p>
        {available.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => {
              const can = available.includes(d);
              const wants = preferred.includes(d);
              return (
                <span
                  key={d}
                  title={
                    can
                      ? wants
                        ? 'Available, and preferred'
                        : 'Available'
                      : 'Not available'
                  }
                  className={`flex h-9 w-11 items-center justify-center rounded-xs border text-[10px] font-bold uppercase tracking-[0.1em] ${
                    can
                      ? wants
                        ? 'border-mint/60 bg-mint/12 text-mint'
                        : 'border-hairline-strong text-ink-body'
                      : 'border-hairline text-ink-faint'
                  }`}
                >
                  {WEEKDAY_SHORT[d]}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="mt-2.5 text-[13px] text-ink-secondary">
            Not recorded. The athlete sets this in their profile.
          </p>
        )}
        {available.length > 0 && (
          <p className="mt-2.5 text-[11px] text-ink-tertiary">
            Filled means available; mint means preferred. {available.length} of 7 days.
          </p>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-hairline pt-5 sm:grid-cols-3">
        <Field
          label="Experience"
          value={profile.experienceLevel ? EXPERIENCE_LABELS[profile.experienceLevel] : null}
        />
        <Field
          label="Current volume"
          value={profile.currentWeeklyKm != null ? `${formatDistance(profile.currentWeeklyKm, units)}/wk` : null}
        />
        <Field
          label="Session length"
          value={profile.typicalSessionMinutes != null ? `${profile.typicalSessionMinutes} min` : null}
        />
        <Field label="Gym access" value={profile.gymAccess ? GYM_LABELS[profile.gymAccess] : null} />
        <Field
          label="Phase"
          value={profile.trainingPhase ? PHASE_LABELS[profile.trainingPhase] : null}
        />
        <Field label="Equipment" value={profile.equipment.length ? `${profile.equipment.length} items` : null} />
      </dl>

      {profile.trainingPhase && (
        <p className="mt-5 border-l-2 border-steel pl-4 text-[13px] leading-relaxed text-ink-body">
          {PHASE_INTENT[profile.trainingPhase]}
        </p>
      )}

      {(profile.injuryNotes || profile.limitationsNotes) && (
        <div className="mt-6 border-t border-hairline pt-5">
          <div className="flex items-center gap-3">
            <p className="im-micro">Reported by the athlete</p>
            <StatusTag tone="progress">Read before prescribing</StatusTag>
          </div>
          {profile.injuryNotes && (
            <p className="mt-3.5 text-[13px] leading-relaxed text-ink-body">{profile.injuryNotes}</p>
          )}
          {profile.limitationsNotes && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
              {profile.limitationsNotes}
            </p>
          )}
          <p className="mt-3.5 text-[11px] leading-relaxed text-ink-tertiary">
            The athlete&rsquo;s own words. Coaching context, not a clinical record — if it needs
            assessing, it needs a clinician.
          </p>
        </div>
      )}

      {profile.equipment.length > 0 && (
        <div className="mt-6 border-t border-hairline pt-5">
          <p className="im-micro">Equipment</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.equipment.map((e) => (
              <li
                key={e}
                className="rounded-xs border border-hairline-strong px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-secondary"
              >
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd
        className={`mt-2 text-[14px] font-semibold ${value ? 'text-ink' : 'text-ink-faint'}`}
      >
        {value ?? 'Not set'}
      </dd>
    </div>
  );
}
