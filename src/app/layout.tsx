import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://predixi.xyz'

export const metadata: Metadata = {
  title: "PrediXI — Web3 Football Prediction Platform",
  description:
    "Predict football match outcomes, track your accuracy on-chain, and climb the leaderboard. Built on Base.",
  keywords: ["football", "prediction", "web3", "Base", "onchain", "blockchain"],

  // ── Open Graph ────────────────────────────────────────────────────────────
  openGraph: {
    type:        "website",
    url:         SITE_URL,
    siteName:    "PrediXI",
    title:       "PrediXI — Web3 Football Prediction Platform",
    description: "Predict football match outcomes, track your accuracy on-chain, and climb the leaderboard. Built on Base.",
  },

  // ── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    card:        "summary_large_image",
    site:        "@predixi_app",
    title:       "PrediXI — Web3 Football Prediction Platform",
    description: "Predict football match outcomes, track your accuracy on-chain, and climb the leaderboard. Built on Base.",
  },

  // ── Base Mini App / Farcaster frame embed ────────────────────────────────
  other: {
    "fc:frame": JSON.stringify({
      version:  'next',
      imageUrl: `${SITE_URL}/opengraph-image`,
      button: {
        title:  'Play PrediXI',
        action: {
          type:                  'launch_frame',
          name:                  'PrediXI',
          url:                   SITE_URL,
          splashImageUrl:        `${SITE_URL}/splash`,
          splashBackgroundColor: '#07080F',
        },
      },
    }),

    // ── Base App ────────────────────────────────────────────────────────────
    "base:app_id":                   "69fc81c8bced645c370bd8fe",
    "mobile-web-app-capable":        "yes",
    "apple-mobile-web-app-capable":  "yes",
    "apple-mobile-web-app-title":    "PrediXI",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "format-detection":              "telephone=no",
  },
};

export const viewport: Viewport = {
  themeColor:    "#07080F",
  width:         "device-width",
  initialScale:  1,
  maximumScale:  1,
  userScalable:  false,
  // viewportFit=cover is required for safe-area-inset-* to work on iPhone
  // notch + in Base App / Coinbase Wallet embedded webview environments.
  viewportFit:   "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-bg font-sans text-text-primary antialiased overflow-x-hidden">
        <Providers>
          <PageWrapper>
            {children}
          </PageWrapper>
        </Providers>
      </body>
    </html>
  );
}
