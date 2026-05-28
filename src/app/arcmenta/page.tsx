import type { Metadata } from "next";
import { ArcHomePage } from "@/components/arcmenta/ArcHomePage";

export const metadata: Metadata = {
  title: "ArcMenta — Neural Prediction Markets",
  description: "AI-driven prediction intelligence. On-chain.",
};

export default function ArcmentaPage() {
  return <ArcHomePage />;
}
