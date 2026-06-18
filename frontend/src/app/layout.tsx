import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "@/components/shared-components/sidebar/sidebar";
import ContentWrapper from "@/components/shared-components/sidebar/content-wrapper";
import { AskAiWidget } from "@/components/shared-components/ai/AskAiWidget";
import AnalyticsInit from "@/components/AnalyticsInit";
import { OnboardingManager } from "@/components/shared-components/OnboardingManager";
import { HeartbeatProvider } from "@/components/shared-components/HeartbeatProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "FMS",
  description: "Flow Management System",
  manifest: "/manifest.json?v=2",

  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/badge-72x72.png", sizes: "72x72", type: "image/png" },
    ],
    shortcut: "/icons/badge-72x72.png",
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FMS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
          <Script
            id="microsoft-clarity-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
              `,
            }}
          />
        )}
        <Providers>
          <AnalyticsInit />
          <OnboardingManager />
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <HeartbeatProvider />
          <ContentWrapper>
            <main className="min-h-screen">{children}</main>
          </ContentWrapper>
          <AskAiWidget />
        </Providers>
      </body>
    </html>
  );
}
