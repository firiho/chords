import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import Intro from "@/components/intro/intro";
import { BackgroundPadHost } from "@/components/audio/background-pad-host";
// @ts-ignore: allow side-effect CSS import without module declarations
import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono"
});


export const metadata: Metadata = {
  title: "Chords",
  description: "A modern browser MIDI runner game where chord recognition clears obstacles.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-384x384.png", type: "image/png", sizes: "384x384" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"]
  },
  manifest: undefined
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>
        <Intro />
        <BackgroundPadHost />
        {children}
      </body>
    </html>
  );
}
