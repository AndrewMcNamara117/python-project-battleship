import type { Metadata, Viewport } from "next";
import { Archivo, Fraunces } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MotionProvider from "@/components/MotionProvider";
import CustomCursor from "@/components/CustomCursor";
import ScrollProgress from "@/components/ScrollProgress";
import IntroLoader from "@/components/IntroLoader";
import JsonLd from "@/components/JsonLd";
import { site } from "@/lib/site";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Thomond Works — Web Design & Branding Studio, Limerick",
    template: "%s — Thomond Works",
  },
  description: site.description,
  keywords: [
    "web design Limerick",
    "website design Limerick",
    "branding Limerick",
    "digital agency Limerick",
    "web development Limerick",
    "Irish web design studio",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IE",
    url: site.url,
    siteName: site.name,
    title: "Thomond Works — Digital experiences, built properly.",
    description: site.description,
    images: [{ url: "/images/og.jpg", width: 1200, height: 630, alt: "Thomond Works — Built in Limerick. Made for everywhere." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thomond Works — Digital experiences, built properly.",
    description: site.description,
    images: ["/images/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0d0f10",
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint: decides whether the intro plays this session
 * and whether motion is enabled at all (prefers-reduced-motion).
 */
const gateScript = `(function(){try{var d=document.documentElement;var m=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!m){d.classList.add('tw-motion')}var seen=false;try{seen=!!sessionStorage.getItem('tw-intro')}catch(e){}d.dataset.intro=(!m&&!seen)?'pending':'done';}catch(e){document.documentElement.dataset.intro='done';}})();`;

const orgSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#org`,
      name: site.name,
      url: site.url,
      email: site.email,
      slogan: site.tagline,
      description: site.description,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Limerick",
        addressCountry: "IE",
      },
      sameAs: [site.social.instagram, site.social.linkedin],
    },
    {
      "@type": "ProfessionalService",
      "@id": `${site.url}/#business`,
      name: site.name,
      url: site.url,
      email: site.email,
      priceRange: "€€",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Limerick",
        addressCountry: "IE",
      },
      areaServed: "Ireland",
      parentOrganization: { "@id": `${site.url}/#org` },
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      publisher: { "@id": `${site.url}/#org` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE" className={`${archivo.variable} ${fraunces.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: gateScript }} />
        <noscript>
          <style>{`#tw-intro{display:none}`}</style>
        </noscript>
        <JsonLd data={orgSchema} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <IntroLoader />
        <MotionProvider />
        <ScrollProgress />
        <CustomCursor />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
