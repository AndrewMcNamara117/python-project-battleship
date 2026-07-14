import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for the Thomond Works website.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <section className="container-tw pb-28 pt-40 md:pt-52">
      <p className="label label--bronze">Legal</p>
      <h1 className="display mt-8 text-[length:var(--text-h1)]">Terms</h1>

      <div className="mt-14 max-w-3xl space-y-10 border-t border-line pt-12">
        <p className="text-sm leading-relaxed text-bronze-bright">
          These terms are a working template and will be reviewed before formal
          publication. Questions in the meantime: {site.email}.
        </p>

        <div>
          <h2 className="mb-4 font-serif text-2xl text-bone">Use of this website</h2>
          <p className="leading-relaxed text-muted">
            This website exists to describe the work of Thomond Works and to let you get in
            touch. The content is provided in good faith for general information; it
            isn&apos;t professional advice for any specific situation.
          </p>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-2xl text-bone">Intellectual property</h2>
          <p className="leading-relaxed text-muted">
            The Thomond Works name, bridge mark and the design of this website belong to
            Thomond Works. Case-study material relating to client work remains the property
            of the respective clients and is shown with permission. Concept studies are
            self-initiated and labelled as such.
          </p>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-2xl text-bone">Engagements</h2>
          <p className="leading-relaxed text-muted">
            Client projects are governed by a written proposal and agreement issued per
            engagement — scope, fees, timelines and ownership are defined there, not on
            this page.
          </p>
        </div>
      </div>
    </section>
  );
}
