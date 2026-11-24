import { headers } from "next/headers";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const manrope = localFont({
  src: "./fonts/manrope.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PitchMate | Your Game. Your Pitch.",
    template: "%s | PitchMate",
  },
  description:
    "PitchMate brings cricket players and turf owners together. Register as a player or get your facility ready to list.",
  icons: { icon: "/logo/mark.svg", apple: "/logo/icon-192.png" },
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce =
    process.env.CSP_MODE === "enforce"
      ? ((await headers()).get("x-csp-nonce") ?? undefined)
      : undefined;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable}`}
    >
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-accent p-3 font-bold text-forest focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
