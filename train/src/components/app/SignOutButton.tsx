'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/actions/auth';

export function SignOutButton() {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      onClick={() => start(() => void signOut())}
      disabled={pending}
      className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-white disabled:opacity-50"
    >
      {pending ? 'Leaving…' : 'Sign out'}
    </button>
  );
}
