const stages = [
  {
    n: "01",
    name: "Discover",
    copy: "We start with the business, not the website — goals, customers, competitors, constraints. What is this actually for?",
  },
  {
    n: "02",
    name: "Define",
    copy: "Strategy, sitemap, content priorities and success measures agreed before a pixel is designed. The foundations are set.",
  },
  {
    n: "03",
    name: "Design",
    copy: "Identity, layout systems and interaction design — art-directed, reviewed together, and built to your brand rather than a template.",
  },
  {
    n: "04",
    name: "Build",
    copy: "Clean, fast, accessible engineering. Performance budgets and device testing are part of the build, not an afterthought.",
  },
  {
    n: "05",
    name: "Refine",
    copy: "Content, motion, speed and SEO tuned against real devices and real data until the whole structure holds its weight.",
  },
  {
    n: "06",
    name: "Launch",
    copy: "A managed handover — analytics, training and a care plan, so launch day is the beginning rather than the end.",
  },
];

/**
 * "How we work" — a blueprint spine that draws itself as you scroll,
 * each stage activating like a stage of bridge construction.
 */
export default function ProcessTimeline() {
  return (
    <div data-draw="scrub" className="relative">
      {/* the drawn spine */}
      <svg
        className="pointer-events-none absolute left-[1.15rem] top-0 h-full w-px md:left-1/2"
        viewBox="0 0 2 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M1 0 V100" stroke="var(--color-bronze)" strokeWidth="2" fill="none" />
      </svg>

      <ol className="space-y-16 md:space-y-24">
        {stages.map((stage, i) => (
          <li
            key={stage.n}
            className={`relative grid gap-4 pl-14 md:w-1/2 md:gap-2 md:pl-0 ${
              i % 2 === 0
                ? "md:mr-auto md:pr-16 md:text-right"
                : "md:ml-auto md:pl-16"
            }`}
            data-reveal={i % 2 === 0 ? "left" : "right"}
          >
            {/* joint marker on the spine */}
            <span
              aria-hidden
              className={`absolute top-1 grid h-9 w-9 -translate-x-1/2 place-items-center border border-bronze/60 bg-bg left-[1.15rem] ${
                i % 2 === 0 ? "md:left-auto md:right-0 md:translate-x-1/2" : "md:left-0"
              }`}
            >
              <span className="h-1.5 w-1.5 bg-emerald" />
            </span>
            <p className="label label--emerald">{stage.n}</p>
            <h3 className="font-serif text-[clamp(1.5rem,2.4vw,2.1rem)] leading-none text-bone">
              {stage.name}
            </h3>
            <p
              className={`max-w-[44ch] text-sm leading-relaxed text-muted ${
                i % 2 === 0 ? "md:ml-auto" : ""
              }`}
            >
              {stage.copy}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
