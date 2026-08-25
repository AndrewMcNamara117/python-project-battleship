'use client';

import { motion, useReducedMotion } from 'motion/react';
import { IronMilesMark } from '@/components/brand/IronMilesLogo';
import { ForgeRing } from '@/components/hero/ForgeRing';
import { ButtonLink } from '@/components/ui/Button';

const LINE_1 = 'TRAIN WITH';
const LINE_2 = 'PURPOSE.';

function SplitLine({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;

  return (
    <span className={className} aria-hidden>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: '0.35em' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: delay + i * 0.028, ease: [0.22, 1, 0.36, 1] }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

export function Hero() {
  const reduced = useReducedMotion();

  return (
    <section className="im-grain relative min-h-[92svh] overflow-hidden border-b border-line">
      {/* the interactive object sits behind the type, never competing with it */}
      <div className="pointer-events-none absolute inset-0 opacity-90 md:pointer-events-auto">
        <div className="absolute inset-0 md:left-[38%]">
          <ForgeRing />
        </div>
      </div>

      {/* legibility scrim — the type must always clear the object */}
      <div
        aria-hidden
        className="absolute inset-0 z-2 bg-[linear-gradient(100deg,var(--color-onyx)_0%,rgba(11,11,11,0.92)_30%,rgba(11,11,11,0.34)_52%,rgba(11,11,11,0.12)_78%,rgba(11,11,11,0.45)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-2 h-40 bg-[linear-gradient(180deg,transparent,var(--color-onyx))]"
      />

      <div className="relative z-3 mx-auto flex min-h-[92svh] max-w-[1240px] flex-col justify-center px-5 py-24">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3"
        >
          <IronMilesMark height={32} title="Iron Miles" />
          <span className="im-micro text-muted">Iron Miles Training</span>
        </motion.div>

        <h1 className="im-display mt-8 text-[clamp(3rem,11vw,7.2rem)]">
          <span className="sr-only">
            {LINE_1} {LINE_2}
          </span>
          <SplitLine text={LINE_1} delay={0.18} className="block" />
          <SplitLine text={LINE_2} delay={0.42} className="block text-green" />
        </h1>

        <motion.p
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 max-w-[46ch] text-[clamp(1.05rem,1.9vw,1.35rem)] leading-relaxed text-white/90"
        >
          Personalised endurance coaching. Built around your goal. Driven by one mindset:{' '}
          <span className="text-green">Forge One More.</span>
        </motion.p>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <ButtonLink href="/apply" size="lg">
            Apply for coaching
          </ButtonLink>
          <ButtonLink href="/app" variant="ghost" size="lg">
            Explore the platform
          </ButtonLink>
        </motion.div>

        <motion.dl
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.05 }}
          className="mt-16 flex flex-wrap gap-x-12 gap-y-6 border-t border-line pt-8"
        >
          {[
            { k: 'Based in', v: 'Limerick' },
            { k: 'Coached by', v: 'A human' },
            { k: 'Built for', v: '5K to ultra' },
          ].map((s) => (
            <div key={s.k}>
              <dt className="im-micro">{s.k}</dt>
              <dd className="mt-2 text-[15px] font-bold uppercase tracking-[0.1em]">{s.v}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
