import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meal Plan",
  description: "Turn a grocery trip into a week of lunch and dinner.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meal Plan",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#005A54",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <div id="app-root" className="min-h-dvh">
          <OfflineBanner />
          <AppShell>{children}</AppShell>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
