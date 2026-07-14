import Link from "next/link";
import type { ReactNode } from "react";

export function Button({
  href,
  variant = "primary",
  children,
  className,
  external,
}: {
  href: string;
  variant?: "primary" | "ghost";
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  const cls = `btn ${variant === "primary" ? "btn--primary" : "btn--ghost"} ${className ?? ""}`;
  const arrow = (
    <span className="btn-arrow" aria-hidden>
      →
    </span>
  );
  if (external) {
    return (
      <a href={href} className={cls} data-magnetic target="_blank" rel="noopener noreferrer">
        {children}
        {arrow}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} data-magnetic>
      {children}
      {arrow}
    </Link>
  );
}

/**
 * Standard section opener: numbered micro-label over a hairline,
 * optional oversized title and lede.
 */
export function SectionHeading({
  index,
  label,
  title,
  lede,
  className,
}: {
  index?: string;
  label: string;
  title?: ReactNode;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between border-t border-line pt-5">
        <p className="label label--bronze" data-reveal="fade">
          {label}
        </p>
        {index ? (
          <p className="label" aria-hidden data-reveal="fade">
            {index}
          </p>
        ) : null}
      </div>
      {title ? (
        <h2 className="display mt-8 text-[length:var(--text-h2)]" data-split>
          {title}
        </h2>
      ) : null}
      {lede ? (
        <p className="lede mt-6" data-reveal>
          {lede}
        </p>
      ) : null}
    </div>
  );
}
