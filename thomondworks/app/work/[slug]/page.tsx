import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { ProjectVisual } from "@/components/ProjectCard";
import JsonLd from "@/components/JsonLd";
import { getProject, projects } from "@/lib/projects";
import { site } from "@/lib/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} — ${project.category}`,
    description: project.summary,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: project.cover
      ? { images: [{ url: project.cover.src, alt: project.cover.alt }] }
      : undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const idx = projects.findIndex((p) => p.slug === project.slug);
  const next = projects[(idx + 1) % projects.length];

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Work", item: `${site.url}/work` },
      {
        "@type": "ListItem",
        position: 2,
        name: project.title,
        item: `${site.url}/work/${project.slug}`,
      },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbs} />

      {/* case study hero */}
      <section className="container-tw pb-16 pt-40 md:pt-52">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="label label--bronze" data-reveal="fade">
            {project.category}
          </p>
          <p className="label" data-reveal="fade">
            {project.year}
          </p>
          {project.status === "concept" ? (
            <p className="label label--emerald" data-reveal="fade">
              Concept Study
            </p>
          ) : null}
        </div>
        <h1 className="display mt-8 text-[length:var(--text-display)]" data-split>
          {project.title}
        </h1>
        {project.brandLine ? (
          <p
            className="grotesk-display mt-6 text-[clamp(1.2rem,2.6vw,2rem)]"
            style={{ color: project.accent }}
            data-split
            data-split-delay="0.25"
          >
            {project.brandLine}
          </p>
        ) : null}
        <p className="lede mt-10" data-reveal>
          {project.intro}
        </p>
      </section>

      {/* cover */}
      <section className="container-tw pb-20">
        <div data-img-reveal className="relative aspect-[16/9] overflow-clip bg-surface-2">
          {project.cover ? (
            <Image
              src={project.cover.src}
              alt={project.cover.alt}
              fill
              priority
              sizes="90vw"
              className="object-cover"
            />
          ) : (
            <ProjectVisual project={project} />
          )}
        </div>
      </section>

      {/* meta + body */}
      <section className="container-tw grid gap-14 pb-24 md:grid-cols-[1fr_2fr] md:gap-24 md:pb-32">
        <aside>
          <div className="border-t border-line pt-6" data-reveal>
            <h2 className="label label--bronze mb-5">Scope</h2>
            <ul className="space-y-2.5">
              {project.services.map((s) => (
                <li key={s} className="text-sm text-muted">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 border-t border-line-soft pt-6" data-reveal>
            <h2 className="label label--bronze mb-5">Facts</h2>
            <dl className="space-y-2.5 text-sm text-muted">
              <div className="flex justify-between gap-4">
                <dt>Year</dt>
                <dd className="text-bone">{project.year}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Status</dt>
                <dd className="text-bone">
                  {project.status === "live" ? "Live project" : "Concept study"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Studio</dt>
                <dd className="text-bone">Thomond Works</dd>
              </div>
            </dl>
          </div>
          {project.status === "live" ? (
            <p className="label mt-10 border-t border-line-soft pt-6 leading-relaxed" data-reveal>
              Results &amp; metrics — to be published once verified data is available.
            </p>
          ) : null}
        </aside>

        <div className="space-y-8">
          {project.body.map((para) => (
            <p key={para.slice(0, 32)} className="text-lg leading-relaxed text-muted" data-reveal>
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* gallery */}
      {project.gallery?.length ? (
        <section className="container-tw grid gap-6 pb-24 sm:grid-cols-2 md:pb-32">
          {project.gallery.map((img, i) => (
            <div
              key={img.src}
              data-img-reveal
              className={`relative overflow-clip bg-surface-2 ${
                i === 0 ? "sm:col-span-2 aspect-[16/8]" : "aspect-[4/3]"
              }`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes={i === 0 ? "90vw" : "(min-width: 640px) 45vw, 90vw"}
                className="object-cover"
              />
            </div>
          ))}
        </section>
      ) : null}

      {/* next project */}
      <section className="hairline-t">
        <Link
          href={`/work/${next.slug}`}
          data-cursor="Next"
          className="group container-tw block py-20 md:py-28"
        >
          <p className="label label--bronze" data-reveal="fade">
            Next Project
          </p>
          <p className="display mt-6 text-[length:var(--text-h1)] text-muted transition-colors duration-500 group-hover:text-bone">
            {next.title}
            <span className="ml-6 inline-block transition-transform duration-500 [transition-timing-function:var(--ease-smooth)] group-hover:translate-x-4">
              →
            </span>
          </p>
        </Link>
      </section>

      <section className="hairline-t py-20 md:py-24">
        <div className="container-tw flex flex-wrap items-center justify-between gap-8">
          <p className="font-serif text-2xl text-bone md:text-3xl">
            Want something built like this?
          </p>
          <Button href="/contact">Start a Project</Button>
        </div>
      </section>
    </>
  );
}
