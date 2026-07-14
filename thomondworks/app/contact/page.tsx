import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import ShannonLine from "@/components/ShannonLine";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — Start a Project",
  description:
    "Start a project with Thomond Works — web design, branding and digital experiences from Limerick, Ireland. Tell us what you're building.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <section className="container-tw pb-16 pt-40 md:pb-20 md:pt-52">
        <p className="label label--bronze" data-reveal="fade">
          New Business
        </p>
        <h1 className="display mt-8 max-w-[8em] text-[length:var(--text-h1)]" data-split>
          Let&apos;s build something <em className="not-italic text-emerald-bright">properly.</em>
        </h1>
        <p className="lede mt-8" data-reveal>
          Tell us where the business is trying to get to. The more you share, the more
          useful our first reply will be — we answer every serious inquiry within two
          working days.
        </p>
      </section>

      <section className="container-tw grid gap-16 pb-28 md:grid-cols-[2fr_1fr] md:gap-24 md:pb-40">
        <ContactForm />

        <aside className="order-first space-y-10 md:order-none">
          <div className="border-t border-line pt-6" data-reveal>
            <h2 className="label label--bronze mb-4">Studio</h2>
            <p className="text-sm leading-relaxed text-muted">
              {site.name}
              <br />
              {site.location}
            </p>
          </div>
          <div className="border-t border-line-soft pt-6" data-reveal>
            <h2 className="label label--bronze mb-4">Email</h2>
            <a href={`mailto:${site.email}`} className="link-line text-sm text-bone">
              {site.email}
            </a>
          </div>
          <div className="border-t border-line-soft pt-6" data-reveal>
            <h2 className="label label--bronze mb-4">Good to Know</h2>
            <p className="text-sm leading-relaxed text-muted">
              We take on a small number of projects at a time so each one gets built
              properly. If we&apos;re not the right fit for your budget or timeline,
              we&apos;ll say so and point you somewhere useful.
            </p>
          </div>
        </aside>
      </section>

      <ShannonLine className="h-12 pb-4 opacity-50" />
    </>
  );
}
