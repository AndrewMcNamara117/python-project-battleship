/**
 * FORGE's answer set.
 *
 * A fixed knowledge base matched by keyword — no model, no generation. If a
 * question does not match, FORGE says so and points at the human coach rather
 * than improvising. That is the whole design: an assistant that cannot invent
 * training advice cannot invent bad training advice.
 */

export interface ForgeAnswer {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

export const FORGE_ANSWERS: ForgeAnswer[] = [
  {
    id: 'zone-2',
    question: 'What does Zone 2 actually mean?',
    answer:
      'Zone 2 is the effort where you could hold a conversation in full sentences. On a heart-rate monitor it sits roughly between 60 and 70 percent of your maximum, but the conversation test is more reliable than the number. If you are breathing too hard to talk, you are above it.',
    keywords: ['zone 2', 'zone2', 'easy pace', 'aerobic', 'conversational'],
  },
  {
    id: 'rpe',
    question: 'How do I rate RPE?',
    answer:
      'RPE is how hard the session felt to you, from 1 to 10. Ten is everything you had. Six or seven is comfortably hard — you could keep going but you would not want to talk. Three is a genuinely easy day. Rate the session as a whole, not its hardest minute.',
    keywords: ['rpe', 'perceived exertion', 'how hard', 'effort rating'],
  },
  {
    id: 'missed',
    question: 'I missed a session — what now?',
    answer:
      'Nothing. Log it as missed and carry on with the next one as written. Do not try to make it up by doubling tomorrow — that turns one missed session into a bad week. Your coach sees missed sessions and adjusts the following week if a pattern forms.',
    keywords: ['missed', 'skip', 'skipped', 'behind', 'make up'],
  },
  {
    id: 'forge-score',
    question: 'How is my Forge Score calculated?',
    answer:
      'Ten points for a prescribed run, eight for a strength session, five for a weekly check-in, ten for an Iron Miles club run, twenty for a fully adhered week, fifteen for volunteering, and twenty-five for a race. Running further than prescribed earns nothing extra — the score rewards doing the plan, not exceeding it.',
    keywords: ['forge score', 'points', 'score', 'leaderboard points'],
  },
  {
    id: 'leaderboard',
    question: 'Who can see me on the leaderboard?',
    answer:
      'Nobody, unless you switch it on in your profile. Even then, other athletes see only your display name, your training group and your score. Your sessions, paces, heart rate and check-ins are never shown to anyone but you and your coach.',
    keywords: ['leaderboard', 'who can see', 'privacy', 'visible', 'other athletes'],
  },
  {
    id: 'check-in',
    question: 'Why does the check-in matter?',
    answer:
      'Because your logged sessions show what you did, and the check-in shows what it cost you. Two athletes can run the same week and be in completely different states at the end of it. The check-in is how your coach tells which one you are.',
    keywords: ['check-in', 'checkin', 'weekly check', 'why check'],
  },
  {
    id: 'long-run-fuel',
    question: 'How should I fuel a long run?',
    answer:
      'Start earlier than you think — around forty minutes in — and repeat every thirty to forty minutes after that. Practise with exactly what you plan to use on race day. Fuelling is a skill that needs training like any other, and the long run is where you train it.',
    keywords: ['fuel', 'fuelling', 'gel', 'nutrition', 'eat', 'long run food'],
  },
  {
    id: 'strength-soreness',
    question: 'Should I run if I am sore from strength work?',
    answer:
      'General muscle soreness after a new strength block is normal and usually eases within a few days. Easy running often helps. That said, soreness that is sharp, one-sided, or getting worse rather than better is a different thing — log it in your check-in and speak to your coach or a physiotherapist. I am not able to assess it.',
    keywords: ['sore', 'soreness', 'doms', 'stiff', 'aching'],
  },
  {
    id: 'taper',
    question: 'What happens in race week?',
    answer:
      'Volume drops sharply, intensity stays but in small doses, and your job becomes sleeping and eating. Nothing you do in race week makes you fitter. The work is already done.',
    keywords: ['taper', 'race week', 'before race', 'peak'],
  },
  {
    id: 'change-plan',
    question: 'Can I change my programme?',
    answer:
      'You can move a session to another day in your calendar. Changing the shape of the programme — what the sessions are, how far, how hard — is your coach’s call. Message them and say what is not working; that is what the thread is for.',
    keywords: ['change plan', 'edit programme', 'edit program', 'move session', 'reschedule'],
  },
];

const REFERRAL =
  'I do not have an answer for that one. Your coach does — send it to them in your messages and they will come back to you.';

const MEDICAL_PATTERN =
  /\b(injur|pain|hurt|physio|doctor|medic|diagnos|sprain|strain|fracture|tendon|swell|medication|tablet|painkiller)/i;

const MEDICAL_RESPONSE =
  'I am not able to help with anything to do with pain or injury — I am a training assistant, not a clinician, and guessing here would be worse than useless. Describe it in your weekly check-in so your coach sees it, and if it is sharp, worsening, or stopping you walking normally, see a doctor or physiotherapist rather than waiting.';

export function answerQuestion(question: string): { answer: string; matched: string | null } {
  const q = question.toLowerCase().trim();
  if (!q) return { answer: REFERRAL, matched: null };

  // anything clinical short-circuits, before any keyword matching
  if (MEDICAL_PATTERN.test(q)) return { answer: MEDICAL_RESPONSE, matched: 'medical' };

  let best: { entry: ForgeAnswer; score: number } | null = null;
  for (const entry of FORGE_ANSWERS) {
    const score = entry.keywords.reduce((acc, k) => (q.includes(k) ? acc + k.length : acc), 0);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }

  return best ? { answer: best.entry.answer, matched: best.entry.id } : { answer: REFERRAL, matched: null };
}
