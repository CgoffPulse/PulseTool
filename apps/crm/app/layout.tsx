import type { Metadata } from 'next';
import { JetBrains_Mono, Montserrat, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Shell } from '@/components/shell';

const body = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});
const display = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Pulse CRM — Where new clients come from',
  description:
    'Pipeline, leads, follow-ups and the bridge from prospect to onboarded client. Sister tool to Pulse Social and Pulse Dev.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-cream-lt font-body text-charcoal antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
