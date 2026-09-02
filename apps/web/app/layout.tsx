import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fonts } from "@/ui/Fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Walkspot", template: "%s · Walkspot" },
  description: "Challenges, proof photos, points. Walk it.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#1F5F5B", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Fonts />
        {children}
      </body>
    </html>
  );
}
