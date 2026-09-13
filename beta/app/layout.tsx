import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HyperGreen — Sustainability intelligence",
  description: "Explore company sustainability, inspect the evidence, and build a net-zero portfolio.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><a href="#main-content" className="skip-link">Skip to research workspace</a>{children}</body>
    </html>
  );
}
