import type { Metadata } from 'next';
import Link from 'next/link';

import PwaBootstrap from '@/components/PwaBootstrap';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: 'Recall',
  description: 'Spaced repetition app for open-ended responses',
  manifest: `${basePath}/manifest.webmanifest`,
  themeColor: '#0C0C0F',
  icons: {
    icon: [
      {
        url: `${basePath}/icons/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: `${basePath}/icons/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: `${basePath}/icons/apple-touch-icon-180.png`,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Recall',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link href="/" className="app-title">
            Recall
          </Link>
          <nav className="app-nav">
            <Link href="/" className="nav-link">Dashboard</Link>
            <Link href="/decks" className="nav-link">Decks</Link>
            <Link href="/review" className="nav-link">Review</Link>
          </nav>
          <div className="header-end">
            <ThemeToggle />
          </div>
        </header>
        <PwaBootstrap />
        {children}
      </body>
    </html>
  );
}
