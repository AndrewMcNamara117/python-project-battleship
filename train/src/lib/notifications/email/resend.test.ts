import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createServer, type Server } from 'node:http';
import type { ProviderResult } from './provider.ts';

/**
 * The Resend adapter, against a server that behaves like Resend.
 *
 * Every branch here is a failure path, because the failure paths are the ones
 * that decide whether an urgent alert is retried, given up on, or silently
 * lost — and they are the ones that never run in a happy-path demo.
 *
 * The endpoint is overridden through the module's own constant by pointing the
 * adapter at a local server; nothing is stubbed, so the real fetch, the real
 * headers and the real status handling are what is exercised.
 */

let server: Server;
let port = 0;
let next: { status: number; body: string; headers?: Record<string, string> } = {
  status: 200, body: '{"id":"msg_default"}',
};
let lastRequest: { headers: Record<string, string | undefined>; body: unknown } | null = null;

before(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      lastRequest = {
        headers: {
          authorization: req.headers.authorization as string | undefined,
          idempotency: req.headers['idempotency-key'] as string | undefined,
        },
        body: raw ? JSON.parse(raw) : null,
      };
      res.writeHead(next.status, { 'content-type': 'application/json', ...(next.headers ?? {}) });
      res.end(next.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;

  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_ENDPOINT = `http://127.0.0.1:${port}/emails`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function send(): Promise<ProviderResult> {
  const { resendProvider } = await import('./resend.ts');
  return resendProvider.send({
    to: 'coach@example.com',
    subject: 'Iron Miles — a test',
    html: '<p>hi</p>',
    text: 'hi',
    replyTo: 'ironmilesclub@outlook.com',
    idempotencyKey: 'im-delivery-abc',
    tags: { kind: 'alert' },
  });
}

describe('the Resend adapter', () => {
  it('reports sent, with the provider\'s message id, on acceptance', async () => {
    next = { status: 200, body: '{"id":"msg_real"}' };
    const result = await send();

    assert.equal(result.state, 'sent', 'accepted is a handoff, never "delivered"');
    assert.equal(result.providerMessageId, 'msg_real');
  });

  it('sends the idempotency key, so a restart cannot email twice', async () => {
    next = { status: 200, body: '{"id":"msg_real"}' };
    await send();
    assert.equal(lastRequest?.headers.idempotency, 'im-delivery-abc');
    assert.equal(lastRequest?.headers.authorization, 'Bearer test-key');
  });

  it('sets reply-to, so a coach hitting reply reaches a real mailbox', async () => {
    next = { status: 200, body: '{"id":"m"}' };
    await send();
    const body = lastRequest?.body as { reply_to?: string; to?: string[] };
    assert.equal(body.reply_to, 'ironmilesclub@outlook.com');
    assert.deepEqual(body.to, ['coach@example.com']);
  });

  it('treats a rejected address as permanent, not worth four attempts', async () => {
    next = { status: 422, body: '{"message":"Invalid `to` field"}' };
    const result = await send();

    assert.equal(result.state, 'failed_permanent');
    assert.match(result.detail, /Invalid `to` field/);
  });

  it('treats a bad key as permanent', async () => {
    next = { status: 401, body: '{"message":"API key is invalid"}' };
    assert.equal((await send()).state, 'failed_permanent');
  });

  it('treats a server error as worth retrying', async () => {
    next = { status: 503, body: '{"message":"upstream unavailable"}' };
    const result = await send();

    assert.equal(result.state, 'failed');
    assert.match(result.detail, /503/);
  });

  it('honours a rate limit and the provider\'s own retry hint', async () => {
    next = {
      status: 429, body: '{"message":"Too many requests"}',
      headers: { 'retry-after': '17' },
    };
    const result = await send();

    assert.equal(result.state, 'failed');
    assert.equal(result.retryAfterSeconds, 17);
  });

  it('survives a response that is not JSON', async () => {
    next = { status: 502, body: '<html>bad gateway</html>' };
    const result = await send();

    assert.equal(result.state, 'failed');
    assert.match(result.detail, /502/);
  });

  it('treats an unreachable provider as retryable, not as a bad message', async () => {
    const saved = process.env.RESEND_ENDPOINT;
    process.env.RESEND_ENDPOINT = 'http://127.0.0.1:1/emails';
    const result = await send();
    process.env.RESEND_ENDPOINT = saved;

    assert.equal(result.state, 'failed');
    assert.match(result.detail, /Could not reach Resend/);
  });

  it('refuses to send with no key rather than throwing', async () => {
    const saved = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const result = await send();
    process.env.RESEND_API_KEY = saved;

    assert.equal(result.state, 'failed_permanent');
    assert.match(result.detail, /RESEND_API_KEY/);
  });
});

describe('who the email says it is from', () => {
  it('never claims a sender the provider has not verified', async () => {
    const { resendProvider, IRON_MILES_MAILBOX } = await import('./resend.ts');
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM_VERIFIED;

    const sender = resendProvider.sender();
    assert.equal(sender.verified, false);
    assert.equal(sender.from.address, 'onboarding@resend.dev');
    assert.equal(sender.replyTo, IRON_MILES_MAILBOX,
      'the Iron Miles mailbox still receives replies, which needs no verification');
    assert.match(sender.setupRequired ?? '', /Verify a domain/);
  });

  it('will not mark a configured sender verified on its own say-so', async () => {
    const { resendProvider } = await import('./resend.ts');
    process.env.EMAIL_FROM_ADDRESS = 'training@ironmiles.ie';
    delete process.env.EMAIL_FROM_VERIFIED;

    const sender = resendProvider.sender();
    assert.equal(sender.from.address, 'training@ironmiles.ie');
    assert.equal(sender.verified, false, 'configured is not the same as verified');
    assert.match(sender.setupRequired ?? '', /EMAIL_FROM_VERIFIED is not set to true/);
  });

  it('reports verified only when the environment says the domain is', async () => {
    const { resendProvider } = await import('./resend.ts');
    process.env.EMAIL_FROM_ADDRESS = 'training@ironmiles.ie';
    process.env.EMAIL_FROM_VERIFIED = 'true';

    const sender = resendProvider.sender();
    assert.equal(sender.verified, true);
    assert.equal(sender.setupRequired, null);

    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM_VERIFIED;
  });
});
