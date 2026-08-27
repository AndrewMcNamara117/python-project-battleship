import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderEmail } from './render.ts';
import { sampleAlert, sampleDigest } from './sample.ts';
import type { NotificationPayload } from '@/lib/domain/notifications';

/**
 * The claim these tests defend: an athlete's own words never reach an inbox.
 *
 * The in-app card quotes them, deliberately, because it sits behind a login.
 * An email sits in a preview pane on a desk anyone can walk past, so it gets
 * the signal kind and nothing else. That is enforced structurally — the
 * renderer reads `payload`, never `body` — and asserted here.
 */

const WORDS = 'Sharp pain in my left Achilles, worse on hills, and my knee is swollen';

function alertWith(payload: NotificationPayload) {
  return {
    kind: 'alert' as const,
    priority: 'attention' as const,
    href: '/coach/athletes/a1#checkins',
    title: `Aoife Devlin — reported a niggle`,
    // exactly what the in-app card shows, and exactly what must not travel
    body: `Reported: ${WORDS}`,
    payload,
  };
}

describe('what an email may say', () => {
  const email = renderEmail(alertWith({
    kind: 'alert', athleteName: 'Aoife Devlin', signals: ['checkin_flagged', 'soreness_reported'],
  }), 'Ronan Doyle')!;

  it('never carries the athlete\'s words, in the subject or the body', () => {
    for (const text of [email.subject, email.html, email.text]) {
      assert.doesNotMatch(text, /Achilles/i);
      assert.doesNotMatch(text, /swollen/i);
      assert.doesNotMatch(text, /worse on hills/i);
    }
  });

  it('never carries a score or a body part', () => {
    for (const text of [email.subject, email.text]) {
      assert.doesNotMatch(text, /\b(knee|calf|achilles|hamstring|back)\b/i);
      assert.doesNotMatch(text, /\b\d+\s*\/\s*10\b/);
    }
  });

  it('shortens the name, so a preview pane shows less than a full one', () => {
    assert.match(email.subject, /Aoife D\./);
    assert.doesNotMatch(email.subject, /Devlin/);
  });

  it('says enough for the coach to decide whether to stop what they are doing', () => {
    assert.match(email.subject, /needs your attention/i);
    assert.match(email.text, /check-in flagged for review/);
    assert.match(email.text, /reported a niggle/);
  });

  it('points at Iron Miles for the detail rather than repeating it', () => {
    assert.match(email.text, /behind your login/i);
  });

  it('refuses to render at all when there is no payload to render from', () => {
    // the alternative would be falling back to `body`, which quotes the athlete
    assert.equal(renderEmail(alertWith(null as never), 'Ronan'), null);
  });
});

describe('the digest email', () => {
  const digest = renderEmail(sampleDigest(), 'Ronan Doyle')!;

  it('counts the squad without naming a diagnosis or a score', () => {
    assert.match(digest.text, /Athletes.*12/);
    assert.match(digest.text, /Need a look.*3/);
    assert.doesNotMatch(digest.text, /risk|readiness|score/i);
  });

  it('says how many need attention in the subject', () => {
    assert.match(digest.subject, /3 athletes need attention/);
  });

  it('states a shared problem once', () => {
    assert.match(digest.text, /3 athletes are waiting on a programme/);
  });

  it('lists who to open first, by short name and reason category', () => {
    assert.match(digest.text, /Sample A\. — check-in flagged for review · reported a niggle/);
  });

  it('sends absolute links, because a mail client has no origin', () => {
    for (const url of digest.text.match(/https?:\/\/\S+/g) ?? []) {
      assert.match(url, /^https?:\/\/[^/]+\//, url);
    }
    assert.ok((digest.text.match(/https?:\/\//g) ?? []).length >= 2, 'and there are links to follow');
  });

  it('says nothing needs them when nothing does, rather than an empty list', () => {
    const quiet = sampleDigest();
    (quiet.payload as { digest: { items: unknown[]; groups: unknown[] } }).digest.items = [];
    const email = renderEmail(quiet, 'Ronan')!;
    assert.match(email.text, /Nothing needs you this morning/);
    assert.match(email.subject, /today's picture/i);
  });
});

describe('both emails', () => {
  it('carry a plain-text alternative that stands on its own', () => {
    for (const email of [renderEmail(sampleAlert(), 'Ronan')!, renderEmail(sampleDigest(), 'Ronan')!]) {
      assert.ok(email.text.length > 120, 'not a stub');
      assert.doesNotMatch(email.text, /<[a-z]/i, 'no markup leaked into it');
      assert.match(email.text, /IRON MILES/);
      assert.match(email.text, /https?:\/\//, 'a link a text-only client can follow');
    }
  });

  it('escape anything variable, so a name cannot become markup', () => {
    const email = renderEmail(alertWith({
      kind: 'alert', athleteName: '<script>alert(1)</script> Devlin', signals: ['checkin_flagged'],
    }), 'Ronan')!;
    assert.doesNotMatch(email.html, /<script>/);
    assert.match(email.html, /&lt;script&gt;/);
  });

  it('open with the brand and close with why it arrived', () => {
    const email = renderEmail(sampleAlert(), 'Ronan')!;
    assert.match(email.html, /Iron/);
    assert.match(email.html, /notification settings/);
  });
});
