import 'server-only';
import { siteUrl } from '@/lib/env';
import { EXTERNAL_SIGNAL_LABEL, externalName } from '@/lib/domain/notifications';
import type { Digest, NotificationDraft, NotificationPayload } from '@/lib/domain/notifications';

/**
 * THE EMAIL ITSELF.
 *
 * An operational email, not a marketing one. No hero image, no call to action
 * in a coloured pill the size of a thumb, no footer of social links. A coach
 * opens this on a phone between sessions and needs to know in one glance
 * whether to stop what they are doing.
 *
 * Two rules constrain everything below:
 *
 *   1. It renders from the notification's structured payload, never from its
 *      `body`. The body quotes the athlete; the payload carries signal kinds.
 *      That is what keeps an athlete's words behind a login by construction
 *      rather than by whoever writes the template remembering to.
 *
 *   2. Every path into Iron Miles is an absolute link to an authenticated
 *      page. The link is a destination, never a credential — the page it
 *      lands on re-checks the roster.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* ---------- brand ---------- */

const IRON = '#080808';
const SLATE = '#14181c';
const HAIRLINE = '#262c33';
const INK = '#eeeeee';
const INK_2 = '#a6adb4';
const INK_3 = '#7e858d';
const MINT = '#2dff8a';
const AMBER = '#ffc46b';

// Every mail client that matters supports this; none of them reliably support
// a webfont, so the stack is the same system stack the product uses on the web.
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function link(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  return `${siteUrl.replace(/\/$/, '')}${href.startsWith('/') ? href : `/${href}`}`;
}

/** Emails are assembled as strings, so anything variable is escaped. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title: string, inner: string, footNote: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
</head>
<body bgcolor="${IRON}" style="margin:0;padding:0;background:${IRON};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       bgcolor="${IRON}" style="background:${IRON};padding:28px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           bgcolor="${SLATE}"
           style="max-width:560px;background:${SLATE};border:1px solid ${HAIRLINE};border-radius:4px;">

      <tr><td style="padding:22px 26px 18px;border-bottom:1px solid ${HAIRLINE};">
        <span style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.22em;
                     text-transform:uppercase;color:${MINT};">Iron</span><span
              style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.22em;
                     text-transform:uppercase;color:${INK};"> Miles</span>
        <div style="font-family:${FONT};font-size:10px;letter-spacing:.2em;text-transform:uppercase;
                    color:${INK_3};margin-top:4px;">Training</div>
      </td></tr>

      <tr><td style="padding:24px 26px 26px;">${inner}</td></tr>

      <tr><td style="padding:16px 26px 20px;border-top:1px solid ${HAIRLINE};">
        <p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.6;color:${INK_3};">
          ${footNote}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

const FOOT_ALERT =
  'Sent because you coach this athlete. Change what Iron Miles tells you, and when, ' +
  'in your notification settings.';
const FOOT_DIGEST =
  'Sent because you coach these athletes. Change what Iron Miles tells you, and when, ' +
  'in your notification settings.';

function button(href: string, label: string): string {
  return `<a href="${esc(link(href))}"
     style="display:inline-block;font-family:${FONT};font-size:13px;font-weight:700;
            letter-spacing:.08em;text-transform:uppercase;text-decoration:none;
            color:${IRON};background:${MINT};padding:11px 20px;border-radius:3px;">${esc(label)}</a>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:19px;line-height:1.25;
             font-weight:800;color:${INK};">${esc(text)}</h1>`;
}

function para(text: string, color = INK_2): string {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:14px;line-height:1.6;
             color:${color};">${esc(text)}</p>`;
}

/* ============================================================
 * ALERT
 * ========================================================== */

function alertEmail(payload: { athleteName: string; signals: string[] }, href: string): RenderedEmail {
  const who = externalName(payload.athleteName);
  const reasons = payload.signals
    .map((kind) => EXTERNAL_SIGNAL_LABEL[kind as keyof typeof EXTERNAL_SIGNAL_LABEL] ?? 'needs a look')
    .filter((label, i, all) => all.indexOf(label) === i);

  // Deliberately vague about the content and specific about the person: enough
  // for a coach to decide whether to stop, nothing for a shoulder to read.
  const subject = `Iron Miles — ${who} needs your attention`;

  const list = reasons.map((r) =>
    `<li style="margin:0 0 6px;font-family:${FONT};font-size:14px;line-height:1.55;color:${INK};">${esc(r)}</li>`,
  ).join('');

  const inner = [
    `<div style="font-family:${FONT};font-size:10px;font-weight:800;letter-spacing:.2em;
                 text-transform:uppercase;color:${AMBER};margin-bottom:10px;">Needs attention</div>`,
    h1(`${who} needs your attention`),
    para(`${who} submitted a check-in and Iron Miles raised this:`),
    `<ul style="margin:0 0 18px;padding-left:18px;">${list}</ul>`,
    para('What they wrote is in Iron Miles, where it stays behind your login.', INK_3),
    `<div style="margin-top:6px;">${button(href, `Open ${who.split(' ')[0]}`)}</div>`,
  ].join('');

  const text = [
    `IRON MILES TRAINING`,
    ``,
    `${who} needs your attention.`,
    ``,
    `${who} submitted a check-in and Iron Miles raised this:`,
    ...reasons.map((r) => `  - ${r}`),
    ``,
    `What they wrote is in Iron Miles, where it stays behind your login.`,
    ``,
    `Open ${who}: ${link(href)}`,
    ``,
    `--`,
    `Sent because you coach this athlete. Change what Iron Miles tells you,`,
    `and when, in your notification settings.`,
  ].join('\n');

  return { subject, html: shell(subject, inner, FOOT_ALERT), text };
}

