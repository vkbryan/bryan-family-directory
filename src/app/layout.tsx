import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { FamilyBanner } from "@/components/family-banner";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bryan Family Directory",
  description: "A private directory for the Bryan family.",
  // Link previews need full addresses for their picture.
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  openGraph: { siteName: "The Bryan Family", title: "The Bryan Family Directory", description: "A private directory for the Bryan family." },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <FamilyBanner />
        <Suspense fallback={null}>
          <SiteNav />
        </Suspense>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-center text-sm text-muted">
          © 2026 Bryan Family Directory · Made by VeeKayBee
        </footer>
      </body>
    </html>
  );
}
