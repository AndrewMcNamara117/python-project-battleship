import type { MetadataRoute } from "next";
import { projects } from "@/lib/projects";
import { articles } from "@/lib/journal";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const statics = ["", "/work", "/services", "/about", "/journal", "/contact", "/privacy", "/terms"].map(
    (path) => ({
      url: `${site.url}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );

  const work = projects.map((p) => ({
    url: `${site.url}/work/${p.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const journal = articles.map((a) => ({
    url: `${site.url}/journal/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...statics, ...work, ...journal];
}
