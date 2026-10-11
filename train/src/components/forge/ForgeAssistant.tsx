import { Panel } from '@/components/ui/Panel';
import type { ForgeMessage } from '@/lib/forge/assistant';

/**
 * FORGE — the training assistant.
 *
 * Its identity is a pulse derived from the Forge Line: a single hairline trace
 * with one live node. No gradient, no robot, no chat mascot, no glow. The
 * restraint is the point — FORGE is an instrument reading, not a character.
 *
 * The disclaimer stays on every non-urgent message. FORGE reflects logged
 * training; it is not the coach, and the interface never lets that blur.
 */
export function ForgeAssistant({ message }: { message: ForgeMessage | null }) {
  if (!message) return null;
  const urgent = message.severity === 'urgent';

  return (
    <Panel
      className={`flex h-full flex-col p-5 sm:p-6 ${
        urgent ? 'border-status-missed/45 bg-status-missed/6' : ''
      }`}
      edge={!urgent}
    >
      <div className="flex items-center gap-3">
        <ForgePulse urgent={urgent} />
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.24em] ${
            urgent ? 'text-status-missed' : 'text-mint'
          }`}
        >
          {urgent ? 'Stop and read this' : 'Forge'}
        </span>
      </div>

      <p
        className={`mt-4 leading-relaxed ${
          urgent ? 'text-[14px] text-ink-body' : 'text-[15px] text-ink-body'
        }`}
      >
        {message.body}
      </p>

      {!urgent && (
        <p className="mt-auto pt-5 text-[11px] leading-relaxed text-ink-tertiary">
          FORGE reflects your logged training. It is an assistant, not your coach.
        </p>
      )}
    </Panel>
  );
}

/**
 * The FORGE signature: a flat trace with a single raised node. Static — a
 * looping pulse would pull the eye away from the training information beside
 * it, which is the opposite of what this component is for.
 */
function ForgePulse({ urgent = false }: { urgent?: boolean }) {
  const colour = urgent ? 'var(--color-status-missed)' : 'var(--color-mint)';
  return (
    <svg viewBox="0 0 46 12" className="h-3 w-[46px] shrink-0" fill="none" aria-hidden>
      <path
        d="M0 6h11l3-4 3.5 8 3-4H46"
        stroke={colour}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="17.5" cy="10" r="1.6" fill={colour} />
    </svg>
  );
}
