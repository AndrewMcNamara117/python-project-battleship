import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SURFACE } from '@/lib/tokens';
import './globals.css';

/**
 * Montserrat, self-hosted.
 *
 * One variable file covering weights 100–900, Latin subset, 37KB — smaller
 * than three static cuts and it gives us the full range. Served from our own
 * origin: no CDN, no runtime request to a third party, and an offline build
 * still works. `next/font/local` ships with Next, so this adds no dependency.
 */
const montserrat = localFont({
  src: './fonts/Montserrat-Variable-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-im-sans',
  // matched to Montserrat's metrics so the fallback swap causes no reflow
  adjustFontFallback: 'Arial',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://train.ironmiles.ie'),
  title: {
    default: 'Iron Miles Training — Forge One More',
    template: '%s · Iron Miles Training',
  },
  description:
    'Personalised endurance coaching. Built around your goal. Driven by one mindset: Forge One More.',
  applicationName: 'Iron Miles Training',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Iron Miles Training',
    title: 'Iron Miles Training — Forge One More',
    description:
      'Personalised endurance coaching. Built around your goal. Driven by one mindset: Forge One More.',
    url: 'https://train.ironmiles.ie',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: SURFACE.onyx,
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-dvh bg-onyx text-ink-body antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:bg-mint focus:px-4 focus:py-2 focus:text-[12px] focus:font-extrabold focus:uppercase focus:tracking-[0.18em] focus:text-mint-deep"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
