import type { NotificationDraft, NotificationPayload } from '@/lib/domain/notifications';

/**
 * Invented content for the test send.
 *
 * Deliberately fictional, and deliberately not built from the roster: proving
 * that email works should never involve putting a real athlete's name in a
 * mailbox nobody has asked to receive it. The shapes match exactly what the
 * jobs produce, so what arrives is what a coach would get.
 */

type Renderable = Pick<NotificationDraft, 'kind' | 'priority' | 'href' | 'title' | 'body'> & {
  payload: NotificationPayload | null;
};

export function sampleAlert(): Renderable {
  return {
    kind: 'alert',
    priority: 'attention',
    title: 'Sample Athlete — check-in flagged, reported a niggle',
    body: 'Sample content for a test send.',
    href: '/coach',
    payload: {
      kind: 'alert',
      athleteName: 'Sample Athlete',
      signals: ['checkin_flagged', 'soreness_reported'],
    },
  };
}

export function sampleDigest(): Renderable {
  return {
    kind: 'digest',
    priority: 'attention',
    title: "Today's picture",
    body: 'Sample content for a test send.',
    href: '/coach',
    payload: {
      kind: 'digest',
      digest: {
        localDate: new Date().toISOString().slice(0, 10),
        athletes: 12,
        needingAttention: 3,
        flaggedCheckIns: 1,
        reportedPain: 1,
        missedSessions: 5,
        programmesEnding: 2,
        groups: [
          { kind: 'no_training', detail: '3 athletes are waiting on a programme.', count: 3 },
        ],
        items: [
          {
            athleteId: 'sample-1', athleteName: 'Sample Athlete', priority: 'attention',
            reasons: [], kinds: ['checkin_flagged', 'soreness_reported'],
            href: '/coach',
          },
          {
            athleteId: 'sample-2', athleteName: 'Second Sample', priority: 'attention',
            reasons: [], kinds: ['missed_repeated'],
            href: '/coach',
          },
          {
            athleteId: 'sample-3', athleteName: 'Third Sample', priority: 'attention',
            reasons: [], kinds: ['programme_ending'],
            href: '/coach',
          },
        ],
      },
    },
  };
}
