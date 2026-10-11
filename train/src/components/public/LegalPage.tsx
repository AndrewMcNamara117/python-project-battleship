import { Section } from '@/components/public/Section';

export interface LegalSection {
  h: string;
  p: string[];
}

/**
 * Legal pages are drafts written to be readable, not to be relied on.
 * The banner is deliberately loud: these need a solicitor's review before
 * the platform takes its first payment.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <Section className="pt-[clamp(56px,8vw,96px)]">
      <div className="mx-auto max-w-[74ch]">
        <p className="im-eyebrow">Legal</p>
        <h1 className="im-display mt-5 text-[clamp(2.2rem,6vw,3.4rem)]">{title}</h1>
        <p className="im-micro mt-5">Last updated {updated}</p>

        <div className="mt-9 border border-warn/35 bg-warn/8 p-5">
          <p className="im-micro text-warn">Draft — solicitor review required</p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-white">
            This document is a working draft written for clarity, not a legal instrument. It must be
            reviewed by a qualified solicitor — with particular attention to health-data handling
            under GDPR — before Iron Miles Training accepts its first payment.
          </p>
        </div>

        <p className="mt-10 text-[16px] leading-relaxed text-muted">{intro}</p>

        <div className="mt-12 space-y-11">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-[1.1rem] font-bold uppercase tracking-[0.04em]">{s.h}</h2>
              <div className="mt-4 space-y-4">
                {s.p.map((para, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-muted">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Section>
  );
}
