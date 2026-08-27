import 'server-only';
import { IRON_MILES_MAILBOX } from './resend';
import type { EmailMessage, EmailProvider, ProviderResult, SenderIdentity } from './provider';

/**
 * DEMO MODE.
 *
 * Demo mode exists so the whole product can be clicked through without
 * provisioning anything. That has to include email — a coach exploring Iron
 * Miles should see where an email would appear and what it would say.
 *
 * What it must never do is imply that one was sent. Every outcome this
 * provider returns is prefixed DEMO, the message id is prefixed `demo_` so it
 * can never be mistaken for a provider's, and the delivery log a coach reads
 * says "simulated" in plain words.
 *
 * The rendered message is logged so it can be read during development; that is
 * the whole of the simulation.
 */
export const simulatedProvider: EmailProvider = {
  name: 'demo',

  configured: () => true,

  sender(): SenderIdentity {
    return {
      from: { address: 'demo@ironmiles.invalid', name: 'Iron Miles Training' },
      replyTo: IRON_MILES_MAILBOX,
      verified: false,
      setupRequired:
        'Demo mode simulates email. Nothing is sent. Set RESEND_API_KEY to send for real.',
    };
  },

  async send(message: EmailMessage): Promise<ProviderResult> {
    console.info(
      `[email:demo] would send to ${message.to}\n` +
      `  subject: ${message.subject}\n` +
      `  text:\n${message.text.split('\n').map((l) => `    ${l}`).join('\n')}`,
    );

    return {
      state: 'sent',
      detail: 'DEMO — email delivery simulated. Nothing was sent.',
      providerMessageId: `demo_${message.idempotencyKey}`,
    };
  },
};
