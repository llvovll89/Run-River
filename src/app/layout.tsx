import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import PWAUpdateBanner from "@/components/PWAUpdateBanner";
import OfflineSyncBanner from "@/components/OfflineSyncBanner";
import AppRecovery from "@/components/AppRecovery";
import { UserProfileProvider } from "@/hooks/useUserProfile";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://run-river.vercel.app";

export const metadata: Metadata = {
  title: "Run River",
  description: "휴대폰만으로 바로 시작하는 목표형 러닝 트래커",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    siteName: "Run River",
    title: "Run River",
    description: "거리/시간/인터벌 목표로 바로 시작하는 러닝 트래커",
    url: "/",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Run River",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Run River",
    description: "휴대폰만으로 바로 시작하는 목표형 러닝 트래커",
    images: ["/icons/icon-512x512.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Run River",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)",  color: "#0c0c0e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex justify-center" style={{ background: "#000" }}>
        <div
          className="relative w-full max-w-[430px] min-h-dvh overflow-x-hidden"
          style={{ background: "var(--c-bg)" }}
        >
          <ThemeProvider>
            <AppRecovery />
            <UserProfileProvider>
              <OfflineSyncProvider>
                <PWAUpdateBanner />
                <OfflineSyncBanner />
                {children}
              </OfflineSyncProvider>
            </UserProfileProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
