import type { Metadata } from "next";
import { ThemedClerkProvider } from "@/components/themed-clerk-provider";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Upload PDFs, text or web pages and get cited answers drawn only from your own documents, plus an honest \"I don't know\" when the answer isn't there.";

// Link previews need absolute URLs. Vercel sets the production hostname;
// locally this falls back to the dev server.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Recall · Ask your documents",
  description,
  openGraph: {
    title: "Recall · Ask your documents. Get answers you can check.",
    description,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

// Runs before first paint so the page never flashes the wrong theme. Reads the
// saved choice, falling back to the system preference; storage can throw in
// private windows, hence the try.
const themeScript = `
try {
  var t = localStorage.getItem('recall-theme');
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme script changes <html>'s class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemedClerkProvider>{children}</ThemedClerkProvider>
      </body>
    </html>
  );
}
