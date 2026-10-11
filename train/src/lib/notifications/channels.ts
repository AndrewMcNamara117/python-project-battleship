import 'server-only';
import { emailProvider } from './email';
import { renderEmail } from './email/render';
import type { ChannelName, NotificationDraft, NotificationPayload } from '@/lib/domain/notifications';

/**
 * How a notification reaches a coach.
 *
 * The domain does not know whether email is Resend, Postmark or SES, and the
 * roster signal that started all this does not know a channel exists. Adding
 * push later should be a new file here and a row in a preference, not a change
 * to anything that decides what is worth sending.
 */

export interface DeliveryOutcome {
  /**
   * `delivered` is only claimed when the channel genuinely knows. Email
   * reports `sent` — the provider accepted it — and is upgraded to
   * `delivered` later by a webhook, or never, honestly.
   */
  state: 'sent' | 'delivered' | 'failed' | 'failed_permanent' | 'unavailable';
  detail: string;
  /** Recorded on the delivery row so "which provider handled it" is answerable. */
  provider?: string;
  providerMessageId?: string;
  /** The provider's own hint, honoured over our backoff schedule. */
  retryAfterSeconds?: number;
}

export interface ChannelSendInput {
  draft: Pick<NotificationDraft, 'kind' | 'priority' | 'href' | 'title' | 'body'> & {
    payload: NotificationPayload | null;
  };
  recipientEmail: string | null;
  recipientName: string | null;
  athleteName: string | null;
  /** Stable across retries of this delivery. */
  idempotencyKey: string;
}

export interface Channel {
  name: ChannelName;
  /** False when nothing is configured. Honest, rather than a silent no-op. */
  available(): boolean;
  /** What a coach is told this channel will do, on the settings screen. */
  describe(): string;
  send(input: ChannelSendInput): Promise<DeliveryOutcome>;
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
  describe: () => 'Always on.',
  async send() {
    return { state: 'delivered', detail: 'Shown in Iron Miles.', provider: 'in_app' };
  },
};

/**
 * Email.
 *
 * Everything vendor-specific lives under `./email`. This function's job is the
 * part that must not vary by vendor: refuse when nothing is configured, refuse
 * when there is nobody to send to, and render from the structured payload so
 * an athlete's own words can never reach an inbox.
 */
export const emailChannel: Channel = {
  name: 'email',

  available: () => emailProvider() !== null,

  describe() {
    const provider = emailProvider();
    if (!provider) return 'Not set up on this deployment.';
    if (provider.name === 'demo') return 'Simulated in demo mode — nothing is sent.';

    const sender = provider.sender();
    return sender.verified
      ? `Sent from ${sender.from.address}.`
      : `Set up, but ${sender.from.address} is not verified yet.`;
  },

  async send({ draft, recipientEmail, recipientName, idempotencyKey }): Promise<DeliveryOutcome> {
    const provider = emailProvider();
    if (!provider) {
      return {
        state: 'unavailable',
        detail: 'No email provider is configured, so nothing was sent.',
      };
    }
    if (!recipientEmail) {
      return {
        state: 'failed_permanent',
        detail: 'That coach has no email address on their profile.',
        provider: provider.name,
      };
    }

    // A notification with no payload cannot be rendered without falling back to
    // `body`, which quotes the athlete. Refusing is the correct outcome: the
    // coach still has it in Iron Miles, and nothing private left the building.
    const rendered = renderEmail(draft, recipientName);
    if (!rendered) {
      return {
        state: 'failed_permanent',
        detail: 'Nothing to render: this notification carries no email payload.',
        provider: provider.name,
      };
    }

    const result = await provider.send({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: provider.sender().replyTo ?? undefined,
      idempotencyKey,
      // labels for the provider's dashboard; nothing here names a person
      tags: { kind: draft.kind, priority: draft.priority },
    });

    return {
      state: result.state,
      detail: result.detail,
      provider: provider.name,
      providerMessageId: result.providerMessageId,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  },
};

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

/** What each channel would do here, in words a coach can read. */
export function channelDescriptions(): Record<ChannelName, string> {
  return {
    in_app: inAppChannel.describe(),
    email: emailChannel.describe(),
  };
}
