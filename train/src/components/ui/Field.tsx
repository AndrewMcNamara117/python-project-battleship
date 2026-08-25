'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';

const inputBase =
  'w-full rounded-xs border border-line-2 bg-iron-2 px-4 py-3 text-[15px] text-white ' +
  'placeholder:text-muted-2 transition-colors duration-200 ' +
  'hover:border-line-2 focus:border-green focus:outline-none ' +
  'disabled:opacity-50 aria-[invalid=true]:border-alert';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[11px] font-bold uppercase tracking-[0.2em] text-muted"
      >
        {label}
        {required && (
          <span className="ml-1 text-green" aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="mt-1.5 text-[12px] leading-relaxed text-muted-2">
          {hint}
        </p>
      )}
      <div className="mt-2.5">
        {children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-[12px] font-bold text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={[inputBase, className].filter(Boolean).join(' ')} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={4}
      className={[inputBase, 'resize-y leading-relaxed', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={[inputBase, 'appearance-none pr-10', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: ComponentProps<'input'> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={`flex gap-3 ${className ?? ''}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4.5 shrink-0 appearance-none rounded-[2px] border border-line-2 bg-iron-2 transition-colors checked:border-green checked:bg-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
        {...rest}
      />
      <label htmlFor={id} className="cursor-pointer text-[13px] leading-relaxed text-white">
        {label}
        {description && <span className="mt-1 block text-[12px] text-muted">{description}</span>}
      </label>
    </div>
  );
}

/** Segmented control — used wherever a select would feel heavier than the choice. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid gap-2 sm:grid-flow-col sm:auto-cols-fr ${className ?? ''}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-xs border px-4 py-3 text-left transition-colors duration-200 ${
              active
                ? 'border-green bg-green/8 text-white'
                : 'border-line-2 text-muted hover:border-line-2 hover:text-white'
            }`}
          >
            <span className="block text-[12px] font-bold uppercase tracking-[0.14em]">{o.label}</span>
            {o.hint && <span className="mt-1 block text-[11px] leading-snug text-muted-2">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 1–10 scale — the check-in's primary input. Keyboard-operable as a radio group. */
export function ScaleInput({
  value,
  onChange,
  lowLabel,
  highLabel,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
  ariaLabel: string;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = n <= value;
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n} out of 10`}
              onClick={() => onChange(n)}
              className={`group relative h-11 flex-1 rounded-xs border transition-colors duration-150 ${
                selected
                  ? 'border-green bg-green text-green-deep'
                  : active
                    ? 'border-green/40 bg-green/12 text-white'
                    : 'border-line-2 text-muted-2 hover:border-line-2 hover:bg-white/3'
              }`}
            >
              <span className="im-mono text-[12px] font-bold">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-2">{lowLabel}</span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-2">{highLabel}</span>
      </div>
    </div>
  );
}
