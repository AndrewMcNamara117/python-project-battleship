import Link from "next/link";
import { BridgeMark } from "./Logo";
import { nav, site } from "@/lib/site";
import { services } from "@/lib/services";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="hairline-t relative overflow-clip bg-surface">
      <div className="container-tw pb-10 pt-20 md:pt-28">
        {/* oversized sign-off */}
        <div className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
          <div>
            <BridgeMark className="mb-8 h-14 w-auto" />
            <p className="font-serif text-[clamp(2.4rem,6vw,5.2rem)] leading-[1.02] tracking-tight text-bone">
              Built in Limerick.
              <br />
              <span className="text-muted">Made for everywhere.</span>
            </p>
          </div>
          <Link href="/contact" className="btn btn--primary shrink-0" data-magnetic>
            Start a Project
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>

        {/* columns */}
        <div className="mt-16 grid gap-10 border-t border-line-soft pt-12 sm:grid-cols-2 lg:grid-cols-4 md:mt-24">
          <div>
            <h2 className="label label--bronze mb-5">Navigate</h2>
            <ul className="space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="link-line text-sm text-muted hover:text-bone">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label label--bronze mb-5">Services</h2>
            <ul className="space-y-3">
              {services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/services#${s.id}`}
                    className="link-line text-sm text-muted hover:text-bone"
                  >
                    {s.title.replace(" & Development", "")}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label label--bronze mb-5">Contact</h2>
            <ul className="space-y-3 text-sm text-muted">
              <li>
                <a href={`mailto:${site.email}`} className="link-line hover:text-bone">
                  {site.email}
                </a>
              </li>
              <li>{site.location}</li>
            </ul>
          </div>
          <div>
            <h2 className="label label--bronze mb-5">Elsewhere</h2>
            <ul className="space-y-3 text-sm text-muted">
              <li>
                <a
                  href={site.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-line hover:text-bone"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={site.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-line hover:text-bone"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* legal */}
        <div className="mt-16 flex flex-col gap-4 border-t border-line-soft pt-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Thomond Works. Digital experiences, built properly.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="link-line hover:text-bone">
              Privacy
            </Link>
            <Link href="/privacy#cookies" className="link-line hover:text-bone">
              Cookies
            </Link>
            <Link href="/terms" className="link-line hover:text-bone">
              Terms
            </Link>
          </div>
        </div>
      </div>

      {/* quiet river beneath everything */}
      <svg
        className="tw-river pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full opacity-[0.16]"
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 30 Q150 18 300 30 T600 30 T900 30 T1200 30"
          fill="none"
          stroke="var(--color-emerald)"
          strokeWidth="1.5"
          strokeDasharray="90 40"
        />
      </svg>
    </footer>
  );
}
