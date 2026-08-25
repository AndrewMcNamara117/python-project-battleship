import type { Metadata, Viewport } from 'next';
import './globals.css';

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
  themeColor: '#050505',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-iron text-white antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:bg-green focus:px-4 focus:py-2 focus:text-[12px] focus:font-extrabold focus:uppercase focus:tracking-[0.18em] focus:text-green-deep"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
