import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${sora.variable} ${manrope.variable} h-full antialiased`}>
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