/* ============================================================
 * DIGEST
 * ========================================================== */

function digestEmail(digest: Digest, coachName: string | null, href: string): RenderedEmail {
  const needing = digest.items.length;
  const subject = needing === 0
    ? 'Iron Miles — today\'s picture'
    : `Iron Miles — ${needing} ${needing === 1 ? 'athlete needs' : 'athletes need'} attention`;

  const greeting = coachName ? `${coachName.split(' ')[0]},` : 'Morning,';

  const counts: [string, number][] = [
    ['Athletes', digest.athletes],
    ['Need a look', needing],
    ['Flagged check-ins', digest.flaggedCheckIns],
    ['Reported a niggle', digest.reportedPain],
    ['Missed sessions', digest.missedSessions],
    ['Programmes ending', digest.programmesEnding],
  ];

  const countRows = counts.map(([label, n]) => `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid ${HAIRLINE};font-family:${FONT};
                 font-size:13px;color:${INK_2};">${esc(label)}</td>
      <td align="right" style="padding:7px 0;border-bottom:1px solid ${HAIRLINE};font-family:${FONT};
                 font-size:14px;font-weight:700;color:${n > 0 ? INK : INK_3};">${n}</td>
    </tr>`).join('');

  const groupLines = digest.groups.length
    ? digest.groups.map((g) => para(g.detail, INK_2)).join('')
    : '';

  // Names and reason categories only. The sentences in `reasons` may quote an
  // athlete, so the email uses `kinds` and never touches them.
  const priority = digest.items.slice(0, 8).map((item) => {
    const who = externalName(item.athleteName);
    const labels = item.kinds
      .map((k) => EXTERNAL_SIGNAL_LABEL[k] ?? 'needs a look')
      .filter((l, i, all) => all.indexOf(l) === i)
      .join(' · ');
    return `
      <tr><td style="padding:11px 0;border-bottom:1px solid ${HAIRLINE};">
        <a href="${esc(link(item.href))}" style="font-family:${FONT};font-size:14px;font-weight:700;
              color:${INK};text-decoration:none;">${esc(who)}</a>
        <div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${INK_3};margin-top:3px;">
          ${esc(labels)}
        </div>
      </td></tr>`;
  }).join('');

  const more = digest.items.length > 8
    ? para(`And ${digest.items.length - 8} more on the roster.`, INK_3)
    : '';

  const inner = [
    `<div style="font-family:${FONT};font-size:10px;font-weight:800;letter-spacing:.2em;
                 text-transform:uppercase;color:${MINT};margin-bottom:10px;">Today's picture</div>`,
    h1(greeting),
    needing === 0
      ? para('Nothing needs you this morning. Every athlete is on track.')
      : para(`${needing} of ${digest.athletes} ${needing === 1 ? 'athlete needs' : 'athletes need'} something from you.`),
    groupLines,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
            style="margin:6px 0 20px;">${countRows}</table>`,
    priority
      ? `<div style="font-family:${FONT};font-size:10px;font-weight:800;letter-spacing:.2em;
                     text-transform:uppercase;color:${INK_3};margin-bottom:4px;">Who to open first</div>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin-bottom:18px;">${priority}</table>`
      : '',
    more,
    `<div style="margin-top:6px;">${button(href, 'Open the roster')}</div>`,
  ].join('');

  const text = [
    `IRON MILES TRAINING — TODAY'S PICTURE`,
    ``,
    greeting,
    needing === 0
      ? 'Nothing needs you this morning. Every athlete is on track.'
      : `${needing} of ${digest.athletes} ${needing === 1 ? 'athlete needs' : 'athletes need'} something from you.`,
    ...(digest.groups.length ? ['', ...digest.groups.map((g) => g.detail)] : []),
    ``,
    ...counts.map(([label, n]) => `  ${label.padEnd(20, '.')} ${n}`),
    ...(digest.items.length ? ['', 'WHO TO OPEN FIRST', ''] : []),
    ...digest.items.slice(0, 8).map((item) => {
      const labels = item.kinds
        .map((k) => EXTERNAL_SIGNAL_LABEL[k] ?? 'needs a look')
        .filter((l, i, all) => all.indexOf(l) === i)
        .join(' · ');
      return `  ${externalName(item.athleteName)} — ${labels}\n    ${link(item.href)}`;
    }),
    ...(digest.items.length > 8 ? [``, `And ${digest.items.length - 8} more on the roster.`] : []),
    ``,
    `Open the roster: ${link(href)}`,
    ``,
    `--`,
    `Sent because you coach these athletes. Change what Iron Miles tells you,`,
    `and when, in your notification settings.`,
  ].join('\n');

  return { subject, html: shell(subject, inner, FOOT_DIGEST), text };
}

/* ============================================================ */

/**
 * Render one notification as an email.
 *
 * Returns null when the notification has no payload to render from. That is a
 * refusal rather than a fallback: composing an email out of `body` would put
 * an athlete's words into an inbox, which is the one thing this file exists to
 * prevent.
 */
export function renderEmail(
  draft: Pick<NotificationDraft, 'kind' | 'href'> & { payload: NotificationPayload | null },
  coachName: string | null,
): RenderedEmail | null {
  const payload = draft.payload;
  if (!payload) return null;

  if (payload.kind === 'alert') return alertEmail(payload, draft.href);
  if (payload.kind === 'digest') return digestEmail(payload.digest, coachName, draft.href);
  return null;
}
