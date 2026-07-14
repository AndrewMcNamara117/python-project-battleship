import Link from "next/link";
import { formatDate, type Article } from "@/lib/journal";

/** Editorial journal row — index, category, title, standfirst. */
export default function JournalCard({
  article,
  index,
}: {
  article: Article;
  index: number;
}) {
  return (
    <Link
      href={`/journal/${article.slug}`}
      data-cursor="Read"
      className="group grid gap-3 border-t border-line-soft py-8 md:grid-cols-[4rem_1fr_auto] md:items-baseline md:gap-8 md:py-10"
    >
      <span className="label" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span>
        <span className="label label--emerald">{article.category}</span>
        <span className="mt-3 block font-serif text-[clamp(1.4rem,2.6vw,2.2rem)] leading-tight text-bone transition-transform duration-500 [transition-timing-function:var(--ease-smooth)] group-hover:translate-x-2">
          {article.title}
        </span>
        <span className="mt-3 block max-w-[62ch] text-sm leading-relaxed text-muted">
          {article.excerpt}
        </span>
      </span>
      <span className="label md:text-right">
        {formatDate(article.date)}
        <span className="mt-1 block text-muted/70">{article.readingMinutes} min read</span>
      </span>
    </Link>
  );
}
