"use client";

import { useState } from "react";
import { site } from "@/lib/site";

const projectTypes = [
  "New website",
  "Website redesign",
  "Brand identity",
  "Brand + website",
  "SEO / performance",
  "Ongoing care",
  "Something else",
];

const budgets = ["Under €2,000", "€2,000–€5,000", "€5,000–€10,000", "€10,000+"];
const timelines = ["As soon as possible", "1–3 months", "3–6 months", "Flexible"];

const inputCls =
  "w-full border-b border-line bg-transparent py-3.5 text-bone placeholder:text-muted/60 transition-colors duration-300 focus:border-emerald-bright focus:outline-none";

interface FormState {
  name: string;
  email: string;
  company: string;
  website: string;
  projectType: string;
  budget: string;
  timeline: string;
  description: string;
}

const empty: FormState = {
  name: "",
  email: "",
  company: "",
  website: "",
  projectType: projectTypes[0],
  budget: "",
  timeline: timelines[1],
  description: "",
};

/**
 * Premium inquiry form. There's no server yet, so submission composes
 * a structured email to the studio inbox — honest, and it works on a
 * fully static deployment. Swap handleSubmit for a POST when a form
 * endpoint exists.
 */
export default function ContactForm() {
  const [form, setForm] = useState<FormState>(empty);
  const [sent, setSent] = useState(false);

  const set =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `Project inquiry — ${form.name}${form.company ? `, ${form.company}` : ""}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      form.company && `Company: ${form.company}`,
      form.website && `Website: ${form.website}`,
      `Project type: ${form.projectType}`,
      form.budget && `Budget: ${form.budget}`,
      `Timeline: ${form.timeline}`,
      "",
      form.description,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  if (sent) {
    return (
      <div className="border border-line-soft bg-surface p-10 md:p-14" role="status">
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke="var(--color-emerald)"
            strokeWidth="2"
            pathLength="1"
            className="[stroke-dasharray:1] [stroke-dashoffset:1] [animation:tw-check-draw_.8s_var(--ease-smooth)_forwards]"
          />
          <path
            d="M20 33 l8 8 l16 -18"
            fill="none"
            stroke="var(--color-emerald-bright)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            className="[stroke-dasharray:1] [stroke-dashoffset:1] [animation:tw-check-draw_.6s_.5s_var(--ease-smooth)_forwards]"
          />
        </svg>
        <h2 className="mt-8 font-serif text-3xl text-bone">Nearly there.</h2>
        <p className="mt-4 max-w-[48ch] leading-relaxed text-muted">
          Your email client should have opened with everything filled in — just press send.
          If it didn&apos;t, write to{" "}
          <a href={`mailto:${site.email}`} className="link-line text-bone">
            {site.email}
          </a>{" "}
          and we&apos;ll reply within two working days.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="link-line label mt-8 cursor-pointer hover:text-bone"
        >
          ← Back to the form
        </button>
        <style>{`@keyframes tw-check-draw { to { stroke-dashoffset: 0; } }`}</style>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
        <div data-reveal>
          <label htmlFor="cf-name" className="label mb-2 block">
            Name *
          </label>
          <input
            id="cf-name"
            required
            autoComplete="name"
            value={form.name}
            onChange={set("name")}
            className={inputCls}
            placeholder="Your name"
          />
        </div>
        <div data-reveal>
          <label htmlFor="cf-email" className="label mb-2 block">
            Email *
          </label>
          <input
            id="cf-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className={inputCls}
            placeholder="you@company.ie"
          />
        </div>
        <div data-reveal>
          <label htmlFor="cf-company" className="label mb-2 block">
            Company
          </label>
          <input
            id="cf-company"
            autoComplete="organization"
            value={form.company}
            onChange={set("company")}
            className={inputCls}
            placeholder="Company name"
          />
        </div>
        <div data-reveal>
          <label htmlFor="cf-website" className="label mb-2 block">
            Current website
          </label>
          <input
            id="cf-website"
            type="url"
            value={form.website}
            onChange={set("website")}
            className={inputCls}
            placeholder="https://"
          />
        </div>
        <div data-reveal>
          <label htmlFor="cf-type" className="label mb-2 block">
            Project type
          </label>
          <select id="cf-type" value={form.projectType} onChange={set("projectType")} className={inputCls}>
            {projectTypes.map((t) => (
              <option key={t} value={t} className="bg-surface">
                {t}
              </option>
            ))}
          </select>
        </div>
        <div data-reveal>
          <label htmlFor="cf-timeline" className="label mb-2 block">
            Timeline
          </label>
          <select id="cf-timeline" value={form.timeline} onChange={set("timeline")} className={inputCls}>
            {timelines.map((t) => (
              <option key={t} value={t} className="bg-surface">
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset data-reveal>
        <legend className="label mb-4">Estimated budget</legend>
        <div className="flex flex-wrap gap-3">
          {budgets.map((b) => (
            <label
              key={b}
              className={`cursor-pointer border px-5 py-2.5 text-xs tracking-[0.12em] uppercase transition-colors duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-emerald-bright ${
                form.budget === b
                  ? "border-emerald bg-emerald/10 text-bone"
                  : "border-line text-muted hover:border-bone/40 hover:text-bone"
              }`}
            >
              <input
                type="radio"
                name="budget"
                value={b}
                checked={form.budget === b}
                onChange={set("budget")}
                className="sr-only"
              />
              {b}
            </label>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          A budget range helps us give you a straight answer about what&apos;s achievable.
          We take on a limited number of projects and will always tell you honestly if
          we&apos;re not the right fit.
        </p>
      </fieldset>

      <div data-reveal>
        <label htmlFor="cf-desc" className="label mb-2 block">
          Tell us about the project *
        </label>
        <textarea
          id="cf-desc"
          required
          rows={5}
          value={form.description}
          onChange={set("description")}
          className={`${inputCls} resize-y`}
          placeholder="What are you building, who is it for, and what should it achieve?"
        />
      </div>

      <div data-reveal className="flex flex-wrap items-center gap-6">
        <button type="submit" className="btn btn--primary cursor-pointer" data-magnetic>
          Send Inquiry
          <span className="btn-arrow" aria-hidden>
            →
          </span>
        </button>
        <p className="text-xs text-muted">
          Prefer email?{" "}
          <a href={`mailto:${site.email}`} className="link-line text-bone">
            {site.email}
          </a>
        </p>
      </div>
    </form>
  );
}
