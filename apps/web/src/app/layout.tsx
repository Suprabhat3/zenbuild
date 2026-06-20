import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShipFlow AI",
  description:
    "AI-assisted product delivery platform: from feature request to shipped, through PRDs, tasks, code, AI review, and human approval.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
