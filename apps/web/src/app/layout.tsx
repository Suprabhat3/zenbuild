import type { Metadata } from "next";
import { Instrument_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import "@/styles/landing.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-src",
  display: "swap",
});

const body = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZenBuild — Ship features calmly, from request to release",
  description:
    "ZenBuild is the AI-assisted product delivery platform that moves features from idea to production through a structured workflow: Request → PRD → Tasks → Code → AI Review → Human Approval → Ship.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
