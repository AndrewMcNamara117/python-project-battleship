import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { Button } from "@/components/ui";
import { articles, formatDate, getArticle } from "@/lib/journal";
import { site } from "@/lib/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/journal/${article.slug}` },
    openGraph: { type: "article", publishedTime: article.date },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const idx = articles.findIndex((a) => a.slug === article.slug);
  const next = articles[(idx + 1) % articles.length];

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        datePublished: article.date,
        articleSection: article.category,
        author: { "@type": "Organization", name: site.name, url: site.url },
        publisher: { "@id": `${site.url}/#org` },
        mainEntityOfPage: `${site.url}/journal/${article.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Journal", item: `${site.url}/journal` },
          {
            "@type": "ListItem",
            position: 2,
            name: article.title,
            item: `${site.url}/journal/${article.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={schema} />

      <article className="container-tw pb-24 pt-40 md:pt-52">
        <header className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="label label--emerald" data-reveal="fade">
              {article.category}
            </p>
            <p className="label" data-reveal="fade">
              {formatDate(article.date)} · {article.readingMinutes} min read
            </p>
          </div>
          <h1 className="display mt-8 text-[length:var(--text-h1)]" data-split>
            {article.title}
          </h1>
          <p className="lede mt-8" data-reveal>
            {article.excerpt}
          </p>
        </header>

        <div className="mx-auto mt-16 max-w-3xl border-t border-line pt-12">
          {article.body.map((block, i) =>
            block.type === "h2" ? (
              <h2
                key={i}
                className="mb-5 mt-12 font-serif text-[1.6rem] leading-tight text-bone first:mt-0"
                data-reveal
              >
                {block.text}
              </h2>
            ) : (
              <p key={i} className="mb-6 text-lg leading-relaxed text-muted" data-reveal>
                {block.text}
              </p>
            )
          )}
        </div>

        <footer className="mx-auto mt-16 max-w-3xl border-t border-line-soft pt-10">
          <p className="text-sm text-muted">
            Written by Thomond Works — an independent digital studio in Limerick, Ireland.
          </p>
        </footer>
      </article>

      <section className="hairline-t">
        <Link
          href={`/journal/${next.slug}`}
          data-cursor="Read"
          className="group container-tw block py-16 md:py-20"
        >
          <p className="label label--bronze">Next Article</p>
          <p className="mt-5 font-serif text-[clamp(1.5rem,3vw,2.4rem)] leading-tight text-muted transition-colors duration-500 group-hover:text-bone">
            {next.title}
            <span className="ml-4 inline-block transition-transform duration-500 [transition-timing-function:var(--ease-smooth)] group-hover:translate-x-3">
              →
            </span>
          </p>
        </Link>
      </section>

      <section className="hairline-t py-20">
        <div className="container-tw flex flex-wrap items-center justify-between gap-8">
          <p className="font-serif text-2xl text-bone md:text-3xl">
            Building something this applies to?
          </p>
          <Button href="/contact">Start a Project</Button>
        </div>
      </section>
    </>
  );
}
