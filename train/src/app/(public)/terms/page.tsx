import type { Metadata } from 'next';
import { LegalPage } from '@/components/public/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of service for Iron Miles Training.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="August 2026"
      intro="These terms cover what Iron Miles Training is, what it is not, and what each of us is responsible for."
      sections={[
        {
          h: 'What this service is',
          p: [
            'Iron Miles Training provides endurance coaching and a platform for delivering it: a personalised training programme, a strength plan, session logging, progress analytics, weekly check-ins, and direct access to a human coach.',
            'Coaching is individual and delivered by a person. FORGE, the automated assistant, summarises your training and answers questions about the platform. It is a convenience, not a coach, and your coach can disable it for you at any time.',
          ],
        },
        {
          h: 'What this service is not',
          p: [
            'This is not a medical service. It does not diagnose, treat or manage any condition, and nothing in it is medical advice.',
            'If you have a health condition, are returning from injury, or are unsure whether you are fit to train, get clearance from a doctor before starting.',
            'If you experience chest pain, dizziness, fainting, numbness, sharp or worsening pain, or anything else that concerns you: stop training and seek qualified medical care. Do not wait for a check-in.',
          ],
        },
        {
          h: 'Your responsibilities',
          p: [
            'Give accurate information about your health, injuries and training history. The programme is only as safe as what it is built from.',
            'Tell your coach about pain, illness or anything that changes your capacity to train. A session is never worth pushing through something that needs looking at.',
            'Use judgement. A prescribed session is a plan made in advance; you are the one who knows how today actually feels.',
          ],
        },
        {
          h: 'Payment and cancellation',
          p: [
            'Coaching is billed monthly in advance through Stripe. Prices are in euro.',
            'Cancel at any time from your billing settings. Coaching continues to the end of the period already paid for, and no further payment is taken.',
            'You may pause a subscription. Your programme, history and analytics are preserved while paused.',
            'Refunds are handled case by case and in good faith. If we have failed to deliver, we will make it right.',
          ],
        },
        {
          h: 'Acceptable use',
          p: [
            'Your account is yours. Do not share credentials.',
            'Community features exist to support other athletes. Abuse, harassment or the sharing of another member’s health information ends access without refund.',
          ],
        },
        {
          h: 'Liability',
          p: [
            'Endurance training carries inherent risk of injury. By using this service you accept that risk.',
            'Nothing in these terms limits liability for death or personal injury caused by negligence, or for fraud, to the extent Irish law does not permit such limitation.',
          ],
        },
        {
          h: 'Governing law',
          p: ['These terms are governed by the laws of Ireland.'],
        },
      ]}
    />
  );
}
