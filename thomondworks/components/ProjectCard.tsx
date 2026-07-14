import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/lib/projects";

/**
 * Art-directed covers for concept studies — no stock photography.
 * Each study gets its own structural composition in the brand system.
 */
export function ProjectVisual({ project }: { project: Project }) {
  const accent = project.accent;
  switch (project.slug) {
    case "the-strand-house":
      return (
        <svg viewBox="0 0 800 600" className="h-full w-full" aria-hidden="true">
          <rect width="800" height="600" fill="var(--color-surface-2)" />
          {/* repeating window arches, warm stone at dusk */}
          {[0, 1, 2, 3].map((c) =>
            [0, 1].map((r) => (
              <path
                key={`${c}-${r}`}
                d={`M${140 + c * 150} ${420 - r * 220} v-80 a45 45 0 0 1 90 0 v80`}
                fill="none"
                stroke={accent}
                strokeWidth="2.5"
                opacity={r === 0 ? 0.9 : 0.35}
              />
            ))
          )}
          <line x1="80" y1="424" x2="720" y2="424" stroke={accent} strokeWidth="2" opacity="0.7" />
          <line x1="80" y1="470" x2="720" y2="470" stroke="var(--color-emerald)" strokeWidth="1.5" opacity="0.4" />
          <text x="84" y="540" fill={accent} opacity="0.55" fontSize="26" fontFamily="var(--font-serif)" letterSpacing="8">
            THE STRAND HOUSE
          </text>
        </svg>
      );
    case "treaty-strength":
      return (
        <svg viewBox="0 0 800 600" className="h-full w-full" aria-hidden="true">
          <rect width="800" height="600" fill="var(--color-surface-2)" />
          {/* barbell plates as structural bars */}
          {[220, 300, 380, 460, 540].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={180 - i * 6}
              width="34"
              height={240 + i * 12}
              fill="none"
              stroke="var(--color-bone)"
              strokeWidth="2.5"
              opacity={0.25 + i * 0.14}
            />
          ))}
          <line x1="120" y1="300" x2="680" y2="300" stroke={accent} strokeWidth="3" />
          <text x="120" y="500" fill="var(--color-bone)" opacity="0.8" fontSize="44" fontWeight="700" fontFamily="var(--font-sans)" letterSpacing="14">
            TREATY
          </text>
          <text x="120" y="548" fill={accent} fontSize="24" fontWeight="600" fontFamily="var(--font-sans)" letterSpacing="20">
            STRENGTH
          </text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 800 600" className="h-full w-full" aria-hidden="true">
          <rect width="800" height="600" fill="var(--color-surface-2)" />
          {/* ruled document grid */}
          {[150, 190, 230, 270, 310, 350, 390].map((y, i) => (
            <line
              key={y}
              x1="110"
              y1={y}
              x2={i % 3 === 2 ? 500 : 690}
              y2={y}
              stroke="var(--color-bone)"
              strokeWidth="1.5"
              opacity="0.22"
            />
          ))}
          <line x1="110" y1="110" x2="690" y2="110" stroke="var(--color-bronze)" strokeWidth="2.5" />
          <text x="110" y="500" fill="var(--color-bone)" opacity="0.85" fontSize="58" fontFamily="var(--font-serif)">
            O&apos;Connell <tspan fill="var(--color-bronze)">&amp;</tspan> Hayes
          </text>
        </svg>
      );
  }
}

export default function ProjectCard({
  project,
  priority = false,
}: {
  project: Project;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/work/${project.slug}`}
      data-cursor="View"
      className="group block focus-visible:outline-offset-8"
    >
      <div data-img-reveal className="relative aspect-[4/3] overflow-clip bg-surface-2">
        {project.cover ? (
          <Image
            src={project.cover.src}
            alt={project.cover.alt}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover transition-transform duration-700 [transition-timing-function:var(--ease-smooth)] group-hover:scale-[1.045]"
          />
        ) : (
          <div className="h-full w-full transition-transform duration-700 [transition-timing-function:var(--ease-smooth)] group-hover:scale-[1.045]">
            <ProjectVisual project={project} />
          </div>
        )}
        {project.status === "concept" ? (
          <span className="label absolute right-4 top-4 border border-line bg-bg/70 px-3 py-1.5 backdrop-blur-sm">
            Concept Study
          </span>
        ) : null}
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <h3 className="font-serif text-[1.6rem] leading-tight text-bone transition-transform duration-500 [transition-timing-function:var(--ease-smooth)] group-hover:translate-x-2">
            {project.title}
          </h3>
          <p className="label mt-2">{project.category}</p>
        </div>
        <p className="label label--bronze shrink-0">{project.year}</p>
      </div>
      <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-muted">{project.summary}</p>
    </Link>
  );
}
