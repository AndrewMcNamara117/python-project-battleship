export const site = {
  name: "Thomond Works",
  url: "https://thomondworks.ie",
  tagline: "Built in Limerick. Made for everywhere.",
  positioning: "Digital experiences, built properly.",
  description:
    "Thomond Works is an independent digital studio in Limerick, Ireland, creating distinctive brands, high-performance websites and digital experiences for ambitious businesses.",
  email: "hello@thomondworks.ie",
  location: "Limerick, Ireland",
  social: {
    instagram: "https://instagram.com/thomondworks",
    linkedin: "https://linkedin.com/company/thomondworks",
  },
} as const;

export const nav = [
  { label: "Work", href: "/work" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "Journal", href: "/journal" },
  { label: "Contact", href: "/contact" },
] as const;
