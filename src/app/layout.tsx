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

export const metadata: Metadata = {
  title: "PrediXI — Web3 Football Prediction Platform",
  description:
    "Predict football match outcomes, earn rewards, and compete on-chain. Built for Base App.",
  keywords: ["football", "prediction", "web3", "Base", "crypto", "blockchain", "earn"],

  // ── Open Graph ────────────────────────────────────────────────────────────
  // opengraph-image.tsx auto-generates the og:image tag.
  // Explicit metadata here covers title/description/siteName only.
  openGraph: {
    type:        "website",
    url:         "https://predixi-base.vercel.app",
    siteName:    "PrediXI",
    title:       "PrediXI — Web3 Football Prediction Platform",
    description: "Predict football match outcomes, earn XP, and compete on-chain. Built for Base App.",
  },

  // ── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    card:        "summary_large_image",
    site:        "@predixi_app",
    title:       "PrediXI — Web3 Football Prediction Platform",
    description: "Predict football match outcomes, earn XP, and compete on-chain. Built for Base App.",
  },

  // ── Base Mini App / Farcaster frame embed ────────────────────────────────
  // fc:frame embeds Mini App metadata for discovery via link unfurling in
  // Warpcast / Base App. Matches the frame config in /.well-known/farcaster.json.
  other: {
    "fc:frame": JSON.stringify({
      version:  'next',
      imageUrl: 'https://predixi-base.vercel.app/opengraph-image',
      button: {
        title:  'Play PrediXI',
        action: {
          type:                  'launch_frame',
          name:                  'PrediXI',
          url:                   'https://predixi-base.vercel.app',
          splashImageUrl:        'https://predixi-base.vercel.app/splash',
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
