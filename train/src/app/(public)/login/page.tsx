import type { Metadata } from 'next';
import { AuthAltLink, AuthShell } from '@/components/auth/AuthShell';
import { DemoEntry } from '@/components/auth/DemoEntry';
import { isDemoMode } from '@/lib/data';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to the Iron Miles Training Hub.',
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Athlete access"
      title="Back to work."
      lead="Your plan, your logs and your coach are where you left them."
      footer={<AuthAltLink href="/apply" label="Not coached yet?" cta="Apply for a place" />}
    >
      <LoginForm />
      {isDemoMode() && <DemoEntry />}
    </AuthShell>
  );
}
