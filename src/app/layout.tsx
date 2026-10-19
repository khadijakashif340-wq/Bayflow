import type { Metadata } from 'next';
import { Bricolage_Grotesque, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BayFlow | Auto Repair Shop Operating System',
  description: 'Multi-tenant auto repair shop management platform with deterministic state machine, live tracking, and POS dashboards.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-brand-bg text-brand-text selection:bg-brand-primary/20 selection:text-brand-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
