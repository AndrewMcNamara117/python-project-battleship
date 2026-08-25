import type { Metadata } from 'next';
import { PACKAGES } from '@/data/packages';
import { Faq } from '@/components/public/Faq';
import { PricingCard } from '@/components/public/PricingCard';
import { Section, SectionHead } from '@/components/public/Section';
import { Reveal } from '@/components/motion/Reveal';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Iron Miles coaching packages. Event Ready Coaching at the founding athlete rate — personalised programming, strength, check-ins and the full training hub.',
};

const PRICING_FAQ = [
  {
    q: 'Why is there an application instead of a buy button?',
    a: 'Because coaching only works when it is a fit. We would rather turn someone away than take a monthly payment for a plan that was never going to suit them. Nothing is charged until we have both agreed to start.',
  },
  {
    q: 'What does the founding rate mean?',
    a: 'The first twenty athletes hold this rate for as long as they stay coached, even when the standard price rises. It is not a limited-time discount that quietly expires.',
  },
  {
    q: 'Can I pause instead of cancelling?',
    a: 'Yes. Injury, a work stretch, a new baby — pause from your billing settings and your programme and history stay exactly where you left them.',
  },
  {
    q: 'Will there be other tiers?',
    a: 'Likely. A group option and a race-block one-off are the two most asked for. The platform is built so those slot in without changing anything you are already paying for.',
  },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pt-[clamp(56px,8vw,96px)]">
        <SectionHead
          eyebrow="Pricing"
          title="One package. Everything in it."
          lead="No feature tiers, no add-ons, nothing held back for a higher plan. One rate, and a coach who reads your week."
          align="center"
        />
        <div className="mx-auto mt-14 max-w-[760px]">
          <Reveal>
            <PricingCard pkg={PACKAGES[0]} />
          </Reveal>
        </div>
      </Section>

      <Section tone="raised">
        <div className="grid gap-14 lg:grid-cols-[0.7fr_1fr] lg:gap-20">
          <SectionHead eyebrow="Billing" title="The fine print, plainly." />
          <Reveal>
            <Faq items={PRICING_FAQ} />
          </Reveal>
        </div>
      </Section>
    </>
  );
}
