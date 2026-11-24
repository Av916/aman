"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { WebVitals } from "./web-vitals";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      nonce={nonce}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <WebVitals />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
