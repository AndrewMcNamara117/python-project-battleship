import type { Metadata } from 'next';
import { LegalPage } from '@/components/public/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Iron Miles Training handles your training and wellbeing data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="August 2026"
      intro="Iron Miles Training holds information about your body, your training and how you are coping with it. That is sensitive, and it is handled as such. This page describes what we collect, who can see it, and how to get it back or have it erased."
      sections={[
        {
          h: 'What we collect',
          p: [
            'Account details: your name, email address, date of birth, location and timezone. Date of birth is used to set training zones sensibly, not for marketing.',
            'Training data: prescribed and completed sessions, distances, durations, paces, heart rate where you supply it, perceived effort, and your own notes on how a session went.',
            'Wellbeing data: your weekly check-in — fatigue, sleep, soreness, stress, motivation, confidence, and the free-text answers you write alongside them.',
            'Billing data: subscription status and invoice history. Card details are handled entirely by Stripe and never reach Iron Miles systems.',
          ],
        },
        {
          h: 'Who can see it',
          p: [
            'You can see everything held about you.',
            'Your coach can see your training and wellbeing data. That is the point of being coached — a check-in nobody reads is a form for its own sake.',
            'Nobody else sees it. Other athletes cannot see your sessions, your check-ins or your notes. The leaderboard shows only a display name and a Forge Score, it is off by default, and it appears only if you switch it on.',
            'Access is enforced in the database itself through row-level security, not only in the application. A query that should not return your data cannot return it.',
          ],
        },
        {
          h: 'What we do not do',
          p: [
            'We do not sell your data, share it with advertisers, or use it to train third-party models.',
            'We do not publish health or check-in information anywhere public.',
            'We do not make medical determinations. The platform flags patterns for a human coach to look at; it does not diagnose, and it never will.',
          ],
        },
        {
          h: 'Your rights',
          p: [
            'Export: download everything held about you as a single JSON file, from your profile settings, at any time.',
            'Deletion: delete your account and all associated training and wellbeing data from your profile settings. Deletion is permanent and cascades through every table.',
            'Correction: edit your profile directly, or ask your coach to correct anything in your training record.',
            'Objection and restriction: contact us and we will act on it. Under GDPR you may also complain to the Irish Data Protection Commission.',
          ],
        },
        {
          h: 'Retention',
          p: [
            'Training history is kept while your account is open, because a coaching decision in month nine depends on what happened in month one.',
            'When you delete your account, training and wellbeing data is erased. Billing records are retained only as long as Irish tax law requires.',
          ],
        },
        {
          h: 'Contact',
          p: ['Data protection queries: privacy@ironmiles.ie. Iron Miles, Limerick, Ireland.'],
        },
      ]}
    />
  );
}
