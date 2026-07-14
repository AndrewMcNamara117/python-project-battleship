import type { Metadata } from "next";
import JournalCard from "@/components/JournalCard";
import { articles } from "@/lib/journal";

export const metadata: Metadata = {
  title: "Journal — Notes on Design, Performance & Digital Strategy",
  description:
    "Notes from Thomond Works on web design, branding, SEO, performance and building digital things properly — written from Limerick, Ireland.",
  alternates: { canonical: "/journal" },
};

export default function JournalPage() {
  return (
    <>
      <section className="container-tw pb-16 pt-40 md:pb-24 md:pt-52">
        <p className="label label--bronze" data-reveal="fade">
          Journal
        </p>
        <h1 className="display mt-8 max-w-[10em] text-[length:var(--text-h1)]" data-split>
          Notes on building properly.
        </h1>
        <p className="lede mt-8" data-reveal>
          Thinking on design, performance, branding and strategy — written plainly, for
          business owners rather than other designers.
        </p>
      </section>

      <section className="container-tw pb-28 md:pb-40">
        <div className="border-b border-line-soft">
          {articles.map((a, i) => (
            <JournalCard key={a.slug} article={a} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
