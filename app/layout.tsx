import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniRank — Autonomous Search Console Intelligence Engine",
  description:
    "Self-driving SEO intelligence: isolate striking distance queries, reverse-engineer competitor gaps, and auto-deploy schema & E-E-A-T content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050810] text-slate-100 min-h-screen font-sans antialiased bg-cyber-grid">
        {children}
      </body>
    </html>
  );
}
