import type { Metadata } from 'next';
import { AuthAltLink, AuthShell } from '@/components/auth/AuthShell';
import { DemoEntry } from '@/components/auth/DemoEntry';
import { isDemoMode } from '@/lib/data';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to the Iron Miles Training Hub.',
};

/** Why the email link sent someone here, in words. Anything else in the URL is ignored. */
const NOTICE: Record<string, string> = {
  // the commonest cause: confirming on a phone an account made on a laptop —
  // the link cannot finish the sign-in there, but the address is confirmed
  link_expired:
    'That link could not sign you in — it may have expired, or been opened on a different device. If you were confirming your email, it is confirmed: log in below.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const notice = error ? NOTICE[error] : undefined;
  return (
    <AuthShell
      eyebrow="Athlete access"
      title="Back to work."
      lead="Your plan, your logs and your coach are where you left them."
      footer={<AuthAltLink href="/apply" label="Not coached yet?" cta="Apply for a place" />}
    >
      {notice && (
        <p role="status" className="mb-6 border-l-2 border-mint pl-4 text-[13px] leading-relaxed text-ink-body">
          {notice}
        </p>
      )}
      <LoginForm />
      {isDemoMode() && <DemoEntry />}
    </AuthShell>
  );
}
