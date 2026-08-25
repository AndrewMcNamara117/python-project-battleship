import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'solid' | 'ghost' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2.5 font-extrabold uppercase tracking-[0.16em] ' +
  'rounded-xs transition-[background-color,border-color,color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-40 select-none';

const variants: Record<Variant, string> = {
  solid: 'bg-mint text-mint-deep hover:bg-mint-bright border border-transparent',
  ghost: 'border border-hairline-strong text-ink-body hover:border-mint hover:text-mint bg-transparent',
  quiet: 'border border-transparent text-ink-secondary hover:text-ink bg-transparent',
  danger: 'border border-status-missed/40 text-status-missed hover:bg-status-missed/10 bg-transparent',
};

const sizes: Record<Size, string> = {
  sm: 'text-[11px] px-3.5 py-2',
  md: 'text-[12px] px-5 py-3',
  lg: 'text-[13px] px-7 py-4',
};

export function buttonClass(variant: Variant = 'solid', size: Size = 'md', extra?: string) {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(' ');
}

export function Button({
  variant = 'solid',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'solid',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
