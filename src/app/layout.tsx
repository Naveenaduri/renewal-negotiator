import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Aurora from "@/components/Aurora";
import Nav from "@/components/Nav";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Renewal Negotiator",
  description:
    "For small teams that auto-renew software they never review: forward a renewal, and two agents rehearse the negotiation with receipts.",
};
export const viewport: Viewport = { themeColor: "#0c1118" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}>
      <body className="min-h-screen">
        <Aurora />
        <Nav />
        {children}
      </body>
    </html>
  );
}
