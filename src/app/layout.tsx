import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSL Certificate Monitor",
  description: "Check SSL certificate status and expiration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
