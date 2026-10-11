import { INTENSITY_LABELS, type Intensity } from '@/lib/domain/types';

const ORDER: Intensity[] = ['recovery', 'easy', 'steady', 'hard', 'max'];

/**
 * INTENSITY SCALE — how hard, as an instrument reading.
 *
 * Five steps on a fixed scale, filled to the prescribed level. Deliberately not
 * a coloured pill: a pill tells you the name of the intensity, this tells you
 * where the session sits relative to everything else the athlete does. The word
 * is always present, so the marks are a second channel and never the only one.
 */
export function IntensityScale({
  intensity,
  className,
  showLabel = true,
}: {
  intensity: Intensity;
  className?: string;
  showLabel?: boolean;
}) {
  if (intensity === 'rest') {
    return showLabel ? (
      <span className={`im-micro ${className ?? ''}`}>Rest</span>
    ) : null;
  }

  const level = ORDER.indexOf(intensity);

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <span
        className="flex items-end gap-[3px]"
        role="img"
        aria-label={`Intensity: ${INTENSITY_LABELS[intensity]}, ${level + 1} of ${ORDER.length}`}
      >
        {ORDER.map((step, i) => (
          <span
            key={step}
            aria-hidden
            className={`w-[3px] rounded-[1px] transition-colors ${
              i <= level ? 'bg-mint' : 'bg-steel'
            }`}
            // the scale steps up in height as well as fill, so it reads as a
            // measurement rather than a progress bar
            style={{ height: `${6 + i * 2.5}px` }}
          />
        ))}
      </span>
      {showLabel && (
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
          {INTENSITY_LABELS[intensity]}
        </span>
      )}
    </span>
  );
}
