import { NextResponse } from 'next/server';
import { isJobName, JOB_NAMES, runJob } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled job runner.
 *
 * Authorised by a bearer secret, checked in constant time. Vercel Cron sends
 * this header automatically; anything else needs the secret. Without CRON_SECRET
 * set the endpoint refuses to run rather than defaulting open.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided.length !== secret.length) return false;

  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { job } = await params;
  if (!isJobName(job)) {
    return NextResponse.json({ error: 'Unknown job', available: JOB_NAMES }, { status: 404 });
  }

  try {
    const report = await runJob(job);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job failed';
    return NextResponse.json({ job, error: message }, { status: 500 });
  }
}
