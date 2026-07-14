export interface Service {
  id: string;
  index: string;
  title: string;
  description: string;
  details: string[];
  /** Which abstract visual the showcase panel renders. */
  visual: "arches" | "mark" | "grid" | "pulse" | "keystone";
}

export const services: Service[] = [
  {
    id: "web-design-development",
    index: "01",
    title: "Web Design & Development",
    description:
      "Bespoke, high-performance websites designed to look exceptional, load fast, and turn attention into action.",
    details: [
      "UX and interface design",
      "Design systems",
      "Front-end development",
      "CMS integration",
      "Motion and interaction design",
      "Accessibility engineering",
    ],
    visual: "arches",
  },
  {
    id: "brand-identity",
    index: "02",
    title: "Brand Identity",
    description:
      "Distinctive visual identities built to give ambitious businesses clarity, recognition, and lasting presence.",
    details: [
      "Logo and mark design",
      "Visual identity systems",
      "Typography and colour",
      "Brand guidelines",
      "Applications and collateral",
    ],
    visual: "mark",
  },
  {
    id: "digital-strategy",
    index: "03",
    title: "Digital Strategy",
    description:
      "Clear digital thinking that aligns brand, content, UX, SEO, and technology around meaningful business goals.",
    details: [
      "Discovery and research",
      "Information architecture",
      "Content strategy",
      "Conversion planning",
      "Technology selection",
    ],
    visual: "grid",
  },
  {
    id: "seo-performance",
    index: "04",
    title: "SEO & Performance",
    description:
      "Technical optimisation, search visibility, speed improvements, and performance systems built for sustainable growth.",
    details: [
      "Technical SEO",
      "Core Web Vitals",
      "Structured data",
      "Local search",
      "Analytics and measurement",
    ],
    visual: "pulse",
  },
  {
    id: "website-care",
    index: "05",
    title: "Website Care",
    description:
      "Ongoing support, updates, security, performance monitoring, and maintenance — so what we build stays built properly.",
    details: [
      "Managed hosting guidance",
      "Security and updates",
      "Performance monitoring",
      "Content changes",
      "Quarterly reviews",
    ],
    visual: "keystone",
  },
];
