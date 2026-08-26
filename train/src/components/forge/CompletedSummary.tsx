import { Panel } from '@/components/ui/Panel';
import { formatDistance, formatMinutes, formatPace } from '@/lib/domain/dates';
import type { CompletedWorkout, ScheduledWorkout, Units } from '@/lib/domain/types';

/**
 * COMPLETED SUMMARY — what actually happened.
 *
 * Shown against the prescription rather than instead of it, because the gap
 * between the two is the interesting part: an 8K prescribed and a 9.4K run is a
 * different conversation from an 8K run as written. Variance is stated in
 * words, never coloured red — the athlete is not being marked.
 */
export function CompletedSummary({
  logged,
  scheduled,
  units = 'metric',
}: {
  logged: CompletedWorkout;
  scheduled?: ScheduledWorkout | null;
  units?: Units;
}) {
  const prescribedKm = scheduled?.distanceKm ?? null;
  const actualKm = logged.actualDistanceKm ?? null;
  const variance =
    prescribedKm && actualKm && prescribedKm > 0
      ? Math.round(((actualKm - prescribedKm) / prescribedKm) * 100)
      : null;

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="im-micro text-mint">Completed</p>
        {variance != null && Math.abs(variance) >= 5 && (
          <p className="text-[11px] text-ink-secondary">
            {variance > 0 ? `${variance}% further than prescribed` : `${Math.abs(variance)}% short of prescribed`}
          </p>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        {actualKm != null && <Figure label="Distance" value={formatDistance(actualKm, units)} />}
        {logged.actualDurationMinutes != null && (
          <Figure label="Duration" value={formatMinutes(logged.actualDurationMinutes)} />
        )}
        {logged.averagePaceSecPerKm != null && (
          <Figure label="Average pace" value={formatPace(logged.averagePaceSecPerKm, units)} />
        )}
        {logged.averageHeartRate != null && (
          <Figure label="Average HR" value={`${logged.averageHeartRate} bpm`} />
        )}
        {logged.rpe != null && <Figure label="Effort" value={`RPE ${logged.rpe}`} />}
        {logged.sessionRating != null && (
          <Figure label="Felt" value={`${logged.sessionRating} of 5`} />
        )}
      </dl>

      {logged.athleteNotes && (
        <p className="mt-5 border-t border-hairline pt-4 text-[13px] leading-relaxed text-ink-secondary">
          &ldquo;{logged.athleteNotes}&rdquo;
        </p>
      )}
    </Panel>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="im-mono mt-2 text-[15px] font-extrabold text-ink">{value}</dd>
    </div>
  );
}
