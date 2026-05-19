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
  other: {
    "base:app_id": "69fc81c8bced645c370bd8fe",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
