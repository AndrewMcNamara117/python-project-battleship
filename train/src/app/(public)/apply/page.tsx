import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/public/Section';
import { ApplyForm } from './ApplyForm';

export const metadata: Metadata = {
  title: 'Apply for Coaching',
  description:
    'Apply for one-to-one Iron Miles endurance coaching. Tell us the goal and where you are now — a person reads every application.',
};

export default function ApplyPage() {
  return (
    <Section className="pt-[clamp(56px,8vw,96px)]">
      <div className="grid gap-14 lg:grid-cols-[0.75fr_1fr] lg:gap-20">
        <div>
          <SectionHead
            eyebrow="Apply"
            title={
              <>
                Pick the
                <br />
                <span className="text-green">start line.</span>
              </>
            }
            lead="Five minutes. A person reads every application, and you will hear back within two days either way."
          />
          <dl className="mt-12 space-y-7 border-t border-line pt-8">
            {[
              { t: 'What happens next', d: 'We read it, and reply with either a place, a waitlist date, or an honest no.' },
              { t: 'If it is a fit', d: 'You onboard properly — history, availability, health, preferences — and your first block is written from that.' },
              { t: 'If it is not', d: 'We will say so, and point you at something that suits you better. There is no hard sell here.' },
            ].map((s) => (
              <div key={s.t}>
                <dt className="text-[13px] font-bold uppercase tracking-[0.12em]">{s.t}</dt>
                <dd className="mt-2 max-w-[40ch] text-[13px] leading-relaxed text-muted">{s.d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ApplyForm />
      </div>
    </Section>
  );
}
