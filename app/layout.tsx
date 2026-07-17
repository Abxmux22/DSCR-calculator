import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSCR Real Estate Investment Analyzer",
  description: "Professional DSCR and investor return analysis for real estate opportunities."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}