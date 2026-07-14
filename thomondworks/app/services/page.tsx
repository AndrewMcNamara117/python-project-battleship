import type { Metadata } from "next";
import ProcessTimeline from "@/components/ProcessTimeline";
import { Button, SectionHeading } from "@/components/ui";
import { services } from "@/lib/services";

export const metadata: Metadata = {
  title: "Services — Web Design, Branding & SEO in Limerick",
  description:
    "Web design and development, brand identity, digital strategy, SEO and website care — five disciplines, one standard, from a Limerick digital studio.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <section className="container-tw pb-20 pt-40 md:pb-28 md:pt-52">
        <p className="label label--bronze" data-reveal="fade">
          Services
        </p>
        <h1 className="display mt-8 max-w-[10em] text-[length:var(--text-h1)]" data-split>
          Five disciplines. One standard: built properly.
        </h1>
        <p className="lede mt-8" data-reveal>
          Everything we offer exists to do one job — move an ambitious business forward.
          Strategy shapes design, design shapes engineering, and engineering is measured,
          maintained and made to last.
        </p>
      </section>

      <div className="container-tw pb-24 md:pb-32">
        {services.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className="grid gap-8 border-t border-line py-16 [scroll-margin-top:6rem] md:grid-cols-[4rem_1.2fr_1fr] md:gap-12 md:py-24"
          >
            <p className="label label--emerald" data-reveal="fade">
              {s.index}
            </p>
            <div>
              <h2 className="display text-[length:var(--text-h3)]" data-split>
                {s.title}
              </h2>
              <p className="lede mt-6" data-reveal>
                {s.description}
              </p>
              {i === 0 ? (
                <p className="mt-6 max-w-[52ch] text-sm leading-relaxed text-muted" data-reveal>
                  Every build is bespoke — no themes, no page-builders — with performance
                  budgets, accessibility and search visibility engineered in from the first
                  commit rather than bolted on at the end.
                </p>
              ) : null}
            </div>
            <ul className="content-start space-y-3 md:pt-2" data-reveal-group>
              {s.details.map((d) => (
                <li
                  key={d}
                  className="border-b border-line-soft pb-3 text-sm text-muted"
                >
                  {d}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="bg-surface py-24 md:py-36">
        <div className="container-tw">
          <SectionHeading
            label="How We Work"
            title="Six spans, every time."
            className="mb-20 md:mb-28"
          />
          <ProcessTimeline />
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="container-tw text-center">
          <h2 className="display mx-auto max-w-[12em] text-[length:var(--text-h2)]" data-split>
            Not sure which of these you need?
          </h2>
          <p className="lede mx-auto mt-6" data-reveal>
            That&apos;s normal — it&apos;s usually a mix. Tell us the business problem and
            we&apos;ll map the shortest route across.
          </p>
          <div className="mt-10" data-reveal>
            <Button href="/contact">Start a Project</Button>
          </div>
        </div>
      </section>
    </>
  );
}
