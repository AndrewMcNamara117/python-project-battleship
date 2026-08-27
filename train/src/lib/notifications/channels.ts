import 'server-only';
import { optionalServerEnv } from '@/lib/env';
import { externalPreview, externalSubject } from '@/lib/domain/notifications';
import type { ChannelName, NotificationDraft } from '@/lib/domain/notifications';

/**
 * How a notification reaches a coach.
 *
 * The domain does not know whether email is Resend, Postmark or SES, and the
 * roster signal that started all this does not know a channel exists. Adding
 * push later should be a new file here and a row in a preference, not a change
 * to anything that decides what is worth sending.
 */

export interface DeliveryOutcome {
  state: 'delivered' | 'failed' | 'unavailable';
  detail: string;
  /** Worth trying again — a timeout, a 500. A bad address is not. */
  retryable: boolean;
}

export interface Channel {
  name: ChannelName;
  /** False when nothing is configured. Honest, rather than a silent no-op. */
  available(): boolean;
  send(input: {
    draft: NotificationDraft;
    recipientEmail: string | null;
    athleteName: string | null;
  }): Promise<DeliveryOutcome>;
}

/**
 * In-app.
 *
 * The notification row *is* the delivery: writing it put it in the coach's
 * notification centre. This channel exists so that in-app is a channel like
 * any other rather than a special case the rest of the code has to know about.
 */
export const inAppChannel: Channel = {
  name: 'in_app',
  available: () => true,
  async send() {
    return { state: 'delivered', detail: 'Shown in Iron Miles.', retryable: false };
  },
};

/**
 * Email.
 *
 * No provider is configured in this environment, and this says so rather than
 * reporting a send that did not happen. When one is added, only the `send`
 * body below changes — the domain, the jobs and the preference model already
 * treat email as a real channel.
 */
export const emailChannel: Channel = {
  name: 'email',

  available: () => Boolean(optionalServerEnv('EMAIL_PROVIDER_KEY')),

  async send({ draft, recipientEmail, athleteName }) {
    if (!emailChannel.available()) {
      return {
        state: 'unavailable',
        detail: 'No email provider is configured, so nothing was sent.',
        retryable: false,
      };
    }
    if (!recipientEmail) {
      return { state: 'failed', detail: 'That coach has no email address.', retryable: false };
    }

    // What would go out. Composed here so the privacy rule — no health detail
    // in a subject line or preview — is enforced at the boundary rather than
    // trusted to whoever writes the provider call.
    const subject = externalSubject(draft, athleteName);
    const preview = externalPreview(draft);

    try {
      const outcome = await sendViaProvider({ to: recipientEmail, subject, preview, href: draft.href });
      return outcome;
    } catch (error) {
      return {
        state: 'failed',
        detail: error instanceof Error ? error.message : 'The email provider did not respond.',
        retryable: true,
      };
    }
  },
};

/**
 * The one place a vendor would appear.
 *
 * Unreachable today: `available()` returns false without a key, so nothing
 * calls this. It is here so the shape of the integration is settled and the
 * failure paths around it are already written and tested.
 */
async function sendViaProvider(_input: {
  to: string; subject: string; preview: string; href: string;
}): Promise<DeliveryOutcome> {
  throw new Error('No email provider is wired up yet.');
}

const CHANNELS: Record<ChannelName, Channel> = {
  in_app: inAppChannel,
  email: emailChannel,
};

export function channelFor(name: ChannelName): Channel {
  return CHANNELS[name];
}

/** What a coach can actually choose, so the settings screen cannot offer a lie. */
export function availableChannels(): ChannelName[] {
  return (Object.keys(CHANNELS) as ChannelName[]).filter((name) => CHANNELS[name].available());
}
