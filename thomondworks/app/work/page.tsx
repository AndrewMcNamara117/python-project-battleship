import type { Metadata } from "next";
import ProjectCard from "@/components/ProjectCard";
import { Button } from "@/components/ui";
import { projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Selected work by Thomond Works — brands, websites and digital experiences designed and built in Limerick, Ireland.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <>
      <section className="container-tw pb-20 pt-40 md:pb-28 md:pt-52">
        <p className="label label--bronze" data-reveal="fade">
          Selected Work
        </p>
        <h1 className="display mt-8 max-w-[10em] text-[length:var(--text-h1)]" data-split>
          Structures that carry businesses forward.
        </h1>
        <p className="lede mt-8" data-reveal>
          Live projects and self-initiated concept studies — always labelled honestly, never
          padded with invented results. The portfolio grows the way good work does: one
          properly built project at a time.
        </p>
      </section>

      <section className="container-tw pb-24 md:pb-36">
        <div className="grid gap-x-12 gap-y-20 md:grid-cols-2">
          {projects.map((p, i) => (
            <div key={p.slug} className={i % 2 === 1 ? "md:mt-28" : ""}>
              <ProjectCard project={p} priority={i === 0} />
            </div>
          ))}
        </div>
      </section>

      <section className="hairline-t py-24 md:py-32">
        <div className="container-tw text-center">
          <h2 className="display text-[length:var(--text-h2)]" data-split>
            Yours could be next.
          </h2>
          <div className="mt-10" data-reveal>
            <Button href="/contact">Start a Project</Button>
          </div>
        </div>
      </section>
    </>
  );
}
