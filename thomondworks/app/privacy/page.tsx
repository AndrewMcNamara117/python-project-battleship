import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy and cookies policy for the Thomond Works website.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <section className="container-tw pb-28 pt-40 md:pt-52">
      <p className="label label--bronze">Legal</p>
      <h1 className="display mt-8 text-[length:var(--text-h1)]">Privacy</h1>

      <div className="mt-14 max-w-3xl space-y-10 border-t border-line pt-12">
        <p className="text-sm leading-relaxed text-bronze-bright">
          This policy is a working template and will be reviewed before formal publication.
          Questions in the meantime: {site.email}.
        </p>

        <div>
          <h2 className="mb-4 font-serif text-2xl text-bone">What we collect</h2>
          <p className="leading-relaxed text-muted">
            When you contact us, we receive the details you choose to send — your name,
            email address and anything you write about your project. We use them to reply
            to you and for nothing else. We don&apos;t sell, rent or share your details
            with third parties for marketing.
          </p>
        </div>

        <div id="cookies" className="[scroll-margin-top:6rem]">
          <h2 className="mb-4 font-serif text-2xl text-bone">Cookies</h2>
          <p className="leading-relaxed text-muted">
            This website sets no advertising or tracking cookies. A single piece of session
            storage remembers whether you&apos;ve seen the opening animation, so it
            doesn&apos;t replay on every page. It contains nothing about you and disappears
            when you close the tab.
          </p>
        </div>

        <div>
          <h2 className="mb-4 font-serif text-2xl text-bone">Your rights</h2>
          <p className="leading-relaxed text-muted">
            Under GDPR you may ask what personal data we hold about you, ask us to correct
            it, or ask us to delete it. Email {site.email} and we&apos;ll handle it
            promptly.
          </p>
        </div>
      </div>
    </section>
  );
}
