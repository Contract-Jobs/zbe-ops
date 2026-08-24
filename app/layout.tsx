import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  weight: ["400", "500", "600", "700"],
});

const ibm = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "ZBE Ops",
    template: "%s | ZBE Ops",
  },
  description: "Yard, site, and ledger for ZBE Power Engineering.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrument.variable} ${ibm.variable} h-full antialiased`}>
      <body className="min-h-full bg-white font-sans text-black">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
