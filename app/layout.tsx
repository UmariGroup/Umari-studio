import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/landing/Footer';
import ToastProvider from '../components/ToastProvider';
import { LanguageProvider } from '../lib/LanguageContext';

function getBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return (envUrl ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: 'Umari AI - AI kontent platformasi',
    template: '%s | Umari AI',
  },
  description: 'Professional AI yordamida kontent yaratish platformasi',
  applicationName: 'Umari AI',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    url: '/',
    siteName: 'Umari AI',
    title: 'Umari AI - AI kontent platformasi',
    description: 'Professional AI yordamida kontent yaratish platformasi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Umari AI - AI kontent platformasi',
    description: 'Professional AI yordamida kontent yaratish platformasi',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = headers();
  const headerLang = headerList.get('x-language');
  const lang = headerLang === 'ru' || headerLang === 'uz' ? headerLang : 'uz';

  const baseUrl = getBaseUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: 'Umari AI',
        url: baseUrl,
        logo: `${baseUrl}/favicon.ico`,
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: 'Umari AI',
        publisher: { '@id': `${baseUrl}/#organization` },
        inLanguage: lang,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${baseUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html lang={lang}>
      <body>
        <LanguageProvider>
          <ToastProvider>
            <script
              type="application/ld+json"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
