import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { siteConfig, generateStructuredData } from "@/config/seo";

// FinTech Typography Stack (Zerodha Kite & Institutional FinTech Standard)
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#07080c" },
  ],
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.creator,
  publisher: siteConfig.publisher,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteConfig.url,
    title: siteConfig.title,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    creator: "@arthaX",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: {
    google: "google464ae241c4013b59",
  },
  category: "finance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ytqqzeemkzhifbtthanh.supabase.co"}
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ytqqzeemkzhifbtthanh.supabase.co"}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateStructuredData()),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('arthax_theme') || 'dark';
                if (t !== 'light' && t !== 'dark') t = 'dark';
                document.documentElement.setAttribute('data-theme', t);
                document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark';
                if (t === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.remove('light');
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${inter.variable} min-h-screen antialiased`}
        style={{
          backgroundColor: "var(--app-bg)",
          color: "var(--app-fg)",
          fontFamily: "var(--font-plus-jakarta), var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "--font-mono": "var(--font-inter)",
        } as React.CSSProperties}
      >
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
