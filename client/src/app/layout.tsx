import type { Metadata } from "next";
import { DM_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const siteUrl = "https://opsflow.aboutwenduo.wang";
const siteTitle = "OpsFlow | Full-Stack Field Service Operations Platform";
const siteDescription =
  "A full-stack SaaS demo built with Next.js, Express, Prisma, PostgreSQL, Docker, AWS, and AI-assisted dispatch planning.";
const socialImage = "/opsflow-logo-full.png";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | OpsFlow",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/opsflow-logo-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/opsflow-logo-icon.png", type: "image/png", sizes: "512x512" }],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "OpsFlow",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1420,
        height: 300,
        alt: "OpsFlow full-stack field service operations platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${dmMono.variable} bg-app text-[var(--color-text)] antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
