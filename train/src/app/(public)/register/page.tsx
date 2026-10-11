import type { Metadata } from 'next';
import { AuthAltLink, AuthShell } from '@/components/auth/AuthShell';
import { DemoEntry } from '@/components/auth/DemoEntry';
import { isDemoMode } from '@/lib/data';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create an Iron Miles Training account.',
};

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="New athlete"
      title="Start the file."
      lead="Create the account, then onboarding takes about eight minutes. Everything after that is training."
      footer={<AuthAltLink href="/login" label="Already have an account?" cta="Log in" />}
    >
      <RegisterForm />
      {isDemoMode() && <DemoEntry />}
    </AuthShell>
  );
}
