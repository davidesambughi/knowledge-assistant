import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Font libero (Google Fonts) — non Google Sans, proprietario e non licenziabile.
// Variable "--font-sans" (non "--font-geist-sans"): app/globals.css §@theme inline mappa
// l'utility Tailwind font-sans su `var(--font-sans)`, quindi il nome deve combaciare
// esattamente per evitare un fallback silenzioso al sans-serif di sistema.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Knowledge Assistant",
  description: "Chatbot RAG sulla documentazione tecnica di Remote NIF.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Locale/messaggi risolti server-side da i18n/request.ts (cookie NEXT_LOCALE, no i18n routing).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        {/* Vercel Web Analytics: in produzione carica /_vercel/insights/script.js (stessa origine,
            compatibile con la CSP "script-src 'self'" di next.config.ts); in dev non traccia. */}
        <Analytics />
      </body>
    </html>
  );
}
