import Image from "next/image";
import { Button, SectionHeading } from "@/components/ui";
import ProjectCard from "@/components/ProjectCard";
import ServicesShowcase from "@/components/ServicesShowcase";
import ProcessTimeline from "@/components/ProcessTimeline";
import ShannonLine from "@/components/ShannonLine";
import JournalCard from "@/components/JournalCard";
import { BridgeMark } from "@/components/Logo";
import { projects } from "@/lib/projects";
import { articles } from "@/lib/journal";

const ironMiles = projects[0];

export default function HomePage() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[100svh] flex-col justify-end overflow-clip">
        <div className="absolute inset-0" aria-hidden="true">
          <div data-parallax="0.08" className="absolute inset-[-6%]">
            <Image
              src="/images/thomond-bridge-dusk.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-45 saturate-[0.55]"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-bg/80 via-bg/30 to-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-bg/40" />
        </div>

        <div data-hero-settle className="container-tw relative pb-24 pt-44 md:pb-32">
          <p className="label label--bronze" data-reveal="fade">
            Independent Digital Studio
            <span className="mx-3 text-line" aria-hidden>
              /
            </span>
            Limerick, Ireland
          </p>
          <h1
            className="display mt-8 max-w-[11em] text-[length:var(--text-display)]"
            data-split
            data-split-delay="0.15"
          >
            Digital experiences. <em className="not-italic text-emerald-bright">Built</em>{" "}
            properly.
          </h1>
          <p className="lede mt-8" data-reveal data-reveal-delay="0.55">
            Thomond Works is a Limerick-based digital studio creating distinctive brands,
            high-performance websites, and digital experiences built to move ambitious
            businesses forward.
          </p>
          <div className="mt-10 flex flex-wrap gap-4" data-reveal data-reveal-delay="0.75">
            <Button href="/work">View Our Work</Button>
            <Button href="/contact" variant="ghost">
              Start a Project
            </Button>
          </div>
        </div>

        <ShannonLine className="absolute bottom-10 left-0 h-14 opacity-70" />
        <p
          className="label absolute bottom-10 right-[max(1.5rem,4vw)] hidden -rotate-90 md:block"
          aria-hidden="true"
        >
          Scroll
        </p>
      </section>

      {/* ============ BRAND STATEMENT ============ */}
      <section className="relative z-10 bg-bg py-28 md:py-44">
        <div className="container-tw">
          <p className="label label--emerald mb-10" data-reveal="fade">
            The short version
          </p>
          <p
            className="display max-w-[13.5em] text-[length:var(--text-h1)]"
            data-split
            data-split-effect="color"
          >
            We don&apos;t just build websites. We build digital identities that move
            businesses forward.
          </p>
        </div>
      </section>

      {/* ============ SELECTED WORK ============ */}
      <section className="py-24 md:py-36">
        <div className="container-tw">
          <SectionHeading
            index="01"
            label="Selected Work"
            title="Work that holds its weight."
            lede="A selection of digital experiences, identities and platforms designed for ambitious businesses."
          />
          <div className="mt-16 grid gap-x-12 gap-y-20 md:mt-24 md:grid-cols-2">
            {projects.map((p, i) => (
              <div key={p.slug} className={i % 2 === 1 ? "md:mt-28" : ""}>
                <ProjectCard project={p} priority={i === 0} />
              </div>
            ))}
          </div>
          <div className="mt-20 text-center" data-reveal>
            <Button href="/work" variant="ghost">
              All Work
            </Button>
          </div>
        </div>
      </section>

      {/* ============ IRON MILES FEATURE ============ */}
      <section className="relative overflow-clip bg-[#050606] py-24 md:py-36">
        <div className="container-tw">
          <div className="flex items-baseline justify-between border-t border-line-soft pt-5">
            <p className="label" data-reveal="fade" style={{ color: ironMiles.accent }}>
              Featured Case Study
            </p>
            <p className="label" data-reveal="fade">
              Limerick, Ireland
            </p>
          </div>

          <div className="mt-14 grid items-end gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
            <div>
              <h2 className="grotesk-display text-[length:var(--text-h1)] text-bone" data-split>
                Iron Miles
              </h2>
              <p
                className="grotesk-display mt-2 text-[clamp(1.4rem,3vw,2.6rem)]"
                data-split
                data-split-delay="0.2"
                style={{ color: ironMiles.accent }}
              >
                Forge one more.
              </p>
              <p className="lede mt-8" data-reveal>
                A Limerick-born endurance and community brand, built around a simple belief:
                there is always one more mile, one more rep, one more opportunity to move
                forward. Identity, website and digital presence — one system from the
                homepage to the finisher medal.
              </p>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2" data-reveal-group>
                {ironMiles.services.map((s) => (
                  <li key={s} className="label">
                    {s}
                  </li>
                ))}
              </ul>
              <div className="mt-10" data-reveal>
                <Button href="/work/iron-miles">View Case Study</Button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_0.8fr] items-end gap-4">
              <div data-img-reveal className="relative aspect-[3/4] overflow-clip">
                <Image
                  src="/images/iron-miles/built-in-the-dark-headtorch-runner-in-the-wo.webp"
                  alt="Iron Miles campaign image — head-torch runner in the woods at night"
                  fill
                  sizes="(min-width: 1024px) 30vw, 55vw"
                  className="object-cover"
                />
              </div>
              <div data-img-reveal className="relative aspect-square overflow-clip">
                <Image
                  src="/images/iron-miles/forge-one-more-iron-miles-finisher-medal.webp"
                  alt="Forge One More — Iron Miles finisher medal"
                  fill
                  sizes="(min-width: 1024px) 22vw, 40vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SERVICES ============ */}
      <section className="py-24 md:py-36">
        <div className="container-tw">
          <SectionHeading
            index="02"
            label="What We Do"
            title="Five disciplines. One standard."
            className="mb-16 md:mb-24"
          />
          <ServicesShowcase />
        </div>
      </section>

      {/* ============ LIMERICK STORY ============ */}
      <section className="relative overflow-clip bg-surface py-24 md:py-40">
        <div className="container-tw grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="label label--bronze" data-reveal="fade">
              Where we&apos;re from
            </p>
            <h2 className="display mt-8 text-[length:var(--text-h1)]" data-split>
              Built here.
            </h2>
            <div className="mt-10 space-y-2 font-serif text-[clamp(1.3rem,2.2vw,1.9rem)] leading-snug text-muted">
              <p data-reveal>Limerick has always been a city of connection.</p>
              <p data-reveal data-reveal-delay="0.08">
                Of bridges. Of movement.
              </p>
              <p data-reveal data-reveal-delay="0.16">
                Of ideas crossing from one side to another.
              </p>
            </div>
            <p className="lede mt-10" data-reveal>
              Thomond Works takes that same philosophy into the digital world — structures
              built properly, connections made deliberately, and work that&apos;s meant to
              stand for years, not seasons.
            </p>
            <div className="mt-12" data-draw aria-hidden="true">
              <svg viewBox="0 0 320 70" className="w-64 text-bronze">
                <path d="M4 8 H316" stroke="currentColor" strokeWidth="2" fill="none" />
                <path
                  d="M30 62 V38 a30 30 0 0 1 60 0 V62 M130 62 V38 a30 30 0 0 1 60 0 V62 M230 62 V38 a30 30 0 0 1 60 0 V62"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <path d="M4 64 H316" stroke="var(--color-emerald)" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          </div>

          <div data-img-reveal className="relative min-h-[26rem] overflow-clip lg:min-h-0">
            <div data-parallax="0.1" className="absolute inset-[-8%]">
              <Image
                src="/images/shannon-bridge-night.jpg"
                alt="Stone bridge arches reflected in the River Shannon at night, Limerick"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-surface/70 to-transparent" />
          </div>
        </div>
      </section>

      {/* ============ PROCESS ============ */}
      <section className="py-24 md:py-36">
        <div className="container-tw">
          <SectionHeading
            index="03"
            label="How We Work"
            title="Built like a bridge — in stages."
            lede="Every project crosses the same six spans. Each one is load-bearing; none of them get skipped."
            className="mb-20 md:mb-28"
          />
          <ProcessTimeline />
        </div>
      </section>

      {/* ============ ABOUT TEASER ============ */}
      <section className="bg-surface py-24 md:py-36">
        <div className="container-tw grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-24">
          <div>
            <SectionHeading
              index="04"
              label="The Studio"
              title={
                <>
                  Rooted in Limerick. <span className="text-muted">Focused on impact.</span>
                </>
              }
            />
            <p className="lede mt-8" data-reveal>
              An independent studio combining strategy, identity, design, development,
              performance and long-term support — for businesses that care about how they
              show up in the world.
            </p>
            <div className="mt-10" data-reveal>
              <Button href="/about" variant="ghost">
                About the Studio
              </Button>
            </div>
          </div>
          <ul className="grid grid-cols-2 content-start gap-px bg-line-soft" data-reveal-group>
            {["Craft", "Clarity", "Performance", "Longevity"].map((v, i) => (
              <li key={v} className="bg-surface p-7 md:p-9">
                <p className="label label--bronze">0{i + 1}</p>
                <p className="mt-4 font-serif text-2xl text-bone">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ TESTIMONIAL (placeholder, clearly marked) ============ */}
      <section className="py-24 md:py-36">
        <div className="container-tw max-w-4xl text-center">
          <p className="label" data-reveal="fade">
            Client Voices — Gathering
          </p>
          <p
            className="display mt-10 text-[clamp(1.6rem,3.4vw,2.8rem)] text-muted"
            data-reveal
          >
            &ldquo;Client testimonials will be published here as projects ship — real words
            from real clients, nothing invented in the meantime.&rdquo;
          </p>
          <p className="label label--bronze mt-8" data-reveal="fade">
            — Thomond Works, being honest
          </p>
        </div>
      </section>

      {/* ============ JOURNAL ============ */}
      <section className="py-24 md:py-32">
        <div className="container-tw">
          <SectionHeading
            index="05"
            label="Journal"
            title="Notes on building properly."
            className="mb-12 md:mb-16"
          />
          <div>
            {articles.slice(0, 3).map((a, i) => (
              <JournalCard key={a.slug} article={a} index={i} />
            ))}
          </div>
          <div className="mt-14" data-reveal>
            <Button href="/journal" variant="ghost">
              All Articles
            </Button>
          </div>
        </div>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section className="relative overflow-clip border-t border-line-soft py-28 md:py-44">
        <div
          className="pointer-events-none absolute right-[-8%] top-1/2 hidden -translate-y-1/2 opacity-[0.13] lg:block"
          aria-hidden="true"
        >
          <BridgeMark className="h-[26rem] w-auto" variant="bronze" />
        </div>
        <div className="container-tw relative">
          <p className="label label--emerald" data-reveal="fade">
            New Business
          </p>
          <h2 className="display mt-8 max-w-[9em] text-[length:var(--text-display)]" data-split>
            Have something worth building?
          </h2>
          <p className="lede mt-8" data-reveal>
            Let&apos;s make it properly. Tell us where you&apos;re trying to get to, and
            we&apos;ll tell you — honestly — how we&apos;d build the bridge.
          </p>
          <div className="mt-12" data-reveal>
            <Button href="/contact">Start a Project</Button>
          </div>
          <p className="label mt-16" data-reveal="fade">
            Or write to{" "}
            <a href="mailto:hello@thomondworks.ie" className="link-line text-bone">
              hello@thomondworks.ie
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
