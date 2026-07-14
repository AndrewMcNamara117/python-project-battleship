import type { Metadata } from "next";
import { Button, SectionHeading } from "@/components/ui";
import { BridgeMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "About — An Independent Digital Studio in Limerick",
  description:
    "Thomond Works is an independent digital studio based in Limerick, Ireland, creating distinctive brands, premium websites and considered digital experiences.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    name: "Craft",
    copy: "Everything is made deliberately — designed on purpose, built by hand, finished at the edges.",
  },
  {
    name: "Clarity",
    copy: "Plain language, honest advice, and websites a visitor understands in five seconds.",
  },
  {
    name: "Performance",
    copy: "Speed, accessibility and search visibility treated as features, with budgets and targets.",
  },
  {
    name: "Longevity",
    copy: "Work that's meant to stand for years — supported, maintained and still sharp at year five.",
  },
];

/** Simplified Ireland silhouette; Limerick marked on the Shannon. */
function IrelandMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 260" className={className} role="img" aria-label="Map of Ireland with Limerick marked">
      <path
        d="M97 10 L118 16 L132 30 L128 44 L142 52 L150 72 L146 92 L154 108 L150 132 L156 154 L148 178 L136 196 L118 210 L124 222 L104 236 L82 230 L60 236 L44 224 L54 214 L34 208 L44 198 L28 188 L40 180 L30 168 L42 160 L34 148 L48 142 L38 128 L52 122 L42 108 L56 100 L46 88 L58 78 L48 64 L64 58 L58 42 L74 40 L70 24 L86 22 Z"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="66" cy="152" r="4" fill="var(--color-emerald)" />
      <circle cx="66" cy="152" r="9" fill="none" stroke="var(--color-emerald)" strokeWidth="1" opacity="0.5" />
      <text x="82" y="156" fill="var(--color-bone)" fontSize="10" fontFamily="var(--font-sans)" letterSpacing="2">
        LIMERICK
      </text>
    </svg>
  );
}

export default function AboutPage() {
  return (
    <>
      <section className="container-tw pb-20 pt-40 md:pb-28 md:pt-52">
        <p className="label label--bronze" data-reveal="fade">
          About the Studio
        </p>
        <h1 className="display mt-8 max-w-[9em] text-[length:var(--text-h1)]" data-split>
          Rooted in Limerick. <span className="text-muted">Focused on impact.</span>
        </h1>
      </section>

      <section className="container-tw grid gap-16 pb-24 md:grid-cols-[1.3fr_1fr] md:gap-24 md:pb-36">
        <div className="space-y-7">
          <p className="lede" data-reveal>
            Thomond Works is an independent digital studio based in Limerick, Ireland.
          </p>
          <p className="text-lg leading-relaxed text-muted" data-reveal>
            We create distinctive brands, premium websites and considered digital
            experiences for businesses that care about how they show up in the world. Our
            work combines strategy, identity, design, development, performance and
            long-term support — one studio accountable for the whole structure.
          </p>
          <p className="text-lg leading-relaxed text-muted" data-reveal>
            The name comes from Thomond Bridge, which has crossed the Shannon beside King
            John&apos;s Castle for centuries. That&apos;s the standard we borrow: build the
            thing properly, and it keeps working long after the opening day.
          </p>
          <p className="font-serif text-2xl text-bone" data-reveal>
            Built locally. Made for everywhere.
          </p>
          <div data-reveal>
            <Button href="/contact" variant="ghost">
              Work With Us
            </Button>
          </div>
        </div>

        <div className="space-y-10">
          {/* founder placeholder — labelled, not faked */}
          <figure
            data-reveal
            className="relative grid aspect-[4/5] place-items-center border border-line-soft bg-surface"
          >
            <BridgeMark className="h-24 w-auto opacity-25" variant="mono" />
            <figcaption className="label absolute bottom-5 left-5">
              Founder portrait — to follow
            </figcaption>
          </figure>
          <div data-reveal>
            <IrelandMap className="mx-auto h-72 w-auto" />
          </div>
        </div>
      </section>

      <section className="bg-surface py-24 md:py-36">
        <div className="container-tw">
          <SectionHeading label="What We Hold To" title="Four load-bearing values." className="mb-14 md:mb-20" />
          <ul className="grid gap-px bg-line-soft sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
            {values.map((v, i) => (
              <li key={v.name} className="bg-surface p-8 md:p-10">
                <p className="label label--bronze">0{i + 1}</p>
                <h3 className="mt-5 font-serif text-2xl text-bone">{v.name}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted">{v.copy}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="container-tw text-center">
          <h2 className="display mx-auto max-w-[11em] text-[length:var(--text-h2)]" data-split>
            The best introduction is a conversation.
          </h2>
          <div className="mt-10" data-reveal>
            <Button href="/contact">Start a Project</Button>
          </div>
        </div>
      </section>
    </>
  );
}
